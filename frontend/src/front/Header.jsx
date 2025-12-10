import React from 'react';
import { useAuthModal } from '../contexts/AuthModalContext'; 

function LoggedOutView({ openLoginModal, openSignupModal }) {
    return (
        <>
            <button className="btn btn-login" onClick={openLoginModal}>
                로그인
            </button>
            <button className="btn btn-signup" onClick={openSignupModal}>
                회원가입
            </button>
        </>
    );
}

function LoggedInView({ userInfo, handleLogout }) {
    return (
        <>
            <span className="welcome-message">
                {userInfo?.username
                    ? `${userInfo.username}님 반갑습니다!`
                    : '사용자님 반갑습니다!'}
            </span>
            <button className="btn btn-login" onClick={handleLogout}>
                로그아웃
            </button>
        </>
    );
}

export default function Header({ onLogoClick }) {

    // Context 사용
    const { 
        isLoggedIn, 
        userInfo, 
        handleLogout, 
        openLoginModal, 
        openSignupModal 
    } = useAuthModal();

    return (
        <header className="app-header">
            <h1 
                onClick={onLogoClick} 
                style={{ userSelect: "none", cursor: "pointer" }}
            >
                와챠우! (Watch out!)
            </h1>

            <div className="login-section">
                {isLoggedIn 
                    ? <LoggedInView userInfo={userInfo} handleLogout={handleLogout} />
                    : <LoggedOutView openLoginModal={openLoginModal} openSignupModal={openSignupModal} />}
            </div>
        </header>
    );
}
