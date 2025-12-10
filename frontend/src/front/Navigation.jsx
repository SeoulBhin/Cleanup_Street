import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navigation() {
    
    const navItems = [
        { path: "/", name: "홈" },
        { path: "/intro", name: "서비스 소개" },
        { path: "/board/notice", name: "공지사항" },
        { path: "/board/free", name: "자유게시판" },
        { path: "/gallery", name: "이야기방" }
        
    ];

    return (
        <nav className="app-nav">
            <ul className="nav-list">
                {navItems.map((item) => (
                    <li key={item.path} className="nav-item">
                        <NavLink 
                            to={item.path}
                            className={({ isActive }) => 
                                isActive ? 'nav-link active' : 'nav-link'
                            }
                        >
                            {item.name}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
