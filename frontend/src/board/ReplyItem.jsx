import React, { useMemo, useState } from "react";
import { addReplyLike, reportReply, updateReply, deleteReply, submitReply } from "../api/boards"; 
// ==ADD: submitReply를 쓰는 구조면 boards api에 맞게 import 필요==
// submitReply가 "게시글 댓글 등록"만 있으면, 대댓글도 같은 API에 parent_id로 보내면 됨

export default function ReplyItem({
  reply,
  onActionSuccess,
  me,
  depth = 0,                 // ==ADD==
  boardType,                 // ==ADD==
  postId,                    // ==ADD==
}) {
  const replyId = useMemo(
    () => reply.id ?? reply.comment_id ?? reply.commentId,
    [reply]
  );

  const [isLiked, setIsLiked] = useState(reply.is_liked_by_me || false);
  const [likesCount, setLikesCount] = useState(reply.likes || 0);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content || "");

  // ==ADD: 대댓글 입력 모드==
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  // 내 댓글만 수정/삭제 가능
  const myId = Number(me?.id ?? me?.user_id ?? me?.userId);
  const authorId = Number(reply?.user_id ?? reply?.author_id ?? reply?.userId);
  const canEdit =
    Number.isFinite(myId) && Number.isFinite(authorId) && myId === authorId;

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

  // ==ADD: 대댓글 등록==
  const submitChildReply = async () => {
    if (!replyId) return alert("부모 댓글 ID 오류");
    if (!replyText.trim()) return alert("답글 내용을 입력하세요.");

    try {
      // ✅ 여기 중요:
      // 네 백엔드 addComment가 { content, parent_id } 받으니까
      // submitReply(boardType, postId, text, parent_id) 형태로 API를 맞춰야 함.
      await submitReply(boardType, postId, replyText.trim(), replyId); // ==ADD==
      setReplyText("");
      setIsReplying(false);
      onActionSuccess?.();
    } catch (e) {
      console.error("답글 등록 실패:", e);
      if (e?.status === 401) alert("로그인이 필요합니다.");
      else alert("답글 등록에 실패했습니다.");
    }
  };

  // ==ADD: 들여쓰기 + ㄴ 표시==
  const indentPx = depth * 22;

  return (
    <div
      className="reply-row" // ==ADD: 댓글마다 경계선==
      style={{ paddingLeft: indentPx }}
    >
      <div className="reply-item">
        {/* ==ADD: ㄴ/└ 표시 (대댓글일 때만)== */}
        {depth > 0 && <span className="reply-branch">ㄴ</span>}

        <div className="reply-body">
          <div className="reply-meta">
            <span className="reply-author">{reply.author || reply.username || "익명"}</span>
            <span className="reply-date">
              {reply.created_at ? new Date(reply.created_at).toLocaleString() : ""}
            </span>
          </div>

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

            {/* ==ADD: 답글 버튼== */}
            <button
              className="btn-reply-action"
              onClick={() => setIsReplying((v) => !v)}
              disabled={isEditing}
            >
              💬 답글
            </button>

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

          {/* ==ADD: 답글 입력창== */}
          {isReplying && (
            <div className="reply-replybox">
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="답글을 입력하세요"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <div className="reply-replybox-actions">
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

          {/* ==ADD: 대댓글(자식) 재귀 렌더링== */}
          {Array.isArray(reply.replies) && reply.replies.length > 0 && (
            <div className="reply-children">
              {reply.replies.map((child) => (
                <ReplyItem
                  key={child.id ?? child.comment_id ?? child.commentId}
                  reply={child}
                  me={me}
                  onActionSuccess={onActionSuccess}
                  depth={depth + 1}     // ==ADD==
                  boardType={boardType} // ==ADD==
                  postId={postId}       // ==ADD==
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
