const fetch = require("node-fetch");
const h3 = require("h3-js");

async function geocodeNaver(address) {
  if (!address || !address.trim()) return null;

  const url =
    "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=" +
    encodeURIComponent(address.trim());

  try {
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID_Map,
        "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET_Map,
      },
    });

    if (!res.ok) {
      console.error("[GEOCODE] naver status:", res.status);
      return null;
    }

    const data = await res.json();
    if (!data.addresses || data.addresses.length === 0) return null;

    const a = data.addresses[0];

    const lat = Number(a.y);
    const lng = Number(a.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      h3Index: h3.geoToH3(lat, lng, 8),
    };
  } catch (err) {
    console.error("[GEOCODE] naver fetch error:", err);
    return null;
  }
}

module.exports = { geocodeNaver };
