from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List, Tuple
from pathlib import Path

import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# --------------------------------------------------
# 기본 설정
# --------------------------------------------------
APP_VERSION = "hybrid-0.2.0"

app = FastAPI(
    title="KoBERT Hybrid Classifier",
    version=APP_VERSION,
    description="규칙 + KoBERT 하이브리드 민원 분류 API",
)

# testPy.py 와 동일한 라벨 매핑
ID2LABEL = {
    0: "도로-교통",
    1: "시설물-건축",
    2: "치안-범죄위험",
    3: "자연재난-환경",
    4: "위생-보건",
    5: "기타",
    6: "스팸",
}
LABELS: List[str] = [ID2LABEL[i] for i in range(len(ID2LABEL))]

# --------------------------------------------------
# KoBERT 아티팩트 로딩
# --------------------------------------------------
# main.py 위치: .../Cleanup_Street/datatest/rule_api/app/main.py
APP_DIR = Path(__file__).resolve().parent          # .../datatest/rule_api/app   
DATATEST_DIR = APP_DIR.parents[1]                  # .../datatest
ARTIFACTS_DIR = DATATEST_DIR / "kobert-7cls-artifacts"

print("[MODEL] loading artifacts from:", ARTIFACTS_DIR)

try:
    tokenizer = AutoTokenizer.from_pretrained(
        str(ARTIFACTS_DIR),
        local_files_only=True,
    )
    model = AutoModelForSequenceClassification.from_pretrained(
        str(ARTIFACTS_DIR),
        local_files_only=True,
    )

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(DEVICE)
    model.eval()

    MODEL_AVAILABLE = True
    print(f"[MODEL] device={DEVICE}, num_labels={model.config.num_labels}")
except Exception as e:
    # 모델이 없어도 API 자체는 동작하게 하기 위한 방어 코드
    print("[MODEL] load failed:", repr(e))
    tokenizer = None
    model = None
    DEVICE = torch.device("cpu")
    MODEL_AVAILABLE = False

# --------------------------------------------------
# 간단한 규칙 기반 스코어
# --------------------------------------------------
# 간단한 라벨별 키워드 (1차 초안)
RULE_KEYWORDS: Dict[str, List[str]] = {
    "도로-교통": [
        "신호", "신호등", "차선", "도로", "버스", "지하철", "교차로", "횡단보도", "불법주차", "불법 주차", 
        "불법주정차", "불법 주정차", "정체", 
        "교통사고", "교통 사고", "과속", "스쿨존", "통행"
        ],
    "시설물-건축": [
        "가로등", "보도블럭", "보도블록", "계단", "난간", "펜스", "담장", "울타리", "건물", 
        "외벽", "표지판", "시설물", "시설", "벤치", "놀이터", "미끄럼틀", "기둥", "CCTV", "cctv"
        ],
    "치안-범죄위험": [
        "폭행", "시비", "싸움", "도난", "절도", "범죄", "수상한 사람", "수상한사람", "스토킹", 
        "폭주", "폭력", "사람이 따라", "사람이따라", "남자가 따라", "남자가따라", 
        "불량 청소년", "불량청소년", "비행소년", "비행 소년", "비행청소년", "비행 청소년", "술 취한", "술에 취한", 
        "때려", "때렸", "위협", "겁 주는", "겁주는", "난동"
        ],
    "자연재난-환경": [
        "폭우", "폭설", "강풍", "태풍", "침수", "물에 잠김", "결빙", "산사태", "눈길", "미세먼지", "공사 먼지", "공사먼지", 
        "빙판", "연기", "불이 났", "화재", "하천 범람", "하천이 범람", "비가 너무", "비가 많이", "눈이 많이", 
        "눈이 쌓여", "눈이 와", "눈이 오고", "눈이 왔", "눈이 내", "눈오", "눈온"
        ],
    "위생-보건": [
        "위생", "벌레", "쥐", "보건", "소독", "건강", "바퀴벌레", "식재료", "구더기", "모기", "해충", 
        "곰팡이", "악취", "냄새", 
        "두통", "어지러움", "감염", "질병"
        ],
    "스팸": [
        "대출", "광고", "홍보", "카지노", "도박", "상담문의", "수익", "투자", "클릭만 해도", "무료 가입", "쿠폰", "특별", "혜택", 
        "응모", "할인", "특가", "가입"
        ],
    # 규칙으로도 안 잡히는 건 기타로 남김
    "기타": [],
}


def rule_scores(text: str) -> Dict[str, float]:
    t = (text or "").strip()
    scores = {lbl: 0.0 for lbl in LABELS}
    if not t:
        scores["기타"] = 1.0
        return scores

    t_lower = t.lower()
    label_hits: Dict[str, int] = {lbl: 0 for lbl in LABELS}

    # 라벨별 키워드 매칭
    for label, keywords in RULE_KEYWORDS.items():
        for kw in keywords:
            if kw and kw in t:
                label_hits[label] += 1

    total_hits = sum(label_hits.values())

    # 자연재난-환경 vs 도로-교통 우선 규칙 
    # >> 만약에 "재난"과 "도로교통"이 같이 잡힌다면, 카테고리를 재난으로 넘기기 
    if label_hits["자연재난-환경"] > 0 and label_hits["도로-교통"] > 0:
        # 자연 쪽으로 몰아주기
        scores = {lbl: 0.0 for lbl in LABELS}
        scores["자연재난-환경"] = 1.0
        return scores

    if total_hits == 0:
        scores["기타"] = 1.0
    else:
        for label, cnt in label_hits.items():
            if cnt > 0:
                scores[label] = cnt / total_hits

    return scores
    

# --------------------------------------------------
# KoBERT 기반 확률
# --------------------------------------------------
def kobert_scores(text: str) -> Dict[str, float]:
    """KoBERT softmax 확률. 모델이 없거나 에러가 나면 전부 0으로 반환."""
    if not MODEL_AVAILABLE or tokenizer is None or model is None:
        return {lbl: 0.0 for lbl in LABELS}

    try:
        enc = tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=128,
            return_tensors="pt",
        )

        # KoBERT 환경에서 token_type_ids 관련 IndexError 방지
        if "token_type_ids" in enc:
            enc.pop("token_type_ids")

        enc = {k: v.to(DEVICE) for k, v in enc.items()}

        with torch.no_grad():
            out = model(**enc)
            logits = out.logits[0].cpu().numpy().astype("float64")

        # 안정적인 softmax
        logits = logits - logits.max()
        exp = np.exp(logits)
        probs = exp / exp.sum()

        return {ID2LABEL[i]: float(probs[i]) for i in range(len(ID2LABEL))}

    except Exception as e:
        print("[ERROR] kobert_scores failed:", repr(e))
        return {lbl: 0.0 for lbl in LABELS}


# --------------------------------------------------
# 하이브리드 결합
# --------------------------------------------------
RULE_WEIGHT = 0.6  # 규칙 비중 (추측임)
MODEL_WEIGHT = 0.4  # KoBERT 비중

def hybrid_infer(text: str, top_k: int = 1) -> Tuple[str, Dict[str, float]]:
    rule = rule_scores(text)
    kobert = kobert_scores(text)

    if MODEL_AVAILABLE:
        merged = {
            lbl: RULE_WEIGHT * rule.get(lbl, 0.0) + MODEL_WEIGHT * kobert.get(lbl, 0.0)
            for lbl in LABELS
        }
    else:
        merged = rule

    best_label = max(merged.items(), key=lambda x: x[1])[0]
    return best_label, merged



# --------------------------------------------------
# API 스키마
# --------------------------------------------------
class Req(BaseModel):
    text: str
    top_k: int | None = 1


class Resp(BaseModel):
    label: str
    probs: Dict[str, float]
    version: str


class DebugResp(BaseModel):
    label: str
    rule: Dict[str, float]
    kobert: Dict[str, float]
    merged: Dict[str, float]
    version: str



# --------------------------------------------------
# 엔드포인트
# --------------------------------------------------
@app.post(
    "/v1/classify",
    response_model=Resp,
    summary="text 한 줄을 받아 KoBERT로 분류 결과를 반환하는 엔드포인트.",
)
def classify(req: Req) -> Resp:
    label, probs = hybrid_infer(req.text, req.top_k or 1)
    return Resp(label=label, probs=probs, version=APP_VERSION)


@app.post(
    "/v1/debug_classify",
    response_model=DebugResp,
    summary="규칙/KoBERT/하이브리드 점수를 모두 반환하는 디버그 엔드포인트.",
)
def debug_classify(req: Req) -> DebugResp:
    text = req.text

    # 1) 규칙 점수
    rule = rule_scores(text)

    # 2) KoBERT 점수
    kobert = kobert_scores(text)

    # 3) 하이브리드 병합 (현재 설정된 가중치 사용)
    if MODEL_AVAILABLE:
        merged = {
            lbl: RULE_WEIGHT * rule.get(lbl, 0.0) + MODEL_WEIGHT * kobert.get(lbl, 0.0)
            for lbl in LABELS
        }
    else:
        merged = rule

    best_label = max(merged.items(), key=lambda x: x[1])[0]

    return DebugResp(
        label=best_label,
        rule=rule,
        kobert=kobert,
        merged=merged,
        version=APP_VERSION,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=9000, reload=True)
