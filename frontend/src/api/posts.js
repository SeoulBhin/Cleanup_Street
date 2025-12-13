// src/api/posts.js
import { getJSON, postJSON, putJSON, del } from "./http";

/** 게시글 목록 조회 */
export function listPosts(limit = 50, offset = 0) {
  return getJSON(`/api/posts?limit=${limit}&offset=${offset}`);
}

/** 게시글 단일 조회 */
export function getPost(id) {
  return getJSON(`/api/posts/${id}`);
}

/** 게시글 생성 (모자이크 미리보기 제거됨) */
export function createPost({
  userId = 1,
  title,
  content,
  category,
  address = null,
  latitude = null,
  longitude = null,
  h3Index = null,
  attachments = [],
}) {
  return postJSON(`/api/posts`, {
    userId,
    title,
    postBody: content,
    category,
    address,
    latitude,
    longitude,
    h3Index,
    attachments,
  });
}

/** 게시글 수정 */
export function updatePost(id, body) {
  return putJSON(`/api/posts/${id}`, body);
}

/** 게시글 삭제 */
export function deletePost(id) {
  return del(`/api/posts/${id}`);
}
