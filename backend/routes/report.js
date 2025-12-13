const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db');

const toId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

router.post('/posts/:id', requireAuth, async (req, res) => {
  const postId = toId(req.params.id);
  const { reason } = req.body;
  const userId = req.user?.userId;

  if (!postId) return res.status(400).json({ error: 'BAD_POST_ID' });
  if (!reason) return res.status(400).json({ error: 'MISSING_REASON' });

  try {
    const post = await pool.query(`SELECT 1 FROM public.posts WHERE post_id=$1`, [postId]);
    if (!post.rowCount) return res.status(404).json({ error: 'POST_NOT_FOUND' });

    await pool.query(
      `INSERT INTO public.reports (target_type, target_id, user_id, reason)
       VALUES ('POST', $1, $2, $3)`,
      [postId, userId, reason]
    );

    res.json({ ok: true, message: '게시글 신고 완료' });
  } catch (e) {
    console.error('[REPORT posts]', e.code, e.detail, e.message);
    res.status(500).json({ error: 'REPORT_FAILED', code: e.code });
  }
});

router.post('/comment/:id', requireAuth, async (req, res) => {
  const commentId = toId(req.params.id);
  const { reason } = req.body;
  const userId = req.user?.userId;

  if (!commentId) return res.status(400).json({ error: 'BAD_COMMENT_ID' });
  if (!reason) return res.status(400).json({ error: 'MISSING_REASON' });

  try {
    const comment = await pool.query(`SELECT 1 FROM public.comments WHERE comment_id=$1`, [commentId]);
    if (!comment.rowCount) return res.status(404).json({ error: 'COMMENT_NOT_FOUND' });

    await pool.query(
      `INSERT INTO public.reports (target_type, target_id, user_id, reason)
       VALUES ('COMMENT', $1, $2, $3)`,
      [commentId, userId, reason]
    );

    res.json({ ok: true, message: '댓글 신고 완료' });
  } catch (e) {
    console.error('[REPORT comments]', e.code, e.detail, e.message);
    res.status(500).json({ error: 'REPORT_FAILED', code: e.code });
  }
});

module.exports = router;
