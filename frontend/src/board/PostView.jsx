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
  const images = post.images || [];

  // 기존 방식 attachments (서버에 없으면 빈 배열)
  const attachments = post.attachments || [];

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

      {/* 🔹 모자이크 이미지 표시 */}
      {!!images.length && (
        <div style={{ marginTop: 16 }}>
          <strong>모자이크 이미지</strong>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 8,
            }}
          >
            {images.map((img) => (
              <div key={img.imageId} style={{ maxWidth: 260 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  variant: {img.variant}
                </div>
                <img
                  src={img.imageUrl}
                  alt={img.variant}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    marginTop: 4,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🔹 기존 attachments 표시 */}
      {!!attachments.length && (
        <div style={{ marginTop: 16 }}>
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
