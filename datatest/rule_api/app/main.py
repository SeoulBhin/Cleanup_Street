# app/main.py
import os
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import google.generativeai as genai

# -----------------------------
# 로깅 기본 설정 (터미널에 보기 좋게)
# -----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# -----------------------------
# 설정 / 환경변수
# -----------------------------
GEMINI_API_KEY = "AIzaSyAUBeBBsvmhadJ00jq6kOREleCqavdAAlI"
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.")

genai.configure(api_key=GEMINI_API_KEY)

# 사용 모델 이름 (콘솔에서 확인한 그대로)
MODEL_NAME = "gemini-2.5-flash"
model = genai.GenerativeModel(MODEL_NAME)

# 프로젝트 카테고리 7종
CATEGORIES = [
    "도로-교통",
    "시설물-건축",
    "치안-범죄위험",
    "자연재난-환경",
    "위생-보건",
    "기타",
    "스팸",
]


# -----------------------------
# 요청 / 응답 스키마
# -----------------------------
class ClassifyReq(BaseModel):
    # 세 가지 중 아무 조합이나 허용 (text / title / content)
    text: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = ""


class ClassifyRes(BaseModel):
    category: str


# -----------------------------
# FastAPI 앱
# -----------------------------
app = FastAPI(title="Cleanup_Street Gemini classifier")


@app.get("/health")
def health():
    return {"ok": True}


def _pick_text(req: ClassifyReq) -> str:
    """text가 있으면 우선, 없으면 title+content를 합쳐서 사용."""
    if req.text and req.text.strip():
        return req.text.strip()

    t = (req.title or "").strip()
    c = (req.content or "").strip()
    combined = (t + ("\n" + c if c else "")).strip()
    return combined


def _normalize_category(raw: str) -> str:
    """모델 출력 문자열을 7개 카테고리 중 하나로 정규화."""
    s = raw.strip()
    # 한 줄만 사용
    s = s.splitlines()[0].strip()

    # 정확 일치 우선
    if s in CATEGORIES:
        return s

    # 아주 단순한 키워드 매핑 (방어용)
    if "도로" in s or "교통" in s:
        return "도로-교통"
    if "시설" in s or "건축" in s or "건물" in s or "가로등" in s or "보도블록" in s:
        return "시설물-건축"
    if "치안" in s or "범죄" in s or "도난" in s or "소매치기" in s or "폭력" in s:
        return "치안-범죄위험"
    if "자연" in s or "재난" in s or "환경" in s or "침수" in s or "강풍" in s or "하천" in s:
        return "자연재난-환경"
    if "위생" in s or "보건" in s or "쓰레기" in s or "악취" in s or "하수" in s:
        return "위생-보건"
    if "스팸" in s or "광고" in s or "특가" in s or "포인트" in s or "당첨" in s:
        return "스팸"

    # 아무 것도 못 맞추면 기타
    return "기타"


@app.post("/classify", response_model=ClassifyRes)
def classify(req: ClassifyReq):
    # 1) 입력 텍스트 결정
    text = _pick_text(req)
    if not text:
        raise HTTPException(status_code=400, detail="EMPTY_TEXT")

    # 2) 프롬프트 구성
    system_prompt = (
        "당신은 한국어 민원/게시글을 아래 7개 카테고리 중 하나로만 분류하는 분류기입니다.\n"
        "반드시 다음 라벨 중 하나만 한 줄로 출력하세요 (다른 단어, 설명, 기호 금지):\n"
        "도로-교통, 시설물-건축, 치안-범죄위험, 자연재난-환경, 위생-보건, 기타, 스팸\n"
        "입력 텍스트의 의미를 보고 가장 적절한 하나를 고르세요.\n"
    )

    full_prompt = f"{system_prompt}\n[입력 텍스트]\n{text}"

    try:
        # 3) Gemini 호출
        response = model.generate_content(full_prompt)
        raw = (response.text or "").strip()
        if not raw:
            raise ValueError("빈 응답을 받았습니다.")

        cat = _normalize_category(raw)

        if cat not in CATEGORIES:
            raise ValueError(f"예상치 못한 카테고리 응답: {raw!r} -> {cat!r}")

        # 🔍 디버그 로그: 실제 입력·원본 응답·최종 카테고리 확인
        logger.info(
            "[CLASSIFY] input=%r raw=%r category=%r",
            text[:80],
            raw[:80],
            cat,
        )

        return {"category": cat}

    except Exception as e:
        # 터미널에 에러 로그 출력
        logger.exception("Gemini 분류 중 오류 발생: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"CLASSIFY_FAILED: {str(e)}",
        )
