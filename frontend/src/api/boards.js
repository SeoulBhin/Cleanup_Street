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
    ...body,                             // 🔥 postBody 포함해서 전부 전달
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
