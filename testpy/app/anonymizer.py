import cv2
import numpy as np
import sys

# ===============================
# YOLOv8 (ONNX) 기반 얼굴/번호판 모자이크 처리기
# ===============================
class AnonymizerONNX:
    def __init__(self, face_model_path=None, plate_model_path=None, conf=0.35):
        # OpenCV DNN으로 ONNX 모델 로드
        self.face_net = cv2.dnn.readNetFromONNX(face_model_path) if face_model_path else None
        self.plate_net = cv2.dnn.readNetFromONNX(plate_model_path) if plate_model_path else None
        self.conf = conf

    def mosaic(self, img, x1, y1, x2, y2, block_size=15):
        """선택된 영역을 모자이크 처리"""
        x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
        roi = img[y1:y2, x1:x2]
        if roi.size == 0:
            return img
        roi_small = cv2.resize(roi, (max(1, (x2-x1)//block_size), max(1, (y2-y1)//block_size)))
        roi_mosaic = cv2.resize(roi_small, (x2-x1, y2-y1), interpolation=cv2.INTER_NEAREST)
        img[y1:y2, x1:x2] = roi_mosaic
        return img

    def detect(self, net, frame):
        """YOLOv8 ONNX 추론"""
        h, w = frame.shape[:2]

        # YOLOv8 입력 전처리
        blob = cv2.dnn.blobFromImage(frame, scalefactor=1/255.0, size=(640, 640), swapRB=True)
        net.setInput(blob)
        preds = net.forward()[0]  # [8400, 85] (YOLO 출력 구조)

        boxes = []
        for det in preds:
            conf = det[4]
            if conf < self.conf:
                continue
            # 클래스별 confidence
            scores = det[5:]
            class_id = np.argmax(scores)
            score = scores[class_id] * conf
            if score < self.conf:
                continue

            # 바운딩박스 좌표 복원
            cx, cy, bw, bh = det[0:4]
            x1 = int((cx - bw/2) * w / 640)
            y1 = int((cy - bh/2) * h / 640)
            x2 = int((cx + bw/2) * w / 640)
            y2 = int((cy + bh/2) * h / 640)
            boxes.append((x1, y1, x2, y2))
        return boxes

    def process_image(self, input_path, output_path):
        img = cv2.imread(input_path)
        if img is None:
            raise FileNotFoundError(f"이미지를 불러올 수 없습니다: {input_path}")

        # 얼굴 탐지
        if self.face_net:
            face_boxes = self.detect(self.face_net, img)
            for (x1, y1, x2, y2) in face_boxes:
                img = self.mosaic(img, x1, y1, x2, y2)

        # 번호판 탐지
        if self.plate_net:
            plate_boxes = self.detect(self.plate_net, img)
            for (x1, y1, x2, y2) in plate_boxes:
                img = self.mosaic(img, x1, y1, x2, y2)

        cv2.imwrite(output_path, img)
        print(f"결과 저장 완료: {output_path}")

    def process_video(self, input_path, output_path):
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise FileNotFoundError(f"비디오를 열 수 없습니다: {input_path}")

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if self.face_net:
                face_boxes = self.detect(self.face_net, frame)
                for (x1, y1, x2, y2) in face_boxes:
                    frame = self.mosaic(frame, x1, y1, x2, y2)

            if self.plate_net:
                plate_boxes = self.detect(self.plate_net, frame)
                for (x1, y1, x2, y2) in plate_boxes:
                    frame = self.mosaic(frame, x1, y1, x2, y2)

            out.write(frame)

        cap.release()
        out.release()
        print(f"결과 저장 완료: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("사용법: python anonymizer.py [image|video] <입력경로> <출력경로> <face_model.onnx>")
        sys.exit(1)

    mode = sys.argv[1]
    input_path = sys.argv[2]
    output_path = sys.argv[3]
    face_model = sys.argv[4]

    anonymizer = AnonymizerONNX(face_model_path=face_model, plate_model_path=None, conf=0.35)

    if mode == "image":
        anonymizer.process_image(input_path, output_path)
    elif mode == "video":
        anonymizer.process_video(input_path, output_path)
    else:
        print("지원하지 않는 모드입니다. image 또는 video 선택.")
