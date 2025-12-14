const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const {
  togglePostLike,
  getPostLikeState, 
} = require("../controllers/postReaction.controller");

router.post("/posts/:postId/like", requireAuth, togglePostLike);
router.get("/posts/:postId/like-state", requireAuth, getPostLikeState);

module.exports = router;
