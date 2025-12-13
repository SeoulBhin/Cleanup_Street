// src/api/boards.js
import { del, getJSON, postJSON, putJSON } from "./http";

export function listBoardPosts(boardType, q = "") {
  return getJSON(
    `/api/board-posts?boardType=${encodeURIComponent(
      boardType
    )}&q=${encodeURIComponent(q)}`
  );
}

// 상세 조회는 그대로 board-posts 사용
export function getBoardPost(boardType, id) {
  return getJSON(`/api/board-posts/${id}`);
}

// ✅ 새 글 작성: userId/user_id 같은 필드는 프론트에서 보내지 않음 (서버가 토큰으로 결정)
export function createBoardPost(boardType, body) {
  const { userId, user_id, ...safeBody } = body || {};
  return postJSON(`/api/posts`, {
    ...safeBody,
    category: safeBody.category,
  });
}

// ✅ 수정도 마찬가지로 userId 계열 제거 (안전장치)
export function updateBoardPost(boardType, id, body) {
  const { userId, user_id, ...safeBody } = body || {};
  return putJSON(`/api/posts/${id}`, {
    ...safeBody,
    category: boardType || safeBody.category,
  });
}

export function deleteBoardPost(boardType, id) {
  return del(`/api/posts/${id}`);
}

/* =========================
   ✅ 게시글 좋아요
   POST /api/posts/:postId/like (requireAuth)
========================= */
export function addLike(boardType, postId) {
  return postJSON(`/api/posts/${postId}/like`);
}

/* =========================
   ✅ 댓글 API
   GET  /api/posts/:postId/comments
   POST /api/posts/:postId/comments (requireAuth)
========================= */
export function listReplies(boardType, postId) {
  return getJSON(`/api/posts/${postId}/comments`);
}

export function submitReply(boardType, postId, content) {
  return postJSON(`/api/posts/${postId}/comments`, { content });
}

/* =========================
   ✅ 댓글 좋아요
   POST /api/comments/:id/like (requireAuth)
========================= */
export function addReplyLike(replyId) {
  return postJSON(`/api/comments/${replyId}/like`);
}

/* =========================
   ✅ 댓글 신고
========================= */
export function reportReply(replyId, reason) {
  return postJSON(`/api/report/comment/${replyId}`, {
    reason, // ✅ 서버가 기대하는 필드명
  });
}

// 댓글 수정
export function updateReply(replyId, content) {
  return putJSON(`/api/comments/${replyId}`, { content });
}

// 댓글 삭제
export function deleteReply(replyId) {
  return del(`/api/comments/${replyId}`);
}
