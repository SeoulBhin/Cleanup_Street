import { useMemo, useState, useRef, useEffect } from "react";

const initialFormState = {
  userId: "",
  title: "",
  postBody: "",
  category: "기타",
  latitude: "",
  longitude: "",
  h3Index: "",
};

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function PostComposer({ onSuccess, onCancel }) {
  const [form, setForm] = useState(initialFormState);
  const [previewId, setPreviewId] = useState(null);
  const [autoMosaicImage, setAutoMosaicImage] = useState(null);
  const [plateVisibleImage, setPlateVisibleImage] = useState(null);
  const [showPlateVisible, setShowPlateVisible] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [isSubmitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const canSubmit = useMemo(() => {
    return previewId && form.title.trim() && form.postBody.trim();
  }, [previewId, form.title, form.postBody]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetPreview = () => {
    setPreviewId(null);
    setAutoMosaicImage(null);
    setPlateVisibleImage(null);
    setShowPlateVisible(false);
    setMessage("");
    setLocalPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    resetPreview();
    setSelectedFile(file);
    setLocalPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
    handleUploadAndPreview(file);
  };

  const handleUploadAndPreview = async (file) => {
    setError("");
    setMessage("");

    if (!form.userId.trim()) {
      setError("먼저 사용자 ID를 입력해주세요.");
      setSelectedFile(null);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("userId", form.userId);
      formData.append("image", file);

      const response = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "모자이크 생성에 실패했습니다.");
      }

      if (!data?.previewId) {
        throw new Error("모자이크 생성 응답이 올바르지 않습니다.");
      }

      setPreviewId(data.previewId);
      setAutoMosaicImage(data.autoMosaicImage);
      setPlateVisibleImage(data.plateVisibleImage);
      setShowPlateVisible(false);
      setMessage("모자이크 이미지가 생성되었습니다. 기본값은 번호판까지 모자이크 처리된 이미지입니다.");
      setLocalPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    } catch (err) {
      setError(err.message);
      setSelectedFile(null); // Clear file on error
      setLocalPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!previewId) {
      setError("먼저 이미지를 업로드하여 미리보기를 생성해주세요.");
      return;
    }

    setSubmitLoading(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId,
          userId: Number(form.userId),
          title: form.title.trim(),
          postBody: form.postBody.trim(),
          category: form.category || undefined,
          latitude: parseNumber(form.latitude),
          longitude: parseNumber(form.longitude),
          h3Index: parseNumber(form.h3Index),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "게시글 저장에 실패했습니다.");
      }

      setMessage("게시글이 성공적으로 저장되었습니다.");
      onSuccess?.(data);
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialFormState);
    resetPreview();
    setSelectedFile(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="userId">사용자 ID</label>
        <input
          type="number"
          id="userId"
          className="form-input"
          placeholder="DB에 등록된 사용자 ID"
          value={form.userId}
          onChange={handleChange("userId")}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="image-upload">이미지 업로드</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            type="button"
            className="form-btn btn-submit"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{ flexShrink: 0 }}
          >
            {isUploading ? '업로드 중...' : '파일 선택'}
          </button>
          <span style={{ color: '#4b5563', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {selectedFile ? selectedFile.name : '처리할 이미지 파일을 선택하세요.'}
          </span>
        </div>
        <input
          type="file"
          id="image-upload"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/webp"
          style={{ display: "none" }}
        />
      </div>

      {isUploading && <div className="form-group">모자이크 생성 중... 서버 성능에 따라 10초 이상 소요될 수 있습니다.</div>}

      {localPreviewUrl && (!previewId || isUploading) && (
        <div className="form-group">
          <label>원본 미리보기</label>
          <div className="mosaic-preview mosaic-preview--original">
            <div className="mosaic-preview-toolbar">
              <div>
                <p className="mosaic-preview-title">모자이크 준비 중입니다.</p>
                <p className="mosaic-preview-helper">잠시 후 얼굴과 번호판이 자동으로 가려집니다.</p>
              </div>
            </div>
            <div className="mosaic-preview-image">
              <img src={localPreviewUrl} alt="원본 미리보기" />
            </div>
          </div>
        </div>
      )}

      {previewId && (
        <div className="form-group">
          <label>모자이크 결과 미리보기</label>
          <div className="mosaic-preview">
            <div className="mosaic-preview-toolbar">
              <div>
                <p className="mosaic-preview-title">업로드한 사진은 자동으로 모자이크 처리됐어요.</p>
                <p className="mosaic-preview-helper">
                  {showPlateVisible
                    ? "필요한 경우에만 번호판을 확인하고, 완료 후에는 다시 가려주세요."
                    : "기본값으로 얼굴·번호판이 모두 가려진 상태입니다."}
                </p>
              </div>
              {plateVisibleImage && (
                <button
                  type="button"
                  className={`mosaic-toggle-btn ${showPlateVisible ? "active" : ""}`}
                  onClick={() => setShowPlateVisible((prev) => !prev)}
                >
                  {showPlateVisible ? "차량 모자이크 적용" : "차량 모자이크 해제"}
                </button>
              )}
            </div>

            <div className="mosaic-preview-image">
              <img
                src={showPlateVisible ? plateVisibleImage : autoMosaicImage}
                alt="모자이크 미리보기"
              />
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="title">제목</label>
        <input
          type="text"
          id="title"
          className="form-input"
          value={form.title}
          onChange={handleChange("title")}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="category">카테고리</label>
        <select
          id="category"
          className="form-select"
          value={form.category}
          onChange={handleChange("category")}
        >
          <option value="도로파손">도로파손</option>
          <option value="가로등고장">가로등고장</option>
          <option value="쓰레기 문제">쓰레기 문제</option>
          <option value="기타">기타</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="postBody">내용</label>
        <textarea
          id="postBody"
          className="form-textarea"
          value={form.postBody}
          onChange={handleChange("postBody")}
          required
        />
      </div>

      <div className="form-group" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        <div>
          <label htmlFor="latitude">위도</label>
          <input
            type="number"
            step="0.000001"
            id="latitude"
            className="form-input"
            value={form.latitude}
            onChange={handleChange("latitude")}
          />
        </div>
        <div>
          <label htmlFor="longitude">경도</label>
          <input
            type="number"
            step="0.000001"
            id="longitude"
            className="form-input"
            value={form.longitude}
            onChange={handleChange("longitude")}
          />
        </div>
        <div>
          <label htmlFor="h3Index">H3 인덱스</label>
          <input
            type="number"
            id="h3Index"
            className="form-input"
            value={form.h3Index}
            onChange={handleChange("h3Index")}
          />
        </div>
      </div>

      {(message || error) && (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.5rem",
            backgroundColor: error ? "#fee2e2" : "#dcfce7",
            color: error ? "#b91c1c" : "#15803d",
          }}
        >
          {error || message}
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="form-btn btn-cancel" onClick={handleCancel}>
          취소
        </button>
        <button type="submit" className="form-btn btn-submit" disabled={!canSubmit || isSubmitLoading}>
          {isSubmitLoading ? "저장 중..." : "글작성 완료"}
        </button>
      </div>
    </form>
  );
}
