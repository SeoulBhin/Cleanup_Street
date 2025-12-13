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

  // ✅ 앱 시작 시 로그인 복구: token + userInfo
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("userInfo");

    if (token) {
      setIsLoggedIn(true);
      if (storedUser) {
        try {
          setUserInfo(JSON.parse(storedUser));
        } catch {
          setUserInfo(null);
        }
      }
    }
  }, []);

  // ✅ 로그인 성공 처리: 토큰 + 유저 저장
  const handleLoginSuccess = useCallback(
    (data) => {
      if (data?.token) {
        localStorage.setItem("accessToken", data.token);
      }
      if (data?.user) {
        setUserInfo(data.user);
        localStorage.setItem("userInfo", JSON.stringify(data.user)); // ✅ 추가
      } else {
        setUserInfo(null);
        localStorage.removeItem("userInfo");
      }

      setIsLoggedIn(true);
      closeLoginModal();
    },
    [closeLoginModal]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userInfo"); // ✅ 추가
    localStorage.removeItem("token");    // (기존 잔재 호환용) 있어도 무방
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
