// src/components/PostView.jsx
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getBoardPost,
  deleteBoardPost,
  addLike,
  listReplies,
  submitReply,
  getPostLikeState,
  reportPost,
} from "../api/boards";

import ReplyItem from "./ReplyItem";
import { getMe } from "../api/auth";

export default function PostView() {
  const { boardType, id } = useParams();
  const navigate = useNavigate();

  const isLoggedIn = !!localStorage.getItem("accessToken");

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);

  const [isLiked, setIsLiked] = useState(false);
  const [replies, setReplies] = useState([]);
  const [newReplyText, setNewReplyText] = useState("");

  const [me, setMe] = useState(null);

  const isValidId =
    id !== undefined &&
    id !== "undefined" &&
    id !== "new" &&
    !Number.isNaN(Number(id));

  const fetchDetail = useCallback(async () => {
    if (!isValidId) {
      setLoading(false);
      setLoadError("BAD_ID");
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const p = await getBoardPost(boardType, id);
      setPost(p);
      setSelectedImageId(null);
      setIsLiked(!!p?.is_liked_by_me);

      const r = await listReplies(boardType, id);

      // ✅✅ ADD: user_id별 익명 1,2... 매핑 + parentId 통일 + replies 배열 준비
      const anonMap = new Map();
      let seq = 0;

      const normalized = Array.isArray(r)
        ? r.map((x) => {
            const cid = x.id ?? x.comment_id ?? x.commentId;

            const uid = Number(x.user_id ?? x.userId ?? x.author_id ?? x.authorId);

            let displayAuthor = "익명";
            if (Number.isFinite(uid)) {
              if (!anonMap.has(uid)) anonMap.set(uid, ++seq);
              displayAuthor = `익명 ${anonMap.get(uid)}`;
            }

            // ✅✅ ADD: parentId 필드 흡수 (백엔드 필드명 다를 수 있어서 최대한 커버)
            const parentId =
              x.parent_id ??
              x.parentId ??
              x.parent_comment_id ??
              x.parentCommentId ??
              x.parent ??
              null;

            return {
              ...x,
              id: cid,
              displayAuthor,
              parentId,     // ✅✅ ADD
              replies: [],  // ✅✅ ADD (트리용)
            };
          })
        : [];

      // ✅✅ ADD: flat -> tree 변환 (여기가 핵심)
      const byId = new Map();
      normalized.forEach((c) => {
        if (c?.id != null) byId.set(c.id, c);
      });

      const roots = [];
      normalized.forEach((c) => {
        const pid = c.parentId;

        // 부모가 존재하면 부모 replies에 push, 아니면 최상위로
        if (pid != null && pid !== 0 && byId.has(pid)) {
          byId.get(pid).replies.push(c);
        } else {
          roots.push(c);
        }
      });

      // ✅✅ CHANGE: setReplies(normalized) -> setReplies(roots)
      setReplies(roots);

      try {
        if (isLoggedIn) {
          const s = await getPostLikeState(id);
          setIsLiked(!!s?.liked);
          setPost((prev) => (prev ? { ...prev, likes: s?.likes ?? 0 } : prev));
        }
      } catch {}
    } catch (err) {
      console.error("게시글/댓글 불러오기 실패:", err);
      setLoadError("LOAD_FAIL");
      setPost(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [boardType, id, isValidId, isLoggedIn]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    getMe()
      .then((r) => setMe(r?.me))
      .catch(() => setMe(null));
  }, []);

  const handleLike = async () => {
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!post) return;

    const wasLiked = isLiked;
    const delta = wasLiked ? -1 : 1;

    setIsLiked(!wasLiked);
    setPost((prev) => (prev ? { ...prev, likes: (prev.likes || 0) + delta } : prev));

    try {
      const res = await addLike(boardType, id);
      setIsLiked(!!res?.liked);
    } catch (err) {
      console.error("좋아요 실패:", err);

      setIsLiked(wasLiked);
      setPost((prev) => (prev ? { ...prev, likes: (prev.likes || 0) - delta } : prev));

      if (err?.status === 401) alert("로그인이 필요합니다.");
      else alert("좋아요 처리에 실패했습니다.");
    }
  };

  const handleReportPost = async () => {
    if (!isLoggedIn) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!isValidId) {
      alert("게시글 ID 오류");
      return;
    }
    if (!window.confirm("정말 이 게시글을 신고하시겠습니까?")) return;

    const reason = window.prompt("신고 사유를 입력하세요");
    if (!reason || !reason.trim()) return;

    try {
      await reportPost(boardType, id, reason.trim());
      alert("게시글 신고가 접수되었습니다.");
    } catch (e) {
      console.error("게시글 신고 실패:", e);
      if (e?.status === 401) alert("로그인이 필요합니다.");
      else alert("게시글 신고 처리에 실패했습니다.");
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    const text = newReplyText.trim();
    if (!text) return;

    try {
      await submitReply(boardType, id, text);
      setNewReplyText("");
      await fetchDetail();
    } catch (err) {
      console.error("댓글 작성 실패:", err);
      if (err?.status === 401) alert("로그인이 필요합니다.");
      else alert("댓글 작성에 실패했습니다.");
    }
  };

  const onDelete = async () => {
    if (!isValidId) return;
    if (!window.confirm("정말 삭제할까요?")) return;
    try {
      await deleteBoardPost(boardType, id);
    } catch (e) {
      console.error("삭제 실패:", e);
    }
    navigate(`/board/${boardType}`);
  };

  if (!isValidId) {
    return (
      <div className="page-container fade-in">
        <h2 className="page-title">잘못된 게시글 주소입니다.</h2>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <Link className="form-btn btn-cancel" to={`/board/${boardType || "free"}`}>
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page-container">불러오는 중...</div>;

  if (loadError && !post) {
    return (
      <div className="page-container fade-in">
        <h2 className="page-title">게시글을 불러올 수 없습니다.</h2>
        <p style={{ marginTop: 8, color: "#ffffffff" }}>
          게시글이 삭제되었거나, 일시적인 오류가 발생했을 수 있습니다.
        </p>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <Link className="form-btn btn-cancel" to={`/board/${boardType}`}>
            목록
          </Link>
        </div>
      </div>
    );
  }

  if (!post) return <div className="page-container">게시글 정보가 없습니다.</div>;

  const myId = me ? Number(me.id ?? me.user_id ?? me.userId) : null;
  const ownerId = Number(post.user_id ?? post.author_id ?? post.userId ?? post.userId);
  const isOwner = myId !== null && ownerId === myId;

  return (
    <div className="page-container fade-in">
      <h2 className="page-title" style={{ border: "none", paddingBottom: 0 }}>
        {post.title}
      </h2>

      <div className="post-meta" style={{ marginBottom: 16 }}>
        <span className="post-category" style={{ marginRight: 8 }}>
          {post.category}
        </span>
        <span>작성자: {post.author || "익명"}</span> |{" "}
        <span>
          작성일: {post.created_at ? new Date(post.created_at).toLocaleString() : "-"}
        </span>
      </div>

      <div className="post-actions-detail" style={{ marginBottom: 12 }}>
        <button className={`btn-action ${isLiked ? "active" : ""}`} onClick={handleLike}>
          {isLiked ? "❤️ 좋아요 취소" : "🤍 좋아요"} ({post.likes || 0})
        </button>

        <button className="btn-action btn-report" onClick={handleReportPost} style={{ marginLeft: 8 }}>
          🚨 신고
        </button>
      </div>

      <div className="post-content" style={{ whiteSpace: "pre-wrap" }}>
        {post.content}
      </div>

      <hr className="detail-separator" style={{ marginTop: 18 }} />

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
          <button type="submit" className="form-btn btn-submit">
            등록
          </button>
        </form>

        <div className="reply-list">
          {replies.length === 0 ? (
            <p className="no-replies">아직 댓글이 없습니다.</p>
          ) : (
            replies.map((reply) => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                me={me}
                postId={id}
                boardType={boardType}
                onActionSuccess={fetchDetail}
                depth={0}
              />
            ))
          )}
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 24 }}>
        <Link className="form-btn btn-cancel" to={`/board/${boardType}`}>
          목록
        </Link>

        {isOwner && (
          <>
            <Link className="form-btn btn-submit" to={`/board/${boardType}/${id}/edit`}>
              수정
            </Link>

            <button className="form-btn btn-submit" onClick={onDelete}>
              삭제
            </button>
          </>
        )}
      </div>
    </div>
  );
}
