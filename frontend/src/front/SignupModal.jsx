import React, { useState } from "react";
import axios from "axios";

const API_BASE = "/api/auth"; // 서버에서 app.use('/api/auth', authRoutes) 라고 되어 있다고 가정

export default function SignupModal({ onClose }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    passwordConfirm: "",
    code: "",
  });

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [message, setMessage] = useState("");   // 성공/안내 메시지
  const [error, setError] = useState("");       // 에러 메시지

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 1) 이메일로 인증코드 보내기
  const handleSendCode = async () => {
    if (!form.email) {
      setError("이메일을 먼저 입력하세요.");
      return;
    }

    try {
      setError("");
      setMessage("");
      setIsSendingCode(true);

      const res = await axios.post(`${API_BASE}/register/start`, {
        email: form.email,
      });

      setMessage(res.data?.message || "인증 코드가 전송되었습니다.");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        "인증 코드 전송 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setIsSendingCode(false);
    }
  };

  // 2) 이메일 + 코드 검증
  const handleVerifyCode = async () => {
    if (!form.email || !form.code) {
      setError("이메일과 인증코드를 모두 입력하세요.");
      return;
    }

    try {
      setError("");
      setMessage("");
      setIsVerifying(true);

      const res = await axios.post(`${API_BASE}/register/verify`, {
        email: form.email,
        code: form.code,
      });

      setIsVerified(true);
      setMessage(res.data?.message || "인증이 완료되었습니다.");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        "인증 코드 확인 중 오류가 발생했습니다.";
      setError(msg);
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  // 3) 최종 회원가입
  const onSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!isVerified) {
      setError("이메일 인증을 먼저 완료해주세요.");
      return;
    }

    if (form.password !== form.passwordConfirm) {
      setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/register/complete`, {
        username: form.username,
        email: form.email,
        password: form.password,
      });

      alert(res.data?.message || "회원가입이 완료되었습니다.");
      onClose();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message || "회원가입 처리 중 오류가 발생했습니다.";
      setError(msg);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="page-title">회원가입</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="form">
          {/* 아이디 */}
          <div className="form-group">
            <label>아이디</label>
            <input
              name="username"
              className="form-input"
              placeholder="아이디를 입력하세요"
              value={form.username}
              onChange={onChange}
              required
            />
          </div>

          {/* 이메일 + 코드 전송 버튼 */}
          <div className="form-group">
            <label>이메일</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="이메일을 입력하세요"
                value={form.email}
                onChange={onChange}
                required
              />
              <button
                type="button"
                className="btn-small"
                onClick={handleSendCode}
                disabled={isSendingCode}
              >
                {isSendingCode ? "전송 중..." : "코드 전송"}
              </button>
            </div>
          </div>

          {/* 이메일 인증 코드 입력 + 확인 버튼 */}
          <div className="form-group">
            <label>이메일 인증 코드</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                name="code"
                className="form-input"
                placeholder="메일로 받은 6자리 코드를 입력하세요"
                value={form.code}
                onChange={onChange}
              />
              <button
                type="button"
                className="btn-small"
                onClick={handleVerifyCode}
                disabled={isVerifying}
              >
                {isVerifying ? "확인 중..." : "코드 확인"}
              </button>
            </div>
            {isVerified && (
              <span style={{ color: "green", fontSize: "0.85rem" }}>
                이메일 인증 완료 ✔
              </span>
            )}
          </div>

          {/* 비밀번호 */}
          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="비밀번호를 입력하세요"
              value={form.password}
              onChange={onChange}
              required
            />
          </div>

          {/* 비밀번호 확인 */}
          <div className="form-group">
            <label>비밀번호 확인</label>
            <input
              type="password"
              name="passwordConfirm"
              className="form-input"
              placeholder="비밀번호를 다시 입력하세요"
              value={form.passwordConfirm}
              onChange={onChange}
              required
            />
          </div>

          {/* 에러 / 안내 메시지 */}
          {error && (
            <div style={{ color: "red", marginBottom: "8px" }}>{error}</div>
          )}
          {message && !error && (
            <div style={{ color: "green", marginBottom: "8px" }}>{message}</div>
          )}

          <button type="submit" className="btn-submit-full">
            가입하기
          </button>
        </form>
      </div>
    </div>
  );
}
