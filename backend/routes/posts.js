// backend/routes/posts.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // pg 래퍼 (db.query)
const h3 = require("h3-js");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const { requirePostOwner } = require("../middleware/onlyOwner");

// =========================
// fetchCompat (node-fetch require 제거: Node18+ global fetch 우선)
// =========================
async function fetchCompat(url, options) {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch(url, options);
  }
  const mod = await import("node-fetch");
  const f = mod.default || mod;
  return f(url, options);
}

// =========================
// KoBERT 호출 (자동 분류)
// =========================
const KOBERT_URL = process.env.KOBERT_URL; // 예: http://127.0.0.1:7014/predict
const KOBERT_ENABLED = !!process.env.KOBERT_URL;

const ALLOWED_CATEGORIES = new Set([
  "도로-교통",
  "시설물-건축",
  "치안-범죄위험",
  "자연재난-환경",
  "위생-보건",
  "기타",
  "스팸",
]);

function normalizeCategory(raw) {
  if (!raw || typeof raw !== "string") return null;

  let s = raw.trim();
  s = s.replace(/\s+/g, "");
  s = s.replace(/[·ㆍ]/g, "-");
  s = s.replace(/_/g, "-");

  if (s === "자연-재난환경") s = "자연재난-환경";
  if (s === "자연재난환경") s = "자연재난-환경";

  return s;
}

async function classifyByKoBERT(text) {
  if (!KOBERT_ENABLED) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);

  try {
    const res = await fetchCompat(KOBERT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ac.signal,
    });

    if (!res.ok) throw new Error(`KoBERT ${res.status}`);

    const data = await res.json();

    const picked =
      data?.category ||
      data?.label ||
      data?.result?.category ||
      data?.result?.label ||
      null;

    const norm = normalizeCategory(picked);
    if (!norm) return null;

    return ALLOWED_CATEGORIES.has(norm) ? norm : null;
  } catch (e) {
    console.warn("[KoBERT] classify failed:", e?.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// =========================
// uploads helpers
// =========================
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

function resolveUploadPath(url) {
  if (!url || typeof url !== "string") return null;
  const uploadsIdx = url.indexOf("/uploads/");
  if (uploadsIdx === -1) return null;
  const filename = url.slice(uploadsIdx + "/uploads/".length).split(/[?#]/)[0];
  if (!filename) return null;
  return path.join(UPLOAD_DIR, filename);
}

// 선택된 이미지 URL을 현재 업로드 디렉터리에 복사/저장 후 새 공개 URL 반환
async function persistImageToUploads(selectedImageUrl, req, variant = "AUTO") {
  if (!selectedImageUrl) return null;
  try {
    let buf;
    let ext = ".jpg";

    if (selectedImageUrl.startsWith("data:")) {
      const match = selectedImageUrl.match(/^data:(.*?);base64,(.*)$/);
      if (!match) throw new Error("Invalid data URI");
      const [, meta, b64] = match;
      const ct = meta || "";
      if (ct.includes("png")) ext = ".png";
      else if (ct.includes("webp")) ext = ".webp";
      else if (ct.includes("gif")) ext = ".gif";
      buf = Buffer.from(b64, "base64");
    } else {
      const res = await fetchCompat(selectedImageUrl);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("png")) ext = ".png";
      else if (ct.includes("webp")) ext = ".webp";
      else if (ct.includes("gif")) ext = ".gif";
      buf = Buffer.from(await res.arrayBuffer());
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${variant.toLowerCase()}-${crypto
      .randomBytes(8)
      .toString("hex")}${ext}`;
    const dest = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(dest, buf);

    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const base = `${proto}://${host}`;
    return `${base}/uploads/${filename}`;
  } catch (err) {
    console.warn("[persistImageToUploads] failed", err.message || err);
    return selectedImageUrl; // 실패 시 기존 URL 그대로 사용
  }
}

async function deleteLocalUpload(url) {
  const filePath = resolveUploadPath(url);
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
    console.log("[uploads] removed", filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("[uploads] delete failed", filePath, err.message);
    }
  }
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
    p.address,
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

function normalizeAddress(address) {
  const a = (address || "").toString().trim();
  return a ? a : null;
}

// h3-js hex string -> bigint(10진수 문자열)로 변환 시도 (DB가 bigint여도 안전)
function h3HexToDecimalString(hexIndex) {
  if (!hexIndex || typeof hexIndex !== "string") return null;
  const s = hexIndex.trim();
  try {
    // "8a..." 같은 hex가 들어오면 0x 붙여서 BigInt로
    const bi = BigInt("0x" + s.replace(/^0x/i, ""));
    return bi.toString(10);
  } catch {
    return null;
  }
}
async function geocodeNaver(address) {
  if (!address || !address.trim()) return null;

  const url =
    "https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=" +
    encodeURIComponent(address.trim());

  try {
    const res = await fetchCompat(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID_Map,
        "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET_Map,
        Accept: "application/json",
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
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    console.error("Failed to fetch post detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== 새 글 작성 (주소 + 지도/H3 + KoBERT 포함) ==================
router.post("/", requireAuth, async (req, res) => {
  // userId는 토큰에서만 결정
  const userId = Number(req.user?.id ?? req.user?.user_id);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    title,
    postBody,
    category,
    latitude,
    longitude,
    h3Index,
    previewId,
    address,
    autoCategory,
  } = req.body;

  if (!title || !postBody) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1) 주소/좌표 정리
    let lat = latitude;
    let lng = longitude;
    let h3Idx = h3Index;
    const addr = normalizeAddress(address);

    if (
      (lat == null || lng == null || lat === "" || lng === "") &&
      addr
    ) {
      const geo = await geocodeNaver(addr);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      } else {
        console.warn("[POSTS] geocode failed for address:", addr);
      }
    }

    lat = lat != null && lat !== "" ? Number(lat) : null;
    lng = lng != null && lng !== "" ? Number(lng) : null;

    const hasCoord = Number.isFinite(lat) && Number.isFinite(lng);

    // 2) H3 계산 (DB bigint 대비: 10진 문자열로 변환 시도)
    let h3ToStore = null;

    if (h3Idx != null && h3Idx !== "") {
      // 들어온 h3Index가 hex면 bigint(10진)로 변환, 아니면 원문 사용
      if (typeof h3Idx === "string") {
        const dec = h3HexToDecimalString(h3Idx);
        h3ToStore = dec ?? h3Idx;
      } else {
        h3ToStore = h3Idx;
      }
    } else if (hasCoord) {
      const hex = h3.latLngToCell(lat, lng, 8);
      const dec = h3HexToDecimalString(hex);
      h3ToStore = dec ?? hex;
    }

    // 3) location
    const location = hasCoord ? `SRID=4326;POINT(${lng} ${lat})` : null;

    // 4) KoBERT 분류 (autoCategory=true일 때만 시도)
    const wantAuto = !!autoCategory;
    const requested = normalizeCategory(category);
    let finalCategory = null;

    if (wantAuto) {
      const text = `${String(title)}\n${String(postBody)}`;
      const predicted = await classifyByKoBERT(text);
      if (predicted) finalCategory = predicted;
    }

    if (!finalCategory) {
      // 자동 분류 실패/비활성 시: 요청값이 허용 카테고리면 사용, 아니면 기타
      finalCategory =
        requested && ALLOWED_CATEGORIES.has(requested) ? requested : "기타";
    }

    // 5) preview 조회
    let previewData = null;
    if (previewId) {
      const previewResult = await db.query(
        "SELECT original_image_url, auto_mosaic_image, plate_visible_image FROM image_previews WHERE preview_id = $1",
        [previewId]
      );
      if (previewResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid previewId provided." });
      }
      previewData = previewResult.rows[0];
    }

    // 6) INSERT (address 포함)
    const insertQuery = `
      INSERT INTO posts (
        user_id, title, content, category,
        address, location, h3_index, status,
        latitude, longitude, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING post_id;
    `;

    const status = "DONE";
    const insertValues = [
      userId,
      title,
      postBody,
      finalCategory,
      addr,
      location,
      h3ToStore,
      status,
      lat,
      lng,
    ];

    const { rows } = await db.query(insertQuery, insertValues);
    const newPostId = rows[0].post_id;

    // 7) preview 이미지 처리(기존 로직 유지)
    if (previewData) {
      const selectedVariant =
        req.body.selectedVariant === "PLATE_VISIBLE" ? "PLATE_VISIBLE" : "AUTO";
      const selectedImageRaw =
        selectedVariant === "PLATE_VISIBLE"
          ? previewData.plate_visible_image
          : previewData.auto_mosaic_image;

      const selectedImage = await persistImageToUploads(
        selectedImageRaw,
        req,
        selectedVariant
      );

      await db.query(
        `INSERT INTO post_images (post_id, image_url, variant) VALUES ($1,$2,$3);`,
        [newPostId, selectedImage, selectedVariant]
      );

      await db.query(
        "UPDATE image_previews SET is_used = true WHERE preview_id = $1",
        [previewId]
      );

      const deleteTargets = [];
      const originalUrl = previewData.original_image_url;

      if (selectedVariant === "AUTO" && previewData.plate_visible_image) {
        deleteTargets.push(previewData.plate_visible_image);
      }
      if (selectedVariant === "PLATE_VISIBLE" && previewData.auto_mosaic_image) {
        deleteTargets.push(previewData.auto_mosaic_image);
      }
      if (originalUrl) deleteTargets.push(originalUrl);

      await Promise.all(deleteTargets.map((u) => deleteLocalUpload(u)));
      await db.query("DELETE FROM image_previews WHERE preview_id = $1", [
        previewId,
      ]);
    }

    const createdPost = await fetchPostById(newPostId);
    res.status(201).json(createdPost);
  } catch (err) {
    console.error("Failed to create post", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});
// ================== 글 수정 (작성자만) ==================
router.put("/:postId", requireAuth, requirePostOwner, async (req, res) => {
  const { postId } = req.params;

  const {
    title,
    postBody,
    category,
    latitude,
    longitude,
    h3Index,
    previewId,
    address,
    autoCategory, // 수정 화면에서는 보통 false가 옴
  } = req.body;

  if (!title || !postBody) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const existing = await fetchPostById(postId);
    if (!existing) return res.status(404).json({ error: "Post not found" });

    const me = Number(req.user?.id ?? req.user?.user_id);
    if (!Number.isFinite(me)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (Number(existing.user_id) !== me) {
      return res.status(403).json({ error: "FORBIDDEN", code: "NOT_AUTHOR" });
    }

    // 주소/좌표
    let lat = latitude;
    let lng = longitude;
    let h3Idx = h3Index;
    const addr = normalizeAddress(address);

    if (
      (lat == null || lng == null || lat === "" || lng === "") &&
      addr
    ) {
      const geo = await geocodeNaver(addr);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      } else {
        console.warn("[POSTS][UPDATE] geocode failed for address:", addr);
      }
    }

    lat = lat != null && lat !== "" ? Number(lat) : null;
    lng = lng != null && lng !== "" ? Number(lng) : null;

    const hasCoord = Number.isFinite(lat) && Number.isFinite(lng);

    // H3
    let h3ToStore = null;
    if (h3Idx != null && h3Idx !== "") {
      if (typeof h3Idx === "string") {
        const dec = h3HexToDecimalString(h3Idx);
        h3ToStore = dec ?? h3Idx;
      } else {
        h3ToStore = h3Idx;
      }
    } else if (hasCoord) {
      const hex = h3.latLngToCell(lat, lng, 8);
      const dec = h3HexToDecimalString(hex);
      h3ToStore = dec ?? hex;
    }

    const location = hasCoord ? `SRID=4326;POINT(${lng} ${lat})` : null;

    // 카테고리
    const wantAuto = !!autoCategory;
    const requested = normalizeCategory(category);
    let finalCategory = null;

    if (wantAuto) {
      const text = `${String(title)}\n${String(postBody)}`;
      const predicted = await classifyByKoBERT(text);
      if (predicted) finalCategory = predicted;
    }

    if (!finalCategory) {
      // 수정은 기본적으로 기존 값을 유지하고 싶어하는 흐름이므로,
      // 요청값이 허용이면 요청값, 아니면 기존값, 그것도 없으면 기타
      if (requested && ALLOWED_CATEGORIES.has(requested)) finalCategory = requested;
      else finalCategory = existing.category || "기타";
    }

    // UPDATE (address 포함)
    const updateQuery = `
      UPDATE posts
      SET
        title=$2,
        content=$3,
        category=$4,
        address=$5,
        location=$6,
        h3_index=$7,
        latitude=$8,
        longitude=$9,
        updated_at=NOW()
      WHERE post_id=$1
      RETURNING post_id;
    `;

    const updateValues = [
      postId,
      title,
      postBody,
      finalCategory,
      addr,
      location,
      h3ToStore,
      lat,
      lng,
    ];

    const { rows } = await db.query(updateQuery, updateValues);
    if (!rows.length) return res.status(404).json({ error: "Post not found" });

    // previewId 처리 (기존 로직 유지)
    if (previewId) {
      const previewResult = await db.query(
        "SELECT original_image_url, auto_mosaic_image, plate_visible_image FROM image_previews WHERE preview_id = $1",
        [previewId]
      );

      if (previewResult.rows.length) {
        const previewData = previewResult.rows[0];
        const selectedVariant =
          req.body.selectedVariant === "PLATE_VISIBLE"
            ? "PLATE_VISIBLE"
            : "AUTO";

        const selectedImageRaw =
          selectedVariant === "PLATE_VISIBLE"
            ? previewData.plate_visible_image
            : previewData.auto_mosaic_image;

        const selectedImage = await persistImageToUploads(
          selectedImageRaw,
          req,
          selectedVariant
        );

        await db.query(
          `INSERT INTO post_images (post_id, image_url, variant) VALUES ($1,$2,$3);`,
          [postId, selectedImage, selectedVariant]
        );

        await db.query(
          "UPDATE image_previews SET is_used = true WHERE preview_id = $1",
          [previewId]
        );

        const deleteTargets = [];
        const originalUrl = previewData.original_image_url;

        if (selectedVariant === "AUTO" && previewData.plate_visible_image) {
          deleteTargets.push(previewData.plate_visible_image);
        }
        if (selectedVariant === "PLATE_VISIBLE" && previewData.auto_mosaic_image) {
          deleteTargets.push(previewData.auto_mosaic_image);
        }
        if (originalUrl) deleteTargets.push(originalUrl);

        await Promise.all(deleteTargets.map((u) => deleteLocalUpload(u)));
        await db.query("DELETE FROM image_previews WHERE preview_id = $1", [
          previewId,
        ]);
      }
    }

    const updatedPost = await fetchPostById(postId);
    res.json(updatedPost);
  } catch (err) {
    console.error("Failed to update post", err);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// ================== 글 삭제 (작성자만) ==================
router.delete("/:postId", requireAuth, requirePostOwner, async (req, res) => {
  const { postId } = req.params;

  try {
    const existing = await fetchPostById(postId);
    if (!existing) return res.status(404).json({ error: "Post not found" });

    const me = Number(req.user?.id ?? req.user?.user_id);
    if (!Number.isFinite(me)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (Number(existing.user_id) !== me) {
      return res.status(403).json({ error: "FORBIDDEN", code: "NOT_AUTHOR" });
    }

    await db.query("DELETE FROM post_images WHERE post_id = $1", [postId]);
    await db.query("DELETE FROM posts WHERE post_id = $1", [postId]);

    return res.status(204).send();
  } catch (err) {
    console.error("Failed to delete post", err);
    return res.status(500).json({ error: "Failed to delete post" });
  }
});

module.exports = router;
