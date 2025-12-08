const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');


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
    p.created_at,
    p.updated_at,
    ST_AsText(p.location) AS location_wkt,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'imageId', pi.image_id,
            'imageUrl', pi.image_url,
            'createdAt', pi.created_at
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
  const sql = `${BASE_SELECT} WHERE p.post_id = $1`;
  const { rows } = await pool.query(sql, [postId]);
  return rows[0] || null;
}

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    const sql = `${BASE_SELECT} ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`;
    const { rows } = await pool.query(sql, [limit, offset]);
    res.json(rows);
  } catch (err) {
    console.error('[POSTS] list error:', err.code, err.detail, err.message);
    res.status(500).json({ error: 'FAILED_TO_FETCH_POSTS' });
  }
});

router.get('/:postId', async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) return res.status(400).json({ error: 'BAD_POST_ID' });

  try {
    const post = await fetchPostById(postId);
    if (!post) return res.status(404).json({ error: 'POST_NOT_FOUND' });
    res.json(post);
  } catch (err) {
    console.error('[POSTS] detail error:', err.code, err.detail, err.message);
    res.status(500).json({ error: 'FAILED_TO_FETCH_POST' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'NO_USER_IN_TOKEN' });

    const { title, postBody, category, h3Index } = req.body || {};
    if (!title || !postBody || !category) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS' });
    }

    const insertSql = `
  INSERT INTO posts (user_id, title, content, category, h3_index, created_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
  RETURNING post_id
`;

const insertVals = [userId, title, postBody, category, h3Index || null];

    const { rows } = await pool.query(insertSql, insertVals);
    const newPostId = rows[0].post_id;

    const created = await fetchPostById(newPostId);
    return res.status(201).json(created);
  } catch (err) {
    console.error('[POSTS] create error:', err.code, err.detail, err.message);
    return res.status(500).json({
      error: 'FAILED_TO_CREATE_POST',
      code: err.code,
      detail: err.detail,
      message: err.message,
    });
  }
});

module.exports = router;
