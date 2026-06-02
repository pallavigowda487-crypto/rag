# RAGAS Evaluation Scaffold

This directory contains a reusable evaluation setup for your RAG application using [RAGAS](https://github.com/explodinggradients/ragas).

## Structure

```text
rag_eval/
  .env.example
  README.md
  requirements.txt
  evaluator.py                    # backwards-compatible entrypoint
  generate_test_data.py           # backwards-compatible entrypoint
  config/
    metrics.json                  # metric + model settings
  data/
    eval_dataset.json             # active dataset used for evaluation
    samples/
      eval_dataset.sample.json    # template dataset
    generated/
      .gitkeep                    # generated testsets land here
  results/
    .gitkeep
    raw/
      .gitkeep                    # raw row-level metric outputs
    summaries/
      .gitkeep                    # aggregate summaries
  src/
    __init__.py
    config.py
    data_loader.py
    evaluate_rag.py
    generate_testset.py
```

## Quick Start

1. Install dependencies:
   - `cd rag_eval`
   - `pip install -r requirements.txt`
2. Create `.env` from `.env.example` and add keys.
3. Put your eval records in `data/eval_dataset.json`.
4. Run evaluation:
   - `python evaluator.py`
5. Check outputs:
   - `results/raw/eval_results.csv`
   - `results/summaries/eval_summary.json`

## Dataset Format

Each item must contain:

- `question` (str): user question
- `contexts` (list[str]): retrieved chunks passed to your LLM
- `answer` (str): your RAG system answer
- `ground_truth` (str): expected/reference answer

Use `data/samples/eval_dataset.sample.json` as the template.
