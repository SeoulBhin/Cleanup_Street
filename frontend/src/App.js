import React, { useState } from "react";
import axios from "axios";

function App() {
  const [msg, setMsg] = useState("");

  const checkBackend = async () => {
    try {
      const res = await axios.get("/api/hello");
      setMsg(res.data);
    } catch (err) {
      setMsg("❌ 백엔드 연결 실패!");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Cleanup Street 테스트</h1>
      <button onClick={checkBackend}>API 연결 테스트</button>
      <p>{msg}</p>
    </div>
  );
}

export default App;
