import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthModal } from "../contexts/AuthModalContext";

function parseHash(hash) {
  const h = (hash || "").replace(/^#/, "");
  return Object.fromEntries(new URLSearchParams(h));
}

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleLoginSuccess } = useAuthModal();

  useEffect(() => {
    const params = parseHash(location.hash);
    const token = params.token;
    const provider = params.provider;

    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    localStorage.setItem("accessToken", token);

    handleLoginSuccess({
      user: { username: provider ? `${provider} 로그인` : "사용자" },
      token,
    });

    // ✅ hash 제거(토큰 흔적 제거) -> 이후에 다시 콜백 페이지로 와도 재처리 방지
    window.history.replaceState(null, "", "/");

    navigate("/", { replace: true });
  }, [location.hash, navigate, handleLoginSuccess]);

  return <div style={{ padding: 20 }}>로그인 처리 중...</div>;
}
