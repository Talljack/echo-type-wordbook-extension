import type { AiProviderConfig, ProviderDefinition, ProviderProtocol } from "../types";

const provider = (
  id: string,
  name: string,
  protocol: ProviderProtocol,
  baseUrl: string,
  defaultModel: string,
  requiresApiKey = true,
  editableBaseUrl = false
): ProviderDefinition => ({ id, name, protocol, baseUrl, defaultModel, requiresApiKey, editableBaseUrl });

export const PROVIDERS: Record<string, ProviderDefinition> = {
  openai: provider("openai", "OpenAI", "openai", "https://api.openai.com/v1", "gpt-4.1-mini"),
  anthropic: provider("anthropic", "Anthropic", "anthropic", "https://api.anthropic.com/v1", "claude-sonnet-4-20250514"),
  google: provider("google", "Google Gemini", "google", "https://generativelanguage.googleapis.com/v1beta", "gemini-2.5-flash"),
  openrouter: provider("openrouter", "OpenRouter", "openai", "https://openrouter.ai/api/v1", "openai/gpt-4.1-mini"),
  deepseek: provider("deepseek", "DeepSeek", "openai", "https://api.deepseek.com", "deepseek-chat"),
  qwen: provider("qwen", "通义千问", "openai", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"),
  moonshot: provider("moonshot", "Moonshot / Kimi", "openai", "https://api.moonshot.cn/v1", "moonshot-v1-8k"),
  zhipu: provider("zhipu", "智谱 GLM", "openai", "https://open.bigmodel.cn/api/paas/v4", "glm-4-flash"),
  siliconflow: provider("siliconflow", "SiliconFlow", "openai", "https://api.siliconflow.cn/v1", "Qwen/Qwen2.5-7B-Instruct"),
  groq: provider("groq", "Groq", "openai", "https://api.groq.com/openai/v1", "llama-3.1-8b-instant"),
  ollama: provider("ollama", "Ollama（本地）", "ollama", "http://localhost:11434", "qwen2.5", false, true),
  custom: provider("custom", "自定义 OpenAI 兼容", "openai", "", "", false, true)
};

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

export function resolveProvider(config: AiProviderConfig): ProviderDefinition {
  const definition = PROVIDERS[config.providerId];
  if (!definition) throw new Error("请选择支持的 AI 服务商。");
  return definition;
}

export function providerConfigIsReady(config: AiProviderConfig): boolean {
  const definition = PROVIDERS[config.providerId];
  if (!definition || !config.model.trim()) return false;
  const baseUrl = definition.editableBaseUrl ? config.baseUrl : definition.baseUrl;
  if (!normalizeBaseUrl(baseUrl)) return false;
  return !definition.requiresApiKey || Boolean(config.apiKey.trim());
}

function promptFor(word: string, context: string) {
  return {
    system: "你是专业英汉词典编辑。只返回符合要求的 JSON，不要 Markdown。释义简洁准确，例句自然且适合英语学习者。",
    user: `为英文单词 ${JSON.stringify(word)} 生成学习词卡。网页语境：${JSON.stringify(context || "未提供")}。返回字段：translation（简体中文核心释义）、pronunciation（IPA）、partOfSpeech、definitions（最多3条英文释义）、synonyms（最多6个）、antonyms（最多6个）、examples（3条，必须含日常/商务/影视风格，元素结构为 {text,translation,source}，source 取 daily/business/movie）。`
  };
}

export function buildEnrichmentRequest(config: AiProviderConfig, word: string, context: string): { url: string; init: RequestInit } {
  const definition = resolveProvider(config);
  const baseUrl = normalizeBaseUrl(definition.editableBaseUrl ? config.baseUrl : definition.baseUrl);
  const prompt = promptFor(word, context);
  const json = { "Content-Type": "application/json" };

  if (definition.protocol === "anthropic") {
    return {
      url: `${baseUrl}/messages`,
      init: {
        method: "POST",
        headers: { ...json, "x-api-key": config.apiKey.trim(), "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: config.model, max_tokens: 1400, temperature: 0.2, system: prompt.system, messages: [{ role: "user", content: prompt.user }] })
      }
    };
  }

  if (definition.protocol === "google") {
    return {
      url: `${baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
      init: {
        method: "POST",
        headers: { ...json, "x-goog-api-key": config.apiKey.trim() },
        body: JSON.stringify({ system_instruction: { parts: [{ text: prompt.system }] }, contents: [{ role: "user", parts: [{ text: prompt.user }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } })
      }
    };
  }

  const messages = [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }];
  if (definition.protocol === "ollama") {
    return {
      url: `${baseUrl}/api/chat`,
      init: { method: "POST", headers: json, body: JSON.stringify({ model: config.model, stream: false, format: "json", options: { temperature: 0.2 }, messages }) }
    };
  }

  return {
    url: baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`,
    init: {
      method: "POST",
      headers: { ...json, ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}) },
      body: JSON.stringify({ model: config.model, temperature: 0.2, response_format: { type: "json_object" }, messages })
    }
  };
}

export function parseProviderText(providerId: string, data: unknown): string {
  const protocol = PROVIDERS[providerId]?.protocol ?? (providerId as ProviderProtocol);
  const value = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (protocol === "anthropic") {
    const content = Array.isArray(value.content) ? value.content as Array<Record<string, unknown>> : [];
    return content.filter((item) => item.type === "text").map((item) => String(item.text ?? "")).join("\n").trim();
  }
  if (protocol === "google") {
    const candidates = Array.isArray(value.candidates) ? value.candidates as Array<Record<string, unknown>> : [];
    const content = candidates[0]?.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content.parts as Array<Record<string, unknown>> : [];
    return parts.map((part) => String(part.text ?? "")).join("\n").trim();
  }
  if (protocol === "ollama") {
    const message = value.message as Record<string, unknown> | undefined;
    return String(message?.content ?? "").trim();
  }
  const choices = Array.isArray(value.choices) ? value.choices as Array<Record<string, unknown>> : [];
  const message = choices[0]?.message as Record<string, unknown> | undefined;
  return String(message?.content ?? "").trim();
}
