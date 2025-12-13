// src/components/Header.jsx
import React from "react";
import { useAuthModal } from "../contexts/AuthModalContext";

export default function Header({ onLogoClick }) {
  const context = useAuthModal();

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
    openSignupModal,
  } = context;

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
    const name = userInfo?.displayName || userInfo?.username || "사용자";
    return (
      <>
        <span className="welcome-message">{name}님 반갑습니다!</span>

        <button className="btn btn-login" onClick={handleLogout}>
          로그아웃
        </button>
      </>
    );
  };

  return (
    <header className="app-header">
      <h1 onClick={onLogoClick} style={{ userSelect: "none", cursor: "pointer" }}>
        와챠웃! (Watch out!)
      </h1>

      <div className="login-section">
        {isLoggedIn ? <LoggedInView /> : <LoggedOutView />}
      </div>
    </header>
  );
}