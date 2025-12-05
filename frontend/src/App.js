import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./front/layout";

import HomePage from "./front/HomePage";
import IntroPage from "./front/IntroPage";
import AnnouncementsPage from "./front/AnnouncementsPage";
import GalleryPage from "./front/GalleryPage";

import BoardList from "./board/BoardList";
import PostForm from "./board/PostForm";
import PostView from "./board/PostView";

import Chat from "./chatting/Chat";

export default function App() {
  return (
    <Router>
      <Routes>
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
    </Router>
  );
}
