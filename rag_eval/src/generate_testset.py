import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from ragas.testset.evolutions import multi_context, reasoning, simple
from ragas.testset.generator import TestsetGenerator

from src.config import BASE_DIR


def run() -> None:
    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required to generate synthetic testsets.")

    source_doc = BASE_DIR.parent / "README.md"
    if not source_doc.exists():
        raise FileNotFoundError(f"Source document not found: {source_doc}")

    loader = TextLoader(str(source_doc), encoding="utf-8")
    documents = loader.load()

    generator_llm = ChatOpenAI(model=os.getenv("RAGAS_EVAL_MODEL", "gpt-4o-mini"), api_key=api_key)
    critic_llm = ChatOpenAI(model=os.getenv("RAGAS_CRITIC_MODEL", "gpt-4o-mini"), api_key=api_key)
    embeddings = OpenAIEmbeddings(
        model=os.getenv("RAGAS_EMBEDDING_MODEL", "text-embedding-3-small"),
        api_key=api_key,
    )

    generator = TestsetGenerator.from_langchain(generator_llm, critic_llm, embeddings)
    testset = generator.generate_with_langchain_docs(
        documents,
        test_size=8,
        distributions={simple: 0.5, multi_context: 0.3, reasoning: 0.2},
    )

    out_path = BASE_DIR / "data" / "generated" / "generated_testset.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    testset.to_pandas().to_csv(out_path, index=False)
    print(f"Generated testset saved to: {out_path}")


if __name__ == "__main__":
    run()
