import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    getBoardPostDetail, 
    addLike, 
    reportPost, 
    listReplies,
    submitReply 
} from '../api/boards'; 
import ReplyItem from './ReplyItem'; 
import ReportModal from './ReportModal'; 

export default function BoardDetail() {
    const { boardType, id } = useParams();
    const [post, setPost] = useState(null);
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [isLiked, setIsLiked] = useState(false);
    const [newReplyText, setNewReplyText] = useState('');
    // 신고 모달 상태 추가
    const [isReportModalOpen, setIsReportModalOpen] = useState(false); 


    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            // 1. 게시글 상세 정보 로드
            const detail = await getBoardPostDetail(boardType, id); 
            setPost(detail);
            setIsLiked(detail.is_liked_by_me || false);

            // 2. 댓글 목록 로드
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


    // 신고 버튼 클릭 시 모달 열기 함수
    const openReportModal = () => {
        if (post) {
            setIsReportModalOpen(true);
        }
    };
    const closeReportModal = () => setIsReportModalOpen(false);


    // 기능: 좋아요 토글
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

    // 신고 처리 로직은 모달로 이동하고, 버튼은 모달 열기만 담당
    const handleReport = openReportModal; 
    
    // 기능: 댓글 작성
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
        <>
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
                    {/* 신고 버튼을 누르면 openReportModal 호출 */}
                    <button className="btn-action btn-report" onClick={handleReport}>
                    🚨 신고
                    </button>
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

                    <div className="reply-list">
                        {replies.length === 0 ? (
                            <p className="no-replies">아직 댓글이 없습니다.</p>
                        ) : (
                            replies.map((reply) => (
                                <ReplyItem 
                                    key={reply.id} 
                                    reply={reply} 
                                    onActionSuccess={fetchDetail} 
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
            
            {/* 4. 신고 모달 렌더링 */}
            {isReportModalOpen && post && (
                <ReportModal
                    onClose={closeReportModal}
                    boardType={boardType}
                    postId={post.id}
                    postTitle={post.title}
                />
            )}
        </>
    );
}