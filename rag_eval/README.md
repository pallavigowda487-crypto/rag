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

### Windows (your machine)

Run checks and install helper:

```powershell
cd rag_eval
.\setup.ps1
```

Or run these directly (do **not** use bare `pip` / `python` from repo root):

```powershell
cd rag_eval
py --version
py -m pip --version
py -m pip install -r requirements.txt
py evaluator.py
```

Why: `python` and `pip` may point to Microsoft Store stubs. The `py` launcher uses your real install at `%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe`.

If `py -m pip install` fails on Python 3.14 (missing wheels / C++ build tools), use 3.12:

```powershell
winget install Python.Python.3.12
py -3.12 -m pip install -r requirements.txt
py -3.12 evaluator.py
```

### General

1. Install dependencies (see Windows section above).
2. Create `.env` from `.env.example` and add keys.
3. Put your eval records in `data/eval_dataset.json`.
4. Run evaluation.
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
