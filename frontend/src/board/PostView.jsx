// src/components/PostView.jsx
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getBoardPost,
  deleteBoardPost,
  addLike,
  listReplies,
  submitReply,
  getPostLikeState, // ✅ 추가
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

      // 1) 게시글 불러오기
      const p = await getBoardPost(boardType, id);
      setPost(p);
      setSelectedImageId(null);

      // 서버가 is_liked_by_me 내려주면 초기 좋아요 상태 세팅
      setIsLiked(!!p?.is_liked_by_me);

      // 2) 댓글 불러오기
      const r = await listReplies(boardType, id);
      const normalized = Array.isArray(r)
        ? r.map((x) => ({
            ...x,
            id: x.id ?? x.comment_id ?? x.commentId,
          }))
        : [];
      setReplies(normalized);

      // ==================================================
      // ✅ 추가: 좋아요 상태/개수 DB 기준으로 덮어쓰기
      // (posts 조회 SQL을 수정하지 않아도 좋아요 0으로 안 돌아감)
      // ==================================================
      try {
        if (isLoggedIn) {
          const s = await getPostLikeState(id);
          setIsLiked(!!s?.liked);
          setPost((prev) =>
            prev ? { ...prev, likes: s?.likes ?? 0 } : prev
          );
        }
      } catch (e) {
        // 401 등은 무시 (로그인 아닐 때)
      }
      // ==================================================
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
    setPost((prev) =>
      prev ? { ...prev, likes: (prev.likes || 0) + delta } : prev
    );

    try {
      const res = await addLike(boardType, id);
      setIsLiked(!!res?.liked);
      // ✅ res에 likes는 현재 토글 API가 안 내려줘도 OK (like-state로 덮어쓰기 되니까)
    } catch (err) {
      console.error("좋아요 실패:", err);

      setIsLiked(wasLiked);
      setPost((prev) =>
        prev ? { ...prev, likes: (prev.likes || 0) - delta } : prev
      );

      if (err?.status === 401) alert("로그인이 필요합니다.");
      else alert("좋아요 처리에 실패했습니다.");
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

  if (loading) {
    return <div className="page-container">불러오는 중...</div>;
  }

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

  if (!post) {
    return <div className="page-container">게시글 정보가 없습니다.</div>;
  }

  const myId = me ? Number(me.id ?? me.user_id ?? me.userId) : null;
  const ownerId = Number(post.user_id ?? post.author_id ?? post.userId ?? post.userId);
  const isOwner = myId !== null && ownerId === myId;

  const images = Array.isArray(post.images) ? post.images : [];
  const attachments = Array.isArray(post.attachments) ? post.attachments : [];

  const extractImageUrls = (text) => {
    if (!text || typeof text !== "string") return [];
    const urls = [];

    const roughUrl = /(https?:\/\/\S+)/gi;
    let match;
    while ((match = roughUrl.exec(text)) !== null) urls.push(match[1]);

    const uploadsRegex = /(\/uploads\/\S+)/gi;
    while ((match = uploadsRegex.exec(text)) !== null) urls.push(match[1]);

    const cleaned = [];
    const seen = new Set();
    for (const url of urls) {
      const stripped = url.replace(/[)>,\]]+$/, "");
      if (!/\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(stripped)) continue;
      if (seen.has(stripped)) continue;
      seen.add(stripped);
      cleaned.push(stripped);
    }
    return cleaned;
  };

  const contentImages = extractImageUrls(post.content);

  const normalizedImages = images.map((img) => ({
    ...img,
    variant: (img.variant || "").toUpperCase(),
  }));

  const hasProcessed = normalizedImages.length > 0;

  const attachmentImages = [...attachments, ...contentImages].reduce(
    (acc, url) => {
      if (!url || acc.seen.has(url)) return acc;
      acc.seen.add(url);
      acc.list.push({
        imageUrl: url,
        variant: "ORIGINAL",
        imageId: `attachment-${acc.list.length}`,
      });
      return acc;
    },
    { seen: new Set(), list: [] }
  ).list;

  const gallerySources = hasProcessed ? normalizedImages : attachmentImages;

  const selected =
    gallerySources.find((img) => {
      if (selectedImageId === null) return false;
      return img.imageId === selectedImageId;
    }) || null;

  const defaultImage = gallerySources[0] || null;
  const activeImage = selected || defaultImage;

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
      </div>

      <div style={{ marginBottom: 12, color: "#94a3b8" }}>
        <strong style={{ color: "#e5e7eb" }}>주소: </strong>
        {post.address || "주소 정보 없음"}
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
              <ReplyItem key={reply.id} reply={reply} onActionSuccess={fetchDetail} />
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
