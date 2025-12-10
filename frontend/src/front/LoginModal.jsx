import React from "react";
import { apiBase } from "../api/http";   // ⬅️ 추가: 서버 베이스 URL

export default function LoginModal({ onClose, openSignupModal }) {
  // 소셜 로그인 핸들러
  const handleSocialLogin = (provider) => {
    // backend/server.js 에서
    // app.use("/api/oauth/google", googleOAuth);
    // app.use("/api/oauth/naver", naverOAuth);
    // app.use("/api/oauth/kakao", kakaoOAuth);
    //
    // 이런 식으로 붙어 있으니까, 프론트에서는:
    //   GET /api/oauth/google/login
    //   GET /api/oauth/kakao/login
    //   GET /api/oauth/naver/login
    // 로 보내주면 됨(라우터 안에서 /login 만들어놨다는 가정)

    const p = provider.toLowerCase(); // 'Google' -> 'google'

    // 실제 인증 페이지로 리다이렉트
    window.location.href = `${apiBase}/api/oauth/${p}/login`;
  };

  const handleGoToSignup = () => {
    onClose();
    if (openSignupModal) openSignupModal();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="page-title">로그인</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="social-login-group">
          <button
            className="btn-social btn-kakao"
            onClick={() => handleSocialLogin("Kakao")}
          >
            카카오로 시작하기
          </button>
          <button
            className="btn-social btn-naver"
            onClick={() => handleSocialLogin("Naver")}
          >
            네이버로 시작하기
          </button>
        </div>

        <div className="modal-footer-links">
          <button className="text-link" onClick={handleGoToSignup}>
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}
