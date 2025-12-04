import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBoardPost, deleteBoardPost } from "../api/boards";

export default function PostView() {
  const { boardType, id } = useParams();
  const [post, setPost] = useState(null);
  const navigate = useNavigate();

  const fetch = async () => {
    try {
      const p = await getBoardPost(boardType, id);
      setPost(p);
    } catch {
      navigate(`/board/${boardType}`);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line
  }, [boardType, id]);

  const onDelete = async () => {
    if (!window.confirm("정말 삭제할까요?")) return;
    await deleteBoardPost(boardType, id).catch(() => {});
    navigate(`/board/${boardType}`);
  };

  if (!post) return <div className="page-container">불러오는 중...</div>;

  return (
    <div className="page-container fade-in">
      <h2 className="page-title" style={{ border: "none", paddingBottom: 0 }}>
        {post.title}
      </h2>
      <div className="post-meta" style={{ marginBottom: 16 }}>
        <span className="post-category" style={{ marginRight: 8 }}>
          {post.category}
        </span>
        <span>작성자: {post.author || "익명"}</span>{" "}
        |{" "}
        <span>
          작성일:{" "}
          {post.created_at ? new Date(post.created_at).toLocaleString() : "-"}
        </span>
      </div>
      <div className="post-content" style={{ whiteSpace: "pre-wrap" }}>
        {post.content}
      </div>

      {!!(post.attachments || []).length && (
        <div style={{ marginTop: 16 }}>
          <strong>첨부파일</strong>
          <ul>
            {post.attachments.map((u, idx) => (
              <li key={idx}>
                <a href={u} target="_blank" rel="noreferrer">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

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
