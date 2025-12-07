import React from 'react';

// 💡 수정 사항: openLoginModal 함수를 props로 받도록 추가했습니다.
export default function SignupModal({ onClose, openLoginModal }) {
  
  // 소셜 회원가입/로그인 시도 핸들러
  const handleSocialSignup = (provider) => {
    console.log(`${provider} 소셜 회원가입/로그인 시도`);
    alert(`데모: ${provider} 인증 페이지로 이동합니다. (실제 서비스에서는 리다이렉트됩니다)`);
  };

  // 💡 수정 사항: '로그인하기' 버튼 클릭 시 handleGoToLogin 함수 실행
  const handleGoToLogin = (e) => {
    e.preventDefault();
    // 1. 현재 회원가입 모달을 닫고
    onClose(); 
    // 2. 로그인 모달을 열어주는 함수를 실행합니다.
    if (openLoginModal) {
        openLoginModal();
    }
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
