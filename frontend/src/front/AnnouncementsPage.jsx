import { useEffect, useState } from "react";
import { getAnnouncements } from "../api/public";

export default function AnnouncementsPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getAnnouncements().then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div className="page-container fade-in">
      <h2 className="page-title">공지사항</h2>
      <div className="list-container">
        {items.map((it) => (
          <div key={it.id} className="list-item">
            <h3 className="list-item-title">{it.title}</h3>
            <div className="list-item-meta">
              <span>작성자: {it.author}</span> | <span>작성일: {it.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
