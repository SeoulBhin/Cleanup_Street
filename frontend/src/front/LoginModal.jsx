import React from 'react';

/**
 * 로그인 모달 컴포넌트
 * @param {Object} props
 * @param {function} props.onClose - 모달을 닫는 함수
 * @param {function} props.openSignupModal - (새로 추가됨) 회원가입 모달을 여는 함수
 */
// 💡 수정 사항: openSignupModal을 props로 받습니다.
export default function LoginModal({ onClose, openSignupModal }) {

  // 소셜 로그인 핸들러 (실제 구현 시 해당 소셜 로그인 Provider로 리다이렉트)
  const handleSocialLogin = (provider) => {
    console.log(`${provider} 소셜 로그인 시도`);
    // 예: window.location.href = `/api/auth/${provider}`;
  };

  // 💡 새로 추가된 함수: 회원가입 버튼 클릭 핸들러
  const handleGoToSignup = () => {
      onClose(); // 현재 로그인 모달 닫기
      if (openSignupModal) {
          openSignupModal(); // 회원가입 모달 열기
      }
  };


  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content fade-in" 
        onClick={(e) => e.stopPropagation()} // 모달 배경 클릭이벤트 방지
      >
        <div className="modal-header">
          <h2 className="page-title">로그인</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* ======================================================= */}
        {/* 소셜 로그인 버튼 그룹 */}
        {/* ======================================================= */}
        <div className="social-login-group">
          {/* Google 버튼 */}
          <button 
            className="btn-social btn-google" 
            onClick={() => handleSocialLogin('Google')}
          >
            Google로 시작하기
          </button>
          
          {/* Kakao 버튼 */}
          <button 
            className="btn-social btn-kakao" 
            onClick={() => handleSocialLogin('Kakao')}
          >
            카카오로 시작하기
          </button>
          
          {/* Naver 버튼 */}
          <button 
            className="btn-social btn-naver" 
            onClick={() => handleSocialLogin('Naver')}
          >
            네이버로 시작하기
          </button>
        </div>
        
        {/* 추가적인 링크 */}
        <div className="modal-footer-links">
            {/* 💡 수정 사항: onClick 핸들러를 handleGoToSignup 함수로 연결 */}
            <button 
                className="text-link" 
                onClick={handleGoToSignup}
            >
              회원가입
            </button>
        </div>
      </div>
    </div>
  );
}
