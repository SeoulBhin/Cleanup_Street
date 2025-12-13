import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthModal } from "../contexts/AuthModalContext";

function parseHash(hash) {
  // hash: "#provider=naver&token=xxx"
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
      // 토큰 없으면 그냥 홈
      navigate("/", { replace: true });
      return;
    }

    // ✅ 토큰 저장
    localStorage.setItem("accessToken", token);

    // ✅ 로그인 상태 반영 (Header가 즉시 로그인 UI로 바뀜)
    handleLoginSuccess({
      user: {
        username: provider ? `${provider} 로그인` : "사용자",
      },
      token,
    });

    // ✅ hash 제거 + 홈 이동
    navigate("/", { replace: true });
  }, [location.hash, navigate, handleLoginSuccess]);

  return <div style={{ padding: 20 }}>로그인 처리 중...</div>;
}
