import { Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Header from "./Header";
import Navbar from "./Navbar";
import SignupModal from "./SignupModal";
import "../App.css";

export default function Layout() {
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const openSignup = () => setIsSignupOpen(true);
  const closeSignup = () => setIsSignupOpen(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 폰트 로딩 (옵션)
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+KR:wght@400;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <div className="app-container">
      <Header onLogoClick={() => navigate("/")} openSignupModal={openSignup} />
      <Navbar />
      <main className="main-content">
        <div className="content-wrapper">
          <Outlet />
        </div>
      </main>

      {isSignupOpen && <SignupModal onClose={closeSignup} />}

      <footer className="app-footer">
        © 2025 Watch out! Community. All Rights Reserved.
      </footer>
    </div>
  );
}
