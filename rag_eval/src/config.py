import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "metrics.json"


def load_settings() -> dict:
    backend_env = BASE_DIR.parent / "backend" / ".env"
    if backend_env.exists():
        load_dotenv(backend_env)
    load_dotenv(BASE_DIR / ".env")
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config file missing: {CONFIG_PATH}")
    with CONFIG_PATH.open("r", encoding="utf-8") as fp:
        settings = json.load(fp)
    return settings


def provider_from_env(default: str) -> str:
    return os.getenv("RAGAS_MODEL_PROVIDER", default).strip().lower()
