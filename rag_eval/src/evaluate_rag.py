import json
import os
import sys
from pathlib import Path
from types import ModuleType

# Ragas still imports legacy VertexAI path removed from langchain-community 0.4+.
_vertex_stub = ModuleType("langchain_community.chat_models.vertexai")
_vertex_stub.ChatVertexAI = type("ChatVertexAI", (), {})
sys.modules.setdefault("langchain_community.chat_models.vertexai", _vertex_stub)

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from ragas import evaluate
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import answer_relevancy, context_precision, context_recall, faithfulness

from src.config import BASE_DIR, load_settings, provider_from_env
from src.data_loader import load_eval_dataset

METRIC_REGISTRY = {
    "faithfulness": faithfulness,
    "answer_relevancy": answer_relevancy,
    "context_recall": context_recall,
    "context_precision": context_precision,
}


def _build_openai_clients() -> tuple[LangchainLLMWrapper, LangchainEmbeddingsWrapper]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required when provider=openai.")

    eval_model = os.getenv("RAGAS_EVAL_MODEL", "gpt-4o-mini")
    embedding_model = os.getenv("RAGAS_EMBEDDING_MODEL", "text-embedding-3-small")
    llm = ChatOpenAI(model=eval_model, api_key=api_key)
    embeddings = OpenAIEmbeddings(model=embedding_model, api_key=api_key)
    return LangchainLLMWrapper(llm), LangchainEmbeddingsWrapper(embeddings)


def _build_groq_clients() -> tuple[LangchainLLMWrapper, LangchainEmbeddingsWrapper]:
    from langchain_huggingface import HuggingFaceEmbeddings

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        raise ValueError("GROQ_API_KEY is required when provider=groq.")

    groq_model = os.getenv("RAGAS_GROQ_MODEL", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"))
    groq_base = os.getenv("RAGAS_GROQ_BASE_URL", os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1"))

    llm = ChatOpenAI(model=groq_model, api_key=groq_key, base_url=groq_base)
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return LangchainLLMWrapper(llm), LangchainEmbeddingsWrapper(embeddings)


def _build_hf_embeddings_with_openai_llm() -> tuple[LangchainLLMWrapper, LangchainEmbeddingsWrapper]:
    from langchain_huggingface import HuggingFaceEmbeddings

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required when provider=openai_hf.")
    eval_model = os.getenv("RAGAS_EVAL_MODEL", "gpt-4o-mini")
    llm = ChatOpenAI(model=eval_model, api_key=api_key)
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return LangchainLLMWrapper(llm), LangchainEmbeddingsWrapper(embeddings)


def run() -> None:
    settings = load_settings()
    metrics = [METRIC_REGISTRY[name] for name in settings["metrics"]]
    provider = provider_from_env(settings.get("provider", "openai"))

    dataset_path = BASE_DIR / "data" / "eval_dataset.json"
    dataset = load_eval_dataset(dataset_path)

    if provider == "openai":
        ragas_llm, ragas_embeddings = _build_openai_clients()
    elif provider == "groq":
        ragas_llm, ragas_embeddings = _build_groq_clients()
    elif provider == "openai_hf":
        ragas_llm, ragas_embeddings = _build_hf_embeddings_with_openai_llm()
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    result = evaluate(dataset=dataset, metrics=metrics, llm=ragas_llm, embeddings=ragas_embeddings)
    df = result.to_pandas()

    output_csv = BASE_DIR / settings["output_csv"]
    output_summary_json = BASE_DIR / settings["output_summary_json"]
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    output_summary_json.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(output_csv, index=False)
    summary = {k: float(v) for k, v in result._repr_dict.items()}
    output_summary_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Dataset rows: {len(df)}")
    print(f"Detailed results: {output_csv}")
    print(f"Summary results: {output_summary_json}")
    print("Summary metrics:")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    run()
