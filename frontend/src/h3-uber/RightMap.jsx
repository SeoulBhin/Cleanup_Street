import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import L from "leaflet";
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/map", { credentials: "include" });
        if (!res.ok) throw new Error("지도 데이터를 불러오지 못했습니다.");
        const data = await res.json();
        if (!cancelled) setItems(data || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const bounds = useMemo(() => {
    return items
      .map((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      })
      .filter(Boolean);
  }, [items]);

  const center = bounds[0] || [37.5665, 126.978];

  return (
    <div className="map-section">
      <div className="map-header">
        <h2>현장 신고 지도</h2>
        <p className="map-subtext">
          지도 마커를 클릭하면 신고 내용과 썸네일을 확인할 수 있습니다.
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

          <MarkerClusterGroup chunkedLoading>
            {items.map((item) => {
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              const imageUrl = item.image_url || FALLBACK_IMAGE;
              return (
                <Marker position={[lat, lng]} key={`${item.id}-${item.image_variant || "N"}`}>
                  <Popup>
                    <div className="map-popup">
                      <div className="map-popup-thumb">
                        <img
                          src={imageUrl}
                          alt={item.title || "신고 이미지"}
                          loading="lazy"
                        />
                      </div>
                      <div className="map-popup-body">
                        <h3>{item.title || "제목 없음"}</h3>
                        <p className="map-popup-meta">
                          위도: {lat.toFixed(6)}, 경도: {lng.toFixed(6)}
                        </p>
                        <p className="map-popup-desc">
                          {item.content ? item.content.substring(0, 120) : "내용 없음"}
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
