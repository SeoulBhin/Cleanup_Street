// React 및 필요한 훅(hook)들을 가져옵니다.
import React, { useState, useEffect } from 'react';

// ===================================================================================
// CSS Styles: 별도 파일 대신 컴포넌트 내에 스타일을 직접 정의합니다.
// ===================================================================================
const GlobalStyles = () => (
  <style>{`
    /* General Body Styles */
    body {
      margin: 0;
      background-color: #f3f4f6; /* Tailwind: bg-gray-100 */
      color: #1f2937; /* Default text color */
    }

    /* Keyframes for fade-in animation */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .fade-in {
      animation: fadeIn 0.5s ease-in-out;
    }

    /* App Container */
    .app-container {
      min-height: 100vh;
    }

    /* Header */
    .app-header {
      background: linear-gradient(to right, #ef4444, #3b82f6); /* from-red-500 to-blue-500 */
      color: white;
      padding: 1rem;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); /* shadow-lg */
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .app-header h1 {
      font-size: 2.25rem; /* text-4xl */
      font-weight: 800; /* font-extrabold */
      cursor: pointer;
    }

    .login-section {
      display: flex;
      align-items: center;
      gap: 1rem; /* space-x-4 */
    }

    .login-section input {
      padding: 0.25rem 0.5rem; /* px-2 py-1 */
      border-radius: 0.375rem; /* rounded-md */
      color: #1f2937; /* text-gray-800 */
      font-size: 0.875rem; /* text-sm */
      border: 1px solid transparent;
    }
    .login-section input:focus {
      outline: none;
      box-shadow: 0 0 0 2px #facc15; /* ring-2 focus:ring-yellow-400 */
    }

    .login-section .btn {
      font-weight: 600; /* font-semibold */
      padding: 0.25rem 0.75rem; /* px-3 py-1 */
      border-radius: 0.375rem; /* rounded-md */
      transition: background-color 0.2s;
      border: none;
      cursor: pointer;
      font-size: 0.875rem; /* text-sm */
    }

    .login-section .btn-login {
      background-color: white;
      color: #2563eb; /* text-blue-600 */
    }
    .login-section .btn-login:hover {
      background-color: #e5e7eb; /* hover:bg-gray-200 */
    }

    .login-section .btn-signup {
      background-color: #facc15; /* bg-yellow-400 */
      color: #1f2937; /* text-gray-800 */
    }
    .login-section .btn-signup:hover {
      background-color: #eab308; /* hover:bg-yellow-500 */
    }

    /* Navbar */
    .app-nav {
      background: linear-gradient(to right, #3b82f6, #ef4444); /* from-blue-500 to-red-500 */
      color: white;
      padding: 0.75rem; /* p-3 */
      display: flex;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* shadow-md */
    }

    .nav-list {
      display: flex;
      gap: 2rem; /* space-x-8 */
      font-size: 1.125rem; /* text-lg */
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .nav-item {
      cursor: pointer;
      padding: 0.5rem 1rem; /* px-4 py-2 */
      border-radius: 0.375rem; /* rounded-md */
      transition: all 0.3s ease;
    }
    .nav-item:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .nav-item.active {
      background-color: white;
      color: #2563eb; /* text-blue-600 */
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* shadow-md */
      font-weight: 700; /* font-bold */
    }

    /* Main Content */
    .main-content {
      padding: 2rem; /* p-8 */
    }
    @media (max-width: 640px) {
      .main-content {
        padding: 1rem; /* p-4 */
      }
    }

    .content-wrapper {
      max-width: 80rem; /* max-w-7xl */
      margin: 0 auto;
      min-height: calc(100vh - 200px);
    }

    /* Page Styles (shared) */
    .page-container {
      padding: 2rem;
      background-color: white;
      border-radius: 0.5rem; /* rounded-lg */
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); /* shadow-xl */
      width: 100%;
    }

    .page-title {
      font-size: 1.875rem; /* text-3xl */
      font-weight: 700; /* font-bold */
      color: #1f2937; /* text-gray-800 */
      margin: 0 0 1.5rem 0; /* mb-6 */
      padding-bottom: 0.5rem; /* pb-2 */
      border-bottom: 2px solid #3b82f6; /* border-b-2 border-blue-500 */
    }

    /* Home Page */
    .home-page {
      width: 100%;
      height: 100%;
      background-color: #e5e7eb; /* bg-gray-200 */
      border-radius: 0.5rem; /* rounded-lg */
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); /* shadow-xl */
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .home-page-content {
      text-align: center;
    }
    .home-page-icon {
      width: 6rem; /* w-24 */
      height: 6rem; /* h-24 */
      margin: 0 auto 1rem; /* mx-auto mb-4 */
      color: #9ca3af; /* text-gray-400 */
    }
    .home-page-title {
      font-size: 1.5rem; /* text-2xl */
      font-weight: 700; /* font-bold */
      color: #4b5563; /* text-gray-600 */
    }
    .home-page-subtitle {
      color: #6b7280; /* text-gray-500 */
      margin-top: 0.5rem; /* mt-2 */
    }

    /* Intro Page */
    .intro-page p {
      font-size: 1.125rem; /* text-lg */
      color: #4b5563; /* text-gray-600 */
      line-height: 1.75; /* leading-relaxed */
      margin-bottom: 1rem; /* mb-4 */
    }
    .intro-page .highlight {
      font-weight: 600; /* font-semibold */
      color: #2563eb; /* text-blue-600 */
    }

    /* Announcements & Forum Page */
    .list-container {
      display: flex;
      flex-direction: column;
      gap: 1rem; /* space-y-4 */
    }
    .list-item {
      padding: 1rem;
      border: 1px solid #e5e7eb; /* border */
      border-radius: 0.5rem; /* rounded-lg */
      cursor: pointer;
      transition: box-shadow 0.2s;
    }
    .list-item:hover {
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* hover:shadow-md */
    }
    .list-item-title {
      font-size: 1.25rem; /* text-xl */
      font-weight: 600; /* font-semibold */
      color: #374151; /* text-gray-700 */
    }
    .list-item-meta {
      font-size: 0.875rem; /* text-sm */
      color: #6b7280; /* text-gray-500 */
      margin-top: 0.25rem; /* mt-1 */
    }

    /* Forum Page Specific */
    .forum-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem; /* mb-6 */
      padding-bottom: 0.5rem; /* pb-2 */
      border-bottom: 2px solid #3b82f6; /* border-b-2 border-blue-500 */
    }
    .forum-header .page-title {
      margin: 0;
      padding: 0;
      border: none;
    }
    .btn-write {
      background-color: #2563eb; /* bg-blue-600 */
      color: white;
      font-weight: 700; /* font-bold */
      padding: 0.5rem 1.5rem; /* py-2 px-6 */
      border-radius: 0.5rem; /* rounded-lg */
      transition: background-color 0.2s;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* shadow-md */
    }
    .btn-write:hover {
      background-color: #1d4ed8; /* hover:bg-blue-700 */
    }

    .forum-post .post-header {
      display: flex;
      align-items: center;
      margin-bottom: 0.5rem; /* mb-2 */
    }
    .post-category {
      background-color: #fee2e2; /* bg-red-100 */
      color: #b91c1c; /* text-red-700 */
      font-size: 0.75rem; /* text-xs */
      font-weight: 600; /* font-semibold */
      margin-right: 0.5rem; /* mr-2 */
      padding: 0.125rem 0.625rem; /* px-2.5 py-0.5 */
      border-radius: 9999px; /* rounded-full */
    }
    .forum-post .list-item-title {
      color: #1f2937; /* text-gray-800 */
    }
    .post-content {
      color: #4b5563; /* text-gray-600 */
      margin-bottom: 0.5rem; /* mb-2 */
    }
    .post-meta {
      font-size: 0.875rem; /* text-sm */
      color: #9ca3af; /* text-gray-400 */
    }

    /* New Post & Signup Page Forms */
    .form-container {
      max-width: 42rem; /* max-w-2xl */
      margin: 0 auto;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem; /* space-y-6 */
    }
    .form-group {
      display: flex;
      flex-direction: column;
    }
    .form-group label {
      display: block;
      font-size: 1.125rem; /* text-lg */
      font-weight: 500; /* font-medium */
      color: #374151; /* text-gray-700 */
      margin-bottom: 0.25rem; /* mb-1 */
    }
    .form-input, .form-select, .form-textarea {
      width: 100%;
      padding: 0.5rem 0.75rem; /* px-3 py-2 */
      border: 1px solid #d1d5db; /* border border-gray-300 */
      border-radius: 0.5rem; /* rounded-lg */
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
      box-sizing: border-box; /* Ensures padding doesn't affect width */
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    }
    .form-textarea {
      min-height: 150px;
      resize: vertical;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem; /* space-x-4 */
    }
    .form-btn {
      font-weight: 700;
      padding: 0.5rem 1.5rem;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .btn-cancel {
      background-color: #6b7280; /* bg-gray-500 */
      color: white;
    }
    .btn-cancel:hover {
      background-color: #4b5563; /* hover:bg-gray-600 */
    }
    .btn-submit {
      background-color: #ef4444; /* bg-red-500 */
      color: white;
    }
    .btn-submit:hover {
      background-color: #dc2626; /* hover:bg-red-600 */
    }

    /* Gallery Page */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem; /* gap-6 */
    }
    @media (max-width: 1024px) {
      .gallery-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 640px) {
      .gallery-grid {
        grid-template-columns: 1fr;
      }
    }

    .gallery-item {
      position: relative;
      overflow: hidden;
      border-radius: 0.5rem; /* rounded-lg */
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); /* shadow-lg */
    }
    .gallery-item img {
      width: 100%;
      height: 15rem; /* h-60 */
      object-fit: cover;
      transition: transform 0.3s ease;
      display: block;
    }
    .gallery-item:hover img {
      transform: scale(1.1);
    }
    .gallery-item-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(0, 0, 0, 0);
      transition: background-color 0.3s ease;
      display: flex;
      align-items: flex-end;
    }
    .gallery-item:hover .gallery-item-overlay {
      background-color: rgba(0, 0, 0, 0.5);
    }
    .gallery-item-caption {
      color: white;
      padding: 1rem;
      font-size: 1.125rem; /* text-lg */
      font-weight: 600; /* font-semibold */
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .gallery-item:hover .gallery-item-caption {
      opacity: 1;
    }

    /* Signup Page */
    .signup-form-container {
      max-width: 28rem; /* max-w-md */
      margin: 0 auto;
    }
    .signup-form-container .page-title {
      text-align: center;
    }
    .signup-form-container .form-group {
      gap: 0.5rem;
    }
    .btn-submit-full {
      width: 100%;
      background: linear-gradient(to right, #ef4444, #3b82f6);
      color: white;
      font-weight: 700;
      padding: 0.75rem; /* py-3 */
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-submit-full:hover {
      opacity: 0.9;
    }

    /* Footer */
    .app-footer {
      text-align: center;
      padding: 1rem; /* p-4 */
      background-color: #1f2937; /* bg-gray-800 */
      color: white;
      font-size: 0.875rem; /* text-sm */
    }
  `}</style>
);


// ===================================================================================
// Mock Data
// ===================================================================================

const initialAnnouncements = [
  { id: 1, title: '[필독] 와챠웃! 커뮤니티 이용 규칙 안내', author: '관리자', date: '2025-10-15' },
  { id: 2, title: '개인정보 처리 방침 개정 안내', author: '관리자', date: '2025-10-10' },
  { id: 3, title: '서버 점검 예정 (오전 2시 ~ 4시)', author: '관리자', date: '2025-10-05' },
];

const initialPosts = [
  { id: 1, category: '도로파손', title: '1동 앞 보도블럭이 깨졌어요.', author: '주민A', date: '2025-10-14', content: '아이들이 자주 다니는 길인데 위험해 보입니다. 빠른 조치 부탁드립니다.' },
  { id: 2, category: '가로등고장', title: '공원 산책로 가로등이 안 들어와요.', author: '주민B', date: '2025-10-13', content: '밤에 너무 어두워서 산책하기 무섭습니다. 확인 부탁드립니다.' },
  { id: 3, category: '쓰레기 문제', title: '분리수거장에 무단 투기가 너무 많습니다.', author: '주민C', date: '2025-10-12', content: '음식물 쓰레기와 일반 쓰레기를 마구 버려서 냄새가 심합니다. CCTV 설치가 필요해 보입니다.' },
];

const initialGalleryImages = [
  { id: 1, url: 'https://placehold.co/600x400/f87171/ffffff?text=Broken+Streetlight', caption: '고장난 가로등 신고' },
  { id: 2, url: 'https://placehold.co/600x400/60a5fa/ffffff?text=Pothole+Report', caption: '도로 파손 현장' },
  { id: 3, url: 'https://placehold.co/600x400/34d399/ffffff?text=Cleaned+Park', caption: '주민들과 함께한 공원 청소' },
  { id: 4, url: 'https://placehold.co/600x400/fbbf24/ffffff?text=Illegal+Dumping', caption: '불법 쓰레기 투기 현장' },
  { id: 5, url: 'https://placehold.co/600x400/a78bfa/ffffff?text=Community+Effort', caption: '꽃 심기 활동' },
  { id: 6, url: 'https://placehold.co/600x400/ec4899/ffffff?text=Repaired+Bench', caption: '수리된 공원 벤치' },
];

// ===================================================================================
// 컴포넌트 정의
// ===================================================================================

const Header = ({ setCurrentPage }) => (
  <header className="app-header">
    <h1 
      style={{ fontFamily: "'Anton', sans-serif" }}
      onClick={() => setCurrentPage('home')}
    >
      와챠웃! (Watch out!)
    </h1>
    <div className="login-section">
      <input type="text" placeholder="아이디" />
      <input type="password" placeholder="비밀번호" />
      <button className="btn btn-login">로그인</button>
      <button onClick={() => setCurrentPage('signup')} className="btn btn-signup">
        회원가입
      </button>
    </div>
  </header>
);

const Navbar = ({ setCurrentPage, currentPage }) => {
  const navItems = ['소개', '공지사항', '일반 게시판', '활동 갤러리'];
  const pageMap = {
    '소개': 'intro',
    '공지사항': 'announcements',
    '일반 게시판': 'forum',
    '활동 갤러리': 'gallery'
  };

  const getNavItemClass = (page) => {
    return `nav-item ${currentPage === pageMap[page] ? 'active' : ''}`;
  };

  return (
    <nav className="app-nav">
      <ul className="nav-list">
        {navItems.map(item => (
          <li key={item} className={getNavItemClass(item)} onClick={() => setCurrentPage(pageMap[item])}>
            {item}
          </li>
        ))}
      </ul>
    </nav>
  );
};

const HomePage = () => (
    <div className="home-page fade-in">
        <div className="home-page-content">
            <div className="home-page-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-6.734 3.961 2.094a.75.75 0 0 1 0 1.328l-3.961 2.094M3.75 3.75l16.5 16.5M3.75 12h16.5m-16.5 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0Z" />
                </svg>
            </div>
            <h2 className="home-page-title">우리 동네 지도</h2>
            <p className="home-page-subtitle">이곳에 지도 API가 연동되어 동네의 문제 발생 지역을 시각적으로 보여줍니다.</p>
        </div>
    </div>
);

const IntroPage = () => (
  <div className="page-container intro-page fade-in">
    <h2 className="page-title">
      '와챠웃!'에 오신 것을 환영합니다!
    </h2>
    <p>
      '와챠웃!'은 우리 동네의 안전과 청결을 주민 스스로 지켜나가는 온라인 커뮤니티입니다. 
      일상 속에서 발견하는 작지만 중요한 문제들을 함께 공유하고 해결의 목소리를 내기 위해 만들어졌습니다.
    </p>
    <p>
      고장난 가로등, 부서진 보도블럭, 방치된 쓰레기 등 동네의 위험하거나 개선이 필요한 부분들을 사진과 함께 알려주세요. 
      주민 여러분의 작은 관심 하나하나가 모여 우리 동네를 더 안전하고, 더 깨끗하고, 더 살기 좋은 곳으로 만듭니다.
    </p>
    <p className="highlight">
      여러분의 적극적인 참여가 변화의 시작입니다. 지금 바로 '와챠웃!'과 함께 우리 동네를 바꿔나가요!
    </p>
  </div>
);


const AnnouncementsPage = ({ announcements }) => (
  <div className="page-container fade-in">
    <h2 className="page-title">공지사항</h2>
    <div className="list-container">
      {announcements.map(item => (
        <div key={item.id} className="list-item">
          <h3 className="list-item-title">{item.title}</h3>
          <div className="list-item-meta">
            <span>작성자: {item.author}</span> | <span>작성일: {item.date}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ForumPage = ({ posts, setCurrentPage }) => (
  <div className="page-container fade-in">
    <div className="forum-header">
      <h2 className="page-title">일반 게시판</h2>
      <button 
        onClick={() => setCurrentPage('newPost')}
        className="btn-write"
      >
        글쓰기
      </button>
    </div>
    <div className="list-container">
      {posts.map(post => (
        <div key={post.id} className="list-item forum-post">
          <div className="post-header">
            <span className="post-category">{post.category}</span>
            <h3 className="list-item-title">{post.title}</h3>
          </div>
          <p className="post-content">{post.content}</p>
          <div className="post-meta">
            <span>작성자: {post.author}</span> | <span>작성일: {post.date}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);


const NewPostPage = ({ addPost, setCurrentPage }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('가로등고장');
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    const newPost = {
      id: Date.now(),
      category,
      title,
      content,
      author: '새로운주민', // 실제 앱에서는 로그인된 사용자 정보 사용
      date: new Date().toISOString().split('T')[0]
    };
    addPost(newPost);
    setCurrentPage('forum');
  };

  return (
    <div className="page-container form-container fade-in">
      <h2 className="page-title">새 글 작성</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="title">제목</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="category">카테고리</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="form-select"
          >
            <option>가로등고장</option>
            <option>도로파손</option>
            <option>쓰레기 문제</option>
            <option>기타</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="attachment">첨부파일</label>
          <input
            type="file"
            id="attachment"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="content">내용</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="form-textarea"
            required
          ></textarea>
        </div>
        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => setCurrentPage('forum')}
            className="form-btn btn-cancel"
          >
            취소
          </button>
          <button 
            type="submit" 
            className="form-btn btn-submit"
          >
            작성 완료
          </button>
        </div>
      </form>
    </div>
  );
};


const GalleryPage = ({ images }) => (
  <div className="page-container fade-in">
    <h2 className="page-title">활동 갤러리</h2>
    <div className="gallery-grid">
      {images.map(image => (
        <div key={image.id} className="gallery-item">
          <img src={image.url} alt={image.caption} />
          <div className="gallery-item-overlay">
            <p className="gallery-item-caption">
              {image.caption}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const SignupPage = ({ setCurrentPage }) => {
    const handleSignup = (e) => {
        e.preventDefault();
        alert('회원가입 기능이 구현되었습니다. (데모)');
        setCurrentPage('home');
    };

    return (
        <div className="page-container signup-form-container fade-in">
            <h2 className="page-title">회원가입</h2>
            <form onSubmit={handleSignup} className="form">
                <div className="form-group">
                    <label>아이디</label>
                    <input type="text" placeholder="아이디를 입력하세요" className="form-input" required />
                </div>
                <div className="form-group">
                    <label>비밀번호</label>
                    <input type="password" placeholder="비밀번호를 입력하세요" className="form-input" required />
                </div>
                <div className="form-group">
                    <label>비밀번호 확인</label>
                    <input type="password" placeholder="비밀번호를 다시 입력하세요" className="form-input" required />
                </div>
                <div className="form-group">
                    <label>이메일</label>
                    <input type="email" placeholder="이메일을 입력하세요" className="form-input" required />
                </div>
                <button type="submit" className="btn-submit-full">
                    가입하기
                </button>
            </form>
        </div>
    );
};

// ===================================================================================
// 메인 App 컴포넌트
// ===================================================================================
function App() {
  const [currentPage, setCurrentPage] = useState('home'); 
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [posts, setPosts] = useState(initialPosts);
  const [galleryImages, setGalleryImages] = useState(initialGalleryImages);

  const addPost = (post) => {
    setPosts([post, ...posts]);
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'intro':
        return <IntroPage />;
      case 'announcements':
        return <AnnouncementsPage announcements={announcements} />;
      case 'forum':
        return <ForumPage posts={posts} setCurrentPage={setCurrentPage} />;
      case 'newPost':
        return <NewPostPage addPost={addPost} setCurrentPage={setCurrentPage} />;
      case 'gallery':
        return <GalleryPage images={galleryImages} />;
      case 'signup':
        return <SignupPage setCurrentPage={setCurrentPage} />;
      case 'home':
      default:
        return <HomePage />;
    }
  };

  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.href = "https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+KR:wght@400;700&display=swap";
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
  }, []);

  return (
    <div 
      className="app-container"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      <GlobalStyles />
      <Header setCurrentPage={setCurrentPage} />
      <Navbar setCurrentPage={setCurrentPage} currentPage={currentPage} />
      
      <main className="main-content">
        <div className="content-wrapper">
           {renderContent()}
        </div>
      </main>

      <footer className="app-footer">
        © 2025 Watch out! Community. All Rights Reserved.
      </footer>
    </div>
  );
}

export default App;

