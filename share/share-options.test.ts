import type { AiProviderWithModels } from "@/features/ai/types";

import {
  UNCATEGORIZED_CHOICE,
  getTodoSummary,
  shouldShowUncategorizedHint,
  toFolderChoice,
  toModelOptions,
} from "./share-options";

const PROVIDERS: AiProviderWithModels[] = [
  {
    providerId: 1,
    providerType: "GEMINI",
    models: [
      { id: 11, model: "gemini-pro", priority: 2, userProviderId: 101 },
      { id: 12, model: "gemini-flash", priority: 1, userProviderId: 101 },
    ],
  },
  {
    providerId: 2,
    providerType: "OPENAI",
    models: [{ id: 21, model: "gpt", priority: 1, userProviderId: 201 }],
  },
  {
    providerId: 3,
    providerType: "CLAUDE",
    models: [{ id: 31, model: "claude", priority: 1, userProviderId: 301 }],
  },
  {
    providerId: 4,
    providerType: "GEMINI",
    models: [{ id: 41, model: "catalog-only", priority: 1, userProviderId: null }],
  },
];

describe("toModelOptions", () => {
  it("labels providers with display names instead of the raw provider type", () => {
    expect(toModelOptions(PROVIDERS).map((option) => option.label)).toEqual([
      "Gemini",
      "OpenAI",
      "Claude",
    ]);
  });

  it("picks the highest-priority model the user owns and skips catalog-only providers", () => {
    const [gemini] = toModelOptions(PROVIDERS);
    expect(gemini).toEqual({
      key: "1",
      providerType: "GEMINI",
      userProviderId: 101,
      modelId: 12,
      label: "Gemini",
    });
    expect(toModelOptions(PROVIDERS).some((option) => option.key === "4")).toBe(false);
  });

  it("returns no options when the user has no providers", () => {
    expect(toModelOptions([])).toEqual([]);
  });
});

describe("folder choice helpers", () => {
  it("defaults a folder without an emoji to the folder glyph", () => {
    expect(
      toFolderChoice({
        id: 7,
        name: "제주 여행",
        emoji: null,
        isShared: false,
        shareCounts: 0,
        linkCounts: 0,
        myLinkCounts: 0,
      }),
    ).toEqual({ id: 7, name: "제주 여행", emoji: "📁" });
  });

  it("shows the uncategorized hint only for 미분류 with at least one provider", () => {
    const models = toModelOptions(PROVIDERS);
    expect(shouldShowUncategorizedHint(UNCATEGORIZED_CHOICE, models)).toBe(true);
    expect(shouldShowUncategorizedHint(UNCATEGORIZED_CHOICE, [])).toBe(false);
    expect(shouldShowUncategorizedHint({ id: 7, name: "제주 여행", emoji: "✈️" }, models)).toBe(
      false,
    );
  });

  it("summarizes the action setting", () => {
    expect(getTodoSummary(true)).toBe("액션 켬");
    expect(getTodoSummary(false)).toBe("액션 끔");
  });
});
