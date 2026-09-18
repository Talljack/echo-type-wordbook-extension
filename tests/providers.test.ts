import { describe, expect, it } from "vitest";
import { buildEnrichmentRequest, parseProviderText, providerConfigIsReady } from "../src/lib/providers";

describe("AI provider adapters", () => {
  it("builds OpenAI-compatible requests", () => {
    const request = buildEnrichmentRequest({
      providerId: "deepseek",
      apiKey: "secret",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat"
    }, "resilient", "A resilient team.");
    expect(request.url).toBe("https://api.deepseek.com/chat/completions");
    expect(request.init.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(request.init.body))).toMatchObject({ model: "deepseek-chat", temperature: 0.2 });
  });

  it("builds native Ollama requests without an API key", () => {
    const request = buildEnrichmentRequest({
      providerId: "ollama",
      apiKey: "",
      baseUrl: "http://localhost:11434",
      model: "qwen2.5"
    }, "resilient", "");
    expect(request.url).toBe("http://localhost:11434/api/chat");
    expect(providerConfigIsReady({ providerId: "ollama", apiKey: "", baseUrl: "http://localhost:11434", model: "qwen2.5" })).toBe(true);
  });

  it("extracts text from native and compatible responses", () => {
    expect(parseProviderText("anthropic", { content: [{ type: "text", text: "answer" }] })).toBe("answer");
    expect(parseProviderText("google", { candidates: [{ content: { parts: [{ text: "answer" }] } }] })).toBe("answer");
    expect(parseProviderText("openai", { choices: [{ message: { content: "answer" } }] })).toBe("answer");
  });
});
