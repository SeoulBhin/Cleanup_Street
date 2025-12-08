// backend/routes/posts.js
const express = require("express");
const router = express.Router();
const db = require("../db");              // pg 래퍼 (db.query)
const fetch = require("node-fetch");
const h3 = require("h3-js");
const path = require("path");
const fs = require("fs").promises;

// 로컬 uploads 경로 (server.js와 동일하게 계산)
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

function guessMime(src) {
  const lower = (src || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

// /uploads/xxx.jpg 같은 로컬 경로를 실제 파일 경로로 변환
function resolveLocalPath(src) {
  if (!src || typeof src !== "string") return null;
  if (src.startsWith("/uploads/")) {
    const filename = path.basename(src.split("?")[0]);
    return path.join(UPLOAD_DIR, filename);
  }
  // 상대 경로로 들어온 경우도 방어적으로 처리
  if (!src.startsWith("http") && !path.isAbsolute(src)) {
    const filename = path.basename(src.split("?")[0]);
    return path.join(UPLOAD_DIR, filename);
  }
  if (path.isAbsolute(src)) return src;
  return null;
}

async function toDataUri(src) {
  if (!src || typeof src !== "string") return src;
  if (src.startsWith("data:")) return src; // 이미 base64
  const mime = guessMime(src);

  // 1) 로컬 파일 시도
  const local = resolveLocalPath(src);
  if (local) {
    try {
      const buf = await fs.readFile(local);
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch (err) {
      console.warn("[toDataUri] local read failed:", local, err?.message);
    }
  }

  // 2) 원격 URL 시도
  if (src.startsWith("http")) {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`http ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const ct = res.headers.get("content-type") || mime;
      return `data:${ct};base64,${buf.toString("base64")}`;
    } catch (err) {
      console.warn("[toDataUri] remote fetch failed:", src, err?.message);
    }
  }

  // 실패하면 원본 문자열 반환
  return src;
}

// ================== 공통 SELECT ==================
const BASE_SELECT = `
  SELECT
    p.post_id,
    p.user_id,
    p.title,
    p.content,
    p.category,
    p.status,
    p.comment_count,
    p.h3_index::text AS h3_index,
    p.latitude,
    p.longitude,
    p.created_at,
    p.updated_at,
    ST_AsText(p.location) AS location_wkt,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'imageId',  pi.image_id,
            'variant',  pi.variant,
            'imageUrl', pi.image_url,
            'createdAt',pi.created_at
          )
          ORDER BY pi.image_id
        )
        FROM post_images pi
        WHERE pi.post_id = p.post_id
      ),
      '[]'::json
    ) AS images
  FROM posts p
`;

// 단일 게시글 조회 함수
async function fetchPostById(postId) {
  const query = `${BASE_SELECT} WHERE p.post_id = $1`;
  const { rows } = await db.query(query, [postId]);
  return rows[0] || null;
}


async function geocodeNaver(address) {
  if (!address || !address.trim()) return null;

  const url =
    "https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=" +
    encodeURIComponent(address.trim());

  try {
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID_Map,
        "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET_Map,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      console.error("[GEOCODE] naver status:", res.status);
      const text = await res.text().catch(() => "");
      console.error("[GEOCODE] naver body:", text);
      return null;
    }

    const data = await res.json();
    if (!data.addresses || data.addresses.length === 0) return null;

    const a = data.addresses[0];
    const lat = Number(a.y);
    const lng = Number(a.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      roadAddress: a.roadAddress || a.jibunAddress || address,
    };
  } catch (err) {
    console.error("[GEOCODE] naver error:", err.message || err);
    return null;
  }
}

// ================== 목록 / 상세 ==================

// GET posts list
router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    const query = `${BASE_SELECT} ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`;
    const { rows } = await db.query(query, [limit, offset]);
    res.json(rows);
  } catch (err) {
    console.error("Failed to fetch posts:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// GET a single post by ID
router.get("/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const post = await fetchPostById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (err) {
    console.error("Failed to fetch post detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== 새 글 작성 (주소 + 지도/H3 포함) ==================

router.post("/", async (req, res) => {
  // JWT 안 쓰는 모자이크 파이프라인이라 일단 기본값 1
  const userId = req.body.userId || 1;

  const {
    title,
    postBody,
    category,
    latitude,
    longitude,
    h3Index,
    previewId,
    address, // 🔥 프론트에서 온 도로명 주소(카카오/네이버 검색 값)
    attachments = [], // 원본/추가 이미지 URL 배열
  } = req.body;

  if (!title || !postBody || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1) 기본값: 프론트에서 이미 줬다면 그 값 사용
    let lat = latitude;
    let lng = longitude;
    let h3Idx = h3Index;

    // 2) 프론트에서 좌표는 안 주고, 주소만 있을 때 → 네이버 호출
    if ((!lat || !lng) && address && address.trim()) {
      const geo = await geocodeNaver(address);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        // H3 인덱스가 아직 없다면 여기서 계산
        if (!h3Idx && lat && lng) {
          h3Idx = h3.latLngToCell(lat, lng, 8);
        }
      } else {
        console.warn("[POSTS] geocode failed for address:", address);
      }
    }

    // 숫자 형 변환(혹시 문자열로 왔을 경우 대비)
    if (lat !== null && lat !== undefined) lat = Number(lat);
    if (lng !== null && lng !== undefined) lng = Number(lng);

    // 3) location (geometry) 생성
    const location =
      lat && lng ? `SRID=4326;POINT(${lng} ${lat})` : null;

    // === 모자이크 미리보기 이미지 로드(있을 때만) ===
    let previewData = null;
    if (previewId) {
      const previewResult = await db.query(
        "SELECT auto_mosaic_image, plate_visible_image FROM image_previews WHERE preview_id = $1",
        [previewId]
      );
      if (previewResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid previewId provided." });
      }
      previewData = previewResult.rows[0];
    }

    // 4) posts INSERT (latitude / longitude / h3_index / location 포함)
    const insertQuery = `
      INSERT INTO posts (
        user_id,
        title,
        content,
        category,
        location,
        h3_index,
        status,
        latitude,
        longitude,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING post_id;
    `;
    const status = "DONE";
    const insertValues = [
      userId,
      title,
      postBody,
      category,
      location,
      h3Idx,
      status,
      lat,
      lng,
    ];

    const { rows } = await db.query(insertQuery, insertValues);
    const newPostId = rows[0].post_id;

    // 5) post_images 에 선택된 이미지 저장 (있을 때만)
    if (previewData) {
      const selectedVariant =
        req.body.selectedVariant === "PLATE_VISIBLE"
          ? "PLATE_VISIBLE"
          : "AUTO";
      const rawImage =
        selectedVariant === "PLATE_VISIBLE"
          ? previewData.plate_visible_image
          : previewData.auto_mosaic_image;
      const selectedImage = await toDataUri(rawImage);

      const imageInsertQuery = `
        INSERT INTO post_images (post_id, image_url, variant)
        VALUES ($1, $2, $3);
      `;
      await db.query(imageInsertQuery, [
        newPostId,
        selectedImage,
        selectedVariant,
      ]);
      await db.query(
        "UPDATE image_previews SET is_used = true WHERE preview_id = $1",
        [previewId]
      );
    }

    // 5-1) 추가 첨부(원본)도 post_images에 저장
    if (Array.isArray(attachments) && attachments.length > 0) {
      const converted = await Promise.all(
        attachments.map((url) => toDataUri(url))
      );
      const params = [newPostId];
      const values = converted.map((dataUri, idx) => {
        params.push(dataUri);
        return `($1, $${idx + 2}, 'ORIGINAL')`;
      });
      await db.query(
        `
        INSERT INTO post_images (post_id, image_url, variant)
        VALUES ${values.join(",")}
        `,
        params
      );
    }

    // 6) 방금 저장한 게시글 다시 조회해서 반환
    const createdPost = await fetchPostById(newPostId);
    res.status(201).json(createdPost);
  } catch (err) {
    console.error("Failed to create post", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// ================== 글 수정 (주소 + 지도/H3 포함) ==================

router.put("/:postId", async (req, res) => {
  const { postId } = req.params;

  const {
    title,
    postBody,
    category,
    latitude,
    longitude,
    h3Index,
    previewId,     // 수정하면서 새 미리보기 선택했을 때만 들어옴
    address,       // 수정 시에도 주소 문자열
    attachments = [],
  } = req.body;

  if (!title || !postBody || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    let lat = latitude;
    let lng = longitude;
    let h3Idx = h3Index;

    // 주소만 있고 좌표 없으면 네이버 호출
    if ((!lat || !lng) && address && address.trim()) {
      const geo = await geocodeNaver(address);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        if (!h3Idx && lat && lng) {
          h3Idx = h3.latLngToCell(lat, lng, 8); 
        }
      } else {
        console.warn("[POSTS][UPDATE] geocode failed for address:", address);
      }
    }

    if (lat !== null && lat !== undefined) lat = Number(lat);
    if (lng !== null && lng !== undefined) lng = Number(lng);

    console.log("[POSTS] final coords:", { lat, lng, h3Idx, address });
    
    const location =
      lat && lng ? `SRID=4326;POINT(${lng} ${lat})` : null;

    // posts UPDATE
    const updateQuery = `
      UPDATE posts
      SET
        title      = $2,
        content    = $3,
        category   = $4,
        location   = $5,
        h3_index   = $6,
        latitude   = $7,
        longitude  = $8,
        updated_at = NOW()
      WHERE post_id = $1
      RETURNING post_id;
    `;
    const updateValues = [
      postId,
      title,
      postBody,
      category,
      location,
      h3Idx,
      lat,
      lng,
    ];
    

    const { rows } = await db.query(updateQuery, updateValues);
    if (!rows.length) {
      return res.status(404).json({ error: "Post not found" });
    }

    // 새 previewId가 온 경우에만 이미지 추가 (필요시 기존 이미지 삭제 로직 추가 가능)
    if (previewId) {
      const previewResult = await db.query(
        "SELECT auto_mosaic_image, plate_visible_image FROM image_previews WHERE preview_id = $1",
        [previewId]
      );
      if (previewResult.rows.length) {
        const previewData = previewResult.rows[0];
        const selectedVariant =
          req.body.selectedVariant === "PLATE_VISIBLE"
            ? "PLATE_VISIBLE"
            : "AUTO";
        const rawImage =
          selectedVariant === "PLATE_VISIBLE"
            ? previewData.plate_visible_image
            : previewData.auto_mosaic_image;
        const selectedImage = await toDataUri(rawImage);

        await db.query(
          `
          INSERT INTO post_images (post_id, image_url, variant)
          VALUES ($1, $2, $3);
        `,
          [postId, selectedImage, selectedVariant]
        );
        await db.query(
          "UPDATE image_previews SET is_used = true WHERE preview_id = $1",
          [previewId]
        );
      }
    }

    // 첨부 배열이 오면 ORIGINAL로 추가 저장 (덮어쓰지 않고 append)
    if (Array.isArray(attachments) && attachments.length > 0) {
      const converted = await Promise.all(
        attachments.map((url) => toDataUri(url))
      );
      const params = [postId];
      const values = converted.map((dataUri, idx) => {
        params.push(dataUri);
        return `($1, $${idx + 2}, 'ORIGINAL')`;
      });
      await db.query(
        `
        INSERT INTO post_images (post_id, image_url, variant)
        VALUES ${values.join(",")}
        `,
        params
      );
    }

    const updatedPost = await fetchPostById(postId);
    res.json(updatedPost);
  } catch (err) {
    console.error("Failed to update post", err);
    res.status(500).json({ error: "Failed to update post" });
  }
});

module.exports = router;
