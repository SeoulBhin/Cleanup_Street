<template>
  <div class="container">
    <header class="header">
      <h1 class="title">
        🧹 클린업 스트릿 (Cleanup Street)
      </h1>
      <p class="subtitle">
        우리가 함께 만들어가는 깨끗한 동네, 클린업 스트릿 프로젝트에 오신 것을 환영합니다.
      </p>
    </header>

    <main class="main-content">
      <div class="card">
        <h2 class="card-title">🚀 CI/CD 파이프라인으로 자동화된 배포</h2>
        <p class="card-body">
          클린업 스트릿 프로젝트는 **CI/CD (지속적 통합/지속적 배포)** 파이프라인을 통해 관리되고 있습니다.
          <br><br>
          코드 변경사항이 Github에 푸시(Push)되면, 자동으로 테스트, 빌드, 그리고 서버 배포까지의 모든 과정이 실행됩니다. 이를 통해 더 빠르고 안정적으로 새로운 기능을 여러분께 선보일 수 있습니다.
        </p>
      </div>
    </main>

    <footer class="footer">
      <p>&copy; 2025 Cleanup Street Project. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
/* Google Fonts에서 Noto Sans KR 폰트 가져오기 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');

:root {
  --primary-color: #2ecc71;
  --secondary-color: #34495e;
  --background-color: #ecf0f1;
  --card-background: #ffffff;
  --text-color: #333;
  --light-text-color: #7f8c8d;
}

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: var(--background-color);
  font-family: 'Noto Sans KR', sans-serif;
  color: var(--text-color);
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
  text-align: center;
}

.header {
  margin-bottom: 3rem;
}

.title {
  font-size: 2.8rem;
  font-weight: 700;
  color: var(--secondary-color);
  margin: 0;
}

.subtitle {
  font-size: 1.2rem;
  color: var(--light-text-color);
  margin-top: 0.5rem;
  max-width: 600px;
}

.main-content {
  width: 100%;
  max-width: 700px;
}

.card {
  background-color: var(--card-background);
  border-radius: 12px;
  padding: 2.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12);
}

.card-title {
  font-size: 1.8rem;
  color: var(--primary-color);
  margin-top: 0;
  margin-bottom: 1rem;
}

.card-body {
  font-size: 1.1rem;
  line-height: 1.8;
  color: var(--secondary-color);
}

.footer {
  margin-top: 4rem;
  font-size: 0.9rem;
  color: var(--light-text-color);
}

/* 모바일 화면 대응 */
@media (max-width: 768px) {
  .title {
    font-size: 2.2rem;
  }
  .subtitle {
    font-size: 1rem;
  }
  .card-title {
    font-size: 1.5rem;
  }
  .card-body {
    font-size: 1rem;
  }
  .card {
    padding: 1.5rem;
  }
}
</style>
