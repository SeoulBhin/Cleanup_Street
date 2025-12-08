async function geocodeNaver(address) {
  if (!address || !address.trim()) return null;

  const url =
    "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=" +
    encodeURIComponent(address.trim());

  try {
    console.log("[GEOCODE] naver request address:", address);

    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID_Map,
        "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET_Map,
      },
    });

    const text = await res.text();       // 🔥 응답 몸통도 같이 찍자
    if (!res.ok) {
      console.error("[GEOCODE] naver status:", res.status, text);
      return null;
    }

    const data = JSON.parse(text);
    if (!data.addresses || data.addresses.length === 0) {
      console.warn("[GEOCODE] naver no addresses:", data);
      return null;
    }

    const a = data.addresses[0];
    const lat = Number(a.y);
    const lng = Number(a.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn("[GEOCODE] naver invalid coords:", a);
      return null;
    }

    console.log("[GEOCODE] naver success:", lat, lng);

    return {
      lat,
      lng,
      roadAddress: a.roadAddress || a.jibunAddress || address,
    };
  } catch (err) {
    console.error("[GEOCODE] naver error:", err);
    return null;
  }
}
