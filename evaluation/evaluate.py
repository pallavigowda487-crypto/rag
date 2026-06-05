import json
import os
import requests
import pandas as pd
import sys, types

m = types.ModuleType('langchain_community.chat_models.vertexai')
m.ChatVertexAI = type('ChatVertexAI', (object,), {})
sys.modules['langchain_community.chat_models.vertexai'] = m

from dotenv import load_dotenv
from datasets import Dataset

from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings

from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)

# Load environment variables (GROQ_API_KEY, BACKEND_URL)
load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4005")

def get_answer_from_backend(question: str):
    """
    Calls the Node.js backend to get the generated answer and retrieved contexts.
    Ensure that a document is uploaded via the frontend/API before running this.
    """
    url = f"{BACKEND_URL}/api/query"
    try:
        response = requests.post(url, json={"question": question}, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        answer = data.get("answer", "")
        citations = data.get("citations", [])
        
        # Extract contexts from the citations
        contexts = [cit.get("text", "") for cit in citations]
        
        return answer, contexts
    except requests.exceptions.RequestException as e:
        print(f"Error querying backend for question '{question}': {e}")
        return "", []

def main():
    print("Loading test data...")
    try:
        with open("test_data.json", "r") as f:
            test_data = json.load(f)
    except FileNotFoundError:
        print("Error: test_data.json not found. Please create one with questions.")
        return

    questions = []
    answers = []
    contexts_list = []
    ground_truths = []

    print("Querying backend for answers (if missing)...")
    for item in test_data:
        question = item.get("question")
        ground_truth = item.get("ground_truth", "")
        answer = item.get("answer", "")
        contexts = item.get("contexts", [])
        
        print(f" -> Question: {question}")
        
        # Only query the backend if answer/contexts are missing
        if not answer or not contexts:
            answer, contexts = get_answer_from_backend(question)
        
        questions.append(question)
        answers.append(answer)
        contexts_list.append(contexts)
        ground_truths.append(ground_truth)

    # Format data for Ragas (HuggingFace Dataset format)
    data = {
        "question": questions,
        "answer": answers,
        "contexts": contexts_list,
        "ground_truth": ground_truths
    }
    dataset = Dataset.from_dict(data)

    print("\nInitializing Evaluation Models...")
    # Initialize the LLM (Judge) using Groq
    eval_llm = ChatGroq(model="llama-3.1-8b-instant")
    
    # Initialize local embeddings for metrics that require them
    eval_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    print("\nRunning Ragas Evaluation... This may take a moment.")
    
    metrics = [
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall
    ]
    
    # Fix Groq API limitation where it doesn't support n > 1
    answer_relevancy.strictness = 1
    
    result = evaluate(
        dataset=dataset,
        metrics=metrics,
        llm=eval_llm,
        embeddings=eval_embeddings
    )

    print("\n=== Evaluation Results ===")
    print(result)

    # Export results to CSV
    df = result.to_pandas()
    df.to_csv("evaluation_results.csv", index=False)
    print("\nResults exported to evaluation_results.csv")

    # Calculate averages and export to JSON for the web UI
    import math

    averages = {
        "faithfulness": float(df["faithfulness"].mean()) if "faithfulness" in df else 0.0,
        "answer_relevancy": float(df["answer_relevancy"].mean()) if "answer_relevancy" in df else 0.0,
        "context_precision": float(df["context_precision"].mean()) if "context_precision" in df else 0.0,
        "context_recall": float(df["context_recall"].mean()) if "context_recall" in df else 0.0,
    }

    # Handle NaN values which JSON can't parse
    for k, v in averages.items():
        if math.isnan(v):
            averages[k] = 0.0

    questions_data = []
    for _, row in df.iterrows():
        q_data = {
            "question": row.get("user_input", "Unknown Question"),
            "faithfulness": float(row.get("faithfulness", 0.0)) if not math.isnan(row.get("faithfulness", 0.0)) else 0.0,
            "answer_relevancy": float(row.get("answer_relevancy", 0.0)) if not math.isnan(row.get("answer_relevancy", 0.0)) else 0.0,
            "context_precision": float(row.get("context_precision", 0.0)) if not math.isnan(row.get("context_precision", 0.0)) else 0.0,
            "context_recall": float(row.get("context_recall", 0.0)) if not math.isnan(row.get("context_recall", 0.0)) else 0.0,
        }
        questions_data.append(q_data)

    output_json = {
        "averages": averages,
        "questions": questions_data
    }

    with open("evaluation_results.json", "w") as f:
        json.dump(output_json, f)
    print("Averages and question details exported to evaluation_results.json")

if __name__ == "__main__":
    main()
