// backend/routes/posts.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // pg 래퍼 (db.query)
const h3 = require("h3-js");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

// =========================
// KoBERT 호출 (자동 분류)
// =========================
const KOBERT_URL = process.env.KOBERT_URL;
const KOBERT_ENABLED = !!KOBERT_URL;

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
  s = s.replace(/\s+/g, ""); // 공백 제거
  s = s.replace(/[·ㆍ]/g, "-"); // 중점류 → -
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
    const res = await globalThis.fetch(KOBERT_URL, {
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
  } finally {
    clearTimeout(timer);
  }
}

// =========================
// uploads 유틸
// =========================
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
      const res = await globalThis.fetch(selectedImageUrl);
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
    p.post_id      AS id,
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
    ST_AsText(p.location::geometry) AS location_wkt,
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

// 네이버 지오코딩
async function geocodeNaver(address) {
  if (!address || !address.trim()) return null;

  const url =
    "https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=" +
    encodeURIComponent(address.trim());

  try {
    const res = await globalThis.fetch(url, {
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
  const id = Number(req.params.postId);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "BAD_POST_ID" });
  }

  try {
    const post = await fetchPostById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    console.error("Failed to fetch post detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== 새 글 작성 ==================
router.post("/", requireAuth, async (req, res) => {
  const userId = Number(req.user?.id ?? req.user?.user_id);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const {
    title,
    content,
    postBody,
    category,
    autoCategory = false,
    latitude = null,
    longitude = null,
    h3Index = null,
    previewId = null,
    address,
    attachments = [],
    selectedVariant = "AUTO",
  } = req.body;

  const finalContent = (content ?? postBody ?? "").toString();
  if (!title || !finalContent) {
    return res.status(400).json({
      error: "Missing required fields",
      code: "MISSING_FIELDS",
      message: "필수 값 누락 (title / content)",
    });
  }

  try {
    // 1) category + KoBERT 옵션
    let finalCategory = (category ?? "").toString().trim() || "기타";

    if (autoCategory === true && KOBERT_ENABLED) {
      try {
        const predicted = await classifyByKoBERT(`${title}\n${finalContent}`);
        if (predicted) finalCategory = predicted;
      } catch {
        // ignore
      }
    }

    const norm = normalizeCategory(finalCategory);
    finalCategory = norm && ALLOWED_CATEGORIES.has(norm) ? norm : "기타";

    // 2) 좌표/주소
    let lat = latitude;
    let lng = longitude;
    let resolvedAddress = (address || "").trim() || null;

    if (lat !== null && lat !== undefined && lat !== "") lat = Number(lat);
    else lat = null;

    if (lng !== null && lng !== undefined && lng !== "") lng = Number(lng);
    else lng = null;

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && resolvedAddress) {
      const geo = await geocodeNaver(resolvedAddress);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        resolvedAddress = geo.roadAddress || resolvedAddress;
      }
    }

    const hasCoord = Number.isFinite(lat) && Number.isFinite(lng);
    const location = hasCoord ? `SRID=4326;POINT(${lng} ${lat})` : null;

    // 3) h3Index
    let h3Idx = h3Index;
    if (!h3Idx && hasCoord) {
      h3Idx = h3.latLngToCell(lat, lng, 8);
    }

    // 4) INSERT
    const insertQuery = `
      INSERT INTO posts (
        user_id, title, content, category,
        address, location, h3_index, status,
        latitude, longitude, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'DONE',$8,$9,NOW(),NOW())
      RETURNING post_id AS id;
    `;

    const { rows } = await db.query(insertQuery, [
      userId,
      title,
      finalContent,
      finalCategory,
      resolvedAddress,
      location,
      h3Idx,
      hasCoord ? lat : null,
      hasCoord ? lng : null,
    ]);

    const newPostId = rows[0].id;

    // 5) previewId → 모자이크 이미지
    if (previewId) {
      const previewResult = await db.query(
        "SELECT original_image_url, auto_mosaic_image, plate_visible_image FROM image_previews WHERE preview_id = $1",
        [previewId]
      );
      if (previewResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid previewId provided." });
      }

      const previewData = previewResult.rows[0];
      const variant =
        selectedVariant === "PLATE_VISIBLE" ? "PLATE_VISIBLE" : "AUTO";
      const selectedImageRaw =
        variant === "PLATE_VISIBLE"
          ? previewData.plate_visible_image
          : previewData.auto_mosaic_image;

      const selectedImage = await persistImageToUploads(
        selectedImageRaw,
        req,
        variant
      );

      await db.query(
        `INSERT INTO post_images (post_id, image_url, variant) VALUES ($1,$2,$3);`,
        [newPostId, selectedImage, variant]
      );

      await db.query(
        "UPDATE image_previews SET is_used = true WHERE preview_id = $1",
        [previewId]
      );

      // 선택하지 않은 미리보기/원본 정리 + preview row 삭제
      const deleteTargets = [];
      const originalUrl = previewData.original_image_url;

      if (variant === "AUTO" && previewData.plate_visible_image) {
        deleteTargets.push(previewData.plate_visible_image);
      }
      if (variant === "PLATE_VISIBLE" && previewData.auto_mosaic_image) {
        deleteTargets.push(previewData.auto_mosaic_image);
      }
      if (originalUrl) deleteTargets.push(originalUrl);

      await Promise.all(deleteTargets.map((u) => deleteLocalUpload(u)));
      await db.query("DELETE FROM image_previews WHERE preview_id = $1", [
        previewId,
      ]);
    }

    // 6) attachments → ORIGINAL
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const params = [newPostId];
      const values = attachments.map((url, idx) => {
        params.push(url);
        return `($1, $${idx + 2}, 'ORIGINAL')`;
      });

      await db.query(
        `INSERT INTO post_images (post_id, image_url, variant) VALUES ${values.join(
          ","
        )}`,
        params
      );
    }

    const createdPost = await fetchPostById(newPostId);
    return res.status(201).json(createdPost);
  } catch (err) {
    console.error("Failed to create post", err);
    return res.status(500).json({ error: "Failed to create post" });
  }
});

// ================== 글 수정 (작성자만) ==================
router.put("/:postId", requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: "BAD_POST_ID" });
  }

  const userId = Number(req.user?.id ?? req.user?.user_id);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const {
    title,
    content,
    postBody,
    category,
    autoCategory = false,
    latitude = null,
    longitude = null,
    h3Index = null,
    previewId = null,
    address,
    attachments = [],
    selectedVariant = "AUTO",
  } = req.body;

  const finalContent = (content ?? postBody ?? "").toString();
  if (!title || !finalContent) {
    return res.status(400).json({
      error: "Missing required fields",
      code: "MISSING_FIELDS",
      message: "필수 값 누락 (title / content)",
    });
  }

  try {
    // 0) 소유권 체크
    const existing = await fetchPostById(postId);
    if (!existing) return res.status(404).json({ error: "Post not found" });

    if (Number(existing.user_id) !== userId) {
      return res.status(403).json({ error: "FORBIDDEN", code: "NOT_AUTHOR" });
    }

    // 1) category + KoBERT 옵션
    let finalCategory = (category ?? "").toString().trim() || "기타";

    if (autoCategory === true && KOBERT_ENABLED) {
      try {
        const predicted = await classifyByKoBERT(`${title}\n${finalContent}`);
        if (predicted) finalCategory = predicted;
      } catch {
        // ignore
      }
    }

    const norm = normalizeCategory(finalCategory);
    finalCategory = norm && ALLOWED_CATEGORIES.has(norm) ? norm : "기타";

    // 2) 좌표/주소
    let lat = latitude;
    let lng = longitude;
    let resolvedAddress = (address || "").trim() || null;

    if (lat !== null && lat !== undefined && lat !== "") lat = Number(lat);
    else lat = null;

    if (lng !== null && lng !== undefined && lng !== "") lng = Number(lng);
    else lng = null;

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && resolvedAddress) {
      const geo = await geocodeNaver(resolvedAddress);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        resolvedAddress = geo.roadAddress || resolvedAddress;
      }
    }

    const hasCoord = Number.isFinite(lat) && Number.isFinite(lng);
    const location = hasCoord ? `SRID=4326;POINT(${lng} ${lat})` : null;

    // 3) h3Index
    let h3Idx = h3Index;
    if (!h3Idx && hasCoord) {
      h3Idx = h3.latLngToCell(lat, lng, 8);
    }

    // 4) UPDATE
    const updateQuery = `
      UPDATE posts
      SET
        title      = $2,
        content    = $3,
        category   = $4,
        address    = $5,
        location   = $6,
        h3_index   = $7,
        latitude   = $8,
        longitude  = $9,
        updated_at = NOW()
      WHERE post_id = $1
      RETURNING post_id AS id;
    `;

    const upd = await db.query(updateQuery, [
      postId,
      title,
      finalContent,
      finalCategory,
      resolvedAddress,
      location,
      h3Idx,
      hasCoord ? lat : null,
      hasCoord ? lng : null,
    ]);

    if (!upd.rowCount) return res.status(404).json({ error: "Post not found" });

    // 5) attachments 누적 방지: ORIGINAL만 정리 후 재삽입
    if (attachments && Array.isArray(attachments)) {
      await db.query(
        `DELETE FROM post_images WHERE post_id = $1 AND variant = 'ORIGINAL'`,
        [postId]
      );

      if (attachments.length > 0) {
        const params = [postId];
        const values = attachments.map((url, idx) => {
          params.push(url);
          return `($1, $${idx + 2}, 'ORIGINAL')`;
        });

        await db.query(
          `INSERT INTO post_images (post_id, image_url, variant)
           VALUES ${values.join(",")}`,
          params
        );
      }
    }

    // 6) previewId(새 미리보기 선택) 처리
    if (previewId) {
      // 모자이크 누적 방지: 기존 AUTO/PLATE_VISIBLE 정리
      await db.query(
        `DELETE FROM post_images WHERE post_id = $1 AND variant IN ('AUTO','PLATE_VISIBLE')`,
        [postId]
      );

      const previewResult = await db.query(
        "SELECT original_image_url, auto_mosaic_image, plate_visible_image FROM image_previews WHERE preview_id = $1",
        [previewId]
      );

      if (previewResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid previewId provided." });
      }

      const previewData = previewResult.rows[0];
      const variant =
        selectedVariant === "PLATE_VISIBLE" ? "PLATE_VISIBLE" : "AUTO";
      const selectedImageRaw =
        variant === "PLATE_VISIBLE"
          ? previewData.plate_visible_image
          : previewData.auto_mosaic_image;

      const selectedImage = await persistImageToUploads(
        selectedImageRaw,
        req,
        variant
      );

      await db.query(
        `INSERT INTO post_images (post_id, image_url, variant) VALUES ($1,$2,$3);`,
        [postId, selectedImage, variant]
      );

      await db.query(
        "UPDATE image_previews SET is_used = true WHERE preview_id = $1",
        [previewId]
      );

      // 선택하지 않은 미리보기/원본 정리 + preview row 삭제
      const deleteTargets = [];
      const originalUrl = previewData.original_image_url;

      if (variant === "AUTO" && previewData.plate_visible_image) {
        deleteTargets.push(previewData.plate_visible_image);
      }
      if (variant === "PLATE_VISIBLE" && previewData.auto_mosaic_image) {
        deleteTargets.push(previewData.auto_mosaic_image);
      }
      if (originalUrl) deleteTargets.push(originalUrl);

      await Promise.all(deleteTargets.map((u) => deleteLocalUpload(u)));
      await db.query("DELETE FROM image_previews WHERE preview_id = $1", [
        previewId,
      ]);
    }

    const updatedPost = await fetchPostById(postId);
    return res.json(updatedPost);
  } catch (err) {
    console.error("Failed to update post", err);
    return res.status(500).json({ error: "Failed to update post" });
  }
});

// ================== 글 삭제 (작성자만) ==================
router.delete("/:postId", requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: "BAD_POST_ID" });
  }

  const userId = Number(req.user?.id ?? req.user?.user_id);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  try {
    const existing = await fetchPostById(postId);
    if (!existing) return res.status(404).json({ error: "Post not found" });

    if (Number(existing.user_id) !== userId) {
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
