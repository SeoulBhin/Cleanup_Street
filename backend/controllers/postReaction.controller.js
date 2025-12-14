const { pool } = require("../db");

exports.togglePostLike = async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = Number(req.params.postId);

    if (!Number.isFinite(postId)) {
      return res.status(400).json({ message: "BAD_POST_ID" });
    }

    const postResult = await pool.query(
      `SELECT user_id, title
        FROM public.posts
        WHERE post_id = $1`,
      [postId]
    );

    if (!postResult.rowCount) {
      return res.status(404).json({ message: "POST_NOT_FOUND" });
    }

    const postOwnerId = postResult.rows[0].user_id;
    const postTitle = postResult.rows[0].title;

    const existing = await pool.query(
      `SELECT reaction_id
        FROM public.post_reactions
        WHERE post_id = $1
          AND user_id = $2
          AND reaction_type = 'like'`,
      [postId, userId]
    );

    if (existing.rowCount) {
      await pool.query(
        `DELETE FROM public.post_reactions
          WHERE reaction_id = $1`,
        [existing.rows[0].reaction_id]
      );

      return res.json({ liked: false });
    }

    const likeInsert = await pool.query(
      `INSERT INTO public.post_reactions (post_id, user_id, reaction_type)
        VALUES ($1, $2, 'like')
        ON CONFLICT (post_id, user_id, reaction_type) DO NOTHING
        RETURNING reaction_id`,
      [postId, userId]
    );

    if (!likeInsert.rowCount) {
      return res.json({ liked: true });
    }

    if (postOwnerId && postOwnerId !== userId) {
      const likeMsg = `회원님의 게시글 "${postTitle}"에 좋아요가 눌렸습니다.`;

      const alertInsert = await pool.query(
        `INSERT INTO public.alerts_master (message, target_type, target_id)
          VALUES ($1, 'POST_LIKE', $2)
          RETURNING alert_id`,
        [likeMsg, postId]
      );

      const newAlertId = alertInsert.rows[0].alert_id;

      await pool.query(
        `INSERT INTO public.user_alerts (user_id, alert_id)
          VALUES ($1, $2)`,
        [postOwnerId, newAlertId]
      );
    }

    return res.json({ liked: true });
  } catch (err) {
    console.error("[togglePostLike] error:", err);
    return res.status(500).json({ message: "LIKE_TOGGLE_FAILED" });
  }
};

// ======================================================
// ✅ 추가 API: 좋아요 상태/개수만 조회 (posts 조회 SQL 수정 없이 해결)
// GET /api/posts/:postId/like-state (requireAuth)
// ======================================================
exports.getPostLikeState = async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId)) {
      return res.status(400).json({ message: "BAD_POST_ID" });
    }

    // ✅ 너 auth 미들웨어가 decoded를 req.user에 그대로 넣으니까 id/userId 둘 다 대응
    const userId = Number(req.user?.id ?? req.user?.userId ?? req.user?.user_id);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ message: "UNAUTHORIZED" });
    }

    // 좋아요 개수
    const cnt = await pool.query(
      `
      SELECT COUNT(*)::int AS likes
      FROM public.post_reactions
      WHERE post_id = $1
        AND reaction_type = 'like'
      `,
      [postId]
    );

    // 내가 눌렀는지
    const me = await pool.query(
      `
      SELECT 1
      FROM public.post_reactions
      WHERE post_id = $1
        AND user_id = $2
        AND reaction_type = 'like'
      LIMIT 1
      `,
      [postId, userId]
    );

    return res.json({
      likes: cnt.rows[0]?.likes ?? 0,
      liked: !!me.rowCount,
    });
  } catch (err) {
    console.error("[getPostLikeState] error:", err);
    return res.status(500).json({ message: "LIKE_STATE_FAILED" });
  }
};
