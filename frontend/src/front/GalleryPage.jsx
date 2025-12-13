import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getGallery } from "../api/public";
import { useAuthModal } from "../contexts/AuthModalContext";

export default function GalleryPage() {
  const { isLoggedIn } = useAuthModal();
  const [images, setImages] = useState([]);

  useEffect(() => {
    // ✅ 로그인 안 되어 있으면 요청 자체 안 함
    if (!isLoggedIn) return;

    getGallery().then(setImages).catch(() => setImages([]));
  }, [isLoggedIn]);

  // ✅ 로그인 안 되어 있으면 문구만 출력
  if (!isLoggedIn) {
    return (
      <div className="page-container fade-in">
        <h2 className="page-title">활동 채팅방</h2>
        <p style={{ textAlign: "center", marginTop: 30, fontSize: 16 }}>
          로그인을 하십시요.
        </p>
      </div>
    );
  }
  
  return (
    <div className="page-container fade-in">
      <h2 className="page-title">활동 채팅방</h2>

      <div className="gallery-grid">
        {images.map((img) => (
          <div key={img.id} className="gallery-item">
            <Link
              to={`/chat/${img.roomId || `gallery-${img.id}`}`}
              className="gallery-link"
              title="이 카드 전용 채팅으로 이동"
            >
              <img src={img.url} alt={img.caption} />
              <div className="gallery-item-overlay">
                <div className="gallery-item-caption">{img.caption}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
