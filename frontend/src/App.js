import React, { useEffect, useState } from 'react';
import './App.css';
import axios from 'axios'; // axios 라이브러리 사용

function App() {
  // test 
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    // proxy 설정 덕분에 /api/hello 요청은 http://localhost:8080/api/hello 로 전달됩니다.
    axios.get('/api/hello')
      .then(response => {
        setMessage(response.data);
      })
      .catch(error => {
        console.error("API 호출 오류:", error);
        setMessage("백엔드 연결 실패!");
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>React Frontend</h1>
        <h3>Spring Backend</h3>
        <p>Spring Backend: <strong>{message}</strong></p>
        <p>무중단 배포 테스트!</p>
      </header>
    </div>
  );
}

export default App;