import './App.css';
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Context 및 Modals import (경로 확인 필수)
import { AuthModalProvider, useAuthModal } from "./contexts/AuthModalContext"; 
import LoginModal from "./front/LoginModal";
import SignupModal from "./front/SignupModal";

// 페이지 및 레이아웃 컴포넌트 import (경로 확인 필수)
import Layout from "./front/Layout"; 
import HomePage from "./front/HomePage";
import IntroPage from "./front/IntroPage";
import AnnouncementsPage from "./front/AnnouncementsPage";
import GalleryPage from "./front/GalleryPage";
import BoardList from "./board/BoardList";
import PostForm from "./board/PostForm";
import PostView from "./board/PostView"; 
import Chat from "./chatting/Chat";


// 모달 렌더링 전용 컴포넌트: Context의 상태에 따라 전역적으로 모달을 표시
const GlobalModals = () => {
    const { 
        isLoginModalOpen, isSignupModalOpen, 
        closeLoginModal, openSignupModal,
        closeSignupModal, openLoginModal,
        handleLoginSuccess 
    } = useAuthModal();
    
    return (
        <>
            {isLoginModalOpen && (
                <LoginModal 
                    onClose={closeLoginModal} 
                    openSignupModal={openSignupModal} 
                    onLoginSuccess={handleLoginSuccess} 
                />
            )}
            {isSignupModalOpen && (
                <SignupModal 
                    onClose={closeSignupModal} 
                    openLoginModal={openLoginModal} 
                />
            )}
        </>
    );
};


function AppRoutes() {
    return (
        <Router>
            <Routes>
                {/* Layout 내부에 Header가 있고, Provider 내부에서 렌더링됩니다. */}
                <Route element={<Layout />}> 
                    <Route path="/" element={<HomePage />} />
                    <Route path="/intro" element={<IntroPage />} />
                    <Route path="/announcements" element={<AnnouncementsPage />} />
                    <Route path="/gallery" element={<GalleryPage />} />

                    <Route path="/board/:boardType" element={<BoardList />} />
                    <Route path="/board/:boardType/new" element={<PostForm />} />
                    <Route path="/board/:boardType/:id" element={<PostView />} />
                    <Route path="/board/:boardType/:id/edit" element={<PostForm />} />
                </Route>

                <Route path="/chat/:roomId" element={<Chat />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            
            <GlobalModals />
        </Router>
    );
}

export default function App() {
    return (
        <AuthModalProvider>
            <AppRoutes />
        </AuthModalProvider>
    );
}
