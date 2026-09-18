import type { WordEntry } from "../types";

interface DraftInput {
  word: string;
  bookId: string;
  context?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  now?: number;
}

const WORD_PATTERN = /[\p{L}]+(?:[’'-][\p{L}]+)*/u;

export function normalizeSelection(value: string): string {
  const normalized = String(value ?? "").normalize("NFKC").trim();
  if (!normalized) return "";
  return normalized.match(WORD_PATTERN)?.[0]?.replaceAll("’", "'").toLocaleLowerCase("en-US") ?? "";
}

function createId(word: string, bookId: string, now: number): string {
  const safeWord = word.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 36) || "word";
  return `${bookId}-${safeWord}-${now.toString(36)}`;
}

export function createWordDraft(input: DraftInput): WordEntry {
  const now = input.now ?? Date.now();
  const word = normalizeSelection(input.word);
  return {
    id: createId(word, input.bookId, now),
    word,
    bookId: input.bookId,
    translation: "",
    pronunciation: "",
    partOfSpeech: "",
    definitions: [],
    senses: [],
    phrases: [],
    synonyms: [],
    antonyms: [],
    examples: [],
    context: input.context?.trim() ?? "",
    sourceUrl: input.sourceUrl?.trim() ?? "",
    sourceTitle: input.sourceTitle?.trim() ?? "",
    note: "",
    tags: [],
    encounters: 1,
    mastery: 0,
    enrichmentStatus: "pending",
    enrichmentProvider: "",
    createdAt: now,
    updatedAt: now
  };
}

export function upsertWord(words: WordEntry[], incoming: WordEntry): { words: WordEntry[]; word: WordEntry; created: boolean } {
  const index = words.findIndex((item) => item.bookId === incoming.bookId && item.word === incoming.word);
  if (index < 0) return { words: [incoming, ...words], word: incoming, created: true };

  const previous = words[index];
  const merged: WordEntry = {
    ...previous,
    context: incoming.context || previous.context,
    sourceUrl: incoming.sourceUrl || previous.sourceUrl,
    sourceTitle: incoming.sourceTitle || previous.sourceTitle,
    encounters: previous.encounters + 1,
    updatedAt: incoming.updatedAt
  };
  const next = [...words];
  next[index] = merged;
  return { words: next, word: merged, created: false };
}

export function filterWords(words: WordEntry[], query: string, bookId?: string): WordEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  return words
    .filter((word) => !bookId || bookId === "all" || word.bookId === bookId)
    .filter((word) => !needle || [word.word, word.translation, word.note, ...word.tags, ...word.definitions,
      ...(word.senses ?? []).flatMap((sense) => [sense.definition, sense.translation]),
      ...(word.phrases ?? []).flatMap((phrase) => [phrase.text, phrase.translation])]
      .some((value) => value.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
