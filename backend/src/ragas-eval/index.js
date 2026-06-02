import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RAGAssessment,
  Faithfulness,
  Relevance,
  ContextPrecision,
  ContextRecall,
} from "@iklovepolo/ragas-lib";
import { ragasConfig, validateRagasConfig } from "./config.js";
import { createRagasProvider } from "./provider.js";
import { loadEvaluationDataset } from "./dataset.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "output");
const outputFile = path.join(outputDir, "ragas-evaluation-report.json");

async function fetchRagAnswer(question) {
  const response = await fetch(`${ragasConfig.backendUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend query failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  if (!payload.answer) {
    throw new Error("Backend returned no answer field from /api/query");
  }

  return payload.answer;
}

function createAssessment(provider) {
  const assessment = new RAGAssessment({
    provider,
    verbose: ragasConfig.verbose,
  });

  assessment.registerMetric(new Faithfulness(provider));
  assessment.registerMetric(new Relevance(provider));
  assessment.registerMetric(new ContextPrecision(provider));
  assessment.registerMetric(new ContextRecall(provider));

  return assessment;
}

async function runEvaluation() {
  const missing = validateRagasConfig();
  if (missing.length) {
    throw new Error(`Missing evaluation config: ${missing.join(", ")}`);
  }

  const dataset = await loadEvaluationDataset();
  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new Error("Evaluation dataset is empty. Check sample-eval-dataset.json.");
  }

  const provider = createRagasProvider();
  const assessment = createAssessment(provider);
  const ragAnswers = [];
  const contexts = [];

  for (const testCase of dataset) {
    const answer = await fetchRagAnswer(testCase.question);
    ragAnswers.push(answer);
    contexts.push(testCase.context || "");

    if (ragasConfig.verbose) {
      console.log(`Question: ${testCase.question}`);
      console.log(`Answer: ${answer.slice(0, 200)}`);
      console.log("---");
    }
  }

  const report = await assessment.evaluate({
    dataset,
    ragAnswers,
    contexts,
    onProgress: (completed, total) => {
      console.log(`Evaluating ${completed}/${total}`);
    },
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(report, null, 2), "utf-8");

  console.log(`RAG evaluation complete. Report saved to: ${outputFile}`);
  console.log("Summary:", JSON.stringify(report.metadata, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runEvaluation().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default runEvaluation;
