from __future__ import annotations

import argparse
import base64
import io
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

# --- 초기 설정 및 경로 탐색 ---

# 현재 스크립트의 디렉토리를 기준으로 경로를 설정합니다.
SCRIPT_DIR = Path(__file__).resolve().parent


def _find_models_dir() -> Path:
    """상위 디렉토리를 탐색하여 'models' 디렉토리의 경로를 찾습니다."""
    for candidate in (SCRIPT_DIR, *SCRIPT_DIR.parents):
        maybe = candidate / "models"
        if maybe.exists():
            return maybe
    # 찾지 못한 경우, 스크립트 디렉토리 아래에 있다고 가정합니다.
    return SCRIPT_DIR / "models"


# 모델 파일이 저장된 기본 경로를 설정합니다.
MODELS_DIR = _find_models_dir()
DEFAULT_FACE_MODEL = MODELS_DIR / "face" / "yolov8n-face.pt"
DEFAULT_PLATE_MODEL = MODELS_DIR / "plate" / "plate-detector.pt"


# --- 데이터 클래스 정의 ---

@dataclass
class Detection:
    """탐지된 객체 정보를 저장하는 데이터 클래스."""
    label: str  # 객체 레이블 (e.g., "face", "plate")
    confidence: float  # 탐지 신뢰도 (0.0 ~ 1.0)
    box: Tuple[int, int, int, int]  # 바운딩 박스 (x1, y1, x2, y2)

    def clip(self, width: int, height: int) -> "Detection":
        """바운딩 박스가 이미지 경계를 넘어가지 않도록 좌표를 조정합니다."""
        x1, y1, x2, y2 = self.box
        x1 = max(0, min(width - 1, x1))
        y1 = max(0, min(height - 1, y1))
        x2 = max(0, min(width, x2))
        y2 = max(0, min(height, y2))
        return Detection(self.label, self.confidence, (x1, y1, x2, y2))


@dataclass
class ProcessedImage:
    """이미지 처리 결과를 저장하는 데이터 클래스."""
    original_path: str | Path
    mosaic_with_plates: str | Path
    mosaic_faces_only: str | Path
    faces: Sequence[Detection]
    plates: Sequence[Detection]

    def export_metadata(self, output_path: Path) -> None:
        """탐지 결과를 JSON 파일로 저장합니다."""
        payload = {
            "original": str(self.original_path),
            "mosaic_with_plates": str(self.mosaic_with_plates),
            "mosaic_faces_only": str(self.mosaic_faces_only),
            "faces": [asdict(det) for det in self.faces],
            "plates": [asdict(det) for det in self.plates],
        }
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


# --- 메인 처리 클래스 ---

class MosaicProcessor:
    """
    YOLO 모델을 사용하여 이미지에서 얼굴과 번호판을 탐지하고,
    모자이크 처리를 수행하는 메인 클래스.
    """
    def __init__(
        self,
        face_model: str | Path,
        plate_model: str | Path,
        conf: float = 0.3,
        imgsz: int | Tuple[int, int] = 640,
    ) -> None:
        """
        MosaicProcessor를 초기화합니다.

        Args:
            face_model (str | Path): 얼굴 탐지 모델 파일 경로.
            plate_model (str | Path): 번호판 탐지 모델 파일 경로.
            conf (float): 탐지에 사용할 최소 신뢰도.
            imgsz (int | Tuple[int, int]): 모델에 입력할 이미지 크기.
        """
        self.face_model = YOLO(face_model)
        self.plate_model = YOLO(plate_model)
        self.conf = conf
        self.imgsz = imgsz

    def _detect(self, model: YOLO, img: np.ndarray) -> List[Detection]:
        """YOLO 모델을 사용하여 객체를 탐지합니다."""
        results = model(img, imgsz=self.imgsz, conf=self.conf, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                label = model.names[int(box.cls)]
                confidence = float(box.conf)
                detections.append(Detection(label, confidence, (x1, y1, x2, y2)))
        return detections

    def detect_faces(self, img: np.ndarray) -> List[Detection]:
        """이미지에서 얼굴을 탐지합니다."""
        return self._detect(self.face_model, img)

    def detect_plates(self, img: np.ndarray) -> List[Detection]:
        """이미지에서 번호판을 탐지합니다."""
        return self._detect(self.plate_model, img)

    def apply_mosaic(self, img: np.ndarray, detections: Iterable[Detection], pixel_size: int = 20) -> np.ndarray:
        """탐지된 영역을 흰색으로 덮어 정보를 가립니다."""
        output_img = img.copy()
        h, w, _ = output_img.shape
        for det in detections:
            x1, y1, x2, y2 = det.clip(w, h).box
            if x2 <= x1 or y2 <= y1:
                continue
            output_img[y1:y2, x1:x2] = 255  # 채워진 흰색 박스로 덮어냅니다.
        return output_img

    def to_base64(self, img: np.ndarray) -> str:
        """OpenCV 이미지를 Base64 문자열로 변환합니다."""
        _, buffer = cv2.imencode(".jpg", img)
        return base64.b64encode(buffer).decode("utf-8")

    def process_image_from_path(self, input_path: str | Path) -> ProcessedImage:
        """지정된 경로의 이미지를 처리합니다."""
        img = cv2.imread(str(input_path))
        if img is None:
            raise FileNotFoundError(f"이미지를 로드할 수 없습니다: {input_path}")

        faces = self.detect_faces(img)
        plates = self.detect_plates(img)

        # 얼굴과 번호판 모두 모자이크 처리
        all_detections = faces + plates
        mosaic_all = self.apply_mosaic(img, all_detections)
        b64_all = self.to_base64(mosaic_all)

        # 얼굴만 모자이크 처리
        mosaic_faces = self.apply_mosaic(img, faces)
        b64_faces = self.to_base64(mosaic_faces)

        return ProcessedImage(
            original_path=input_path,
            mosaic_with_plates=b64_all,
            mosaic_faces_only=b64_faces,
            faces=faces,
            plates=plates,
        )


def main():
    """스크립트의 메인 실행 함수."""
    parser = argparse.ArgumentParser(description="얼굴과 번호판에 모자이크를 적용합니다.")
    parser.add_argument("--input", type=Path, required=True, help="처리할 이미지 파일 경로.")
    parser.add_argument("--face-model", type=Path, default=DEFAULT_FACE_MODEL, help="얼굴 탐지 모델 경로.")
    parser.add_argument("--plate-model", type=Path, default=DEFAULT_PLATE_MODEL, help="번호판 탐지 모델 경로.")
    parser.add_argument("--conf", type=float, default=0.3, help="탐지 최소 신뢰도.")
    parser.add_argument("--imgsz", type=int, default=640, help="모델 입력 이미지 크기.")
    parser.add_argument("--output-meta", type=Path, help="탐지 메타데이터를 저장할 JSON 파일 경로.")
    args = parser.parse_args()

    processor = MosaicProcessor(
        face_model=args.face_model,
        plate_model=args.plate_model,
        conf=args.conf,
        imgsz=args.imgsz,
    )

    processed = processor.process_image_from_path(args.input)

    if args.output_meta:
        processed.export_metadata(args.output_meta)

    # Node.js에서 사용할 수 있도록 두 개의 Base64 문자열을 구분자와 함께 출력
    print(f"{processed.mosaic_with_plates}---SPLIT---{processed.mosaic_faces_only}")


if __name__ == "__main__":
    main()
