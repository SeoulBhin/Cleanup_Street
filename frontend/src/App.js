import React from "react";
import BackendStatus from "./components/BackendStatus";
import "./App.css";

function App() {
  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>React + Spring 연결 테스트</h1>
      <BackendStatus />
    </div>
  );
}

export default App;
