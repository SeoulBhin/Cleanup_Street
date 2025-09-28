import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [message, setMessage] = useState("⏳ 백엔드 연결 확인 중...");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    axios
      .get("/api/hello")
      .then((res) => {
        setMessage("✅ 백엔드 연결 성공: " + res.data);
        setStatus("success");
      })
      .catch(() => {
        setMessage("❌ 백엔드 연결 실패 (API 응답 없음)");
        setStatus("error");
      });
  }, []);

  return (
    <div style={{
      fontFamily: "sans-serif",
      textAlign: "center",
      marginTop: "50px"
    }}>
      <h1>Cleanup Street 테스트 페이지</h1>
      <p style={{
        fontSize: "1.2rem",
        fontWeight: "bold",
        color: status === "success" ? "green" : status === "error" ? "red" : "gray"
      }}>
        {message}
      </p>
      <button onClick={() => window.location.reload()}>
        🔄 다시 시도
      </button>
    </div>
  );
}

export default App;
