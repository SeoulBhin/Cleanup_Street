const { pool } = require('../db');

exports.listComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const { rows } = await pool.query(
      `SELECT c.*, u.username
       FROM public.comments c
       JOIN public.users u ON u.user_id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.parent_id NULLS FIRST, c.created_at ASC`,
      [postId]
    );

    const map = {};
    const result = [];

    rows.forEach(c => (map[c.comment_id] = { ...c, replies: [] }));
    rows.forEach(c => {
      if (c.parent_id) {
        map[c.parent_id]?.replies.push(map[c.comment_id]);
      } else {
        result.push(map[c.comment_id]);
      }
    });

    res.json(result);
  } catch (err) {
    console.error('[listComments]', err);
    res.status(500).json({ message: '댓글 조회 실패' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parent_id = null } = req.body;
    const userId = req.user.userId; 

    if (!content || !content.trim()) {
      return res.status(400).json({ message: '댓글 내용이 필요합니다.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO public.comments (post_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, userId, content, parent_id]
    );

    const newComment = rows[0];

    const postResult = await pool.query(
      `SELECT user_id, title
       FROM public.posts
       WHERE post_id = $1`,
      [postId]
    );

    let postOwnerId = null;
    let postTitle = null;

    if (postResult.rowCount) {
      postOwnerId = postResult.rows[0].user_id;
      postTitle = postResult.rows[0].title;
    }

    if (postOwnerId && postOwnerId !== userId) {
      const alertMsg = `게시글 "${postTitle}"에 새로운 댓글이 달렸습니다.`;

      const alertInsert = await pool.query(
        `INSERT INTO public.alerts_master (message, target_type, target_id)
         VALUES ($1, 'POST_COMMENT', $2)
         RETURNING alert_id`,
        [alertMsg, newComment.comment_id]
      );

      const newAlertId = alertInsert.rows[0].alert_id;

      await pool.query(
        `INSERT INTO public.user_alerts (user_id, alert_id)
         VALUES ($1, $2)`,
        [postOwnerId, newAlertId]
      );
    }

    if (parent_id) {
      const parentResult = await pool.query(
        `SELECT user_id
         FROM public.comments
         WHERE comment_id = $1`,
        [parent_id]
      );

      if (parentResult.rowCount) {
        const parentOwnerId = parentResult.rows[0].user_id;

        if (parentOwnerId !== userId) {
          const replyAlertMsg = `회원님의 댓글에 새로운 답글이 달렸습니다.`;

          const replyAlertInsert = await pool.query(
            `INSERT INTO public.alerts_master (message, target_type, target_id)
             VALUES ($1, 'COMMENT_REPLY', $2)
             RETURNING alert_id`,
            [replyAlertMsg, newComment.comment_id]
          );

          const replyAlertId = replyAlertInsert.rows[0].alert_id;

          await pool.query(
            `INSERT INTO public.user_alerts (user_id, alert_id)
             VALUES ($1, $2)`,
            [parentOwnerId, replyAlertId]
          );
        }
      }
    }

    res.status(201).json(newComment);
  } catch (err) {
    console.error('[addComment]', err);
    res.status(500).json({ message: '댓글 작성 실패' });
  }
};

exports.editComment = async (req, res) => {
  try {
    const { id } = req.params;         
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: '댓글 내용이 필요합니다.' });
    }

    const { rows } = await pool.query(
      `UPDATE public.comments
       SET content = $1
       WHERE comment_id = $2 AND user_id = $3
       RETURNING *`,
      [content, id, userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: '댓글을 찾을 수 없거나 수정 권한이 없습니다.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[editComment]', err);
    res.status(500).json({ message: '댓글 수정 실패' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;     
    const userId = req.user.userId;

    const r = await pool.query(
      `UPDATE public.comments
       SET content = '[deleted]'
       WHERE comment_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: '댓글을 찾을 수 없거나 삭제 권한이 없습니다.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[deleteComment]', err);
    res.status(500).json({ message: '댓글 삭제 실패' });
  }
};
