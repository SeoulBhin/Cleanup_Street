// src/api/public.js

async function getJSON(path) {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error("fetch error");
  return res.json();
}

export async function getAnnouncements() {
  try {
    return await getJSON("/api/announcements");
  } catch {
    return [
      { id: 1, title: "[필독] 와챠우! 커뮤니티 이용 규칙 안내", author: "관리자", date: "2025-10-15" },
      { id: 2, title: "개인정보 처리 방침 개정 안내", author: "관리자", date: "2025-10-10" },
      { id: 3, title: "서버 점검 예정 (오전 2시 ~ 4시)", author: "관리자", date: "2025-10-05" },
    ];
  }
}
export async function getGallery() {
  const base = window.location.origin.includes('5173')
    ? 'http://localhost:8080'
    : window.location.origin;

  return [
    { id: 1, url: `${base}/gallery/1.png`, caption: "고장난 가로등 신고 후 수리" },
    { id: 2, url: `${base}/gallery/2.png`, caption: "도로 파손 정비 전/후" },
    { id: 3, url: `${base}/gallery/3.png`, caption: "공원 쓰레기 정리 캠페인" },
    { id: 4, url: `${base}/gallery/4.png`, caption: "불법 투기 단속 현장" },
    { id: 5, url: `${base}/gallery/5.png`, caption: "커뮤니티 합동 정화 활동" },
    { id: 6, url: `${base}/gallery/6.png`, caption: "깨끗해진 벤치 주변" },
  ];
}