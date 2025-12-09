import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthModalContext = createContext(null);

export const useAuthModal = () => useContext(AuthModalContext);

export function AuthModalProvider({ children }) {
    // 1. 로그인/사용자 상태
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState(null); 
    
    // 2. 모달 상태
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

    // --- 모달 제어 함수 ---
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

    // --- 인증 처리 함수 ---
    const handleLoginSuccess = useCallback((data) => {
        setUserInfo(data);
        setIsLoggedIn(true);
        closeLoginModal();
    }, [closeLoginModal]);

    const handleLogout = useCallback(() => {
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

    return (
        <AuthModalContext.Provider value={value}>
            {children}
        </AuthModalContext.Provider>
    );

}
