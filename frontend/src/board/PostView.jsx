// src/components/PostView.jsx
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getBoardPost,
  deleteBoardPost,
  addLike,        // ✅ 추가
  listReplies,    // ✅ 추가 (GET /api/posts/:postId/comments)
  submitReply,    // ✅ 추가 (POST /api/posts/:postId/comments)
} from "../api/boards";

import ReplyItem from "./ReplyItem";

export default function PostView() {
  const { boardType, id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);

  // ✅ 좋아요/댓글 상태
  const [isLiked, setIsLiked] = useState(false);
  const [replies, setReplies] = useState([]);
  const [newReplyText, setNewReplyText] = useState("");

  // 🔹 id가 정상적인 숫자인지 체크
  const isValidId =
    id !== undefined &&
    id !== "undefined" &&
    id !== "new" &&
    !Number.isNaN(Number(id));

  // --------------------------
  // ✅ 게시글 + 댓글 같이 불러오기
  // --------------------------
  const fetchDetail = useCallback(async () => {
    if (!isValidId) {
      setLoading(false);
      setLoadError("BAD_ID");
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      // 1) 게시글 불러오기 (기존)
      const p = await getBoardPost(boardType, id);
      setPost(p);
      setSelectedImageId(null);

      // ✅ 서버가 is_liked_by_me 내려주면 초기 좋아요 상태 세팅
      setIsLiked(!!p?.is_liked_by_me);

      // 2) 댓글 불러오기 (서버 확정 라우트)
      const r = await listReplies(boardType, id);
      setReplies(Array.isArray(r) ? r : []);
    } catch (err) {
      console.error("게시글/댓글 불러오기 실패:", err);
      setLoadError("LOAD_FAIL");
      setPost(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [boardType, id, isValidId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // --------------------------
  // ✅ 게시글 좋아요 토글
  // --------------------------
  const handleLike = async () => {
    if (!post) return;

    const wasLiked = isLiked;
    const delta = wasLiked ? -1 : 1;

    // 낙관적 업데이트
    setIsLiked(!wasLiked);
    setPost((prev) =>
      prev ? { ...prev, likes: (prev.likes || 0) + delta } : prev
    );

    try {
      // 서버: POST /api/posts/:postId/like  → { liked: true/false }
      const res = await addLike(boardType, id);
      setIsLiked(!!res?.liked);
    } catch (err) {
      console.error("좋아요 실패:", err);

      // 롤백
      setIsLiked(wasLiked);
      setPost((prev) =>
        prev ? { ...prev, likes: (prev.likes || 0) - delta } : prev
      );

      if (err?.status === 401) alert("로그인이 필요합니다.");
      else alert("좋아요 처리에 실패했습니다.");
    }
  };

  // --------------------------
  // ✅ 댓글 작성
  // --------------------------
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    const text = newReplyText.trim();
    if (!text) return;

    try {
      await submitReply(boardType, id, text); // body: { content: text }
      setNewReplyText("");
      await fetchDetail();
    } catch (err) {
      console.error("댓글 작성 실패:", err);
      if (err?.status === 401) alert("로그인이 필요합니다.");
      else alert("댓글 작성에 실패했습니다.");
    }
  };

  // --------------------------
  // 삭제 기능 (기존)
  // --------------------------
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

  // --------------------------
  // 잘못된 ID 처리 (기존)
  // --------------------------
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

  // --------------------------
  // 로딩 / 에러 화면 (기존)
  // --------------------------
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

  // --------------------------
  // ✅ (기존) 이미지 처리 로직 그대로
  // --------------------------
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

  // --------------------------
  // 렌더링
  // --------------------------
  return (
    <div className="page-container fade-in">
      {/* 제목 */}
      <h2 className="page-title" style={{ border: "none", paddingBottom: 0 }}>
        {post.title}
      </h2>

      {/* 메타 정보 */}
      <div className="post-meta" style={{ marginBottom: 16 }}>
        <span className="post-category" style={{ marginRight: 8 }}>
          {post.category}
        </span>
        <span>작성자: {post.author || "익명"}</span> |{" "}
        <span>
          작성일: {post.created_at ? new Date(post.created_at).toLocaleString() : "-"}
        </span>
      </div>

      {/* ✅ 좋아요 버튼 (추가) */}
      <div className="post-actions-detail" style={{ marginBottom: 12 }}>
        <button
          className={`btn-action ${isLiked ? "active" : ""}`}
          onClick={handleLike}
        >
          {isLiked ? "❤️ 좋아요 취소" : "🤍 좋아요"} ({post.likes || 0})
        </button>
      </div>

      {/* 내용 */}
      <div className="post-content" style={{ whiteSpace: "pre-wrap" }}>
        {post.content}
      </div>

      {/* 이미지 영역 (기존) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <strong>이미지</strong>
          {!hasProcessed && !!attachments.length && (
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 12,
                background: "#f97316",
                color: "#fff",
              }}
            >
              처리 중 (원본 미리보기)
            </span>
          )}
        </div>

        {activeImage ? (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                width: "100%",
                maxWidth: 960,
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                background: "#0f172a",
              }}
            >
              <img
                src={activeImage.imageUrl}
                alt="게시 이미지"
                style={{
                  width: "100%",
                  minHeight: 320,
                  maxHeight: 640,
                  objectFit: "contain",
                  display: "block",
                  background: "#0f172a",
                }}
                onError={(e) => {
                  e.currentTarget.src =
                    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23232a3b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%237884ab' font-size='20'%3E이미지를 불러올 수 없습니다%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
              {activeImage.createdAt ? new Date(activeImage.createdAt).toLocaleString() : ""}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, color: "#94a3b8" }}>표시할 이미지가 없습니다.</div>
        )}

        {gallerySources.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {gallerySources.map((img) => (
              <button
                key={img.imageId || img.imageUrl}
                onClick={() => setSelectedImageId(img.imageId || img.imageUrl)}
                style={{
                  border:
                    activeImage &&
                    (activeImage.imageId === img.imageId ||
                      activeImage.imageUrl === img.imageUrl)
                      ? "2px solid #0ea5e9"
                      : "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 0,
                  background: "#0b1220",
                  cursor: "pointer",
                }}
              >
                <img
                  src={img.imageUrl}
                  alt="이미지 썸네일"
                  style={{ width: 120, height: 80, objectFit: "cover", display: "block", borderRadius: 7 }}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <hr className="detail-separator" style={{ marginTop: 18 }} />

      {/* ✅ 댓글 섹션 (추가) */}
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

      {/* 하단 버튼 (기존) */}
      <div className="form-actions" style={{ marginTop: 24 }}>
        <Link className="form-btn btn-cancel" to={`/board/${boardType}`}>
          목록
        </Link>

        <Link className="form-btn btn-submit" to={`/board/${boardType}/${id}/edit`}>
          수정
        </Link>

        <button className="form-btn btn-submit" onClick={onDelete}>
          삭제
        </button>
      </div>
    </div>
  );
}
