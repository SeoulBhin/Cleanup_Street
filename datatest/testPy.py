# testPy.py
import argparse
import logging
import random
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
from torch.utils.data import DataLoader
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    DataCollatorWithPadding,
)
from datasets import Dataset, DatasetDict


# -----------------------------
# Utilities
# -----------------------------
def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def env_check() -> None:
    import sys, platform
    import transformers  # noqa

    print(f"[Python] {sys.version}")
    print(f"[OS] {platform.platform()}")
    print(f"[PyTorch] {torch.__version__}")
    print(f"[Transformers] {transformers.__version__}")
    print(f"[CUDA available] {torch.cuda.is_available()}")
    print(f"[GPU name] {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}")
    # Optional: KoBART cache info (ignore if not installed)
    try:
        from kobart import get_pytorch_kobart_model  # type: ignore
        print("KoBART path:", get_pytorch_kobart_model())
    except Exception:
        pass


# -----------------------------
# Data (7 labels: 스팸 포함)
# -----------------------------
ID2LABEL = {
    0: "도로-교통",
    1: "시설물-건축",
    2: "치안-범죄위험",
    3: "자연재난-환경",
    4: "위생-보건",
    5: "기타",
    6: "스팸",
}
LABEL2ID = {v: k for k, v in ID2LABEL.items()}


def build_small_dataset() -> DatasetDict:
    """Small 7-class toy dataset (오버핏·파이프라인 검증용)."""
    train_texts = [
        # 0 도로-교통
        "신호등이 고장나 차량이 위험합니다.",
        "버스 정류장 안내표지가 잘못되어 혼란스럽습니다.",
        # 1 시설물-건축
        "공원 가로등이 꺼져 보행이 불편합니다.",
        "보도블록이 파손되어 위험합니다.",
        # 2 치안-범죄위험
        "골목에서 오토바이 과속 소음이 심합니다.",
        "주차장에서 차량 도난이 우려됩니다.",
        # 3 자연재난-환경
        "집중호우로 하천 수위가 상승했습니다.",
        "강풍으로 가로수가 넘어졌습니다.",
        # 4 위생-보건
        "음식물 쓰레기 방치로 악취가 발생합니다.",
        "하수구 역류로 위생 문제가 있습니다.",
        # 5 기타
        "앱 사용 오류가 있어 문의드립니다.",
        "민원 카테고리 찾기가 어렵습니다.",
        # 6 스팸
        "지금 가입하면 포인트 지급! 010-1234-5678로 연락 주세요.",
        "클릭만 해도 당첨! www.spam-event.com 에서 확인하세요.",
    ]
    train_labels = [
        0, 0,  # 도로-교통
        1, 1,  # 시설물-건축
        2, 2,  # 치안-범죄위험
        3, 3,  # 자연재난-환경
        4, 4,  # 위생-보건
        5, 5,  # 기타
        6, 6,  # 스팸
    ]

    test_texts = [
        "교차로 신호가 먹통이라 위험합니다.",          # 0
        "계단이 미끄러워 넘어질 뻔했습니다.",          # 1
        "비로 배수가 되지 않아 침수되었습니다.",      # 3
        "무단 쓰레기 투기가 계속됩니다.",              # 4
        "벽 근처에서 빈번히 소매치기가 발생합니다.",    # 2
        "분류 기준 문의드립니다.",                    # 5
        "특가 세일 진행 중! 010-9999-9999로 전화주세요.",  # 6
    ]
    test_labels = [0, 1, 3, 4, 2, 5, 6]

    return DatasetDict(
        {
            "train": Dataset.from_dict({"text": train_texts, "label": train_labels}),
            "test": Dataset.from_dict({"text": test_texts, "label": test_labels}),
        }
    )


# -----------------------------
# CSV loader (실제 민원 데이터용)
# -----------------------------
def load_csv_dataset(path: str, test_ratio: float = 0.2) -> DatasetDict:
    """
    complaints_v1.csv를 읽어서 DatasetDict(train/test)로 변환.
    - 지원 컬럼: id, text, label
    - label은 문자열(도로-교통, …, 스팸) → LABEL2ID로 정수 인코딩
    - 간단히 train/test 8:2 비율로 랜덤 분할 (작은 데이터 기준 파이프라인 검증용)
    """
    import pandas as pd

    print(f"[DATA] loading CSV from {path}")

    # sep=None + engine="python" 으로 구분자 자동 추론(콤마/세미콜론 등)
    df = pd.read_csv(path, sep=None, engine="python")

    print("[DATA] raw columns:", list(df.columns))

    # 1) 컬럼 이름 정규화 (양쪽 공백 제거 + BOM 제거)
    normalized_cols = []
    for c in df.columns:
        c2 = str(c).strip()
        if c2.startswith("\ufeff"):
            c2 = c2.replace("\ufeff", "")
        normalized_cols.append(c2)
    df.columns = normalized_cols

    print("[DATA] normalized columns:", list(df.columns))

    # 2) text 컬럼 존재 여부 확인
    if "text" not in df.columns:
        raise ValueError("CSV에는 text 컬럼이 필요합니다.")

    # 3) label 컬럼 존재 여부 확인
    if "label" not in df.columns:
        raise ValueError("CSV에는 label 컬럼이 필요합니다.")

    # 4) text, label 둘 다 비어 있는 행 제거
    df = df.dropna(subset=["text", "label"]).reset_index(drop=True)

    # 5) 라벨 문자열 → 정수 ID 매핑
    df["label_id"] = df["label"].map(LABEL2ID)

    if df["label_id"].isna().any():
        bad = df[df["label_id"].isna()]["label"].unique()
        raise ValueError(f"알 수 없는 라벨이 있습니다: {bad}")

    # 6) 파이썬 리스트로 변환
    texts = df["text"].astype(str).tolist()
    labels = df["label_id"].astype(int).tolist()

    n = len(texts)
    if n == 0:
        raise ValueError("CSV에 데이터가 없습니다.")

    # 7) 인덱스 셔플 후 8:2 분할
    indices = list(range(n))
    random.shuffle(indices)

    cut = max(1, int(n * (1 - test_ratio)))  # 최소 1개는 train
    train_idx = indices[:cut]
    test_idx = indices[cut:] if cut < n else []

    train_texts = [texts[i] for i in train_idx]
    train_labels = [labels[i] for i in train_idx]

    if len(test_idx) > 0:
        test_texts = [texts[i] for i in test_idx]
        test_labels = [labels[i] for i in test_idx]
    else:
        # 샘플이 너무 적으면 test를 train과 동일하게 사용
        test_texts = train_texts
        test_labels = train_labels

    print(f"[CSV] total={n}, train={len(train_texts)}, test={len(test_texts)}")

    # 8) HuggingFace DatasetDict로 변환
    return DatasetDict(
        {
            "train": Dataset.from_dict({"text": train_texts, "label": train_labels}),
            "test": Dataset.from_dict({"text": test_texts, "label": test_labels}),
        }
    )


def build_dataset(data_mode: str, csv_path: Path | None = None) -> DatasetDict:
    """data_mode에 따라 toy vs CSV 데이터셋을 생성."""
    if data_mode == "csv" and csv_path is not None:
        print(f"[DATA] CSV 사용: {csv_path}")
        return load_csv_dataset(str(csv_path))
    else:
        print("[DATA] toy dataset 사용 (코드 내 예시 문장)")
        return build_small_dataset()


# -----------------------------
# Model / Tokenizer
# -----------------------------
def load_tok_model(model_name: str = "skt/kobert-base-v1"):
    """KoBERT 로더 + PAD 토큰 정합 + 7클래스 분류 헤더."""
    tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=False)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=len(ID2LABEL),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )
    # PAD 보강 및 임베딩 정합
    if tokenizer.pad_token is None:
        tokenizer.add_special_tokens({"pad_token": "[PAD]"})
    model.resize_token_embeddings(len(tokenizer))
    model.config.pad_token_id = tokenizer.pad_token_id
    print(f"[vocab_size] {len(tokenizer)} / [pad_token_id] {tokenizer.pad_token_id}")
    return tokenizer, model


def tokenize_dataset(
    ds: DatasetDict, tokenizer, max_length: int = 128, no_tti: bool = True
) -> DatasetDict:
    """텍스트 → 토큰 ID/마스크로 변환 + label → labels 이름 통일."""

    def tok(ex):
        return tokenizer(
            ex["text"],
            truncation=True,
            padding="max_length",
            max_length=max_length,
            return_token_type_ids=not no_tti,
        )

    tokenized = ds.map(tok, batched=False)
    # labels 컬럼 확정(버전별 불일치 방지)
    if "label" in tokenized["train"].column_names:
        tokenized = DatasetDict(
            {
                "train": tokenized["train"].rename_column("label", "labels"),
                "test": tokenized["test"].rename_column("label", "labels"),
            }
        )
    return tokenized


def to_torch(tokenized: DatasetDict) -> DatasetDict:
    """HF Dataset → torch Tensor 포맷으로 변환."""
    return DatasetDict(
        {
            "train": tokenized["train"].remove_columns(["text"]).with_format("torch"),
            "test": tokenized["test"].remove_columns(["text"]).with_format("torch"),
        }
    )


# -----------------------------
# Metrics (no external evaluate)
# -----------------------------
def compute_metrics_np(logits: np.ndarray, labels: np.ndarray) -> Dict[str, float]:
    """Accuracy + Macro-F1 (클래스별 F1 평균)."""
    preds = logits.argmax(axis=-1)
    acc = float((preds == labels).mean()) if len(labels) > 0 else 0.0

    num_classes = len(ID2LABEL)
    f1s: List[float] = []
    for c in range(num_classes):
        tp = int(((preds == c) & (labels == c)).sum())
        fp = int(((preds == c) & (labels != c)).sum())
        fn = int(((preds != c) & (labels == c)).sum())
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        f1s.append(f1)
    macro_f1 = float(np.mean(f1s)) if f1s else 0.0
    return {"accuracy": acc, "f1": macro_f1}


def hf_compute_metrics(eval_pred: Tuple[np.ndarray, np.ndarray]) -> Dict[str, float]:
    """Trainer용 metrics 래퍼."""
    logits, labels = eval_pred
    if isinstance(logits, (list, tuple)):
        logits = logits[0]
    return compute_metrics_np(np.array(logits), np.array(labels))


# -----------------------------
# Sanity forward
# -----------------------------
def forward_sanity(model, tokenizer, tokenized_torch: DatasetDict) -> None:
    """한 번 forward만 돌려서 loss가 잘 나오는지 확인."""
    collator = DataCollatorWithPadding(tokenizer=tokenizer, padding="longest")
    loader = DataLoader(tokenized_torch["train"], batch_size=4, shuffle=False, collate_fn=collator)
    batch = next(iter(loader))
    with torch.no_grad():
        out = model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
            labels=batch["labels"],
        )
    print("[forward OK] loss:", float(out.loss))


# -----------------------------
# Train/Eval
# -----------------------------
def train_and_eval(
    model,
    tokenizer,
    tokenized_torch: DatasetDict,
    output_dir: str,
    num_train_epochs: int = 1,
    lr: float = 5e-5,
    batch_size: int = 8,
    export_trained: bool = False,
    export_dir: str | None = None,
) -> Dict[str, float]:
    """
    train1/train3 모드에서 사용하는 기본 학습 + 평가 루틴.
    export_trained=True 인 경우, 학습이 끝난 모델/토크나이저를 export_dir에 저장.
    """
    args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=num_train_epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=lr,
        logging_steps=10,
        report_to=[],
        seed=42,
        save_strategy="no",  # 체크포인트 저장 안 함
        # evaluation_strategy 인자는 버전 차이 문제 방지를 위해 사용하지 않음
    )

    collator = DataCollatorWithPadding(tokenizer=tokenizer, padding="longest")
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized_torch["train"],
        eval_dataset=tokenized_torch["test"],
        tokenizer=tokenizer,
        data_collator=collator,
        compute_metrics=hf_compute_metrics,
    )
    trainer.train()
    metrics = trainer.evaluate()  # 에포크 종료 후 한 번 평가
    print(metrics)

    if export_trained and export_dir is not None:
        # 학습된 모델/토크나이저 저장
        trainer.save_model(export_dir)
        tokenizer.save_pretrained(export_dir)
        print(f"[saved] trained artifacts -> {export_dir}")

    return metrics


# -----------------------------
# Artifacts
# -----------------------------
def save_artifacts(tokenizer, model, out_dir: str) -> None:
    """현재 모델/토크나이저 상태를 저장 (서빙용)."""
    tokenizer.save_pretrained(out_dir)
    model.save_pretrained(out_dir)
    print(f"[saved] artifacts -> {out_dir}")


# -----------------------------
# CLI
# -----------------------------
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="KoBERT 7-class pipeline")
    p.add_argument("--mode", choices=["env", "sanity", "train1", "train3", "overfit", "export"], default="sanity")
    p.add_argument("--data_mode", choices=["toy", "csv"], default="toy")
    p.add_argument("--model_name", default="skt/kobert-base-v1")
    p.add_argument("--out_dir", default="./kobert-7cls-out")
    p.add_argument("--overfit_dir", default="./kobert-7cls-overfit")
    p.add_argument("--art_dir", default="./kobert-7cls-artifacts")
    p.add_argument("--seed", type=int, default=42)
    # ★ 새 옵션: train1/train3에서 학습된 모델 저장 여부
    p.add_argument(
        "--export_trained",
        action="store_true",
        help="train1/train3 모드에서 학습이 끝난 모델을 art_dir에 저장",
    )
    return p.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    args = parse_args()
    set_seed(args.seed)

    # ★ 추가: art_dir를 testPy.py 기준 절대경로로 보정
    # 기본값("./kobert-7cls-artifacts")이면 항상 datatest/kobert-7cls-artifacts를 가리키게 함
    script_dir = Path(__file__).parent  # .../datatest
    if args.art_dir == "./kobert-7cls-artifacts":
        args.art_dir = str(script_dir / "kobert-7cls-artifacts")

    if args.mode == "env":
        env_check()
        return

    # data_mode에 따라 toy / CSV 선택
    csv_path: Path | None = None
    if args.data_mode == "csv":
        csv_path = Path(__file__).parent / "data" / "complaints_v1.csv"

    ds = build_dataset(args.data_mode, csv_path)
    tokenizer, model = load_tok_model(args.model_name)
    tokenized = tokenize_dataset(ds, tokenizer, max_length=128, no_tti=True)

    # quick vocabulary sanity (flattened max)
    max_train_id = max((x for seq in tokenized["train"]["input_ids"] for x in seq), default=0)
    max_test_id = max((x for seq in tokenized["test"]["input_ids"] for x in seq), default=0)
    print(f"[max token id train/test] {max_train_id} {max_test_id}")
    assert max_train_id < len(tokenizer) and max_test_id < len(tokenizer), "Token id exceeds vocab size"

    tokenized_torch = to_torch(tokenized)

    if args.mode == "sanity":
        forward_sanity(model, tokenizer, tokenized_torch)
        return

    if args.mode == "train1":
        train_and_eval(
            model,
            tokenizer,
            tokenized_torch,
            output_dir=args.out_dir,
            num_train_epochs=1,
            lr=5e-5,
            export_trained=args.export_trained,
            export_dir=args.art_dir,
        )
        return

    if args.mode == "train3":
        train_and_eval(
            model,
            tokenizer,
            tokenized_torch,
            output_dir=args.out_dir,
            num_train_epochs=3,
            lr=3e-5,
            export_trained=args.export_trained,
            export_dir=args.art_dir,
        )
        return

    if args.mode == "overfit":
        # train과 eval을 둘 다 train셋으로 사용해서 오버핏 되는지 확인
        args_tr = TrainingArguments(
            output_dir=args.overfit_dir,
            num_train_epochs=30,
            per_device_train_batch_size=8,
            per_device_eval_batch_size=8,
            learning_rate=2e-5,
            weight_decay=0.01,
            logging_steps=5,
            report_to=[],          # ← 여기만 수정 (report_to[] → report_to=[])
            seed=args.seed,
            save_strategy="no",
            # evaluation_strategy 인자 제거 (버전 호환성 확보)
        )
        collator = DataCollatorWithPadding(tokenizer=tokenizer, padding="longest")
        trainer = Trainer(
            model=model,
            args=args_tr,
            train_dataset=tokenized_torch["train"],
            eval_dataset=tokenized_torch["train"],  # train셋에 대해 평가 → 1.0 근처 기대
            tokenizer=tokenizer,
            data_collator=collator,
            compute_metrics=hf_compute_metrics,
        )
        trainer.train()
        print(trainer.evaluate())
        return

    if args.mode == "export":
        # 초기(비학습) 모델/토크나이저를 그대로 저장하는 모드
        save_artifacts(tokenizer, model, args.art_dir)
        return


if __name__ == "__main__":
    main()
