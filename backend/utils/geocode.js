// backend/utils/geocode.js
const fetch = require("node-fetch");
const h3 = require("h3-js");

// 네이버 지오코딩
async function geocodeNaver(address) {
  if (!address) return null;

  const url =
    "https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=" +
    encodeURIComponent(address);

  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID_Map,
      "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET_Map,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error("[GEOCODE] naver status:", res.status);
    return null;
  }

  const data = await res.json();
  if (!data.addresses || data.addresses.length === 0) return null;

  const a = data.addresses[0];
  const lat = Number(a.y); // 위도
  const lng = Number(a.x); // 경도

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // H3 인덱스 계산 (예외 보호)
  let h3Index = null;
  try {
    h3Index = h3.geoToH3(lat, lng, 8);
  } catch (err) {
    console.error("[GEOCODE] H3 변환 실패:", err);
    h3Index = null;
  }

  return {
    lat,
    lng,
    h3Index,
    normalizedAddress: a.roadAddress || a.jibunAddress || address,
  };
}

// 옛 코드 호환용
async function geocodeAddress(address) {
  return geocodeNaver(address);
}

module.exports = { geocodeNaver, geocodeAddress };
