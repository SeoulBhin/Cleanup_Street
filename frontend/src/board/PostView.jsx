// src/components/PostView.jsx

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBoardPost, deleteBoardPost } from "../api/boards";

export default function PostView() {
  const { boardType, id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [viewVariant, setViewVariant] = useState("AUTO"); // AUTO or PLATE_VISIBLE
  const [selectedImageId, setSelectedImageId] = useState(null);

  // 🔹 id가 정상적인 숫자인지 체크
  const isValidId =
    id !== undefined &&
    id !== "undefined" &&
    id !== "new" &&
    !Number.isNaN(Number(id));

  // --------------------------
  // 게시글 불러오기
  // --------------------------
  useEffect(() => {
    if (!isValidId) {
      setLoading(false);
      setLoadError("BAD_ID");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const p = await getBoardPost(boardType, id);
        setPost(p);
        setViewVariant("AUTO");
        setSelectedImageId(null);
      } catch (err) {
        console.error("게시글 불러오기 실패:", err);
        setLoadError("LOAD_FAIL");
      } finally {
        setLoading(false);
      }
    })();
  }, [boardType, id, isValidId]);

  // --------------------------
  // 삭제 기능
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
  // 잘못된 ID 처리
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
  // 로딩 / 에러 화면
  // --------------------------
  if (loading) {
    return (
      <div className="page-container">
        불러오는 중...
      </div>
    );
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

  // --------------------------
  // 실제 게시글 렌더링
  // --------------------------
  if (!post) {
    return (
      <div className="page-container">
        게시글 정보가 없습니다.
      </div>
    );
  }

  // 모자이크 이미지(posts.images)
  const images = Array.isArray(post.images) ? post.images : [];
  const attachments = Array.isArray(post.attachments) ? post.attachments : [];

  // 콘텐츠 안에 포함된 이미지 URL 추출
  const extractImageUrls = (text) => {
    if (!text || typeof text !== "string") return [];
    const urls = [];
    const urlRegex = /(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      urls.push(match[1]);
    }
    const uploadsRegex = /(\/uploads\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi;
    while ((match = uploadsRegex.exec(text)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  };

  const contentImages = extractImageUrls(post.content);

  const normalizedImages = images.map((img) => ({
    ...img,
    variant: (img.variant || "").toUpperCase(),
  }));

  const variantImage = (variant) =>
    normalizedImages.find((img) => img.variant === variant);

  const hasAuto = !!variantImage("AUTO");
  const hasPlateVisible = !!variantImage("PLATE_VISIBLE");
  const hasProcessed = normalizedImages.length > 0;

  // attachments + content 내 이미지 URL도 썸네일로 포함 (중복 제거)
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

  const gallerySources = hasProcessed
    ? normalizedImages
    : attachmentImages;

  const selected =
    gallerySources.find((img) => {
      if (selectedImageId === null) return false;
      return img.imageId === selectedImageId;
    }) || null;

  const defaultImage =
    (hasProcessed && (variantImage(viewVariant) || normalizedImages[0])) ||
    gallerySources[0] ||
    null;

  const activeImage = selected || defaultImage;

  const toggleVariant = () => {
    if (viewVariant === "AUTO" && hasPlateVisible) {
      setViewVariant("PLATE_VISIBLE");
      setSelectedImageId(variantImage("PLATE_VISIBLE")?.imageId ?? null);
    } else {
      setViewVariant("AUTO");
      setSelectedImageId(variantImage("AUTO")?.imageId ?? null);
    }
  };

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
          작성일:{" "}
          {post.created_at
            ? new Date(post.created_at).toLocaleString()
            : "-"}
        </span>
      </div>

      {/* 내용 */}
      <div className="post-content" style={{ whiteSpace: "pre-wrap" }}>
        {post.content}
      </div>

      {/* 🔹 이미지 영역 (모자이크/원본/처리중 상태 포함) */}
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
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
          {hasProcessed && (
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 12,
                background: "#0ea5e9",
                color: "#fff",
              }}
            >
              {viewVariant === "AUTO"
                ? "얼굴+번호판 모자이크"
                : "번호판만 모자이크 해제"}
            </span>
          )}
          <button
            className="form-btn btn-submit"
            style={{ padding: "6px 12px" }}
            onClick={toggleVariant}
            disabled={!hasProcessed || (!hasAuto && !hasPlateVisible)}
          >
            {viewVariant === "AUTO" ? "번호판 모자이크 해제" : "전체 모자이크"}
          </button>
        </div>

        {activeImage ? (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                width: "100%",
                maxWidth: 600,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                background: "#0f172a",
              }}
            >
              <img
                src={activeImage.imageUrl}
                alt={activeImage.variant || "image"}
                style={{ width: "100%", display: "block" }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
              {activeImage.variant}
              {activeImage.createdAt ? ` · ${new Date(activeImage.createdAt).toLocaleString()}` : ""}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, color: "#94a3b8" }}>
            표시할 이미지가 없습니다.
          </div>
        )}

        {gallerySources.length > 1 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
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
                  alt={img.variant || "thumbnail"}
                  style={{ width: 120, height: 80, objectFit: "cover", display: "block", borderRadius: 7 }}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 🔹 기존 attachments 표시 (링크) */}
      {!!attachments.length && (
        <div style={{ marginTop: 12 }}>
          <strong>첨부파일</strong>
          <ul>
            {attachments.map((u, idx) => (
              <li key={idx}>
                <a href={u} target="_blank" rel="noreferrer">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="form-actions" style={{ marginTop: 24 }}>
        <Link className="form-btn btn-cancel" to={`/board/${boardType}`}>
          목록
        </Link>

        <Link
          className="form-btn btn-submit"
          to={`/board/${boardType}/${id}/edit`}
        >
          수정
        </Link>

        <button className="form-btn btn-submit" onClick={onDelete}>
          삭제
        </button>
      </div>
    </div>
  );
}
