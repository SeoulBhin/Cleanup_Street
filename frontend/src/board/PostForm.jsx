// src/board/PostForm.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createBoardPost,
  getBoardPost,
  updateBoardPost,
} from "../api/boards";
import { uploadFiles } from "../api/uploads";
import { createImagePreview } from "../api/previews";
import { FORUM_CATEGORIES } from "./categories";

export default function PostForm() {
  const { boardType, id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    category: FORUM_CATEGORIES[0],
    content: "",
    // 실제 저장용으로 보내지 않음(프라이버시), 프리뷰 생성만 사용
    attachments: [],
    address: "",
  });
  const [preview, setPreview] = useState(null); // { previewId, autoUrl, plateUrl, selectedVariant }
  const [uploading, setUploading] = useState(false);
  const [processingText, setProcessingText] = useState("");

  // ================= 주소 검색 (카카오 우편번호) =================
  const openAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert("주소 검색 스크립트가 로드되지 않았습니다.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: function (data) {
        const roadAddr = data.roadAddress;
        const jibunAddr = data.jibunAddress;
        const fullAddress = roadAddr || jibunAddr;

        if (!fullAddress) return;

        setForm((s) => ({
          ...s,
          address: fullAddress,
        }));
      },
    }).open();
  };

  // ================= 글 수정일 때 기존 데이터 불러오기 =================
  useEffect(() => {
    if (!isEdit) return;
    getBoardPost(boardType, id)
      .then((p) =>
        setForm({
          title: p.title || "",
          category: p.category || FORUM_CATEGORIES[0],
          content: p.content || "",
          attachments: (p.images || []).map((img) => img.imageUrl) || [],
          address: p.address || "",
        })
      )
      .catch(() => {});
  }, [boardType, id, isEdit]);

  // ================= 공통 핸들러 =================
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setUploading(true);
      setProcessingText("이미지 처리 중입니다. 잠시만 기다려주세요...");

      const { urls } = await uploadFiles(files);
      setForm((s) => ({
        ...s,
        // 첫 번째 업로드만 사용, 원본 저장은 하지 않음
        attachments: urls.length ? [urls[0]] : [],
      }));

      // 첫 번째 업로드 파일로 모자이크 미리보기 생성
      const firstUrl = urls?.[0];
      if (firstUrl) {
        try {
          const p = await createImagePreview(firstUrl);
          setPreview({
            previewId: p.previewId,
            autoUrl: p.autoMosaicImage,
            plateUrl: p.plateVisibleImage,
            selectedVariant: "AUTO",
          });
          setProcessingText("");
        } catch (err) {
          console.error("미리보기 생성 실패", err);
          setProcessingText(
            "미리보기 생성에 실패했습니다. 그래도 원본을 사용해 저장할 수 있습니다."
          );
        }
      }
    } catch {
      alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (!preview) {
        // preview가 아직 없으면 처리중 메시지 유지
        setProcessingText((t) => t || "");
      }
    }
  };

  // ================= 제출 =================
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      alert("제목/내용을 입력하세요.");
      return;
    }

    // 공통 필드 (여기에는 category를 넣지 않는다)
    const base = {
      title: form.title,
      attachments: [], // 원본은 저장하지 않음 (모자이크만 서버에서 관리)
      address: form.address?.trim() || null,
      previewId: preview?.previewId || null,
      selectedVariant: preview?.selectedVariant || "AUTO",
    };

    try {
      if (isEdit) {
        // ✅ 수정: 이미 분류된 글 → 기존 category 유지, autoCategory=false
        await updateBoardPost(boardType, id, {
          ...base,
          content: form.content,
          category: form.category, // 서버에서 가져온 값 유지
          autoCategory: false,
        });
        navigate(`/board/${boardType}/${id}`);
      } else {
        // ✅ 새 글 작성: category는 보내지 않고 autoCategory=true → KoBERT가 분류
        const created = await createBoardPost(boardType, {
          ...base,
          content: form.content,
          postBody: form.content,
          autoCategory: true,
        });

        const newId = created.post_id || created.id;
        navigate(`/board/${boardType}/${newId}`);
      }
    } catch (err) {
      if (err?.status === 401) {
        alert("로그인을 하십시오.");
      } else if (err?.status === 400 && err?.code === "INVALID_ADDRESS") {
        alert("주소를 찾을 수 없습니다. 다시 확인해 주세요.");
      } else if (err?.status === 502 && err?.code === "GEOCODE_FAILED") {
        alert(
          "주소를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      } else {
        alert("저장 중 오류가 발생했습니다.");
      }
    }
  };

  // ================= 렌더 =================
  return (
    <div className="page-container form-container fade-in">
      <h2 className="page-title">
        {isEdit ? "글 수정" : "새 글 작성"}
      </h2>

      <form className="form" onSubmit={onSubmit}>
        {/* 제목 */}
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

        {/* 카테고리 (수정 화면에서만 의미 있음 / 새 글에는 실제로는 사용 안 함) */}
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

        {/* 주소 + 검색 버튼 */}
        <div className="form-group">
          <label>주소</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              name="address"
              value={form.address}
              readOnly
              placeholder="주소 검색 버튼을 눌러 선택하세요"
            />
            <button
              type="button"
              onClick={openAddressSearch}
              className="form-btn btn-secondary"
            >
              주소 검색
            </button>
          </div>
        </div>

        {/* 첨부파일 */}
        <div className="form-group">
          <label>첨부파일</label>
          <input type="file" onChange={onUpload} />
          {uploading && (
            <div style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>
              업로드 중...
            </div>
          )}
          {!!processingText && (
            <div style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>
              {processingText}
            </div>
          )}
          {!!(form.attachments || []).length && (
            <div style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>
              첨부 완료 · 모자이크 미리보기 생성됨
            </div>
          )}
        </div>

        {/* 모자이크 미리보기 (작성 중 선택) */}
        {preview && (
          <div className="form-group">
            <label>모자이크 선택</label>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setPreview((p) => ({ ...p, selectedVariant: "AUTO" }))
                }
                style={{
                  border:
                    preview.selectedVariant === "AUTO"
                      ? "2px solid #0ea5e9"
                      : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 0,
                  background: "transparent",
                  cursor: "pointer",
                  width: "48%",
                  minWidth: 260,
                }}
              >
                <img
                  src={preview.autoUrl}
                  alt="얼굴+번호판 모자이크"
                  style={{
                    width: "100%",
                    height: 220,
                    objectFit: "contain",
                    display: "block",
                    borderRadius: 10,
                    background: "#0f172a",
                  }}
                />
                <div
                  style={{ padding: 10, fontSize: 13, textAlign: "center" }}
                >
                  얼굴+번호판 모자이크
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setPreview((p) => ({
                    ...p,
                    selectedVariant: "PLATE_VISIBLE",
                  }))
                }
                style={{
                  border:
                    preview.selectedVariant === "PLATE_VISIBLE"
                      ? "2px solid #0ea5e9"
                      : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 0,
                  background: "transparent",
                  cursor: "pointer",
                  width: "48%",
                  minWidth: 260,
                }}
              >
                <img
                  src={preview.plateUrl}
                  alt="얼굴만 모자이크"
                  style={{
                    width: "100%",
                    height: 220,
                    objectFit: "contain",
                    display: "block",
                    borderRadius: 10,
                    background: "#0f172a",
                  }}
                />
                <div
                  style={{ padding: 10, fontSize: 13, textAlign: "center" }}
                >
                  얼굴만 모자이크
                </div>
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
              작성 단계에서 바로 모자이크 버전을 선택합니다. 저장 시 선택한
              버전으로 게시됩니다.
            </div>
          </div>
        )}

        {/* 내용 */}
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

        {/* 버튼들 */}
        <div className="form-actions">
          <button
            type="button"
            className="form-btn btn-cancel"
            onClick={() => navigate(-1)}
          >
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
