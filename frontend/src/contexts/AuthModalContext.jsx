import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const AuthModalContext = createContext(null);

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (context === null) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
};

export function AuthModalProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  const openLoginModal = useCallback(() => {
    setIsSignupModalOpen(false);
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const openSignupModal = useCallback(() => {
    setIsLoginModalOpen(false);
    setIsSignupModalOpen(true);
  }, []);

  const closeSignupModal = useCallback(() => setIsSignupModalOpen(false), []);

  // ✅ 앱 시작 시 토큰 있으면 로그인 상태 복구
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setIsLoggedIn(true);
      // userInfo 복구는 /me 호출이 베스트지만 일단 true만 켜도 Header는 바뀜
    }
  }, []);

  // ✅ 로그인 성공 처리: 토큰 저장 + 상태 반영
  const handleLoginSuccess = useCallback(
    (data) => {
      if (data?.token) {
        localStorage.setItem("accessToken", data.token);
      }
      setUserInfo(data?.user ?? data ?? null);
      setIsLoggedIn(true);
      closeLoginModal();
    },
    [closeLoginModal]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token"); 
    setIsLoggedIn(false);
    setUserInfo(null);
    alert("로그아웃 되었습니다.");
  }, []);

  const value = {
    isLoggedIn,
    userInfo,
    handleLogout,
    openLoginModal,
    closeLoginModal,
    openSignupModal,
    closeSignupModal,
    handleLoginSuccess,
    isLoginModalOpen,
    isSignupModalOpen,
  };

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}
