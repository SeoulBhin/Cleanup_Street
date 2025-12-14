const db = require("../db");

// posts 테이블 기준으로 작성자 체크
exports.requirePostOwner = async (req, res, next) => {
  try {
    const postId = Number(req.params.postId || req.params.id);
    const me = Number(req.user?.id);

    if (!Number.isFinite(postId)) {
      return res.status(400).json({ error: "BAD_POST_ID" });
    }
    if (!Number.isFinite(me)) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const { rows } = await db.query(
      "SELECT user_id FROM posts WHERE post_id = $1",
      [postId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Post not found" });
    }

    const ownerId = Number(rows[0].user_id);
    if (ownerId !== me) {
      return res.status(403).json({ error: "FORBIDDEN", code: "NOT_AUTHOR" });
    }

    // 필요하면 다음 미들웨어/라우트에서 쓰라고 ownerId 저장
    req.ownerId = ownerId;
    next();
  } catch (e) {
    console.error("[requirePostOwner]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};
