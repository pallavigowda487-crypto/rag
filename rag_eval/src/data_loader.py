import json
from pathlib import Path

from datasets import Dataset

REQUIRED_KEYS = ("question", "contexts", "answer", "ground_truth")


def load_eval_dataset(dataset_path: Path) -> Dataset:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    with dataset_path.open("r", encoding="utf-8") as fp:
        rows = json.load(fp)

    if not isinstance(rows, list) or not rows:
        raise ValueError("Dataset must be a non-empty JSON array.")

    for i, row in enumerate(rows):
        missing = [key for key in REQUIRED_KEYS if key not in row]
        if missing:
            raise ValueError(f"Row {i} missing keys: {missing}")
        if not isinstance(row["contexts"], list):
            raise ValueError(f"Row {i} field 'contexts' must be a list[str].")

    formatted = {
        "question": [row["question"] for row in rows],
        "contexts": [row["contexts"] for row in rows],
        "answer": [row["answer"] for row in rows],
        "ground_truth": [row["ground_truth"] for row in rows],
    }
    return Dataset.from_dict(formatted)
