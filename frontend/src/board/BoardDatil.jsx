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

// 댓글 페이지당 항목 수 설정
const REPLIES_PER_PAGE = 5; 

export default function BoardDetail() {
    const { boardType, id } = useParams();
    const [post, setPost] = useState(null);
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [isLiked, setIsLiked] = useState(false);
    const [newReplyText, setNewReplyText] = useState('');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false); 

    // 댓글 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // 댓글만 불러오는 함수 (페이징 처리)
    const fetchReplies = useCallback(async (page) => {
        try {
            // 서버 API 호출: 최신순(desc) 정렬 및 페이징 적용
            const res = await listReplies(boardType, id, {
                page: page,
                limit: REPLIES_PER_PAGE,
                sort: 'desc', // 최신 댓글이 목록의 가장 위에 표시되도록 정렬
            });
            
            // 서버 응답 형태를 { data: [...replies], total: 20 }로 가정
            const replyList = Array.isArray(res?.data) ? res.data : [];
            const totalItems = res?.total || 0;
            
            setReplies(replyList);
            setTotalPages(Math.ceil(totalItems / REPLIES_PER_PAGE));
            setCurrentPage(page);
        } catch (err) {
            console.error("댓글 불러오기 실패:", err);
            setReplies([]);
        }
    }, [boardType, id]);


    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            // 1. 게시글 상세 정보 로드
            const detail = await getBoardPostDetail(boardType, id); 
            setPost(detail);
            setIsLiked(detail.is_liked_by_me || false);

            // 2. 댓글 목록 로드 (첫 페이지)
            await fetchReplies(1); 

        } catch (error) {
            console.error("Failed to fetch detail:", error);
            setPost(null);
            setReplies([]);
        } finally {
            setLoading(false);
        }
    }, [boardType, id, fetchReplies]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);


    const openReportModal = () => {
        if (post) {
            setIsReportModalOpen(true);
        }
    };
    const closeReportModal = () => setIsReportModalOpen(false);

    // 페이지 변경 핸들러
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            fetchReplies(page);
        }
    };


    // 기능: 좋아요 토글 (게시글 좋아요)
    const handleLike = async () => {
        const wasLiked = isLiked;
        const delta = wasLiked ? -1 : 1;
        
        setIsLiked(!wasLiked);
        setPost((p) => ({
             ...p,
             likes: p.likes + delta
        }));

        try {
            await addLike(boardType, id); 
        } catch (error) {
            console.error("좋아요 실패:", error);
            // 실패 시 UI 롤백 
            setIsLiked(wasLiked); 
            setPost((p) => ({
                 ...p,
                 likes: p.likes - delta
            }));
        }
    };

    const handleReport = openReportModal; 
    
    // 기능: 댓글 작성 (작성 후 1페이지로 이동)
    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!newReplyText.trim()) return;
        
        try {
            await submitReply(boardType, id, newReplyText); 

            setNewReplyText('');
            // 댓글 작성 후, 최신 댓글이 있는 1페이지를 다시 불러옴 (댓글 폼 위쪽으로 형성)
            await fetchReplies(1); 
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
                    <button className="btn-action btn-report" onClick={handleReport}>
                    신고
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
                    {/* 전체 댓글 수는 post 객체에서 가져온다고 가정 */}
                    <h3>댓글 ({post.comments_count || 0})</h3>
                    
                    {/* 댓글 목록 (작성 폼 위쪽) */}
                    <div className="reply-list">
                        {replies.length === 0 ? (
                            <p className="no-replies">아직 댓글이 없습니다.</p>
                        ) : (
                            replies.map((reply) => (
                                <ReplyItem 
                                    key={reply.id} 
                                    reply={reply} 
                                    // 액션 성공 시 현재 페이지의 댓글을 새로 불러옴
                                    onActionSuccess={() => fetchReplies(currentPage)} 
                                />
                            ))
                        )}
                    </div>

                    {/* 페이지네이션 컨트롤 (목록 바로 아래) */}
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="page-btn"
                            >
                                &lt; 이전
                            </button>
                            
                            <span className="page-info">{currentPage} / {totalPages}</span>
                            
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="page-btn"
                            >
                                다음 &gt;
                            </button>
                        </div>
                    )}
                    
                    {/* 댓글 작성 폼 (가장 아래 위치) */}
                    <form onSubmit={handleReplySubmit} className="reply-form-bottom"> 
                        <textarea
                            className="form-textarea"
                            placeholder="댓글을 입력하세요"
                            value={newReplyText}
                            onChange={(e) => setNewReplyText(e.target.value)}
                            rows={3}
                        />
                        <button type="submit" className="form-btn btn-submit">등록</button>
                    </form>
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
