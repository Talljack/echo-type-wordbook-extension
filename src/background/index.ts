import { applyEnrichment, parseAiWordCard, mergeFallbackEnrichment, parseDictionaryEntry } from "../lib/enrichment";
import { buildEnrichmentRequest, parseProviderText, providerConfigIsReady } from "../lib/providers";
import { chromeStorage, getState, initializeStorage, setPendingSelection, updateWord } from "../lib/storage";
import type { AiProviderConfig, EnrichmentResult } from "../types";

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("请求超时"));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetch(url, { ...init, signal: controller.signal }),
      timeout
    ]);
    if (!response.ok) throw new Error(`请求失败（${response.status}）`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId!);
    controller.abort();
  }
}

export async function enrichWithFreeServices(word: string): Promise<EnrichmentResult> {
  const encoded = encodeURIComponent(word);
  const [dictionary, translation] = await Promise.allSettled([
    fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`, undefined, 4_000),
    fetchJson(`https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|zh-CN`, undefined, 6_000)
  ]);
  const dictionaryResult = dictionary.status === "fulfilled" ? parseDictionaryEntry(dictionary.value) : { definitions: [], synonyms: [], antonyms: [], examples: [] };
  const translationResult = translation.status === "fulfilled" ? translation.value : {};
  const merged = mergeFallbackEnrichment(dictionaryResult, translationResult);
  if (!merged.translation && !merged.definitions.length) throw new Error("免费词典暂时没有找到这个词。");
  return merged;
}

export async function enrichWithAi(config: AiProviderConfig, word: string, context: string): Promise<EnrichmentResult> {
  const request = buildEnrichmentRequest(config, word, context);
  const data = await fetchJson(request.url, request.init);
  const text = parseProviderText(config.providerId, data);
  if (!text) throw new Error("AI 服务返回了空内容。");
  return { ...parseAiWordCard(text), provider: config.providerId };
}

export async function enrichWord(word: string, context: string): Promise<EnrichmentResult> {
  const state = await getState();
  if (state.settings.aiEnabled && providerConfigIsReady(state.settings.aiProvider)) {
    try {
      return await enrichWithAi(state.settings.aiProvider, word, context);
    } catch (error) {
      console.warn("AI enrichment failed, falling back to free services", error);
    }
  }
  return enrichWithFreeServices(word);
}

async function enrichAndPersistWord(wordId: string, word: string, context: string): Promise<EnrichmentResult> {
  try {
    const result = await enrichWord(word, context);
    if (wordId) {
      const current = (await getState()).words.find((item) => item.id === wordId);
      if (current) await updateWord(chromeStorage(), { ...applyEnrichment(current, result), updatedAt: Date.now() });
    }
    return result;
  } catch (error) {
    if (wordId) {
      const current = (await getState()).words.find((item) => item.id === wordId);
      if (current) await updateWord(chromeStorage(), { ...current, enrichmentStatus: "failed", updatedAt: Date.now() });
    }
    throw error;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeStorage();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "echotype-add-word", title: "加入 EchoType 词书：%s", contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "echotype-add-word" || !info.selectionText) return;
  const selection = {
    word: info.selectionText.trim(),
    context: "",
    sourceUrl: info.pageUrl || tab?.url || "",
    sourceTitle: tab?.title || "",
    capturedAt: Date.now()
  };
  void setPendingSelection(chromeStorage(), selection).then(async () => {
    try {
      await chrome.action.openPopup();
    } catch {
      await chrome.windows.create({ url: chrome.runtime.getURL("popup.html"), type: "popup", width: 430, height: 680 });
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ENRICH_WORD") {
    void enrichAndPersistWord(String(message.wordId ?? ""), String(message.word ?? ""), String(message.context ?? ""))
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "词卡优化失败。" }));
    return true;
  }
  if (message?.type === "TEST_AI") {
    void enrichWithAi(message.config as AiProviderConfig, "resilient", "A resilient team adapts to change.")
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "连接失败。" }));
    return true;
  }
  return false;
});
