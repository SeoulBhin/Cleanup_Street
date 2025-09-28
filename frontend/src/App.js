import React, { useState } from "react";
import axios from "axios";

function App() {
  const [message, setMessage] = useState("");

  const testApi = async () => {
    try {
      const res = await axios.get("/api/hello");
      setMessage(res.data);
    } catch (err) {
      setMessage("❌ 백엔드 연결 실패");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Cleanup Street 개발 환경</h1>
      <button onClick={testApi}>API 연결 테스트</button>
      <p>{message}</p>
    </div>
  );
}

export default App;
