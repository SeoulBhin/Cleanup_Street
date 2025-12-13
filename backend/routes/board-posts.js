// backend/routes/board-posts.js

// =========================
// KoBERT 호출 (자동 분류)
// =========================

// ✅ fetch 안전 래퍼: Node 18+는 global fetch 사용, 아니면 node-fetch를 동적 로드
async function fetchCompat(url, options) {
  if (typeof fetch === "function") {
    return fetch(url, options);
  }
  // ⚠️ node-fetch 설치가 필요할 수 있음: npm i node-fetch
  // ⚠️ node-fetch 버전에 따라 require가 깨질 수 있어서 import() 방식 사용
  const mod = await import("node-fetch");
  const f = mod.default || mod;
  return f(url, options);
}

const KOBERT_URL = process.env.KOBERT_URL;           // 없으면 undefined
const KOBERT_ENABLED = !!process.env.KOBERT_URL;     // URL 있을 때만 ON

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

  // 흔한 흔들림 보정
  if (s === "자연-재난환경") s = "자연재난-환경";
  if (s === "자연재난환경") s = "자연재난-환경";

  // 예: "치안·범죄위험" -> 위에서 "-"로 바뀌지만 혹시 누락 대비
  if (s === "치안-범죄위험") s = "치안-범죄위험";

  return s;
}

async function classifyByKoBERT(text) {
  if (!KOBERT_ENABLED) return null; // ✅ 팀 환경/배포에서 KoBERT 호출 자체를 안 함

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

    // ⚠️ 응답 필드명은 서버 구현에 따라 다를 수 있음(확실하지 않음)
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
// 기존 라우터
// =========================
const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { latLngToCell } = require("h3-js");
const { geocodeAddress } = require("../utils/geocode");

/**
 * 공통 SELECT 구문
 * - posts + post_images 묶어서 한 번에 내려줌
 * - 프론트 PostView의 post.images 렌더링에 맞춤
 */
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

/**
 * 공통: 단일 게시글 조회 함수
 */
const fetchPostById = async (postId) => {
  const query = `${BASE_SELECT} WHERE p.post_id = $1`;
  const { rows } = await db.query(query, [postId]);
  return rows[0] ? enrichImages(rows[0]) : null;
};

/**
 * content 안에 포함된 이미지 URL까지 병합
 * - post_images에 없는 경우도 ORIGINAL variant로 내려줘서 프론트에서 <img>로 렌더 가능
 */
function enrichImages(row) {
  if (!row) return row;

  const images = Array.isArray(row.images) ? row.images : [];
  const existing = new Set(images.map((i) => i.imageUrl));

  const content = row.content || "";
  const urlRegex = /(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi;
  const fallbackUrls = [];

  let match;
  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[1];
    if (!existing.has(url)) fallbackUrls.push(url);
  }

  const uploadsRegex = /(\/uploads\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi;
  while ((match = uploadsRegex.exec(content)) !== null) {
    const url = match[1];
    if (!existing.has(url) && !fallbackUrls.includes(url)) {
      fallbackUrls.push(url);
    }
  }

  const mergedImages = images.concat(
    fallbackUrls.map((url, idx) => ({
      imageId: `fallback-${idx}`,
      variant: "ORIGINAL",
      imageUrl: url,
      createdAt: row.created_at,
    }))
  );

  const mergedAttachments = [];
  const seen = new Set();
  for (const u of [...(row.attachments || []), ...fallbackUrls]) {
    if (u && !seen.has(u)) {
      seen.add(u);
      mergedAttachments.push(u);
    }
  }

  return {
    ...row,
    images: mergedImages,
    attachments: mergedAttachments,
  };
}

/**
 * 주소 처리 공통 함수
 */
async function resolveLocation({ latitude, longitude, address }) {
  let lat = null;
  let lng = null;
  let normalizedAddress = (address || "").trim() || null;

  if (
    latitude != null &&
    longitude != null &&
    latitude !== "" &&
    longitude !== ""
  ) {
    lat = Number(latitude);
    lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return {
        error: {
          status: 400,
          body: {
            code: "INVALID_COORD",
            message: "좌표값이 올바르지 않습니다.",
          },
        },
      };
    }
    return { lat, lng, address: normalizedAddress };
  }

  if (normalizedAddress) {
    const cleaned = normalizedAddress
      .replace(/^\d{5}\s*/, "")
      .replace(/\(.*$/, "")
      .trim();

    const geo = await geocodeAddress(cleaned);
    if (!geo) {
      return {
        error: {
          status: 400,
          body: {
            code: "INVALID_ADDRESS",
            message: "주소를 찾을 수 없습니다. 다시 확인해 주세요.",
          },
        },
      };
    }

    return {
      lat: geo.lat,
      lng: geo.lng,
      address: geo.normalizedAddress || cleaned,
    };
  }

  return { lat: null, lng: null, address: null };
}

/**
 * lat/lng → H3, location WKT 계산
 */
function buildSpatialFields(lat, lng) {
  if (lat == null || lng == null) {
    return { h3_index: null, location: null };
  }

  const hexIndex = latLngToCell(lat, lng, 10);
  let h3_index = null;
  try {
    h3_index = BigInt("0x" + hexIndex);
  } catch {
    h3_index = null;
  }

  const location = `SRID=4326;POINT(${lng} ${lat})`;
  return { h3_index, location };
}

// ================================
// 목록 조회  GET /api/board-posts
// ================================
router.get("/", async (req, res, next) => {
  try {
    const { boardType = "free", q = "" } = req.query;
    const search = `%${q}%`;

    let sql;
    let params;

    if (!boardType || boardType === "free") {
      sql = `
        ${BASE_SELECT}
        WHERE (p.title ILIKE $1 OR p.content ILIKE $1)
        ORDER BY p.created_at DESC
      `;
      params = [search];
    } else {
      sql = `
        ${BASE_SELECT}
        WHERE p.category = $1
          AND (p.title ILIKE $2 OR p.content ILIKE $2)
        ORDER BY p.created_at DESC
      `;
      params = [boardType, search];
    }

    const { rows } = await db.query(sql, params);
    res.json(rows.map(enrichImages));
  } catch (err) {
    next(err);
  }
});

// ================================
// 개별 조회  GET /api/board-posts/:id
// ================================
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "BAD_POST_ID" });
    }

    const post = await fetchPostById(id);
    if (!post) return res.status(404).json({ message: "Not Found" });

    res.json(post);
  } catch (err) {
    next(err);
  }
});

// ================================
// 게시글 생성  POST /api/board-posts
// ================================
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      content,
      postBody, // ✅ 호환: 팀원 프론트가 postBody로 보내는 경우
      category,
      autoCategory = false, 
      address,
      latitude = null,
      longitude = null,
      attachments = [],
      previewId = null,
      selectedVariant = "AUTO",
    } = req.body;

    // ✅ 최종 본문: content 우선, 없으면 postBody 사용
    const finalContent = (content ?? postBody ?? "").toString();

    if (!title || !finalContent) {
      return res
        .status(400)
        .json({ message: "필수 값 누락 (title / content)", code: "MISSING_FIELDS" });
    }

    // ✅ 0) KoBERT 자동 분류
    let finalCategory = category;

    if ((autoCategory === true || !finalCategory) && KOBERT_ENABLED) {
      try {
        const predicted = await classifyByKoBERT(`${title}\n${finalContent}`);
        finalCategory = predicted || finalCategory || "기타";
      } catch (e) {
        finalCategory = finalCategory || "기타";
      }
    } else {
      const norm = normalizeCategory(finalCategory);
      finalCategory = norm && ALLOWED_CATEGORIES.has(norm) ? norm : "기타";
    }


    // 1) 주소/좌표 처리
    const locResult = await resolveLocation({ latitude, longitude, address });
    if (locResult.error) {
      return res.status(locResult.error.status).json(locResult.error.body);
    }
    const resolvedLat = locResult.lat;
    const resolvedLng = locResult.lng;
    const resolvedAddress = locResult.address;

    // 2) H3, location 계산
    const { h3_index, location } = buildSpatialFields(resolvedLat, resolvedLng);

    // 3) posts INSERT
    const insertQuery = `
      INSERT INTO posts
        (user_id, title, content, category,
         address, latitude, longitude, h3_index, location,
         status, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7, $8, $9,
         'DONE', NOW(), NOW())
      RETURNING post_id AS id
    `;

    const { rows } = await db.query(insertQuery, [
      req.user.user_id,
      title,
      finalContent, // ✅ 여기!
      finalCategory,
      resolvedAddress,
      resolvedLat,
      resolvedLng,
      h3_index,
      location,
    ]);

    const postId = rows[0].id;

    // 4) 미리보기(previewId) → 모자이크 이미지 1장 저장
    if (previewId) {
      try {
        const { rows: previewRows } = await db.query(
          `
          SELECT auto_mosaic_image, plate_visible_image
          FROM image_previews
          WHERE preview_id = $1
          `,
          [previewId]
        );

        if (previewRows.length) {
          const preview = previewRows[0];
          const variant =
            selectedVariant === "PLATE_VISIBLE" ? "PLATE_VISIBLE" : "AUTO";
          const imageUrl =
            variant === "PLATE_VISIBLE"
              ? preview.plate_visible_image
              : preview.auto_mosaic_image;

          await db.query(
            `
            INSERT INTO post_images (post_id, image_url, variant)
            VALUES ($1, $2, $3)
            `,
            [postId, imageUrl, variant]
          );

          await db.query(
            `UPDATE image_previews SET is_used = true WHERE preview_id = $1`,
            [previewId]
          );
        }
      } catch (e) {
        console.error("[POSTS] preview attach error:", e);
      }
    }

    // 5) 추가 첨부(attachments)
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const params = [postId];
      const values = attachments.map((url, idx) => {
        params.push(url);
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

    res.json({ id: postId, category: finalCategory });
  } catch (err) {
    next(err);
  }
});

// ================================
// 게시글 수정  PUT /api/board-posts/:id
// ================================
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      postBody, // ✅ 호환
      category,
      address,
      latitude = null,
      longitude = null,
      attachments = [],
    } = req.body;

    const finalContent = (content ?? postBody ?? "").toString();

    // ✅ 수정은 기존 팀원 흐름 유지: category는 필수로 둠
    if (!title || !finalContent || !category) {
      return res
        .status(400)
        .json({ message: "필수 값 누락 (title / content / category)", code: "MISSING_FIELDS" });
    }

    const locResult = await resolveLocation({ latitude, longitude, address });
    if (locResult.error) {
      return res.status(locResult.error.status).json(locResult.error.body);
    }
    const resolvedLat = locResult.lat;
    const resolvedLng = locResult.lng;
    const resolvedAddress = locResult.address;

    const { h3_index, location } = buildSpatialFields(resolvedLat, resolvedLng);

    const updateQuery = `
      UPDATE posts
      SET
        title      = $1,
        content    = $2,
        category   = $3,
        address    = $4,
        latitude   = $5,
        longitude  = $6,
        h3_index   = $7,
        location   = $8,
        updated_at = NOW()
      WHERE post_id = $9
    `;

    await db.query(updateQuery, [
      title,
      finalContent, // ✅ 여기!
      category,
      resolvedAddress,
      resolvedLat,
      resolvedLng,
      h3_index,
      location,
      id,
    ]);

    await db.query(`DELETE FROM post_images WHERE post_id = $1`, [id]);

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const params = [id];
      const values = attachments.map((url, idx) => {
        params.push(url);
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

    res.json({ success: true, id: Number(id) });
  } catch (err) {
    next(err);
  }
});

// ================================
// 게시글 삭제  DELETE /api/board-posts/:id
// ================================
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query(`DELETE FROM post_images WHERE post_id = $1`, [id]);
    await db.query(`DELETE FROM posts       WHERE post_id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
