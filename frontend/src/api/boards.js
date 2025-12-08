// src/api/boards.js
import { del, getJSON, postJSON, putJSON } from "./http";

// 목록 조회: boardType, q를 그대로 서버에 전달
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

// ✅ 새 글 작성: /api/posts 사용, category는 body 안의 값 그대로 사용
export function createBoardPost(boardType, body) {
  return postJSON(`/api/posts`, {
    ...body,
    category: boardType,
    postBody: body.content   // 🔥 핵심: postBody 추가
  });
}

// ✅ 글 수정: 여전히 /api/board-posts/:id 사용 (지오코드 로직 여기에 있음)
export function updateBoardPost(boardType, id, body) {
  return putJSON(`/api/board-posts/${id}`, {
    ...body,
  });
}

// 삭제는 그대로 /api/board-posts/:id 사용
export function deleteBoardPost(boardType, id) {
  return del(`/api/board-posts/${id}`);
}
