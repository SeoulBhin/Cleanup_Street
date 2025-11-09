import { useEffect, useState } from "react";

export default function BackendStatus() {
  const [status, setStatus] = useState("백엔드 연결 확인 중...");
  const [color, setColor] = useState("gray");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setStatus(`✅ 백엔드 연결 성공: ${text}`);
        setColor("green");
      })
      .catch((err) => {
        setStatus(`❌ 백엔드 연결 실패: ${err.message}`);
        setColor("red");
      });
  }, []);

  return (
    <div
      style={{
        padding: "1rem",
        border: `2px solid ${color}`,
        borderRadius: "8px",
        margin: "1rem",
        backgroundColor: "#f9f9f9",
      }}
    >
      <h3>Spring Backend 상태</h3>
      <p style={{ color, fontWeight: "bold" }}>{status}</p>
    </div>
  );
}
