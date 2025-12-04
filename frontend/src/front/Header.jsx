export default function Header({ onLogoClick, openSignupModal }) {
  return (
    <header className="app-header">
      <h1 onClick={onLogoClick} style={{ userSelect: "none" }}>
        와챠우! (Watch out!)
      </h1>
      <div className="login-section">
        <input type="text" placeholder="아이디" />
        <input type="password" placeholder="비밀번호" />
        <button className="btn btn-login">로그인</button>
        <button className="btn btn-signup" onClick={openSignupModal}>
          회원가입
        </button>
      </div>
    </header>
  );
}