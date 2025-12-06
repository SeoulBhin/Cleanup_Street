// backend/routes/board-posts.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { latLngToCell } = require("h3-js");

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
    p.h3_index,
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
  return rows[0];
};

// ================================
// 목록 조회  GET /api/board-posts
//   ?boardType=도로-교통&q=검색어
// ================================
router.get("/", async (req, res, next) => {
  try {
    const { boardType, q = "" } = req.query;

    const query = `
      ${BASE_SELECT}
      WHERE ($1::varchar IS NULL OR p.category = $1)
        AND (p.title ILIKE $2 OR p.content ILIKE $2)
      ORDER BY p.created_at DESC
    `;

    const { rows } = await db.query(query, [
      boardType || null,
      `%${q}%`,
    ]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ================================
// 개별 조회  GET /api/board-posts/:id
// ================================
router.get("/:id", async (req, res, next) => {
  try {
    const post = await fetchPostById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Not Found" });
    }

    res.json(post);
  } catch (err) {
    next(err);
  }
});

// ================================
// 게시글 생성  POST /api/board-posts
// body: { title, content, category, latitude?, longitude? ... }
// ================================
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      content,
      category,
      latitude = null,
      longitude = null,
      // author, address, attachments 등은
      // posts 테이블에 컬럼이 없으므로 일단 무시 (나중에 컬럼 추가 가능)
    } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ message: "필수 값 누락 (title / content / category)" });
    }

    let h3_index = null;
    let location = null;

    if (latitude && longitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      // H3 index 계산 (해상도 10 예시)
      const cell = latLngToCell(lat, lng, 10);
      // BIGINT 컬럼에 넣기 위해 문자열 또는 BigInt 사용
      h3_index = BigInt(cell);
      // PostGIS geography(Point, 4326)
      location = `SRID=4326;POINT(${lng} ${lat})`;
    }

    const insertQuery = `
      INSERT INTO posts
        (user_id, title, content, category,
         latitude, longitude, h3_index, location,
         status, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7, $8,
         'DONE', NOW(), NOW())
      RETURNING post_id AS id
    `;

    const { rows } = await db.query(insertQuery, [
      req.user.user_id,
      title,
      content,
      category,
      latitude || null,
      longitude || null,
      h3_index,
      location,
    ]);

    res.json({ id: rows[0].id });
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
      category,
      latitude = null,
      longitude = null,
    } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ message: "필수 값 누락 (title / content / category)" });
    }

    let h3_index = null;
    let location = null;

    if (latitude && longitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      const cell = latLngToCell(lat, lng, 10);
      h3_index = BigInt(cell);
      location = `SRID=4326;POINT(${lng} ${lat})`;
    }

    const updateQuery = `
      UPDATE posts
      SET
        title      = $1,
        content    = $2,
        category   = $3,
        latitude   = $4,
        longitude  = $5,
        h3_index   = $6,
        location   = $7,
        updated_at = NOW()
      WHERE post_id = $8
    `;

    await db.query(updateQuery, [
      title,
      content,
      category,
      latitude || null,
      longitude || null,
      h3_index,
      location,
      id,
    ]);

    res.json({ success: true });
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

    // 이미지가 있다면 post_images 먼저 삭제
    await db.query(`DELETE FROM post_images WHERE post_id = $1`, [id]);
    // 본문 삭제
    await db.query(`DELETE FROM posts WHERE post_id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
