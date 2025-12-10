import React from 'react';
import { useAuthModal } from '../contexts/AuthModalContext'; 

export default function Header({ onLogoClick }) {
    const { 
        isLoggedIn, 
        userInfo, 
        handleLogout, 
        openLoginModal, 
        openSignupModal 
    } = useAuthModal();
    
    
    // 로그인 전 UI (폼 + 로그인/회원가입 버튼)
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

    // 로그인 후 UI (환영 메시지 + 로그아웃 버튼)
    const LoggedInView = () => (
        <>
            <span className="welcome-message">
                {userInfo?.username ? `${userInfo.username}님 반갑습니다!` : '사용자님 반갑습니다!'}
            </span>
            <button className="btn btn-login" onClick={handleLogout}>
                로그아웃
            </button>
        </>
    );


    return (
        <header className="app-header">
            <h1 onClick={onLogoClick} style={{ userSelect: "none" }}>
                와챠우! (Watch out!)
            </h1>
            <div className="login-section">
                {/* Context 상태에 따른 조건부 렌더링 */}
                {isLoggedIn ? <LoggedInView /> : <LoggedOutView />}
            </div>
        </header>
    );
}
