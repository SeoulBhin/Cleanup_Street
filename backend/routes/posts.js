// backend/routes/posts.js (MERGED 1/2)
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
// 공통: 카테고리 정규화/허용 목록
// =========================
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

  // 공백/구분자 통일
  s = s.replace(/\s+/g, "");
  s = s.replace(/[·ㆍ]/g, "-");
  s = s.replace(/_/g, "-");

  // 자주 나오는 변형 보정
  if (s === "도로교통") s = "도로-교통";
  if (s === "시설물건축") s = "시설물-건축";
  if (s === "치안" || s === "치안범죄위험" || s === "치안-범죄") s = "치안-범죄위험";
  if (s === "자연재난환경" || s === "자연재난" || s === "자연환경" || s === "자연-재난환경") {
    s = "자연재난-환경";
  }
  if (s === "위생보건") s = "위생-보건";

  return s;
}

function pickFirstLine(raw) {
  return String(raw || "").split(/\r?\n/)[0].trim();
}

// =========================
// 키워드 백업 분류 (Gemini 실패 시 대비)
// =========================
function classifyByKeywords(title, body) {
  const text = `${String(title || "")} ${String(body || "")}`
    .toLowerCase()
    .replace(/\s+/g, "");
  const has = (arr) =>
    arr.some((k) => text.includes(k.toLowerCase().replace(/\s+/g, "")));

  if (has(["도로", "교통", "신호", "차량", "주차", "버스", "횡단보도", "정체"])) {
    return "도로-교통";
  }
  if (
    has([
      "건물",
      "시설",
      "시설물",
      "건축",
      "벤치",
      "공원",
      "파손",
      "철거",
      "보수",
      "나사",
      "볼트",
      "헐거",
      "느슨",
      "수리",
      "고정",
      "고장",
    ])
  ) {
    return "시설물-건축";
  }
  if (has(["치안", "범죄", "절도", "도둑", "폭행", "흉기", "경찰", "신고", "위협"])) {
    return "치안-범죄위험";
  }
  if (has(["폭우", "침수", "홍수", "태풍", "지진", "환경", "미세먼지", "하수구", "역류"])) {
    return "자연재난-환경";
  }
  if (has(["위생", "보건", "쓰레기", "악취", "벌레", "쥐", "음식점", "식중독", "곰팡이"])) {
    return "위생-보건";
  }
  if (has(["세일", "광고", "홍보", "특가", "링크", "구독", "클릭"])) {
    return "스팸";
  }
  return null;
}

// =========================
// Gemini 호출 (자동 분류) - REST
// =========================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENABLED = !!GEMINI_API_KEY;

console.log("[POSTS][INIT_GEMINI]", {
  enabled: GEMINI_ENABLED,
  model: GEMINI_MODEL,
});

async function classifyByGemini(text) {
  if (!GEMINI_ENABLED) {
    console.warn("[GEMINI] disabled: no GEMINI_API_KEY env");
    return null;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);

  try {
    const prompt = `
당신은 한국어 민원/제보 글을 7개 카테고리 중 하나로 분류하는 모델입니다.
아래 라벨 중 하나만, 한 줄로 그대로 출력하세요. 추가 설명/기호/따옴표/JSON 금지.
라벨: 도로-교통, 시설물-건축, 치안-범죄위험, 자연재난-환경, 위생-보건, 기타, 스팸

[입력]
${String(text || "")}
    `.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
  GEMINI_MODEL
)}:generateContent`;

    const res = await fetchCompat(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      signal: ac.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 20 },
      }),
    });


    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.warn("[GEMINI] bad status:", res.status, bodyText.slice(0, 300));
      return null;
    }

    const data = await res.json();

    const raw =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text)
        .filter(Boolean)
        .join("\n") ??
      "";

    const picked = pickFirstLine(raw);
    if (!picked.trim()) return null;
    const norm = normalizeCategory(picked);

    console.log("[GEMINI] response <-", { raw: picked, norm });

    if (!norm) return null;
    return ALLOWED_CATEGORIES.has(norm) ? norm : null;
  } catch (e) {
    console.warn("[GEMINI] classify failed:", e?.message || e);
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
    return selectedImageUrl;
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

async function fetchPostById(postId) {
  const query = `${BASE_SELECT} WHERE p.post_id = $1`;
  const { rows } = await db.query(query, [postId]);
  return rows[0] || null;
}

function normalizeAddress(address) {
  const a = (address || "").toString().trim();
  return a ? a : null;
}

function h3HexToDecimalString(hexIndex) {
  if (!hexIndex || typeof hexIndex !== "string") return null;
  const s = hexIndex.trim();
  try {
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

// ================== 새 글 작성 (주소 + 지도/H3 + 자동 분류) ==================
router.post("/", requireAuth, async (req, res) => {
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
    // 1) 주소/좌표
    let lat = latitude;
    let lng = longitude;
    let h3Idx = h3Index;
    const addr = normalizeAddress(address);

    if ((lat == null || lng == null || lat === "" || lng === "") && addr) {
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

    // 2) H3
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

    // 3) location
    const location = hasCoord ? `SRID=4326;POINT(${lng} ${lat})` : null;

    // 4) 자동 분류
    // autoCategory가 false가 아닌 경우 자동 분류를 시도(기본 true)
    const wantAuto = autoCategory !== false;
    const requested = normalizeCategory(category);
    let finalCategory = null;

    if (wantAuto) {
      const text = `${String(title)}\n${String(postBody)}`;
      const g = await classifyByGemini(text);
      const kw = g ? null : classifyByKeywords(title, postBody);

      finalCategory = g || kw || null;

      console.log("[POSTS][AUTO_CATEGORY_GEMINI]", { g, kw });
    }

    if (!finalCategory) {
      finalCategory =
        requested && ALLOWED_CATEGORIES.has(requested) ? requested : "기타";
    }

    console.log("[POSTS][AUTO_CATEGORY_DEBUG]", {
      wantAuto,
      requested,
      finalCategory,
      GEMINI_ENABLED,
      GEMINI_MODEL,
    });

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

    // 6) INSERT
    const insertQuery = `
      INSERT INTO posts (
        user_id, title, content, category,
        address, location, h3_index, status,
        latitude, longitude, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING post_id;
    `;

    const insertValues = [
      userId,
      title,
      postBody,
      finalCategory,
      addr,
      location,
      h3ToStore,
      "DONE",
      lat,
      lng,
    ];

    const { rows } = await db.query(insertQuery, insertValues);
    const newPostId = rows[0].post_id;

    // 7) preview 이미지 처리
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
      if (selectedVariant === "AUTO" && previewData.plate_visible_image) {
        deleteTargets.push(previewData.plate_visible_image);
      }
      if (selectedVariant === "PLATE_VISIBLE" && previewData.auto_mosaic_image) {
        deleteTargets.push(previewData.auto_mosaic_image);
      }
      if (previewData.original_image_url) {
        deleteTargets.push(previewData.original_image_url);
      }

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
    autoCategory,
  } = req.body;

  if (!title || !postBody) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const existing = await fetchPostById(postId);
    if (!existing) return res.status(404).json({ error: "Post not found" });

    // ✅ 작성자(토큰) 재검증: 라우트에서 한 번만
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

    if ((lat == null || lng == null || lat === "" || lng === "") && addr) {
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
    const wantAuto = autoCategory !== false;
    const requested = normalizeCategory(category);
    let finalCategory = null;

    if (wantAuto) {
      const text = `${String(title)}\n${String(postBody)}`;
      const g = await classifyByGemini(text);
      const kw = g ? null : classifyByKeywords(title, postBody);

      finalCategory = g || kw || null;

      console.log("[POSTS][AUTO_CATEGORY_GEMINI]", { g, kw });
    }

    if (!finalCategory) {
      if (requested && ALLOWED_CATEGORIES.has(requested)) finalCategory = requested;
      else finalCategory = existing.category || "기타";
    }

    // UPDATE
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

    // preview 처리 (새 이미지로 교체할 때만 기존 정리)
    if (previewId) {
      const previewResult = await db.query(
        "SELECT original_image_url, auto_mosaic_image, plate_visible_image FROM image_previews WHERE preview_id = $1",
        [previewId]
      );

      if (previewResult.rows.length) {
        const previewData = previewResult.rows[0];
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

        // ✅ (추가) 교체 전 기존 post_images URL 확보
        const { rows: oldImgRows } = await db.query(
          "SELECT image_url FROM post_images WHERE post_id = $1",
          [postId]
        );
        const oldImageUrls = oldImgRows.map((r) => r.image_url).filter(Boolean);

        // ✅ 기존 post_images 행 삭제
        await db.query("DELETE FROM post_images WHERE post_id = $1", [postId]);

        // ✅ 새 이미지 INSERT
        await db.query(
          `INSERT INTO post_images (post_id, image_url, variant) VALUES ($1,$2,$3);`,
          [postId, selectedImage, selectedVariant]
        );

        // ✅ (추가) 교체 전 기존 업로드 파일 삭제
        const urlsToDelete = oldImageUrls.filter((u) => u && u !== selectedImage);
        await Promise.all(urlsToDelete.map((u) => deleteLocalUpload(u)));


        // ✅ preview 임시 이미지 삭제 + preview 레코드 삭제
        const deleteTargets = [];
        if (selectedVariant === "AUTO" && previewData.plate_visible_image) {
          deleteTargets.push(previewData.plate_visible_image);
        }
        if (selectedVariant === "PLATE_VISIBLE" && previewData.auto_mosaic_image) {
          deleteTargets.push(previewData.auto_mosaic_image);
        }
        if (previewData.original_image_url) {
          deleteTargets.push(previewData.original_image_url);
        }

        await Promise.all(deleteTargets.map((u) => deleteLocalUpload(u)));
        await db.query("DELETE FROM image_previews WHERE preview_id = $1", [previewId]);
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

    // ✅ DB 삭제 전에 image_url 확보
    const { rows: imgRows } = await db.query(
      "SELECT image_url FROM post_images WHERE post_id = $1",
      [postId]
    );
    const imageUrls = imgRows.map((r) => r.image_url).filter(Boolean);

    // ✅ DB 삭제
    await db.query("DELETE FROM post_images WHERE post_id = $1", [postId]);
    await db.query("DELETE FROM posts WHERE post_id = $1", [postId]);

    // ✅ 실제 파일 삭제
    await Promise.all(imageUrls.map((u) => deleteLocalUpload(u)));

    return res.status(204).send();

    
  } catch (err) {
    console.error("Failed to delete post", err);
    return res.status(500).json({ error: "Failed to delete post" });
  }
});


module.exports = router;
