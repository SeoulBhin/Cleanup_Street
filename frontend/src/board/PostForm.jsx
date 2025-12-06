import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createBoardPost,
  getBoardPost,
  updateBoardPost,
} from "../api/boards";
import { uploadFiles } from "../api/uploads";
import { FORUM_CATEGORIES } from "./categories";

export default function PostForm() {
  const { boardType, id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    category: FORUM_CATEGORIES[0],
    content: "",
    attachments: [],
    address: "",     // ✅ 주소 필드 추가
    // (필요하면 lat/lng 나중에 추가)
  });

  useEffect(() => {
    if (!isEdit) return;
    getBoardPost(boardType, id)
      .then((p) =>
        setForm({
          title: p.title || "",
          category: p.category || FORUM_CATEGORIES[0],
          content: p.content || "",
          attachments: p.attachments || [],
          address: p.address || "",   // ✅ 서버에 address가 있으면 채움
        })
      )
      .catch(() => {});
  }, [boardType, id, isEdit]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const { urls } = await uploadFiles(files);
      setForm((s) => ({ ...s, attachments: [...(s.attachments || []), ...urls] }));
    } catch {}
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      alert("제목/내용을 입력하세요.");
      return;
    }
    const payload = {
      title: form.title,
      content: form.content,
      author: "로그인한유저",
      boardType,
      category: form.category,
      attachments: form.attachments || [],
      address: form.address?.trim() || null,   // ✅ 주소 포함해서 보냄
    };

    try {
      // 수정 부분만
if (isEdit) {
  await updateBoardPost(boardType, id, payload);
  navigate(`/board/${boardType}/${id}`);
} else {
  const created = await createBoardPost(boardType, payload);
  navigate(`/board/${boardType}/${created.id}`);
}

    } catch (err) {
      if (err?.status === 401) {
        alert("로그인을 하십시오.");
      } else {
        alert("저장 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="page-container form-container fade-in">
      <h2 className="page-title">{isEdit ? "글 수정" : "새 글 작성"}</h2>
      <form className="form" onSubmit={onSubmit}>
        <div className="form-group">
          <label>제목</label>
          <input
            className="form-input"
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="제목을 입력하세요"
            required
          />
        </div>

        <div className="form-group">
          <label>카테고리</label>
          <select
            className="form-select"
            name="category"
            value={form.category}
            onChange={onChange}
          >
            {FORUM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ 주소 입력만 추가 */}
        <div className="form-group">
          <label>주소</label>
          <input
            className="form-input"
            name="address"
            value={form.address}
            onChange={onChange}
            placeholder="예) 서울특별시 중구 세종대로 110"
          />
        </div>

        <div className="form-group">
          <label>첨부파일</label>
          <input type="file" onChange={onUpload} />
          {!!(form.attachments || []).length && (
            <div style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>
              첨부됨:
              <ul>
                {form.attachments.map((u, idx) => (
                  <li key={idx}>
                    <a href={u} target="_blank" rel="noreferrer">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>내용</label>
          <textarea
            className="form-textarea"
            name="content"
            value={form.content}
            onChange={onChange}
            required
          />
        </div>

        <div className="form-actions">
          <button type="button" className="form-btn btn-cancel" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="form-btn btn-submit">
            {isEdit ? "수정 완료" : "작성 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
