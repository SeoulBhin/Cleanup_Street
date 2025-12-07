import React from "react";
import { apiBase } from "../api/http";   // ⬅️ 추가

export default function SignupModal({ onClose, openLoginModal }) {
  const handleSocialSignup = (provider) => {
    const p = provider.toLowerCase();
    window.location.href = `${apiBase}/api/oauth/${p}/login`;
  };

  const handleGoToLogin = (e) => {
    e.preventDefault();
    onClose();
    if (openLoginModal) openLoginModal();
  };
    
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content fade-in" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="page-title">회원가입</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="form-container" style={{ maxWidth: 'unset', margin: '0' }}>
            
            <p className="signup-instruction">
                <span className="highlight"></span>10초 만에 시작하기
            </p>

            {/* 소셜 회원가입 버튼 그룹 */}
            <div className="social-login-group">
                <button 
                    className="btn-social btn-google" 
                    onClick={() => handleSocialSignup('Google')}
                >
                    Google로 시작하기
                </button>
                <button 
                    className="btn-social btn-kakao" 
                    onClick={() => handleSocialSignup('Kakao')}
                >
                    카카오로 시작하기
                </button>
                <button 
                    className="btn-social btn-naver" 
                    onClick={() => handleSocialSignup('Naver')}
                >
                    네이버로 시작하기
                </button>
            </div>
            
            {/* 로그인 페이지로 이동하는 섹션 */}
            <div className="modal-footer-links">
                이미 계정이 있으신가요?
                <button 
                    type="button" 
                    className="forgot-password-link link-as-button" 
                    onClick={handleGoToLogin} // 💡 수정된 핸들러 연결
                >
                    로그인하기
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
