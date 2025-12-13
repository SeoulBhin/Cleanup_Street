import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthModal } from "../contexts/AuthModalContext";

function parseHash(hash) {
  const h = (hash || "").replace(/^#/, "");
  return Object.fromEntries(new URLSearchParams(h));
}

// 간단 JWT payload 디코더 (라이브러리 없이)
function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleLoginSuccess } = useAuthModal();

  useEffect(() => {
    const params = parseHash(location.hash);
    const token = params.token;

    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    const payload = decodeJwt(token);

    localStorage.setItem("accessToken", token);
    localStorage.setItem("userInfo", JSON.stringify(payload || {})); // ✅ 추가

    handleLoginSuccess({
      token,
      user: payload || null, // ✅ 변경: provider문구 말고 실제 payload 저장
    });

    window.history.replaceState(null, "", "/");
    navigate("/", { replace: true });
  }, [location.hash, navigate, handleLoginSuccess]);

  return <div style={{ padding: 20 }}>로그인 처리 중...</div>;
}
