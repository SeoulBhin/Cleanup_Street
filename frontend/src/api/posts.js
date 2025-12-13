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

/**
 * 게시글 생성
 * - KoBERT 자동 분류(autoCategory) 기본 사용
 * - category를 넘기면: 수동 카테고리 우선, autoCategory=true이면 KoBERT 결과로 덮어쓸 수 있음(백엔드 로직에 따름)
 * - previewId / selectedVariant / address / attachments 전송
 */
export function createPost({
  userId = 1,
  title,
  content,
  category = null,        // 사용자가 고른 카테고리(없으면 null)
  address = null, 
  latitude = null,
  longitude = null,
  h3Index = null,
  attachments = [],       // 원본/추가 이미지 URL 배열
  autoCategory = true,    // 기본값: 자동 분류 사용
  previewId = null,       // 이미지 미리보기 ID
  selectedVariant = "AUTO", // "AUTO" | "PLATE_VISIBLE"
  address = null,         // 도로명 주소(카카오/네이버 검색 값)
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
    autoCategory,      // KoBERT 호출 플래그
    previewId,
    selectedVariant,
    address,
  });
}

/** 게시글 수정
 *  - body는 PostForm 등에서 그대로 구성해서 넘기는 방식 유지
 *  - (title, postBody, category, latitude, longitude, h3Index, previewId, address, attachments 등)
 */
export function updatePost(id, body) {
  return putJSON(`/api/posts/${id}`, body);
}

/** 게시글 삭제 */
export function deletePost(id) {
  return del(`/api/posts/${id}`);
}
