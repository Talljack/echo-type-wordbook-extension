import { applyEnrichment, parseAiWordCard, mergeFallbackEnrichment, parseDatamuseEntry, parseDictionaryEntry, parseFreeDictionaryEntry, parseYoudaoEntry, prioritizeContextSense } from "../lib/enrichment";
import { buildEnrichmentRequest, parseProviderText, providerConfigIsReady } from "../lib/providers";
import { chromeStorage, getState, initializeStorage, setPendingSelection, updateWord } from "../lib/storage";
import type { AiProviderConfig, EnrichmentResult, WordPhrase, WordSense } from "../types";

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
  const [youdao, dictionary, freeDictionary, datamuseDictionary, translation, collocations, relatedPhrases] = await Promise.allSettled([
    fetchJson(`https://dict.youdao.com/jsonapi?q=${encoded}`, undefined, 5_000),
    fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`, undefined, 4_000),
    fetchJson(`https://freedictionaryapi.com/api/v1/entries/en/${encoded}`, undefined, 5_000),
    fetchJson(`https://api.datamuse.com/words?sp=${encoded}&md=dp&max=1`, undefined, 4_000),
    fetchJson(`https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|zh-CN`, undefined, 6_000),
    fetchJson(`https://api.datamuse.com/words?rel_bga=${encoded}&md=p&max=30`, undefined, 4_000),
    fetchJson(`https://api.datamuse.com/words?sp=*${encoded}*&max=50`, undefined, 4_000)
  ]);
  const curatedDictionary = youdao.status === "fulfilled" ? parseYoudaoEntry(youdao.value) : undefined;
  const primaryDictionary = dictionary.status === "fulfilled" ? parseDictionaryEntry(dictionary.value) : undefined;
  const structuredDictionary = freeDictionary.status === "fulfilled" ? parseFreeDictionaryEntry(freeDictionary.value) : undefined;
  const fallbackDictionary = datamuseDictionary.status === "fulfilled" ? parseDatamuseEntry(datamuseDictionary.value) : undefined;
  const dictionaryResult: EnrichmentResult = curatedDictionary?.definitions.length
    ? curatedDictionary
    : structuredDictionary?.definitions.length
      ? structuredDictionary
      : primaryDictionary?.definitions.length
        ? primaryDictionary
        : fallbackDictionary ?? { definitions: [], senses: [], phrases: [], synonyms: [], antonyms: [], examples: [] };
  const translationResult = translation.status === "fulfilled" ? translation.value : {};
  const phraseTexts = collectPhraseTexts(word, collocations.status === "fulfilled" ? collocations.value : [], relatedPhrases.status === "fulfilled" ? relatedPhrases.value : []);
  const [translatedSenses, translatedPhrases] = await Promise.all([
    translateSenses(dictionaryResult.senses),
    translatePhrases(phraseTexts)
  ]);
  const phrases = [...new Map([...dictionaryResult.phrases, ...translatedPhrases].map((phrase) => [phrase.text.toLocaleLowerCase(), phrase])).values()].slice(0, 8);
  const merged = {
    ...mergeFallbackEnrichment(dictionaryResult, translationResult),
    translation: dictionaryResult.translation || translatedText(translationResult, "word"),
    senses: translatedSenses,
    phrases,
    provider: curatedDictionary?.definitions.length ? "youdao-collins" : "free-dictionary"
  };
  if (!merged.translation && !merged.definitions.length) throw new Error("免费词典暂时没有找到这个词。");
  return merged;
}

interface DatamuseCandidate { word: string; tags: string[] }

function datamuseCandidates(data: unknown): DatamuseCandidate[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        word: typeof value.word === "string" ? value.word.trim() : "",
        tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.toLocaleLowerCase()) : []
      };
    })
    .filter((item) => item.word);
}

function collectPhraseTexts(word: string, collocationData: unknown, phraseData: unknown): string[] {
  const normalizedWord = word.trim().toLocaleLowerCase();
  const stopWords = new Set([
    "a", "about", "after", "an", "and", "any", "are", "as", "at", "be", "before", "but", "by", "can", "could", "did", "do", "does", "for", "from",
    "had", "has", "have", "he", "her", "him", "his", "how", "i", "if", "in", "is", "it", "its", "may", "me", "more", "my", "not", "of", "on", "or", "our", "she",
    "so", "some", "such", "than", "that", "the", "their", "them", "then", "these", "they", "this", "those", "to", "us", "was", "we", "were", "what", "when",
    "where", "which", "who", "why", "will", "with", "would", "you", "your"
  ]);
  const exactWord = new RegExp(`(^|\\s)${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i");
  const collocations = datamuseCandidates(collocationData)
    .filter((item) => /^[a-z][a-z'-]*$/i.test(item.word) && item.word.toLocaleLowerCase() !== normalizedWord && !stopWords.has(item.word.toLocaleLowerCase()))
    .filter((item) => !item.tags.length || item.tags[0] === "n")
    .map((item) => `${word} ${item.word}`)
    .slice(0, 5);
  const phrases = datamuseCandidates(phraseData).map((item) => item.word)
    .filter((item) => item.includes(" ") && exactWord.test(item) && item.toLocaleLowerCase().startsWith(`${normalizedWord} `))
    .slice(0, 3);
  return [...new Map([...phrases, ...collocations].map((item) => [item.toLocaleLowerCase(), item])).values()].slice(0, 8);
}

function translatedText(data: unknown, mode: "default" | "word" | "phrase" = "default"): string {
  const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const responseData = payload.responseData && typeof payload.responseData === "object" ? payload.responseData as Record<string, unknown> : {};
  const matches = Array.isArray(payload.matches) ? payload.matches as Array<Record<string, unknown>> : [];
  const candidates = matches
    .map((match) => ({
      text: typeof match.translation === "string" ? match.translation.trim() : "",
      quality: Number(match.quality ?? 0),
      match: Number(match.match ?? 0),
      usage: Number(match["usage-count"] ?? 0)
    }))
    .filter((item) => item.text);
  if (mode === "word" && candidates.length) {
    const maximumMatch = Math.max(...candidates.map((candidate) => candidate.match));
    const closeMatches = candidates.filter((candidate) => candidate.match >= maximumMatch - 0.03);
    return closeMatches.sort((a, b) => b.usage - a.usage || b.quality - a.quality || b.match - a.match)[0]?.text ?? "";
  }
  if (mode === "phrase" && candidates.length) {
    const maximumMatch = Math.max(...candidates.map((candidate) => candidate.match));
    const closeMatches = candidates.filter((candidate) => candidate.match >= maximumMatch - 0.05);
    const groups = new Map<string, { text: string; count: number; quality: number; match: number }>();
    for (const candidate of closeMatches) {
      const key = candidate.text.replace(/[。.!！?？\s]+$/g, "").toLocaleLowerCase();
      const current = groups.get(key);
      groups.set(key, current
        ? { ...current, count: current.count + 1, quality: Math.max(current.quality, candidate.quality), match: Math.max(current.match, candidate.match) }
        : { text: candidate.text, count: 1, quality: candidate.quality, match: candidate.match });
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || b.match - a.match || b.quality - a.quality)[0]?.text ?? "";
  }
  return typeof responseData.translatedText === "string" ? responseData.translatedText.trim() : "";
}

async function translateFree(text: string): Promise<string> {
  const data = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`, undefined, 6_000);
  return translatedText(data);
}

async function translatePhrase(text: string): Promise<string> {
  try {
    const youdao = await fetchJson(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(text)}`, undefined, 5_000);
    const curated = youdaoPhraseTranslation(youdao);
    if (curated) return curated;
  } catch {
    // Fall through to the translation-memory service.
  }
  const data = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`, undefined, 6_000);
  return translatedText(data, "phrase");
}

function youdaoPhraseTranslation(data: unknown): string {
  const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const ec = payload.ec && typeof payload.ec === "object" ? payload.ec as Record<string, unknown> : {};
  const words = Array.isArray(ec.word) ? ec.word as Array<Record<string, unknown>> : [];
  const translations = Array.isArray(words[0]?.trs) ? words[0].trs as Array<Record<string, unknown>> : [];
  const tr = translations[0]?.tr;
  const rows = Array.isArray(tr) ? tr as Array<Record<string, unknown>> : [];
  const list = rows[0]?.l && typeof rows[0].l === "object" ? (rows[0].l as Record<string, unknown>).i : undefined;
  const raw = Array.isArray(list) ? list.find((item): item is string => typeof item === "string") : typeof list === "string" ? list : "";
  return raw ? raw.split(/[：:]/, 1)[0].split("；", 1)[0].replace(/^(?:adj|adv|n|v)\.\s*/i, "").trim() : "";
}

async function translateSenses(senses: WordSense[]): Promise<WordSense[]> {
  const translations = await Promise.allSettled(senses.map((sense) => sense.translation ? Promise.resolve(sense.translation) : translateFree(sense.definition)));
  return senses.map((sense, index) => ({
    ...sense,
    translation: translations[index]?.status === "fulfilled" ? translations[index].value : ""
  }));
}

async function translatePhrases(phrases: string[]): Promise<WordPhrase[]> {
  const translations = await Promise.allSettled(phrases.map((phrase) => translatePhrase(phrase)));
  return phrases.map((phrase, index) => ({
    text: phrase,
    translation: translations[index]?.status === "fulfilled" ? translations[index].value : ""
  })).filter((phrase) => phrase.translation.replace(/[\s，。,.]/g, "").length >= 2 && phrase.translation.toLocaleLowerCase() !== phrase.text.toLocaleLowerCase());
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
      const result = await enrichWithAi(state.settings.aiProvider, word, context);
      return prioritizeContextSense(result, context);
    } catch (error) {
      console.warn("AI enrichment failed, falling back to free services", error);
    }
  }
  const result = await enrichWithFreeServices(word);
  return prioritizeContextSense(result, context);
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
    chrome.contextMenus.create({ id: "echotype-add-word", title: "加入词书：%s", contexts: ["selection"] });
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
