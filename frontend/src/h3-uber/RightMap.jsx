/*
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

        <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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
*/

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
// 9~11 정도가 시내 기준 적당
const H3_RESOLUTION = 9;

export default function RightMap() {
  const [points, setPoints] = useState([]);

  // 서버에서 지도용 포인트 가져오기
  useEffect(() => {
    fetch("/api/map")
      .then((r) => r.json())
      .then((raw) => {
        console.log("[/api/map] raw 응답:", raw);

        // 1) 배열이면 그대로 사용
        if (Array.isArray(raw)) {
          setPoints(raw);
          return;
        }

        // 2) { rows: [...] } 형태면 rows 사용
        if (raw && Array.isArray(raw.rows)) {
          setPoints(raw.rows);
          return;
        }

        console.warn("/api/map 응답 형식이 예상과 다름:", raw);
        setPoints([]);
      })
      .catch((e) => {
        console.error("지도 데이터 실패:", e);
        setPoints([]);
      });
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100vh - 160px)",
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
        {/* 🔁 OSM 서버 직접 사용 (프록시 X) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 🔹 서버(/api/map)에서 내려온 포인트들 */}
        {points.map((p, i) => {
          // lat / lng / latitude / longitude 아무거나 와도 잡아주기
          const lat = Number(
            p.lat ?? p.latitude ?? p.Latitude ?? p.LAT ?? p.y
          );
          const lng = Number(
            p.lng ?? p.longitude ?? p.Longitude ?? p.LNG ?? p.x
          );
          const thumbnail =
            p.image_url ||
            p.imageUrl ||
            p.image ||
            p.thumbnail ||
            (Array.isArray(p.images) && p.images[0]?.imageUrl) ||
            null;
          const imageVariant = p.image_variant || p.imageVariant || "";
          const contentSnippet =
            (p.content && String(p.content).slice(0, 120)) || "";

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn("좌표가 이상해서 스킵:", p);
            return null;
          }

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
                    color: "#259300",      // 테두리 색
                    fillColor: "#4cfb06",  // 채우기 색
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
                  {contentSnippet && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "#6b7280",
                        maxWidth: 220,
                        wordBreak: "break-word",
                      }}
                    >
                      {contentSnippet}
                    </div>
                  )}
                  {thumbnail && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={thumbnail}
                        alt={p.title || "post image"}
                        style={{
                          width: 220,
                          height: 140,
                          objectFit: "cover",
                          borderRadius: 8,
                          display: "block",
                          border: "1px solid #e5e7eb",
                        }}
                        loading="lazy"
                      />
                      {imageVariant ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            marginTop: 4,
                          }}
                        >
                          {imageVariant}
                        </div>
                      ) : null}
                    </div>
                  )}
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
