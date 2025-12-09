import React, { useState } from 'react';
import { addReplyLike, reportReply } from '../api/boards'; 

export default function ReplyItem({ reply, onActionSuccess }) {
    // 초기 상태는 prop에서 가져온 값으로 설정
    const [isLiked, setIsLiked] = useState(reply.is_liked_by_me || false); 
    const [likesCount, setLikesCount] = useState(reply.likes || 0);

    // 기능: 댓글 좋아요 토글
    const handleReplyLike = async () => {
        // Optimistic Update
        setIsLiked((prev) => {
            setLikesCount((c) => prev ? c - 1 : c + 1);
            return !prev;
        });

        try {
            // API 호출: 서버에 좋아요/취소 요청
            await addReplyLike(reply.id); 
            
            // 성공 후 부모 컴포넌트의 목록을 갱신
            if (onActionSuccess) onActionSuccess(); 

        } catch (error) {
            console.error("댓글 좋아요 실패:", error);
            // 실패 시 UI 롤백
            setIsLiked((prev) => !prev);
            setLikesCount((c) => isLiked ? c + 1 : c - 1);
        }
    };

    // 💡 기능: 댓글 신고
    const handleReplyReport = async () => {
        if (window.confirm("정말 이 댓글을 신고하시겠습니까?")) {
            try {
                // API 호출: 서버에 신고 요청
                await reportReply(reply.id); 
                alert("댓글 신고가 접수되었습니다.");
                
                // 신고 성공 후 목록 갱신 (선택 사항)
                if (onActionSuccess) onActionSuccess(); 

            } catch (error) {
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
