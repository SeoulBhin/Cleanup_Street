// src/components/BoardDetail.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

//  ✅ 이 컴포넌트에서 사용할 API 함수들만 import
//  getBoardPostDetail, addLike, reportPost, listReplies, submitReply
import {
  getBoardPostDetail,
  addLike,
  reportPost,
  listReplies,
  submitReply,
} from '../api/boards';

import ReplyItem from './ReplyItem';

export default function BoardDetail() {
  const { boardType, id } = useParams();

  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  // 게시글 좋아요 상태
  const [isLiked, setIsLiked] = useState(false);

  // 새 댓글 입력 값
  const [newReplyText, setNewReplyText] = useState('');

  // ================== (1) 게시글 & 댓글 데이터 로딩 ==================
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      // 1) 게시글 상세
      const detail = await getBoardPostDetail(boardType, id);
      setPost(detail);
      setIsLiked(detail.is_liked_by_me || false);

      // 2) 댓글 목록
      const replyList = await listReplies(boardType, id);
      setReplies(Array.isArray(replyList) ? replyList : []);
    } catch (error) {
      console.error('Failed to fetch detail:', error);
      setPost(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [boardType, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ================== (2) 게시글 상호작용 ==================

  // 게시글 좋아요 토글 (낙관적 업데이트 + 롤백 안전)
  const handleLike = async () => {
    if (!post) return;

    // 클릭 직전 상태를 캡처해두면 비동기여도 안전하게 롤백 가능
    const wasLiked = isLiked; // true면 이미 좋아요 누른 상태
    const delta = wasLiked ? -1 : 1; // 좋아요 취소면 -1, 새로 누르면 +1

    // 1) UI 먼저 변경 (낙관적)
    setIsLiked(!wasLiked);
    setPost((prev) =>
      prev
        ? {
            ...prev,
            likes: (prev.likes || 0) + delta,
          }
        : prev
    );

    try {
      // 2) 서버에 실제 요청
      await addLike(boardType, id);
    } catch (error) {
      console.error('좋아요 실패:', error);

      // 3) 실패 시 롤백
      setIsLiked(wasLiked);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likes: (prev.likes || 0) - delta,
            }
          : prev
      );
    }
  };

  // 게시글 신고
  const handleReport = async () => {
    if (!window.confirm('정말 이 게시글을 신고하시겠습니까?')) return;

    try {
      await reportPost(boardType, id);
      alert('신고가 접수되었습니다.');
    } catch (error) {
      console.error('신고 실패:', error);
      alert('신고 처리에 실패했습니다.');
    }
  };

  // 댓글 작성
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!newReplyText.trim()) return;

    try {
      await submitReply(boardType, id, newReplyText.trim());
      setNewReplyText('');
      // 댓글 작성 후 게시글/댓글 다시 로드
      await fetchDetail();
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      alert('댓글 작성에 실패했습니다.');
    }
  };

  // ================== (3) 렌더링 ==================

  if (loading) return <div className="page-container">불러오는 중...</div>;
  if (!post) return <div className="page-container">게시글을 찾을 수 없습니다.</div>;

  return (
    <div className="page-container fade-in">
      {/* 제목 */}
      <h2 className="page-title">{post.title}</h2>

      {/* 상단 액션 버튼: 좋아요 + 신고 */}
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
        {/* 알림(구독) 버튼 제거됨 */}
      </div>

      <hr className="detail-separator" />

      {/* 본문 */}
      <div className="post-body">
        <p>{post.content}</p>
      </div>

      <hr className="detail-separator" />

      {/* 댓글 섹션 */}
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
          <button type="submit" className="form-btn btn-submit">
            등록
          </button>
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
                // 댓글 좋아요/신고 후 목록을 갱신하도록 부모의 fetchDetail 전달
                onActionSuccess={fetchDetail}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
