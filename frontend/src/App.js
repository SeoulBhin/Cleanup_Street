import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// 레이아웃 및 컴포넌트 import
import Layout from "./front/layout"; // 이 안에 Header가 있다고 가정
import SignupModal from "./front/SignupModal"; // 회원가입 모달
import LoginModal from "./front/LoginModal";   // 로그인 모달

// 기존 페이지 컴포넌트
import HomePage from "./front/HomePage";
import IntroPage from "./front/IntroPage";
import AnnouncementsPage from "./front/AnnouncementsPage";
import GalleryPage from "./front/GalleryPage";

// 게시판 컴포넌트
import BoardList from "./board/BoardList";
import PostForm from "./board/PostForm";
import PostView from "./board/PostView";

// 채팅 컴포넌트
import Chat from "./chatting/Chat";


export default function App() {
  // 모달 상태 관리: App.js에서 최상위 상태를 관리합니다.
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  // 모달 제어 함수
  const openLoginModal = () => {
    setIsSignupModalOpen(false); // 다른 모달 닫기
    setIsLoginModalOpen(true);
  };
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const openSignupModal = () => {
    setIsLoginModalOpen(false); // 다른 모달 닫기
    setIsSignupModalOpen(true);
  };
  const closeSignupModal = () => setIsSignupModalOpen(false);


  //  Layout에 모달 제어 함수를 props로 전달하는 래퍼 컴포넌트
  const LayoutWrapper = (props) => (
      <Layout 
          {...props} 
          openLoginModal={openLoginModal} 
          openSignupModal={openSignupModal} 
      />
  );


  return (
    <Router>
      <Routes>
        <Route element={<LayoutWrapper />}> 
          {/* 홈 및 정적 페이지 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/intro" element={<IntroPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/gallery" element={<GalleryPage />} />

          {/* 게시판 라우팅 */}
          <Route path="/board/:boardType" element={<BoardList />} />
          <Route path="/board/:boardType/new" element={<PostForm />} />
          <Route path="/board/:boardType/:id" element={<PostView />} />
          <Route path="/board/:boardType/:id/edit" element={<PostForm />} />
        </Route>

        <Route path="/chat/:roomId" element={<Chat />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {isLoginModalOpen && (
        <LoginModal 
          onClose={closeLoginModal} 
          openSignupModal={openSignupModal} // 로그인 -> 회원가입 전환
        />
      )}
      {isSignupModalOpen && (
        <SignupModal 
          onClose={closeSignupModal} 
          openLoginModal={openLoginModal} // 회원가입 -> 로그인 전환
        />
      )}
    </Router>
  );
}
