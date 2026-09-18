import { z } from "zod";
import type { EnrichmentResult, WordExample } from "../types";

const exampleSchema = z.object({
  text: z.string().trim().min(1),
  translation: z.string().trim().default(""),
  source: z.enum(["dictionary", "daily", "business", "movie", "context", "ai"]).default("ai")
});

const aiWordCardSchema = z.object({
  translation: z.string().trim().default(""),
  pronunciation: z.string().trim().default(""),
  partOfSpeech: z.string().trim().default(""),
  definitions: z.array(z.string().trim()).default([]),
  synonyms: z.array(z.string().trim()).default([]),
  antonyms: z.array(z.string().trim()).default([]),
  examples: z.array(exampleSchema).default([])
});

const unique = (items: string[], limit = 12) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit);

export function parseDictionaryEntry(data: unknown): EnrichmentResult {
  const entry = Array.isArray(data) && data[0] && typeof data[0] === "object" ? data[0] as Record<string, unknown> : {};
  const meanings = Array.isArray(entry.meanings) ? entry.meanings as Array<Record<string, unknown>> : [];
  const definitions: string[] = [];
  const synonyms: string[] = [];
  const antonyms: string[] = [];
  const examples: WordExample[] = [];

  for (const meaning of meanings) {
    if (Array.isArray(meaning.synonyms)) synonyms.push(...meaning.synonyms.filter((item): item is string => typeof item === "string"));
    if (Array.isArray(meaning.antonyms)) antonyms.push(...meaning.antonyms.filter((item): item is string => typeof item === "string"));
    if (!Array.isArray(meaning.definitions)) continue;
    for (const raw of meaning.definitions as Array<Record<string, unknown>>) {
      if (typeof raw.definition === "string") definitions.push(raw.definition);
      if (typeof raw.example === "string") examples.push({ text: raw.example, translation: "", source: "dictionary" });
      if (Array.isArray(raw.synonyms)) synonyms.push(...raw.synonyms.filter((item): item is string => typeof item === "string"));
      if (Array.isArray(raw.antonyms)) antonyms.push(...raw.antonyms.filter((item): item is string => typeof item === "string"));
    }
  }

  return {
    pronunciation: typeof entry.phonetic === "string" ? entry.phonetic : "",
    partOfSpeech: typeof meanings[0]?.partOfSpeech === "string" ? meanings[0].partOfSpeech : "",
    definitions: unique(definitions, 5),
    synonyms: unique(synonyms),
    antonyms: unique(antonyms),
    examples: examples.slice(0, 5)
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
    definitions: unique(parsed.definitions, 5),
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
