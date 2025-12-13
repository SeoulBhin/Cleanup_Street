import React, { useState } from 'react';
import { useAuthModal } from '../contexts/AuthModalContext';
import { FaBell } from 'react-icons/fa'; // react-icons/fa 사용

export default function Header({ onLogoClick }) {
    
    const context = useAuthModal();

    // --- 알림 상태 관리 ---
    // 실제 알림 데이터는 빈 배열로 초기화 (API로 받아와야 함)
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
    // 알림 버튼 클릭 시 드롭다운 토글
    const handleNotificationToggle = () => {
        setIsNotificationOpen(prev => !prev);
    };

    // 알림 항목 클릭 시 읽음 처리 (가정)
    const handleNotificationClick = (id) => {
        // 실제 로직: 서버에 읽음 요청 후 상태 업데이트
        setNotifications(notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
        ));
    };
    // --- UI 컴포넌트 ---
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
                            {/* 실제 데이터가 있다면 n.time 등을 표시합니다. */}
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

    // 로그인 후 UI
    const LoggedInView = () => {
        const name = userInfo?.displayName || userInfo?.username || '사용자';
        return (
            <>
                <span className="welcome-message">
                    {name}님 반갑습니다!
                </span>
                <button className="btn btn-login" onClick={handleLogout}>
                    로그아웃
                </button>
            </>
        );
    };


    return (
        <header className="app-header">
            {/* 제목과 알림 아이콘을 묶는 컨테이너 추가 */}
            <div className="header-title-section">
                <h1 onClick={onLogoClick} style={{ userSelect: "none" }}>
                    와챠웃! (Watch out!)
                </h1>
                
                {/* 알림 아이콘 영역 (로그인 상태일 때 항상 표시) */}
                {isLoggedIn && (
                    <div className="notification-wrapper">
                        <button 
                            className="notification-icon-container" 
                            onClick={handleNotificationToggle}
                            aria-label="알림 보기"
                        >
                            <FaBell size={20} /> {/* FaBell 아이콘 사용 */}
                            
                            {/* 읽지 않은 알림이 1개 이상일 때만 배지 표시 */}
                            {unreadCount > 0 && (
                                <span className="notification-badge">{unreadCount}</span>
                            )}
                        </button>
                        
                        {/* 드롭다운 창 조건부 렌더링 */}
                        {isNotificationOpen && <NotificationDropdown />}
                    </div>
                )}
            </div>
            
            <div className="login-section">
                {/* Context 상태에 따른 조건부 렌더링 */}
                {isLoggedIn ? <LoggedInView /> : <LoggedOutView />}
            </div>
        </header>
    );
}
