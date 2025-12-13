import React, { useState } from 'react';
import { useAuthModal } from '../contexts/AuthModalContext';
import { FaBell } from 'react-icons/fa'; // react-icons/fa 사용

export default function Header({ onLogoClick }) {
    
    const context = useAuthModal();

    // --- 알림 상태 관리 ---
    const [notifications, setNotifications] = useState([]); 
    const [isNotificationOpen, setIsNotificationOpen] = useState(false); 

    // Context가 null일 경우 안전하게 처리
    if (!context) {
        return (
            <header className="app-header">
                <h1>와챠웃! (Watch out!)</h1>
                <div className="login-section">인증 시스템 로딩 중...</div>
            </header>
        );
    }
    
    const { 
        isLoggedIn, 
        userInfo, 
        handleLogout, 
        openLoginModal, 
        openSignupModal 
    } = context;
    
    // 읽지 않은 알림 개수 계산
    const unreadCount = notifications.filter(n => !n.read).length;

    // --- 이벤트 핸들러 ---
    
    const handleNotificationToggle = () => {
        setIsNotificationOpen(prev => !prev);
    };

    const handleNotificationClick = (id) => {
        setNotifications(notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
        ));
    };
    // 알림 드롭다운 창 컴포넌트
    const NotificationDropdown = () => (
        <div className="notification-dropdown">
            <div className="dropdown-header">
                <h4>알림 ({unreadCount}개)</h4>
            </div>
            
            {notifications.length === 0 ? (
                <div className="dropdown-item-empty">도착한 알림이 없습니다.</div>
            ) : (
                <ul className="dropdown-list">
                    {notifications.map(n => (
                        <li 
                            key={n.id} 
                            // 읽음/읽지 않음 상태에 따라 클래스 적용
                            className={`dropdown-item ${n.read ? 'read' : 'unread'}`}
                            onClick={() => handleNotificationClick(n.id)}
                        >
                            <div className="item-message">{n.message}</div>
                        </li>
                    ))}
                </ul>
            )}
            <div className="dropdown-footer">
                <button onClick={() => setIsNotificationOpen(false)}>닫기</button>
            </div>
        </div>
    );


    // 로그인 전 UI
    const LoggedOutView = () => (
        <>
            <button className="btn btn-login" onClick={openLoginModal}>
                로그인
            </button>
            <button className="btn btn-signup" onClick={openSignupModal}>
                회원가입
            </button>
        </>
    );

    // 로그인 후 UI (Logged In View) 수정
    const LoggedInView = () => {
        const name = userInfo?.displayName || userInfo?.username || '사용자';
        return (
            <>
                <div className="notification-wrapper-inline"> {/* 인라인 배치를 위한 새 클래스 */}
                    <button 
                        className="notification-icon-container-inline" 
                        onClick={handleNotificationToggle}
                        aria-label="알림 보기"
                    >
                        <FaBell size={20} />
                        {unreadCount > 0 && (
                            <span className="notification-badge-inline">{unreadCount}</span>
                        )}
                    </button>
                    {isNotificationOpen && <NotificationDropdown />}
                </div>

                {/* 2. 환영 메시지 */}
                <span className="welcome-message">
                    {name}님 반갑습니다!
                </span>
                
                {/* 3. 로그아웃 버튼 */}
                <button className="btn btn-login" onClick={handleLogout}>
                    로그아웃
                </button>
            </>
        );
    };


    return (
        <header className="app-header">
            <h1 onClick={onLogoClick} style={{ userSelect: "none" }}>
                와챠웃! (Watch out!)
            </h1>
            
            <div className="login-section">
                {/* Context 상태에 따른 조건부 렌더링 */}
                {isLoggedIn ? <LoggedInView /> : <LoggedOutView />}
            </div>
        </header>
    );
}
