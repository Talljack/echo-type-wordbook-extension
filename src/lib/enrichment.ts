import { z } from "zod";
import type { EnrichmentResult, WordExample, WordPhrase, WordSense } from "../types";

const exampleSchema = z.object({
  text: z.string().trim().min(1),
  translation: z.string().trim().default(""),
  source: z.enum(["dictionary", "daily", "business", "movie", "context", "ai"]).default("ai")
});

const senseSchema = z.object({
  partOfSpeech: z.string().trim().default(""),
  definition: z.string().trim().min(1),
  translation: z.string().trim().default("")
});

const phraseSchema = z.object({
  text: z.string().trim().min(1),
  translation: z.string().trim().default("")
});

const aiWordCardSchema = z.object({
  translation: z.string().trim().default(""),
  pronunciation: z.string().trim().default(""),
  partOfSpeech: z.string().trim().default(""),
  definitions: z.array(z.string().trim()).default([]),
  senses: z.array(senseSchema).default([]),
  phrases: z.array(phraseSchema).default([]),
  synonyms: z.array(z.string().trim()).default([]),
  antonyms: z.array(z.string().trim()).default([]),
  examples: z.array(exampleSchema).default([])
});

const unique = (items: string[], limit = 12) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit);
const uniqueSenses = (items: WordSense[]) => [...new Map(items.map((item) => [`${item.partOfSpeech}\u0000${item.definition}`, item])).values()];
const uniquePhrases = (items: WordPhrase[]) => [...new Map(items.map((item) => [item.text.toLocaleLowerCase(), item])).values()].slice(0, 8);
const uncommonSensePattern = /\b(?:archaic|dated|dialectal|ecclesiastical|juggling|mining|nautical|obsolete|rare)\b/i;
const senseLimits: Record<string, number> = { verb: 10, noun: 5, adjective: 6, adverb: 6 };

function commonSenses(items: WordSense[]): WordSense[] {
  const counts = new Map<string, number>();
  return uniqueSenses(items).filter((item) => {
    if (uncommonSensePattern.test(item.definition)) return false;
    const part = item.partOfSpeech.toLocaleLowerCase() || "other";
    const count = counts.get(part) ?? 0;
    if (count >= (senseLimits[part] ?? 5)) return false;
    counts.set(part, count + 1);
    return true;
  });
}

export function parseDictionaryEntry(data: unknown): EnrichmentResult {
  const entries = Array.isArray(data) ? data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const definitions: string[] = [];
  const senses: WordSense[] = [];
  const synonyms: string[] = [];
  const antonyms: string[] = [];
  const examples: WordExample[] = [];
  let pronunciation = "";
  let partOfSpeech = "";

  for (const entry of entries) {
    if (!pronunciation && typeof entry.phonetic === "string") pronunciation = entry.phonetic;
    const meanings = Array.isArray(entry.meanings) ? entry.meanings as Array<Record<string, unknown>> : [];
    for (const meaning of meanings) {
      const currentPart = typeof meaning.partOfSpeech === "string" ? meaning.partOfSpeech : "";
      if (!partOfSpeech) partOfSpeech = currentPart;
      if (Array.isArray(meaning.synonyms)) synonyms.push(...meaning.synonyms.filter((item): item is string => typeof item === "string"));
      if (Array.isArray(meaning.antonyms)) antonyms.push(...meaning.antonyms.filter((item): item is string => typeof item === "string"));
      if (!Array.isArray(meaning.definitions)) continue;
      for (const raw of meaning.definitions as Array<Record<string, unknown>>) {
        if (typeof raw.definition === "string") {
          definitions.push(raw.definition);
          senses.push({ partOfSpeech: currentPart, definition: raw.definition, translation: "" });
        }
        if (typeof raw.example === "string") examples.push({ text: raw.example, translation: "", source: "dictionary" });
        if (Array.isArray(raw.synonyms)) synonyms.push(...raw.synonyms.filter((item): item is string => typeof item === "string"));
        if (Array.isArray(raw.antonyms)) antonyms.push(...raw.antonyms.filter((item): item is string => typeof item === "string"));
      }
    }
  }

  const curatedSenses = commonSenses(senses);
  return {
    pronunciation,
    partOfSpeech,
    definitions: unique(curatedSenses.map((item) => item.definition), Number.POSITIVE_INFINITY),
    senses: curatedSenses,
    phrases: [],
    synonyms: unique(synonyms),
    antonyms: unique(antonyms),
    examples: examples.slice(0, 8)
  };
}

const datamusePartOfSpeech: Record<string, string> = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb"
};

export function parseDatamuseEntry(data: unknown): EnrichmentResult {
  const entry = Array.isArray(data) && data[0] && typeof data[0] === "object" ? data[0] as Record<string, unknown> : {};
  const tags = Array.isArray(entry.tags) ? entry.tags.filter((item): item is string => typeof item === "string") : [];
  const fallbackPart = datamusePartOfSpeech[tags.find((tag) => tag in datamusePartOfSpeech) ?? ""] ?? "";
  const rawDefinitions = Array.isArray(entry.defs) ? entry.defs.filter((item): item is string => typeof item === "string") : [];
  const senses = rawDefinitions.map((item) => {
    const separator = item.indexOf("\t");
    const code = separator >= 0 ? item.slice(0, separator).trim() : "";
    const definition = (separator >= 0 ? item.slice(separator + 1) : item).trim();
    return { partOfSpeech: datamusePartOfSpeech[code] ?? fallbackPart, definition, translation: "" };
  }).filter((item) => item.definition);
  const curatedSenses = commonSenses(senses);
  return {
    pronunciation: "",
    partOfSpeech: senses[0]?.partOfSpeech ?? fallbackPart,
    definitions: unique(curatedSenses.map((item) => item.definition), Number.POSITIVE_INFINITY),
    senses: curatedSenses,
    phrases: [],
    synonyms: [],
    antonyms: [],
    examples: []
  };
}

export function parseFreeDictionaryEntry(data: unknown): EnrichmentResult {
  const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const entries = Array.isArray(payload.entries) ? payload.entries.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const senses: WordSense[] = [];
  let pronunciation = "";
  let partOfSpeech = "";

  for (const entry of entries) {
    const currentPart = typeof entry.partOfSpeech === "string" ? entry.partOfSpeech : "";
    if (!partOfSpeech) partOfSpeech = currentPart;
    if (!pronunciation && Array.isArray(entry.pronunciations)) {
      const ipa = (entry.pronunciations as Array<Record<string, unknown>>).find((item) => item.type === "ipa" && typeof item.text === "string");
      if (ipa) pronunciation = String(ipa.text);
    }
    const rawSenses = Array.isArray(entry.senses) ? entry.senses as Array<Record<string, unknown>> : [];
    for (const raw of rawSenses) {
      const definition = typeof raw.definition === "string" ? raw.definition.trim() : "";
      const tags = Array.isArray(raw.tags) ? raw.tags.filter((item): item is string => typeof item === "string") : [];
      if (!definition || tags.some((tag) => uncommonSensePattern.test(tag)) || tags.includes("form of")) continue;
      senses.push({ partOfSpeech: currentPart, definition, translation: "" });
    }
  }

  const curatedSenses = commonSenses(senses);
  return {
    pronunciation,
    partOfSpeech,
    definitions: curatedSenses.map((item) => item.definition),
    senses: curatedSenses,
    phrases: [],
    synonyms: [],
    antonyms: [],
    examples: []
  };
}

function collectYoudaoExamples(data: unknown, target: WordExample[]) {
  if (!Array.isArray(data)) return;
  for (const item of data) {
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const translated = value.sense && typeof value.sense === "object" ? value.sense as Record<string, unknown> : {};
    const text = typeof value.example === "string" ? value.example.trim() : "";
    if (text) target.push({ text, translation: typeof translated.word === "string" ? translated.word.trim() : "", source: "dictionary" });
  }
}

export function parseYoudaoEntry(data: unknown): EnrichmentResult {
  const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const collins = payload.collins_primary && typeof payload.collins_primary === "object" ? payload.collins_primary as Record<string, unknown> : {};
  const groups = Array.isArray(collins.gramcat) ? collins.gramcat.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const senses: WordSense[] = [];
  const phrases: WordPhrase[] = [];
  const examples: WordExample[] = [];
  let pronunciation = "";
  let partOfSpeech = "";

  for (const group of groups) {
    const currentPart = typeof group.partofspeech === "string" ? group.partofspeech : "";
    if (!partOfSpeech) partOfSpeech = currentPart;
    if (!pronunciation && typeof group.pronunciation === "string") {
      const raw = group.pronunciation.trim().replace(/^\/+|\/+$/g, "");
      pronunciation = raw ? `/${raw}/` : "";
    }
    const rawSenses = Array.isArray(group.senses) ? group.senses as Array<Record<string, unknown>> : [];
    for (const sense of rawSenses) {
      if (senses.length >= 8) break;
      const definition = typeof sense.definition === "string" ? sense.definition.trim() : "";
      const translation = typeof sense.word === "string" ? sense.word.trim() : "";
      if (!definition || !translation) continue;
      senses.push({ partOfSpeech: currentPart, definition, translation });
      collectYoudaoExamples(sense.examples, examples);
    }
    const rawPhrases = Array.isArray(group.phrases) ? group.phrases as Array<Record<string, unknown>> : [];
    for (const phrase of rawPhrases) {
      const phrasalVerbs = Array.isArray(phrase.phrasalverb) ? phrase.phrasalverb as Array<Record<string, unknown>> : [];
      const text = typeof phrase.phrase === "string"
        ? phrase.phrase.trim()
        : typeof phrasalVerbs[0]?.phrase === "string" ? String(phrasalVerbs[0].phrase).trim() : "";
      const phraseSenses = Array.isArray(phrase.senses) ? phrase.senses as Array<Record<string, unknown>> : [];
      const translation = phraseSenses.map((sense) => typeof sense.word === "string" ? sense.word.trim() : "").filter(Boolean).join("；");
      if (text && translation) phrases.push({ text, translation });
      for (const sense of phraseSenses) collectYoudaoExamples(sense.examples, examples);
    }
  }

  const curatedSenses = uniqueSenses(senses).slice(0, 8);
  return {
    translation: curatedSenses[0]?.translation ?? "",
    pronunciation,
    partOfSpeech,
    definitions: curatedSenses.map((item) => item.definition),
    senses: curatedSenses,
    phrases: uniquePhrases(phrases),
    synonyms: [],
    antonyms: [],
    examples: examples.slice(0, 8)
  };
}

const contextStopWords = new Set(["a", "an", "and", "are", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "their", "to", "was", "were", "with"]);

function contextTokens(text: string): Set<string> {
  return new Set(text.toLocaleLowerCase().match(/[a-z]+/g)?.map((token) => token.length > 4 ? token.replace(/(?:ing|ed|es|s)$/i, "") : token).filter((token) => token.length > 2 && !contextStopWords.has(token)) ?? []);
}

const contextConcepts: Array<[string, RegExp]> = [
  ["adaptive-recovery", /\b(?:adapt\w*|recover\w*|change\w*|crisis|damage\w*|disrupt\w*|event\w*|condition\w*)\b/i],
  ["organization-or-person", /\b(?:compan(?:y|ies)|econom(?:y|ic|ics)|business(?:es)?|restaurant\w*|organi[sz]ation\w*|system\w*|team\w*|communit(?:y|ies)|famil(?:y|ies)|people|person\w*|human\w*|organism\w*)\b/i],
  ["physical-elasticity", /\b(?:shape\w*|force\w*|elastic\w*|object\w*|substance\w*|material\w*|floor\w*|spring\w*)\b/i],
  ["physical-movement", /\b(?:move\w*|leg\w*|foot|feet|road\w*|walk\w*|sprint\w*)\b/i],
  ["liquid-flow", /\b(?:flow\w*|tear\w*|water\w*|liquid\w*|stream\w*|river\w*|cheek\w*)\b/i]
];

function contextualMeaningTokens(text: string): Set<string> {
  const tokens = contextTokens(text);
  for (const [concept, pattern] of contextConcepts) {
    if (pattern.test(text)) tokens.add(concept);
  }
  return tokens;
}

export function matchContextSense(senses: WordSense[], context: string): number {
  if (!context.trim() || !senses.length) return -1;
  const sourceTokens = contextualMeaningTokens(context);
  let bestIndex = 0;
  let bestScore = 0;
  senses.forEach((sense, index) => {
    const score = [...contextualMeaningTokens(sense.definition)].reduce((total, token) => total + (sourceTokens.has(token) ? Math.max(token.length, 4) : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function prioritizeContextSense(result: EnrichmentResult, context: string): EnrichmentResult {
  const matchedIndex = matchContextSense(result.senses, context);
  if (matchedIndex <= 0) return { ...result, contextSenseIndex: matchedIndex };
  const senses = [...result.senses];
  const [matchedSense] = senses.splice(matchedIndex, 1);
  senses.unshift(matchedSense);
  return {
    ...result,
    senses,
    definitions: senses.map((sense) => sense.definition),
    contextSenseIndex: 0
  };
}

export function buildSupplementalContexts(word: string, senses: WordSense[], examples: WordExample[], collectedContext: string, limit = 3): Array<WordExample & { senseIndex: number }> {
  const normalizedCollected = collectedContext.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const candidates = [...new Map(examples
    .filter((example) => example.text.trim() && example.text.replace(/\s+/g, " ").trim().toLocaleLowerCase() !== normalizedCollected)
    .map((example) => [example.text.trim().toLocaleLowerCase(), { ...example, senseIndex: matchContextSense(senses, example.text) }])).values()];
  const selected: Array<WordExample & { senseIndex: number }> = [];
  const usedSenses = new Set<number>();
  for (const candidate of candidates) {
    if (candidate.senseIndex >= 0 && !usedSenses.has(candidate.senseIndex)) {
      selected.push(candidate);
      usedSenses.add(candidate.senseIndex);
      if (selected.length >= limit) return selected;
    }
  }
  for (const candidate of candidates) {
    if (!selected.includes(candidate)) selected.push(candidate);
    if (selected.length >= limit) break;
  }
  for (let index = 0; index < senses.length && selected.length < limit; index += 1) {
    if (usedSenses.has(index)) continue;
    const sense = senses[index];
    const definition = sense.definition.trim().replace(/[.!?]+$/g, "");
    const translation = sense.translation.trim().replace(/[。！？]+$/g, "");
    if (!definition) continue;
    selected.push({
      text: `In this context, "${word}" means ${definition.charAt(0).toLocaleLowerCase()}${definition.slice(1)}.`,
      translation: translation ? `这里的 ${word} 表示：${translation}。` : "",
      source: "context",
      senseIndex: index
    });
    usedSenses.add(index);
  }
  return selected;
}

export function mergeFallbackEnrichment(dictionary: EnrichmentResult, translationData: unknown): EnrichmentResult {
  const payload = translationData && typeof translationData === "object" ? translationData as Record<string, unknown> : {};
  const responseData = payload.responseData && typeof payload.responseData === "object" ? payload.responseData as Record<string, unknown> : {};
  return {
    ...dictionary,
    translation: typeof responseData.translatedText === "string" ? responseData.translatedText.trim() : "",
    provider: "free-dictionary"
  };
}

export function parseAiWordCard(text: string): EnrichmentResult {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI 未返回有效的词卡 JSON。");
  const parsed = aiWordCardSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
  return {
    ...parsed,
    definitions: unique(parsed.definitions, Number.POSITIVE_INFINITY),
    senses: uniqueSenses(parsed.senses.length ? parsed.senses : parsed.definitions.map((definition) => ({ partOfSpeech: parsed.partOfSpeech, definition, translation: "" }))),
    phrases: uniquePhrases(parsed.phrases),
    synonyms: unique(parsed.synonyms),
    antonyms: unique(parsed.antonyms),
    examples: parsed.examples.slice(0, 6),
    provider: "ai"
  };
}

export function applyEnrichment<T extends { enrichmentStatus: string; enrichmentProvider: string }>(word: T, result: EnrichmentResult): T & EnrichmentResult {
  return {
    ...word,
    ...result,
    enrichmentStatus: result.translation || result.definitions.length ? "ready" : "partial",
    enrichmentProvider: result.provider ?? "unknown"
  };
}
