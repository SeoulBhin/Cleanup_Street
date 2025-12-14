import React, { useMemo, useState } from "react";
import { addReplyLike, reportReply, updateReply, deleteReply, submitReply } from "../api/boards";

export default function ReplyItem({
  reply,
  onActionSuccess,
  me,
  depth = 0,
  boardType,
  postId,
  isLast = false, // ✅ 마지막 자식 여부
}) {
  const replyId = useMemo(() => reply.id ?? reply.comment_id ?? reply.commentId, [reply]);

  const [isLiked, setIsLiked] = useState(reply.is_liked_by_me || false);
  const [likesCount, setLikesCount] = useState(reply.likes || 0);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content || "");

  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const myId = Number(me?.id ?? me?.user_id ?? me?.userId);
  const authorId = Number(reply?.user_id ?? reply?.author_id ?? reply?.userId);
  const canEdit = Number.isFinite(myId) && Number.isFinite(authorId) && myId === authorId;

  const handleReplyLike = async () => {
    if (!replyId) return alert("댓글 ID 오류");

    setIsLiked((prev) => {
      setLikesCount((c) => (prev ? c - 1 : c + 1));
      return !prev;
    });

    try {
      await addReplyLike(replyId);
      onActionSuccess?.();
    } catch (e) {
      console.error("댓글 좋아요 실패:", e);
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

  const startEdit = () => {
    setEditText(reply.content || "");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditText(reply.content || "");
    setIsEditing(false);
  };

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

  const submitChildReply = async () => {
    if (!replyId) return alert("부모 댓글 ID 오류");
    if (!replyText.trim()) return alert("답글 내용을 입력하세요.");

    try {
      await submitReply(boardType, postId, replyText.trim(), replyId);
      setReplyText("");
      setIsReplying(false);
      onActionSuccess?.();
    } catch (e) {
      console.error("답글 등록 실패:", e);
      if (e?.status === 401) alert("로그인이 필요합니다.");
      else alert("답글 등록에 실패했습니다.");
    }
  };

  const isChild = depth > 0;

  const indent = isChild ? 18 : 0;

  return (
    <div className={`reply-row ${isChild ? "is-child-row" : ""}`} style={{ paddingLeft: indent }}>
      <div className={`reply-item ${isChild ? "is-child" : ""} ${isLast ? "is-last" : ""}`}>
        {/* ✅ ㄴ 텍스트 삭제: CSS가 선/└ 그려줌 */}
        <div className="reply-branch" aria-hidden="true" />

        <div className="reply-body">
          <div className="reply-meta">
            <span className="reply-author">{reply.displayAuthor || "익명"}</span>
            <span className="reply-date">
              {reply.created_at ? new Date(reply.created_at).toLocaleString() : ""}
            </span>
          </div>

          {!isEditing ? (
            <p className="reply-content">{reply.content}</p>
          ) : (
            <div className="reply-edit-box">
              <textarea
                className="form-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
              />
              <div className="reply-edit-actions">
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
            {/*}<button className={`btn-reply-action ${isLiked ? "active" : ""}`} 
             onClick={handleReplyLike}
             disabled={isEditing}
             >
              {isLiked ? "❤️" : "🤍"} {likesCount}
            </button>
            */}
            <button className="btn-reply-action btn-report-sm" onClick={handleReplyReport} disabled={isEditing}>
              🚨 신고
            </button>

            <button className="btn-reply-action" onClick={() => setIsReplying((v) => !v)} disabled={isEditing}>
              💬 답글
            </button>

            {canEdit && !isEditing && (
              <>
                <button className="btn-reply-action" onClick={startEdit}>✏️ 수정</button>
                <button className="btn-reply-action" onClick={handleDelete}>🗑 삭제</button>
              </>
            )}
          </div>

          {isReplying && (
            <div className="reply-reply-box">
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="답글을 입력하세요"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <div className="reply-edit-actions">
                <button className="form-btn btn-submit" type="button" onClick={submitChildReply}>
                  등록
                </button>
                <button
                  className="form-btn btn-cancel"
                  type="button"
                  onClick={() => {
                    setReplyText("");
                    setIsReplying(false);
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {Array.isArray(reply.replies) && reply.replies.length > 0 && (
            <div className="reply-children">
              {reply.replies.map((child, idx) => (
                <ReplyItem
                  key={child.id ?? child.comment_id ?? child.commentId}
                  reply={child}
                  me={me}
                  onActionSuccess={onActionSuccess}
                  depth={depth + 1}
                  boardType={boardType}
                  postId={postId}
                  isLast={idx === reply.replies.length - 1}   // ✅ 마지막이면 true
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
