import React, { useState } from 'react';
import LoginModal from './LoginModal';
import SignupModal from './SignupModal'; // SignupModal 컴포넌트 import

export default function Header({ onLogoClick }) {
  // 1. 모달 상태 관리: 로그인과 회원가입 모두 필요
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  // 기존 openSignupModal 대신 Header 내에서 상태 관리
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false); 

  const openLoginModal = () => {
    setIsSignupModalOpen(false); // 혹시 열려있을 경우 닫고
    setIsLoginModalOpen(true);
  };
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const openSignupModal = () => {
    setIsLoginModalOpen(false); // 혹시 열려있을 경우 닫고
    setIsSignupModalOpen(true);
  };
  const closeSignupModal = () => setIsSignupModalOpen(false);


  return (
    <>
      <header className="app-header">
        <h1 onClick={onLogoClick} style={{ userSelect: "none" }}>
          와챠우! (Watch out!)
        </h1>
        <div className="login-section">
          
          <button className="btn btn-login" onClick={openLoginModal}>
            로그인
          </button>

          <button className="btn btn-signup" onClick={openSignupModal}>
            회원가입
          </button>
        </div>
      </header>

      {/* 2. 로그인 모달 렌더링 */}
      {isLoginModalOpen && (
        <LoginModal 
            onClose={closeLoginModal} 
            openSignupModal={openSignupModal}
        />
      )}

      {/* 3. 회원가입 모달 렌더링 */}
      {isSignupModalOpen && (
        <SignupModal 
            onClose={closeSignupModal} 
            openLoginModal={openLoginModal} // 회원가입 모달에 로그인 모달을 열어주는 함수 전달
        />
      )}
    </>
  );
}
