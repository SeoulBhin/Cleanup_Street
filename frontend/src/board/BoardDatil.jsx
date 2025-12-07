import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
//  API 함수: getBoardPostDetail, addLike, reportPost, listReplies, submitReply만 사용
import { 
    getBoardPostDetail, 
    addLike, 
    reportPost, 
    listReplies,
    submitReply 
} from '../api/boards'; 
import ReplyItem from './ReplyItem'; 

export default function BoardDetail() {
    const { boardType, id } = useParams();
    const [post, setPost] = useState(null);
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    
    //  상태: 좋아요 상태만 유지
    const [isLiked, setIsLiked] = useState(false);
    const [newReplyText, setNewReplyText] = useState('');

    // --- (1) 데이터 로드 및 초기 설정 ---
    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            //  1. 게시글 상세 정보 로드
            const detail = await getBoardPostDetail(boardType, id); 
            setPost(detail);
            setIsLiked(detail.is_liked_by_me || false);

            //  2. 댓글 목록 로드
            const replyList = await listReplies(boardType, id);
            setReplies(Array.isArray(replyList) ? replyList : []);

        } catch (error) {
            console.error("Failed to fetch detail:", error);
            setPost(null);
            setReplies([]);
        } finally {
            setLoading(false);
        }
    }, [boardType, id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);


    // --- (2) 게시글 상호작용 함수 ---

    //  기능: 좋아요 토글
    const handleLike = async () => {
        // Optimistic Update (UI를 먼저 변경)
        setIsLiked((prev) => {
            setPost((p) => ({
                ...p,
                likes: prev ? p.likes - 1 : p.likes + 1
            }));
            return !prev;
        });

        try {
            // API 호출: 서버에 좋아요/취소 요청
            await addLike(boardType, id); 
        } catch (error) {
            console.error("좋아요 실패:", error);
            // 실패 시 UI 롤백 
            setIsLiked((prev) => !prev); 
            setPost((p) => ({
                ...p,
                likes: isLiked ? p.likes + 1 : p.likes - 1
            }));
        }
    };

    // 기능: 신고
    const handleReport = async () => {
        if (window.confirm("정말 이 게시글을 신고하시겠습니까?")) {
            try {
                // API 호출: 서버에 신고 요청
                await reportPost(boardType, id); 
                alert("신고가 접수되었습니다.");
            } catch (error) {
                alert("신고 처리에 실패했습니다.");
            }
        }
    };
    
    //  기능: 댓글 작성
    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!newReplyText.trim()) return;
        
        try {
            // API 호출: 서버에 댓글 제출
            await submitReply(boardType, id, newReplyText); 

            // 성공 후 목록 새로고침 및 입력 필드 초기화
            setNewReplyText('');
            fetchDetail(); // 전체 상세 정보와 댓글 목록을 새로 불러옴
        } catch (error) {
            alert("댓글 작성에 실패했습니다.");
        }
    };

    if (loading) return <div className="page-container">불러오는 중...</div>;
    if (!post) return <div className="page-container">게시글을 찾을 수 없습니다.</div>;

    return (
        <div className="page-container fade-in">
            <h2 className="page-title">{post.title}</h2>
            
            {/* 1. 좋아요, 신고 버튼 섹션 */}
            <div className="post-actions-detail">
                <button 
                className={`btn-action ${isLiked ? 'active' : ''}`} 
                onClick={handleLike}
                >
                {isLiked ? '❤️ 좋아요 취소' : '🤍 좋아요'} ({post.likes || 0})
                </button>
                <button className="btn-action btn-report" onClick={handleReport}>
                🚨 신고
                </button>
                {/*  알림(구독) 버튼이 제거되었습니다. */}
            </div>

            <hr className="detail-separator" />

            {/* 2. 게시글 본문 */}
            <div className="post-body">
                <p>{post.content}</p>
            </div>
            
            <hr className="detail-separator" />

            {/* 3. 댓글 섹션 */}
            <div className="replies-section">
                <h3>댓글 ({replies.length})</h3>
                
                {/* 댓글 작성 폼 */}
                <form onSubmit={handleReplySubmit} className="reply-form">
                    <textarea
                        className="form-textarea"
                        placeholder="댓글을 입력하세요"
                        value={newReplyText}
                        onChange={(e) => setNewReplyText(e.target.value)}
                        rows={3}
                    />
                    <button type="submit" className="form-btn btn-submit">등록</button>
                </form>

                {/* 댓글 목록 */}
                <div className="reply-list">
                    {replies.length === 0 ? (
                        <p className="no-replies">아직 댓글이 없습니다.</p>
                    ) : (
                        replies.map((reply) => (
                            <ReplyItem 
                                key={reply.id} 
                                reply={reply} 
                                // 댓글 좋아요/신고 후 목록을 갱신하도록 부모의 fetchDetail 함수 전달
                                onActionSuccess={fetchDetail} 
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
