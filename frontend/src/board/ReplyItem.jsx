import React, { useMemo, useState } from "react";
import { addReplyLike, reportReply } from "../api/boards";

export default function ReplyItem({ reply, onActionSuccess }) {
  // ✅ reply id 정규화 (comment_id / commentId 등 대비)
  const replyId = useMemo(
    () => reply?.id ?? reply?.comment_id ?? reply?.commentId,
    [reply]
  );

  const [isLiked, setIsLiked] = useState(!!reply.is_liked_by_me);
  const [likesCount, setLikesCount] = useState(reply.likes || 0);

  // 기능: 댓글 좋아요 토글
  const handleReplyLike = async () => {
    if (!replyId) {
      console.error("댓글 id가 없습니다:", reply);
      alert("댓글 식별자가 없어 좋아요를 처리할 수 없습니다.");
      return;
    }

    // Optimistic Update
    setIsLiked((prev) => {
      setLikesCount((c) => (prev ? c - 1 : c + 1));
      return !prev;
    });

    try {
      await addReplyLike(replyId);
      if (onActionSuccess) onActionSuccess();
    } catch (error) {
      console.error("댓글 좋아요 실패:", error);
      // 실패 시 롤백
      setIsLiked((prev) => {
        setLikesCount((c) => (prev ? c - 1 : c + 1));
        return !prev;
      });
      if (error?.status === 401) alert("로그인이 필요합니다.");
      else alert("댓글 좋아요 처리에 실패했습니다.");
    }
  };

  // 기능: 댓글 신고
  const handleReplyReport = async () => {
    if (!replyId) {
      console.error("댓글 id가 없습니다:", reply);
      alert("댓글 식별자가 없어 신고를 처리할 수 없습니다.");
      return;
    }

    const reason = window.prompt("신고 사유를 입력하세요");
    await reportReply(replyId, reason);
    
    if (!reason || !reason.trim()) return;

    try {
      await reportReply(replyId, reason.trim()); // ✅ reason 전달 필수
      alert("댓글 신고가 접수되었습니다.");
      if (onActionSuccess) onActionSuccess();
    } catch (error) {
      console.error("댓글 신고 실패:", error);
      if (error?.status === 401) alert("로그인이 필요합니다.");
      else alert("댓글 신고 처리에 실패했습니다.");
    }
  };

  return (
    <div className="reply-item">
      <div className="reply-meta">
        <span className="reply-author">{reply.author || "익명"}</span>
        <span className="reply-date">
          {reply.created_at ? new Date(reply.created_at).toLocaleString() : "-"}
        </span>
      </div>

      <p className="reply-content">{reply.content}</p>

      <div className="reply-actions">
        <button
          className={`btn-reply-action ${isLiked ? "active" : ""}`}
          onClick={handleReplyLike}
        >
          {isLiked ? "❤️" : "🤍"} {likesCount}
        </button>

        <button className="btn-reply-action btn-report-sm" onClick={handleReplyReport}>
          🚨 신고
        </button>
      </div>
    </div>
  );
}
