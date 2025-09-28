import React from "react";
import BackendStatus from "./components/BackendStatus";
import "./App.css";

function App() {
  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Cleanup Street 무중단 배포 테스트</h1>
      <BackendStatus />
    </div>
  );
}

export default App;
