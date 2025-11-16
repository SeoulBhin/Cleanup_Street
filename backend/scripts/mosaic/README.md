## 모자이크 툴킷

이 폴더는 백엔드 서비스에서 사용하는 독립적인 모자이크 처리 기능에 필요한 모든 파일

### Layout
- `mosaic_processor.py` - YOLO 모델을 사용하여 얼굴과 번호판을 모자이크 처리하는 명령줄 스크립트
- `requirements.txt` - 스크립트 실행에 필요한 최소한의 라이브러리 목록
- `.venv/` - 로컬 개발용 가상 환경 폴더 (Docker 빌드 시에는 무시)

### 로컬 환경 설정
```powershell
cd backend/scripts/mosaic
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

On macOS/Linux:
```bash
cd backend/scripts/mosaic
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 스크립트 수동 실행
```bash
python mosaic_processor.py \
  path/to/image.jpg \
  --output outputs \
  --face-model ../../../models/face/yolov8n-face.pt \
  --plate-model ../../../models/plate/plate-detector.pt
```

Docker 빌드 과정에서도 이 requirements.txt 파일이 /app/.venv 내에 설치됨. 백엔드 서버는 IMAGE_PROCESSING_* 환경 변수에 설정된 경로를 통해 이 mosaic_processor.py 스크립트를 찾아 실행
