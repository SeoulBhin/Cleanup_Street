// src/components/ReplyItem.jsx
import React, { useState } from 'react';
import { addReplyLike, reportReply } from '../api/boards';

// 댓글 객체와 액션 성공 시 부모의 목록 갱신 함수를 props로 받습니다.
export default function ReplyItem({ reply, onActionSuccess }) {
  // 초기 상태는 prop에서 가져온 값으로 설정
  const [isLiked, setIsLiked] = useState(reply.is_liked_by_me || false);
  const [likesCount, setLikesCount] = useState(reply.likes || 0);

  // ================== 댓글 좋아요 토글 ==================
  const handleReplyLike = async () => {
    const wasLiked = isLiked; // 클릭 전 상태
    const delta = wasLiked ? -1 : 1;

    // 1) UI 낙관적 업데이트
    setIsLiked(!wasLiked);
    setLikesCount((prev) => prev + delta);

    try {
      // 2) 서버 호출
      await addReplyLike(reply.id);

      // 3) 필요하면 부모에게 "성공했으니 리스트 다시 불러와" 요청
      if (onActionSuccess) onActionSuccess();
    } catch (error) {
      console.error('댓글 좋아요 실패:', error);

      // 4) 실패 시 롤백
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev - delta);
    }
  };

  // ================== 댓글 신고 ==================
  const handleReplyReport = async () => {
    if (!window.confirm('정말 이 댓글을 신고하시겠습니까?')) return;

    try {
      await reportReply(reply.id);
      alert('댓글 신고가 접수되었습니다.');

      // 신고 후 목록 새로고침이 필요하면 호출
      if (onActionSuccess) onActionSuccess();
    } catch (error) {
      console.error('댓글 신고 실패:', error);
      alert('댓글 신고 처리에 실패했습니다.');
    }
  };

  // ================== 렌더링 ==================
  return (
    <div className="reply-item">
      <div className="reply-meta">
        <span className="reply-author">{reply.author || '익명'}</span>
        <span className="reply-date">
          {reply.created_at
            ? new Date(reply.created_at).toLocaleString()
            : ''}
        </span>
      </div>

      <p className="reply-content">{reply.content}</p>

      {/* 댓글 좋아요/신고 버튼 그룹 */}
      <div className="reply-actions">
        <button
          className={`btn-reply-action ${isLiked ? 'active' : ''}`}
          onClick={handleReplyLike}
        >
          {isLiked ? '❤️' : '🤍'} {likesCount}
        </button>

        <button
          className="btn-reply-action btn-report-sm"
          onClick={handleReplyReport}
        >
          🚨 신고
        </button>
      </div>
    </div>
  );
}
