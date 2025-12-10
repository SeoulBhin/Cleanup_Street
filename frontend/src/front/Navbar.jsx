import { NavLink } from "react-router-dom";

export default function Navbar() {
  const items = [
    { to: "/intro", label: "소개" },
    { to: "/announcements", label: "공지사항" },
    { to: "/board/free", label: "일반 게시판" },
    { to: "/gallery", label: "활동 채팅방" },
  ];

  return (
    <nav className="app-nav">
      <ul className="nav-list">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              isActive ? "nav-item active" : "nav-item"
            }
          >
            {n.label}
          </NavLink>
        ))}
      </ul>
    </nav>
  );
}
