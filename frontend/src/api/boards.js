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

export function createBoardPost(boardType, body) {
  return postJSON(`/api/board-posts`, {
    ...body,
    category: boardType,
  });
}

export function updateBoardPost(boardType, id, body) {
  return putJSON(`/api/board-posts/${id}`, {
    ...body,
    category: boardType,
  });
}

export function deleteBoardPost(boardType, id) {
  return del(`/api/board-posts/${id}`);
}
