import cv2
import os

# ===============================
# 얼굴 / 번호판 모자이크 처리기
# ===============================

class Anonymizer:
    def __init__(self):
        # OpenCV Haar Cascade 모델 경로 (OpenCV에 기본 포함됨)
        face_cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        plate_cascade_path = cv2.data.haarcascades + "haarcascade_russian_plate_number.xml"

        # 얼굴, 번호판 감지기 로드
        self.face_cascade = cv2.CascadeClassifier(face_cascade_path)
        self.plate_cascade = cv2.CascadeClassifier(plate_cascade_path)

    def mosaic(self, img, x, y, w, h, block_size=15):
        """
        선택된 영역을 모자이크 처리
        """
        roi = img[y:y+h, x:x+w]
        if roi.size == 0:
            return img
        # 작은 사이즈로 줄였다가 다시 키워서 모자이크 효과
        roi_small = cv2.resize(roi, (max(1, w//block_size), max(1, h//block_size)))
        roi_mosaic = cv2.resize(roi_small, (w, h), interpolation=cv2.INTER_NEAREST)
        img[y:y+h, x:x+w] = roi_mosaic
        return img

    def process_image(self, input_path, output_path):
        """
        이미지 파일을 읽어 얼굴과 번호판을 모자이크 후 저장
        """
        img = cv2.imread(input_path)
        if img is None:
            raise FileNotFoundError(f"이미지를 불러올 수 없습니다: {input_path}")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 얼굴 탐지
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30,30))
        for (x, y, w, h) in faces:
            img = self.mosaic(img, x, y, w, h)

        # 번호판 탐지
        plates = self.plate_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(60,20))
        for (x, y, w, h) in plates:
            img = self.mosaic(img, x, y, w, h)

        cv2.imwrite(output_path, img)
        print(f"결과 저장 완료: {output_path}")

    def process_video(self, input_path, output_path):
        """
        동영상 파일을 읽어 얼굴과 번호판을 모자이크 후 저장
        """
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

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # 얼굴 탐지
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30,30))
            for (x, y, w, h) in faces:
                frame = self.mosaic(frame, x, y, w, h)

            # 번호판 탐지
            plates = self.plate_cascade.detectMultiScale(gray, 1.1, 3, minSize=(60,20))
            for (x, y, w, h) in plates:
                frame = self.mosaic(frame, x, y, w, h)

            out.write(frame)

        cap.release()
        out.release()
        print(f"결과 저장 완료: {output_path}")


if __name__ == "__main__":
    """
    실행 예시:
    python anonymizer.py image samples/test.jpg out.jpg
    python anonymizer.py video samples/test.mp4 out.mp4
    """
    import sys
    if len(sys.argv) < 4:
        print("사용법: python anonymizer.py [image|video] <입력경로> <출력경로>")
        sys.exit(1)

    mode = sys.argv[1]
    input_path = sys.argv[2]
    output_path = sys.argv[3]

    anonymizer = Anonymizer()

    if mode == "image":
        anonymizer.process_image(input_path, output_path)
    elif mode == "video":
        anonymizer.process_video(input_path, output_path)
    else:
        print("지원하지 않는 모드입니다. image 또는 video 선택.")
