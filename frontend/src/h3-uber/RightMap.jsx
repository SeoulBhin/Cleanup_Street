import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup } from "react-leaflet";
import { cellToBoundary, latLngToCell } from "h3-js";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// 리프렛 기본 아이콘 세팅
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// 서울 시청 근처
const CENTER = [37.5665, 126.978];
// 🔹 핀 주변 육각형 크기 (숫자↑ = 더 작은 셀)
// 9~11 정도가 시내 기준 적당, 일단 10으로
const H3_RESOLUTION = 9;

export default function RightMap() {
  const [points, setPoints] = useState([]);

  // 서버에서 지도용 포인트 가져오기
  useEffect(() => {
    fetch("/api/map")
      .then((r) => r.json())
      .then((data) => {
        console.log("[/api/map] 응답:", data);
        setPoints(Array.isArray(data) ? data : []);
      })
      .catch((e) => console.error("지도 데이터 실패:", e));
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100vh - 160px)", // 상단 헤더+네비 높이만큼 빼줌
        borderRadius: "1rem",
        overflow: "hidden",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
        backgroundColor: "#e5e7eb",
      }}
    >
      <MapContainer
        center={CENTER}
        zoom={15}
        style={{ width: "100%", height: "100%" }}
      >
        {/* 🔁 OSM → 백엔드 프록시 타일 사용 */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="/tiles/{z}/{x}/{y}.png"
        />

        {/* 🔹 서버(/api/map)에서 내려온 포인트들 */}
        {points.map((p, i) => {
          const hasLat = p.lat !== null && p.lat !== undefined;
          const hasLng = p.lng !== null && p.lng !== undefined;
          if (!hasLat || !hasLng) return null;

          const lat = Number(p.lat);
          const lng = Number(p.lng);

          // ✅ 각 포인트를 중심으로 하는 작은 육각형 셀 계산
          let boundary = null;
          try {
            const cell = latLngToCell(lat, lng, H3_RESOLUTION);
            boundary = cellToBoundary(cell, true).map(([bLng, bLat]) => [
              Number(bLat),
              Number(bLng),
            ]);
          } catch (e) {
            console.warn("cellToBoundary 실패:", { title: p.title, p, e });
          }

          return (
            <React.Fragment key={p.id ?? `${i}-${lat},${lng}`}>
              {/* 핀 주변 작은 육각형 */}
              {Array.isArray(boundary) && boundary.length >= 3 && (
                <Polygon
                  positions={boundary}
                  pathOptions={{
                    color: "#259300ff",   // 테두리 색
                    fillColor: "#4cfb06ff", // 채우기 색
                    fillOpacity: 0.4,
                    weight: 2,
                  }}
                />
              )}

              {/* 마커(핀) */}
              <Marker position={[lat, lng]}>
                <Popup>
                  <strong>{p.title || "제목 없음"}</strong>
                  <br />
                  위도: {lat.toFixed(5)}, 경도: {lng.toFixed(5)}
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
