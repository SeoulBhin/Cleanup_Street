// src/api/boards.js
import { del, getJSON, postJSON, putJSON } from "./http";

export function listBoardPosts(boardType, q = "") {
  return getJSON(
    `/api/board-posts?boardType=${encodeURIComponent(
      boardType
    )}&q=${encodeURIComponent(q)}`
  );
}

export function getBoardPost(boardType, id) {
  return getJSON(`/api/board-posts/${id}`);
}

// ✅ 게시판 작성은 /api/posts 로 보내기
export function createBoardPost(boardType, body) {
  return postJSON(`/api/posts`, {
    ...body,
    category: boardType,
  });
}

// ✅ 게시판 수정도 /api/posts/:id 로 보내기
export function updateBoardPost(boardType, id, body) {
  return putJSON(`/api/posts/${id}`, {
    ...body,
    category: boardType,
  });
}

// 삭제는 아직 board-posts 라우터에 없음 → 필요하면 posts로 맞춰야 함
export function deleteBoardPost(boardType, id) {
  return del(`/api/board-posts/${id}`);
}
