# 1. 안정적인 범용 베이스 이미지로 시작 (Ubuntu 22.04)
FROM ubuntu:22.04

# 설치 중 사용자의 입력을 요구하는 대화형 프롬프트 방지
ENV DEBIAN_FRONTEND=noninteractive

# 2. 레이어 캐싱 최적화를 위해 모든 시스템 의존성을 하나의 RUN 명령어로 설치
RUN apt-get update && \
    apt-get install -y \
    # Node.js 설치를 위한 의존성
    curl \
    gnupg \
    # Python 관련 의존성
    python3 \
    python3-pip \
    python3-venv \
    # OpenCV 실행을 위한 시스템 라이브러리 (이미지 처리용)
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 && \
    # Node.js v18 버전 설치
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    # 이미지 크기를 줄이기 위해 불필요한 apt 캐시 제거
    rm -rf /var/lib/apt/lists/*

# 3. Python 가상 환경(Virtual Environment) 설정
RUN python3 -m venv /opt/venv
# 가상 환경의 실행 경로를 시스템 경로(PATH)에 추가
ENV PATH="/opt/venv/bin:$PATH"

# 4. Python 의존성 패키지 설치
COPY scripts/mosaic/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# 5. Node.js 애플리케이션 환경 설정
WORKDIR /app
COPY package*.json ./
RUN npm install

# 6. 나머지 애플리케이션 소스 코드 복사
COPY . .

# 7. 포트 개방 및 컨테이너 실행 명령 정의
EXPOSE 8080
CMD ["npm", "start"]