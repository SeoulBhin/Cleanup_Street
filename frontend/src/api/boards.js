import { del, getJSON, postJSON, putJSON } from "./http";

export function listBoardPosts(boardType, q = "", limit = 50, offset = 0) {
  const usp = new URLSearchParams();
  if (q) usp.set("q", q);
  usp.set("limit", limit);
  usp.set("offset", offset);
  return getJSON(`/api/boards/${encodeURIComponent(boardType)}?${usp}`);
}

export function getBoardPost(boardType, id) {
  return getJSON(`/api/boards/${encodeURIComponent(boardType)}/${id}`);
}

export function createBoardPost(boardType, body) {
  return postJSON(`/api/boards/${encodeURIComponent(boardType)}`, body);
}

export function updateBoardPost(boardType, id, body) {
  return putJSON(`/api/boards/${encodeURIComponent(boardType)}/${id}`, body);
}

export function deleteBoardPost(boardType, id) {
  return del(`/api/boards/${encodeURIComponent(boardType)}/${id}`);
}
