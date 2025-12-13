// src/api/boards.js
import { del, getJSON, postJSON, putJSON } from "./http";

export function listBoardPosts(boardType, q = "", opts = {}) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  return getJSON(`/api/posts?limit=${limit}&offset=${offset}`);
}

// ✅ 상세 조회도 posts.js로 통일
export function getBoardPost(boardType, id) {
  return getJSON(`/api/posts/${id}`);
}

// ✅ 새 글 작성: content -> postBody 변환 + category 결정
export function createBoardPost(boardType, body) {
  const { userId, user_id, content, postBody, ...rest } = body || {};

  const finalCategory = (rest.category ?? boardType ?? "기타");
  const finalPostBody = (content ?? postBody ?? "").toString();

  return postJSON(`/api/posts`, {
    ...rest,
    category: finalCategory,
    postBody: finalPostBody,
  });
}

// ✅ 수정: content -> postBody 변환 + category 결정
export function updateBoardPost(boardType, id, body) {
  const { userId, user_id, content, postBody, ...rest } = body || {};

  const finalCategory = (rest.category ?? boardType ?? "기타");
  const finalPostBody = (content ?? postBody ?? "").toString();

  return putJSON(`/api/posts/${id}`, {
    ...rest,
    category: finalCategory,
    postBody: finalPostBody,
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
