import { MockProvider, OpenAIProvider } from "@iklovepolo/ragas-lib";
import { ragasConfig } from "./config.js";

export function createRagasProvider() {
  if (ragasConfig.providerName === "openai") {
    return new OpenAIProvider({
      apiKey: ragasConfig.openaiApiKey,
      model: ragasConfig.openaiModel,
    });
  }

  return new MockProvider({
    score: 7.5,
    responseDelay: 0,
  });
}
