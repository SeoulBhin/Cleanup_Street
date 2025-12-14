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

// src/api/boards.js 등
export function createBoardPost(boardType, body) {
  // category, userId 계열은 여기서 버립니다.
  const { userId, user_id, content, postBody, category, ...rest } = body || {};

  const finalPostBody = (content ?? postBody ?? "").toString();

  return postJSON(`/api/posts`, {
    ...rest,
    postBody: finalPostBody,
    autoCategory: true,   // ✅ 항상 자동 분류
    // category는 아예 보내지 않음
  });
}


export function updateBoardPost(boardType, id, body) {
  const { userId, user_id, content, postBody, autoCategory, ...rest } = body || {};
  const finalPostBody = (content ?? postBody ?? "").toString();

  // ✅ 자동분류는 "명시적으로 true로 들어온 경우에만" 켭니다.
  const wantAuto = autoCategory === true;

  const payload = {
    ...rest,
    postBody: finalPostBody,
    autoCategory: wantAuto,
  };

  // ✅ 자동분류면 category를 보내지 않습니다(서버가 분류).
  // ✅ 자동분류가 아니면 category가 들어온 경우에만 보냅니다.
  if (!wantAuto && rest.category != null) payload.category = rest.category;

  return putJSON(`/api/posts/${id}`, payload);
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
   ✅ 게시글 신고
   POST /api/report/posts/:id (requireAuth)
========================= */
export function reportPost(boardType, postId, reason) {
  return postJSON(`/api/report/posts/${postId}`, { reason });
}

/* =========================
   ✅ 댓글 API
   GET  /api/posts/:postId/comments
   POST /api/posts/:postId/comments (requireAuth)
========================= */
export function listReplies(boardType, postId) {
  return getJSON(`/api/posts/${postId}/comments`);
}

export function submitReply(boardType, postId, content, parentId = null) {
  return postJSON(`/api/posts/${postId}/comments`, {
    content,
    parent_id: parentId, // ✅ 핵심: 백엔드가 받는 키 이름
  });
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
    reason,
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

/* =========================
   ✅ (추가) 게시글 좋아요 상태/개수 조회
   GET /api/posts/:postId/like-state (requireAuth)
========================= */
export function getPostLikeState(postId) {
  return getJSON(`/api/posts/${postId}/like-state`);
}
