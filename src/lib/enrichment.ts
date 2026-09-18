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

  return {
    pronunciation,
    partOfSpeech,
    definitions: unique(definitions, Number.POSITIVE_INFINITY),
    senses: uniqueSenses(senses),
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
  return {
    pronunciation: "",
    partOfSpeech: senses[0]?.partOfSpeech ?? fallbackPart,
    definitions: unique(senses.map((item) => item.definition), Number.POSITIVE_INFINITY),
    senses: uniqueSenses(senses),
    phrases: [],
    synonyms: [],
    antonyms: [],
    examples: []
  };
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
