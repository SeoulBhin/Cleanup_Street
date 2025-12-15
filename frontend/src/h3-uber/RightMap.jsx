import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Polygon,
} from "react-leaflet";
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import L from "leaflet";
import { latLngToCell, cellToBoundary } from "h3-js";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Leaflet 기본 마커 아이콘 경로 보정
L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow,
});

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="200"%3E%3Crect width="320" height="200" fill="%23232a3b"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%237884ab" font-size="14"%3E이미지 없음%3C/text%3E%3C/svg%3E';

export default function RightMap() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 지도 데이터 로딩
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/map", { credentials: "include" });
        if (!res.ok) throw new Error("지도 데이터를 불러오지 못했습니다.");
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || "알 수 없는 오류");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ 스팸 제외 (지도에 보여줄 데이터만)
  const mapItems = useMemo(() => {
    return (items || []).filter((item) => item?.category !== "스팸");
  }, [items]);


  // bounds 계산 (스팸 제외된 mapItems 기준)
  const bounds = useMemo(() => {
    return mapItems
      .map((item) => {
        const lat = parseFloat(item?.lat);
        const lng = parseFloat(item?.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      })
      .filter(Boolean);
  }, [mapItems]);

  const center = bounds[0] || [37.5665, 126.978]; // 서울 시청 기준

  return (
    <div className="map-section">
      <div className="map-header">
        <h2>실시간 제보 현황</h2>
        <p className="map-subtext">
          지도 마커를 클릭하면 제보 내용을 확인할 수 있습니다.
        </p>
      </div>

      {loading && <div className="map-status">지도 데이터를 불러오는 중...</div>}
      {error && !loading && <div className="map-status error">{error}</div>}

      <div className="map-container">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ✅ 핀 위치에 H3 육각형 표시 (스팸 제외된 mapItems만) */}
          {mapItems.map((item) => {
            const lat = parseFloat(item?.lat);
            const lng = parseFloat(item?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            // H3 인덱스 계산 (resolution 9: 도시 기준)
            const h3Index = latLngToCell(lat, lng, 9);

            // 육각형 꼭짓점 좌표 → Leaflet Polygon 좌표로 변환
            const hexBoundary = cellToBoundary(h3Index, true).map(
              ([hLng, hLat]) => [hLat, hLng]
            );

            return (
              <Polygon
                key={`hex-${item.id}-${item.image_variant || "N"}`}
                positions={hexBoundary}
                pathOptions={{
                  color: "#20b820",
                  weight: 1,
                  fillColor: "#20c420",
                  fillOpacity: 0.25,
                }}
              />
            );
          })}

          {/* ✅ 마커/팝업도 mapItems만 (스팸 제외) */}
          <MarkerClusterGroup chunkedLoading>
            {mapItems.map((item) => {
              const lat = parseFloat(item?.lat);
              const lng = parseFloat(item?.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

              const imageUrl = item?.image_url || FALLBACK_IMAGE;

              return (
                <Marker
                  position={[lat, lng]}
                  key={`${item.id}-${item.image_variant || "N"}`}
                >
                  <Popup>
                    <div className="map-popup">
                      <div className="map-popup-thumb">
                        <img
                          src={imageUrl}
                          alt={item?.title || "신고 이미지"}
                          loading="lazy"
                        />
                      </div>
                      <div className="map-popup-body">
                        <h3>{item?.title || "제목 없음"}</h3>
                        <p className="map-popup-meta">
                          주소: {item?.address || "미입력"}
                        </p>
                        <p className="map-popup-meta">
                          위도: {lat.toFixed(6)}, 경도: {lng.toFixed(6)}
                        </p>
                        <p className="map-popup-desc">
                          {item?.content
                            ? item.content.substring(0, 120)
                            : "내용 없음"}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>

          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
    </div>
  );
}
