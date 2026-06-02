import dotenv from "dotenv";

dotenv.config();

function env(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export const ragasConfig = {
  backendUrl: env("RAGAS_BACKEND_URL", `http://localhost:${env("PORT", "4000")}`),
  providerName: env("RAGAS_PROVIDER", "openai").toLowerCase(),
  openaiApiKey: env("OPENAI_API_KEY", ""),
  openaiModel: env("OPENAI_MODEL", "gpt-4-turbo"),
  timeoutMs: Number(env("RAGAS_EVAL_TIMEOUT", "120000")),
  verbose: env("RAGAS_EVAL_VERBOSE", "false").toLowerCase() === "true",
};

export function validateRagasConfig() {
  const missing = [];

  if (!ragasConfig.backendUrl) missing.push("RAGAS_BACKEND_URL");
  if (ragasConfig.providerName === "openai" && !ragasConfig.openaiApiKey) {
    missing.push("OPENAI_API_KEY");
  }

  return missing;
}
