import { describe, expect, it } from "vitest";
import { anthropicModels, googleModels, openAiModels } from "./http";

describe("provider model response adapters", () => {
  it("normalizes OpenAI, Anthropic and Google model lists", () => {
    expect(openAiModels({ data: [{ id: "gpt-test" }] })[0]?.modelId).toBe("gpt-test");
    expect(anthropicModels({ data: [{ id: "claude-test", display_name: "Claude Test" }] })[0]?.displayName).toBe("Claude Test");
    expect(googleModels({ models: [{ name: "models/gemini-test", displayName: "Gemini Test", supportedGenerationMethods: ["generateContent"] }] })[0]?.modelId).toBe("gemini-test");
  });
});
