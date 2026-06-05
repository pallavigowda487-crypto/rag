import dotenv from "dotenv";

dotenv.config();

function env(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export const ragasConfig = {
  backendUrl: env("RAGAS_BACKEND_URL", `http://localhost:${env("PORT", "4000")}`),
  providerName: env("RAGAS_PROVIDER", env("LLM_PROVIDER", "openai")).toLowerCase(),
  openaiApiKey: env("OPENAI_API_KEY", ""),
  openaiModel: env("OPENAI_MODEL", "gpt-4-turbo"),
  groqApiKey: env("GROQ_API_KEY", ""),
  groqModel: env("GROQ_MODEL", "llama-3.3-70b-versatile"),
  groqApiUrl: env("GROQ_API_URL", "https://api.groq.com/openai/v1"),
  timeoutMs: Number(env("RAGAS_EVAL_TIMEOUT", "120000")),
  verbose: env("RAGAS_EVAL_VERBOSE", "false").toLowerCase() === "true",
};

export function validateRagasConfig() {
  const missing = [];

  if (!ragasConfig.backendUrl) missing.push("RAGAS_BACKEND_URL");
  if (ragasConfig.providerName === "openai" && !ragasConfig.openaiApiKey) {
    missing.push("OPENAI_API_KEY");
  }
  if (ragasConfig.providerName === "groq" && !ragasConfig.groqApiKey) {
    missing.push("GROQ_API_KEY");
  }

  return missing;
}
