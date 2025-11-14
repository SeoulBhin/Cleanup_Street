const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { togglePostLike } = require('../controllers/postReaction.controller');
router.post('/posts/:postId/reactions/like', requireAuth, togglePostLike);

module.exports = router;
