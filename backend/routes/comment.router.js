const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listComments,
  addComment,
  editComment,
  deleteComment,
} = require("../controllers/comment.controller");

const router = express.Router();

router.get("/posts/:postId/comments", listComments);
router.post("/posts/:postId/comments", requireAuth, addComment);
router.put("/comments/:id", requireAuth, editComment);
router.delete("/comments/:id", requireAuth, deleteComment);

module.exports = router;
