import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useParams } from "react-router-dom";

export default function Chat() {
  const { roomId } = useParams();
  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    const url =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_SOCKET_URL) ||
      (typeof process !== "undefined" && process.env?.REACT_APP_SOCKET_URL) ||
      (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE) ||
      window.location.origin;

    const s = io(url, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = s;
    s.emit("join", { roomId });
    // s.emit("room:join", roomId); // 서버가 room:join 사용 시

    const onMsg = (m) => setLogs((prev) => [...prev, m]);
    s.on("msg", onMsg);

    return () => {
      s.off("msg", onMsg);
      s.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  const send = () => {
    if (!msg.trim() || !socketRef.current) return;
    const payload = { roomId, text: msg, ts: Date.now() };

    socketRef.current.emit("msg", payload);
    // socketRef.current.emit("chat:send", payload);

    setLogs((prev) => [...prev, { ...payload, from: "me" }]);
    setMsg("");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>채팅방</h2>

      <div
        style={{
          height: 360,
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          overflowY: "auto",
          marginBottom: 12,
          background: "#fff",
        }}
      >
        {logs.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <span style={{ color: "#999", marginRight: 8 }}>
              {new Date(m.ts || Date.now()).toLocaleTimeString()}
            </span>
            <span>{m.text ?? String(m)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          style={{ flex: 1, resize: "vertical" }}
          placeholder="메시지 입력 후 Enter 전송 (줄바꿈: Shift+Enter)"
        />
        <button onClick={send}>보내기</button>
      </div>
    </div>
  );
}
