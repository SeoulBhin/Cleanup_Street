// backend/utils/geocode.js
const fetch = require("node-fetch");

async function geocodeAddress(address) {
  if (!address) return null;

  const REST_KEY = process.env.KAKAO_REST_API_KEY_Value;
  if (!REST_KEY) {
    console.warn("⚠ KAKAO_REST_API_KEY 미설정 → 지오코딩 건너뜀");
    return null;
  }

  const url =
    "https://dapi.kakao.com/v2/local/search/address.json?query=" +
    encodeURIComponent(address);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${REST_KEY}`,
      },
    });

    if (!res.ok) {
      console.error("geocodeAddress error status:", res.status);
      return null;
    }

    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.documents) || data.documents.length === 0) {
      return null;
    }

    const doc = data.documents[0];
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    const normalizedAddress =
      (doc.road_address && doc.road_address.address_name) ||
      (doc.address && doc.address.address_name) ||
      address;

    return { lat, lng, normalizedAddress };
  } catch (err) {
    console.error("geocodeAddress fetch error:", err);
    return null;
  }
}

module.exports = { geocodeAddress };