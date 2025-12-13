import React, { useState } from 'react';
import { addReplyLike, reportReply } from '../api/boards'; 

export default function ReplyItem({ reply, onActionSuccess }) {
  // ✅ 댓글 id 정규화 (서버가 id / comment_id / commentId 중 뭐로 주든 대응)
  const replyId = reply.id ?? reply.comment_id ?? reply.commentId;

  const [isLiked, setIsLiked] = useState(reply.is_liked_by_me || false); 
  const [likesCount, setLikesCount] = useState(reply.likes || 0);

  const handleReplyLike = async () => {
    if (!replyId) {
      console.error("댓글 ID가 없습니다. reply=", reply);
      alert("댓글 ID가 없습니다(서버 응답 키 확인 필요)");
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
      // 실패 시 UI 롤백
      setIsLiked((prev) => !prev);
      setLikesCount((c) => (isLiked ? c + 1 : c - 1));
    }
  };

  const handleReplyReport = async () => {
    if (!replyId) {
      console.error("댓글 ID가 없습니다. reply=", reply);
      alert("댓글 ID가 없습니다(서버 응답 키 확인 필요)");
      return;
    }

    if (window.confirm("정말 이 댓글을 신고하시겠습니까?")) {
      try {
        await reportReply(replyId);
        alert("댓글 신고가 접수되었습니다.");
        if (onActionSuccess) onActionSuccess();
      } catch (error) {
        console.error("댓글 신고 실패:", error);
        alert("댓글 신고 처리에 실패했습니다.");
      }
    }
  };

  return (
    <div className="reply-item">
      <div className="reply-meta">
        <span className="reply-author">{reply.author || '익명'}</span>
        <span className="reply-date">
          {new Date(reply.created_at).toLocaleString()}
        </span>
      </div>

      <p className="reply-content">{reply.content}</p>

      <div className="reply-actions">
        <button
          className={`btn-reply-action ${isLiked ? 'active' : ''}`}
          onClick={handleReplyLike}
        >
          {isLiked ? '❤️' : '🤍'} {likesCount}
        </button>

        <button className="btn-reply-action btn-report-sm" onClick={handleReplyReport}>
          🚨 신고
        </button>
      </div>
    </div>
  );
}
