import React, { useMemo, useState } from "react";
import {
  addReplyLike,
  reportReply,
  updateReply,
  deleteReply,
  submitReply, // ✅ ADD: 답글 등록
} from "../api/boards";

export default function ReplyItem({ reply, onActionSuccess, me, postId, boardType }) {
  const replyId = useMemo(
    () => reply.id ?? reply.comment_id ?? reply.commentId,
    [reply]
  );

  const [isLiked, setIsLiked] = useState(reply.is_liked_by_me || false);
  const [likesCount, setLikesCount] = useState(reply.likes || 0);

  // ✅ 수정
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content || "");

  // ✅ 답글
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const myId = Number(me?.id ?? me?.user_id ?? me?.userId);
  const authorId = Number(reply?.user_id ?? reply?.author_id ?? reply?.userId);
  const canEdit = Number.isFinite(myId) && myId === authorId;

  const handleReplyLike = async () => {
    setIsLiked((prev) => {
      setLikesCount((c) => (prev ? c - 1 : c + 1));
      return !prev;
    });
    try {
      await addReplyLike(replyId);
      onActionSuccess?.();
    } catch {
      setIsLiked((p) => !p);
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    try {
      await submitReply(boardType, postId, replyText.trim(), replyId); // ✅ parent_id
      setReplyText("");
      setIsReplying(false);
      onActionSuccess?.();
    } catch {
      alert("답글 등록 실패");
    }
  };

  return (
    <div className="reply-item">
      <div className="reply-meta">
        <span className="reply-author">{reply.displayAuthor}</span>
        <span className="reply-date">
          {new Date(reply.created_at).toLocaleString()}
        </span>
      </div>

      {!isEditing ? (
        <p className="reply-content">{reply.content}</p>
      ) : (
        <>
          <textarea
            className="form-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <button className="form-btn btn-submit" onClick={async () => {
            await updateReply(replyId, editText);
            setIsEditing(false);
            onActionSuccess?.();
          }}>
            저장
          </button>
        </>
      )}

      <div className="reply-actions">
        <button onClick={handleReplyLike}>
          {isLiked ? "❤️" : "🤍"} {likesCount}
        </button>

        <button onClick={() => setIsReplying((v) => !v)}>💬 답글</button>

        {canEdit && (
          <>
            <button onClick={() => setIsEditing(true)}>✏️ 수정</button>
            <button onClick={async () => {
              await deleteReply(replyId);
              onActionSuccess?.();
            }}>
              🗑 삭제
            </button>
          </>
        )}
      </div>

      {/* ✅ 답글 입력창 */}
      {isReplying && (
        <div className="reply-reply-box">
          <textarea
            className="form-textarea"
            placeholder="답글을 입력하세요"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <button className="form-btn btn-submit" onClick={handleReplySubmit}>
            답글 등록
          </button>
        </div>
      )}

      {/* ✅ 대댓글 */}
      {reply.replies?.length > 0 && (
        <div className="reply-children">
          {reply.replies.map((child) => (
            <ReplyItem
              key={child.id}
              reply={child}
              me={me}
              postId={postId}
              boardType={boardType}
              onActionSuccess={onActionSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}
