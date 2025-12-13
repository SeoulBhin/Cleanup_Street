import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { listBoardPosts, deleteBoardPost } from "../api/boards";
import { FORUM_CATEGORIES } from "./categories";

export default function BoardList() {
  const { boardType } = useParams();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const q = sp.get("q") || "";
  const selected = sp.get("cat") || "전체";

  const filtered = useMemo(() => {
    if (selected === "전체") return rows;
    return rows.filter((r) => r.category === selected);
  }, [rows, selected]);

  const navigate = useNavigate();

  const fetchList = async () => {
    setLoading(true);
    try {
        const list = await listBoardPosts(boardType, q);
        
        // 수정된 부분: list가 배열인지 확인하고, 아니면 빈 배열을 사용합니다.
        const safeList = Array.isArray(list) ? list : []; 
        setRows(safeList);
        
    } catch (error) {
        console.error("게시글 목록 로딩 오류:", error);
        setRows([]);
    } finally {
        setLoading(false);
    }
};
  useEffect(() => {
    fetchList();
    // eslint-disable-next-line
  }, [boardType, q]);

  const onSearch = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const keyword = (form.get("q") || "").trim();
    setSp((prev) => {
      const np = new URLSearchParams(prev);
      if (keyword) np.set("q", keyword);
      else np.delete("q");
      return np;
    });
  };

  const pickCat = (cat) => {
    setSp((prev) => {
      const np = new URLSearchParams(prev);
      if (cat && cat !== "전체") np.set("cat", cat);
      else np.delete("cat");
      return np;
    });
  };

  const onDelete = async (id) => {
    if (!window.confirm("정말 삭제할까요?")) return;
    await deleteBoardPost(boardType, id).catch(() => {});
    fetchList();
  };

  return (
    <div className="page-container fade-in">
      <div className="forum-header">
        <h2 className="page-title">일반 게시판</h2>
        <button
          className="btn-write"
          onClick={() => navigate(`/board/${boardType}/new`)}
        >
          글쓰기
        </button>
      </div>

      <form onSubmit={onSearch} style={{ marginBottom: "1rem" }}>
        <input
          name="q"
          defaultValue={q}
          className="form-input"
          placeholder="검색어를 입력하세요"
          style={{ width: 280, marginRight: 8 }}
        />
        <button className="form-btn btn-submit" type="submit">
          검색
        </button>
      </form>

      <div className="category-filters">
        <button
          className={`category-btn ${selected === "전체" ? "active" : ""}`}
          onClick={() => pickCat("전체")}
        >
          전체
        </button>
        {FORUM_CATEGORIES.map((c) => (
          <button
            key={c}
            className={`category-btn ${selected === c ? "active" : ""}`}
            onClick={() => pickCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div>불러오는 중...</div>
      ) : (
        <div className="list-container">
          {filtered.length === 0 && <div>게시글이 없습니다.</div>}
          {filtered.map((p) => (
            <div key={p.id} className="list-item forum-post">
              <div className="post-header">
                <span className="post-category">{p.category}</span>
                <h3 className="list-item-title">
                  <Link to={`/board/${boardType}/${p.id}`}>{p.title}</Link>
                </h3>
              </div>
              <p className="post-content">{p.content}</p>
              <div className="post-meta-wrapper">
                <div className="post-meta">
                  <span>작성자: {p.author || "익명"}</span> |{" "}
                  <span>
                    작성일:{" "}
                    {p.created_at
                      ? new Date(p.created_at).toLocaleDateString()
                      : "-"}
                  </span>
                </div>
                <div className="post-actions">
                  <Link to={`/board/${boardType}/${p.id}/edit`} className="btn-edit">
                    수정
                  </Link>
                  <button className="btn-delete" onClick={() => onDelete(p.id)}>
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
