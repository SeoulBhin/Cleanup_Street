import React, { useMemo, useState } from "react";
import { addReplyLike, reportReply, updateReply, deleteReply } from "../api/boards";

export default function ReplyItem({ reply, onActionSuccess, me }) {
  const replyId = useMemo(
    () => reply.id ?? reply.comment_id ?? reply.commentId,
    [reply]
  );

  const [isLiked, setIsLiked] = useState(reply.is_liked_by_me || false);
  const [likesCount, setLikesCount] = useState(reply.likes || 0);

  // ✅ 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content || "");

  // ✅ 내 댓글만 수정/삭제 가능 (서버 수정 없이 프론트에서 판별)
  const myId = Number(me?.id ?? me?.user_id ?? me?.userId);
  const authorId = Number(reply?.user_id ?? reply?.author_id ?? reply?.userId);
  const canEdit =
    Number.isFinite(myId) && Number.isFinite(authorId) && myId === authorId;

  const handleReplyLike = async () => {
    if (!replyId) return alert("댓글 ID 오류");

    // 낙관적 업데이트
    setIsLiked((prev) => {
      setLikesCount((c) => (prev ? c - 1 : c + 1));
      return !prev;
    });

    try {
      await addReplyLike(replyId);
      onActionSuccess?.();
    } catch (e) {
      console.error("댓글 좋아요 실패:", e);
      // 롤백
      setIsLiked((prev) => !prev);
      setLikesCount((c) => (isLiked ? c + 1 : c - 1));
    }
  };

  const handleReplyReport = async () => {
    if (!replyId) return alert("댓글 ID 오류");
    if (!window.confirm("정말 이 댓글을 신고하시겠습니까?")) return;

    const reason = window.prompt("신고 사유를 입력하세요");
    if (!reason || !reason.trim()) return;

    try {
      await reportReply(replyId, reason.trim());
      alert("댓글 신고가 접수되었습니다.");
      onActionSuccess?.();
    } catch (e) {
      console.error("댓글 신고 실패:", e);
      if (e?.status === 401) alert("로그인이 필요합니다.");
      else alert("댓글 신고 처리에 실패했습니다.");
    }
  };

  // ✅ 수정 시작
  const startEdit = () => {
    setEditText(reply.content || "");
    setIsEditing(true);
  };

  // ✅ 수정 취소
  const cancelEdit = () => {
    setEditText(reply.content || "");
    setIsEditing(false);
  };

  // ✅ 수정 저장
  const saveEdit = async () => {
    if (!replyId) return alert("댓글 ID 오류");
    if (!editText.trim()) return alert("내용을 입력하세요.");

    try {
      await updateReply(replyId, editText.trim());
      setIsEditing(false);
      onActionSuccess?.();
    } catch (e) {
      console.error("댓글 수정 실패:", e);
      if (e?.status === 401) alert("로그인이 필요합니다.");
      else alert("댓글 수정에 실패했습니다.");
    }
  };

  // ✅ 삭제
  const handleDelete = async () => {
    if (!replyId) return alert("댓글 ID 오류");
    if (!window.confirm("정말 이 댓글을 삭제하시겠습니까?")) return;

    try {
      await deleteReply(replyId);
      onActionSuccess?.();
    } catch (e) {
      console.error("댓글 삭제 실패:", e);
      if (e?.status === 401) alert("로그인이 필요합니다.");
      else alert("댓글 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="reply-item">
      <div className="reply-meta">
        <span className="reply-author">
          {reply.author || reply.username || "익명"}
        </span>
        <span className="reply-date">
          {reply.created_at ? new Date(reply.created_at).toLocaleString() : ""}
        </span>
      </div>

      {/* ✅ 본문 / 수정모드 */}
      {!isEditing ? (
        <p className="reply-content">{reply.content}</p>
      ) : (
        <div style={{ marginTop: 8 }}>
          <textarea
            className="form-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="form-btn btn-submit" type="button" onClick={saveEdit}>
              저장
            </button>
            <button className="form-btn btn-cancel" type="button" onClick={cancelEdit}>
              취소
            </button>
          </div>
        </div>
      )}

      <div className="reply-actions">
        <button
          className={`btn-reply-action ${isLiked ? "active" : ""}`}
          onClick={handleReplyLike}
          disabled={isEditing}
        >
          {isLiked ? "❤️" : "🤍"} {likesCount}
        </button>

        <button
          className="btn-reply-action btn-report-sm"
          onClick={handleReplyReport}
          disabled={isEditing}
        >
          🚨 신고
        </button>

        {/* ✅ 내 댓글만 수정/삭제 노출 */}
        {canEdit && !isEditing && (
          <>
            <button className="btn-reply-action" onClick={startEdit}>
              ✏️ 수정
            </button>
            <button className="btn-reply-action" onClick={handleDelete}>
              🗑 삭제
            </button>
          </>
        )}
      </div>
    </div>
  );
}
