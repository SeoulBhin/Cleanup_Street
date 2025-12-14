import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useParams } from "react-router-dom";

export default function Chat() {
  const { roomId } = useParams();

  const [roomName, setRoomName] = useState(roomId); // 기본값은 roomId
  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState("");
  const socketRef = useRef(null);

  // ✅ roomId로 roomName 가져오기
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/gallery");
        const list = await res.json();
        const found = list.find((x) => x.roomId === roomId);
        if (alive) setRoomName(found?.roomName || roomId);
      } catch {
        if (alive) setRoomName(roomId);
      }
    })();

    return () => {
      alive = false;
    };
  }, [roomId]);

  // ✅ 소켓 연결 + 방 입장
  useEffect(() => {
    const url =
      (typeof process !== "undefined" && process.env?.REACT_APP_SOCKET_URL) ||
      (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE) ||
      window.location.origin;

    const s = io(url, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = s;

    s.emit("join", { roomId });
    s.emit("read_messages", { roomId });

    const onMsg = (m) => setLogs((prev) => [...prev, m]);
    s.on("msg", onMsg);

    return () => {
      // (권장) 방 나가기 신호
      s.emit("leave", { roomId });

      s.off("msg", onMsg);
      s.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  const send = () => {
    if (!msg.trim() || !socketRef.current) return;

    const payload = { roomId, text: msg, ts: Date.now() };
    socketRef.current.emit("msg", payload);

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
    <div className="chat-page-container fade-in">
      <h2 className="chat-title">채팅방: {roomName}</h2>

      <div className="chat-log-box">
        {logs.map((m, i) => (
          <div
            key={i}
            className={`chat-message ${m.from === "me" ? "message-me" : "message-other"}`}
          >
            <span className="message-time">
              {new Date(m.ts || Date.now()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="message-bubble">{m.text ?? String(m)}</span>
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={onKey}
          rows={3}
          className="chat-textarea"
          placeholder="메시지 입력 후 Enter 전송 (줄바꿈: Shift+Enter)"
        />
        <button className="chat-send-btn btn-submit" onClick={send}>
          보내기
        </button>
      </div>
    </div>
  );
}
