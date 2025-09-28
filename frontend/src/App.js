import axios from "axios";
import { useState } from "react";

function App() {
  const [status, setStatus] = useState("Not checked");

  const checkBackend = async () => {
    try {
      const res = await axios.get("/api/hello");
      setStatus("✅ Backend OK: " + res.data);
    } catch (err) {
      setStatus("❌ Backend failed");
    }
  };

  return (
    <div>
      <h1>Cleanup Street</h1>
      <button onClick={checkBackend}>Check Backend</button>
      <p>{status}</p>
    </div>
  );
}

export default App;
