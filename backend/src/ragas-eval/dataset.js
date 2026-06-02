import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleDatasetPath = path.join(__dirname, "data", "sample-eval-dataset.json");

export async function loadEvaluationDataset() {
  const raw = await readFile(sampleDatasetPath, "utf-8");
  return JSON.parse(raw);
}
