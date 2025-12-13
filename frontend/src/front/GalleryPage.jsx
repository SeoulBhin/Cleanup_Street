import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getGallery } from "../api/public";

export default function GalleryPage() {
  const [images, setImages] = useState([]);

  useEffect(() => {
    getGallery().then(setImages).catch(() => setImages([]));
  }, []);

  return (
    <div className="page-container fade-in">
      {/* 페이지 제목 */}
      <h2 className="page-title">활동 채팅방</h2>

      <div className="gallery-grid">
        {images.map((img) => (
          <div key={img.id} className="gallery-item">
            {/* 카드 전체 클릭 시 채팅방 이동 */}
            <Link
              to={`/chat/${img.roomId || `gallery-${img.id}`}`}
              className="gallery-link"
              title="이 카드 전용 채팅으로 이동"
            >
              <img src={img.url} alt={img.caption} />

              {/* 오버레이 + 캡션 */}
              <div className="gallery-item-overlay">
                <div className="gallery-item-caption">
                  {img.caption}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
