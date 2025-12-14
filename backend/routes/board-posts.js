// backend/routes/board-posts.js
// ✅ 조회 전용 라우터 (/api/board-posts)
// ✅ 작성/수정/삭제 + KoBERT 분류는 /api/posts에서만 수행

const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * 공통 SELECT 구문
 * - board UI 호환을 위해 id와 post_id를 둘 다 내려줌
 */
const BASE_SELECT = `
  SELECT
    p.post_id      AS id,
    p.post_id      AS post_id,
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
 * content 안에 포함된 이미지 URL까지 병합
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
 * 단일 게시글 조회 함수
 */
async function fetchPostById(postId) {
  const query = `${BASE_SELECT} WHERE p.post_id = $1`;
  const { rows } = await db.query(query, [postId]);
  return rows[0] ? enrichImages(rows[0]) : null;
}

// ================================
// 목록 조회  GET /api/board-posts
// - boardType=free(전체) 또는 category 필터
// - q=검색어
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

module.exports = router;
