import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useParams } from "react-router-dom";

export default function Chat() {
  const { roomId } = useParams();
  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    // 환경 변수에서 Socket URL을 가져옵니다.
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
    
    // 💡 안 읽은 메시지 처리: 채팅방 진입 시 '읽음' 신호를 서버에 전송합니다.
    s.emit("read_messages", { roomId }); 

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
      <h2 className="chat-title">채팅방: {roomId}</h2>

      <div className="chat-log-box">
        {logs.map((m, i) => (
          <div 
            key={i} 
            // 'from' 필드를 사용하여 내 메시지/상대방 메시지 구분
            className={`chat-message ${m.from === "me" ? "message-me" : "message-other"}`}
          >
            <span className="message-time">
              {new Date(m.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="message-bubble">{m.text ?? String(m)}</span>
            {/* 💡 안 읽은 메시지 배지 (실제로는 서버 데이터에 의존해야 함) */}
            {/* <span className="unread-badge">1</span> */}
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
