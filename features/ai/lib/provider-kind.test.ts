import { getAiProviderKind, getAiProviderName } from "./provider-kind";

describe("getAiProviderKind", () => {
  it("reads the provider type", () => {
    expect(getAiProviderKind("GEMINI")).toBe("gemini");
    expect(getAiProviderKind("CLAUDE")).toBe("claude");
    expect(getAiProviderKind("OPENAI")).toBe("openai");
  });

  it("reads the provider name", () => {
    expect(getAiProviderKind("Gemini")).toBe("gemini");
    expect(getAiProviderKind(" Claude ")).toBe("claude");
    expect(getAiProviderKind("OpenAI")).toBe("openai");
  });

  it("reads the model name of a link detail", () => {
    expect(getAiProviderKind("gemini-2.5-flash")).toBe("gemini");
    expect(getAiProviderKind("models/gemini-2.0-flash")).toBe("gemini");
    expect(getAiProviderKind("claude-sonnet-4-5")).toBe("claude");
    expect(getAiProviderKind("gpt-4o-mini")).toBe("openai");
    expect(getAiProviderKind("o3")).toBe("openai");
  });

  it("falls back to OpenAI without a value", () => {
    expect(getAiProviderKind(null)).toBe("openai");
    expect(getAiProviderKind(undefined)).toBe("openai");
    expect(getAiProviderKind("")).toBe("openai");
  });
});

describe("getAiProviderName", () => {
  it("names each kind", () => {
    expect(getAiProviderName("gemini")).toBe("Gemini");
    expect(getAiProviderName("claude")).toBe("Claude");
    expect(getAiProviderName("openai")).toBe("OpenAI");
  });
});
