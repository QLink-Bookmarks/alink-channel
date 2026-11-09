import type { AiProviderType } from "@/features/account/types";

type AiProviderKind = "openai" | "claude" | "gemini";

const AI_PROVIDER_NAME: Record<AiProviderKind, string> = {
  openai: "OpenAI",
  claude: "Claude",
  gemini: "Gemini",
};

// Reads the provider kind from a provider type or name ("GEMINI", "Claude") or from a
// model name ("gemini-2.5-flash", "claude-sonnet-4"). Anything else is OpenAI, the
// only other provider the server offers.
function getAiProviderKind(value: AiProviderType | string | null | undefined): AiProviderKind {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("gemini")) return "gemini";
  if (normalized.includes("claude")) return "claude";
  return "openai";
}

function getAiProviderName(kind: AiProviderKind): string {
  return AI_PROVIDER_NAME[kind];
}

export { getAiProviderKind, getAiProviderName };
export type { AiProviderKind };
