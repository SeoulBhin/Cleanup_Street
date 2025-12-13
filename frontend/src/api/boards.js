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

// ✅ 새 글 작성은 /api/posts 로 보내고, body 전체를 그대로 전달
export function createBoardPost(boardType, body) {
  return postJSON(`/api/posts`, {
    ...body, // postBody 포함
    category: body.category,
  });
}

// 수정은 아직 board-posts 에 맡겨둔다면 이대로 두면 됨
export function updateBoardPost(boardType, id, body) {
  return putJSON(`/api/board-posts/${id}`, {
    ...body,
    category: boardType || body.category,
  });
}

export function deleteBoardPost(boardType, id) {
  return del(`/api/board-posts/${id}`);
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
   (이 경로는 서버 라우터에 따라 달라질 수 있음)
========================= */
export function reportReply(replyId, reason) {
    return postJSON(`/api/report/comment/${replyId}`, { reason });
}

// 댓글 수정
export function updateReply(replyId, content) {
  return putJSON(`/api/comments/${replyId}`, { content });
}

// 댓글 삭제
export function deleteReply(replyId) {
  return del(`/api/comments/${replyId}`);
}