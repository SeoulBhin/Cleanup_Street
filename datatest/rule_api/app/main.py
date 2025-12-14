# datatest/rule_api/app/main.py

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()

# 환경변수 OPENAI_API_KEY 사용
client = OpenAI()

# 고정 카테고리 7개
CATEGORIES = [
    "도로-교통",
    "시설물-건축",
    "치안-범죄위험",
    "자연재난-환경",
    "위생-보건",
    "기타",
    "스팸",
]


class ClassifyReq(BaseModel):
    title: str
    content: str | None = ""


class ClassifyRes(BaseModel):
    category: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/classify", response_model=ClassifyRes)
def classify(req: ClassifyReq):
    # title + content 합치기
    text = (req.title or "").strip()
    if req.content:
        text += "\n" + req.content.strip()

    if not text:
        raise HTTPException(status_code=400, detail="EMPTY_TEXT")

    # OpenAI에게 "카테고리 명 하나만" 달라고 요청
    system_prompt = (
        "당신은 한국어 민원/게시글 분류 모델입니다.\n"
        "사용자가 작성한 제목과 내용을 읽고, 아래 7개 카테고리 중 하나만 고르세요.\n"
        "반드시 카테고리 이름만 그대로 한 줄로 출력하십시오.\n\n"
        "카테고리 목록:\n"
        "- 도로-교통\n"
        "- 시설물-건축\n"
        "- 치안-범죄위험\n"
        "- 자연재난-환경\n"
        "- 위생-보건\n"
        "- 기타\n"
        "- 스팸\n"
    )

    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0,
        )

        raw = (resp.choices[0].message.content or "").strip()
        # 따옴표 등 불필요한 문자 제거
        raw = raw.replace('"', "").replace("'", "").strip()

        # 모델이 문장으로 돌려줘도 안전하게 처리: 문자열 안에서 카테고리 이름을 찾기
        cat = None
        for c in CATEGORIES:
            if c in raw:
                cat = c
                break
        if cat is None:
            cat = raw

        if cat not in CATEGORIES:
            # 이상한 값이면 강제로 "기타"
            cat = "기타"

        return {"category": cat}

    except Exception as e:
        # uvicorn 로그를 통해 디버깅할 수 있도록 에러 메시지 노출
        raise HTTPException(
            status_code=500,
            detail=f"CLASSIFY_FAILED: {str(e)}",
        )
