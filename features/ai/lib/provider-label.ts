import type { AiProviderWithModels } from "../types";

function getProviderLabel(provider: AiProviderWithModels): string {
  switch (provider.providerType) {
    case "GEMINI":
      return "Gemini";
    case "CLAUDE":
      return "Claude";
    case "OPENAI":
      return "OpenAI";
    default:
      return provider.providerType;
  }
}

export { getProviderLabel };
