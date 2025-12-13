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
      <h2 className="page-title">활동 채팅방
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
