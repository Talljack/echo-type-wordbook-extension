import type { WordEntry } from "../types";

const csvCell = (value: string) => /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export function exportCsv(words: WordEntry[], bookNames: Map<string, string>): string {
  const header = ["word", "translation", "wordbook", "partOfSpeech", "pronunciation", "definitions", "synonyms", "antonyms", "context", "sourceUrl"];
  const rows = words.map((word) => [
    word.word,
    word.translation,
    bookNames.get(word.bookId) ?? word.bookId,
    word.partOfSpeech,
    word.pronunciation,
    word.definitions.join(" | "),
    word.synonyms.join(" | "),
    word.antonyms.join(" | "),
    word.context,
    word.sourceUrl
  ].map(csvCell).join(","));
  return `\uFEFF${header.join(",")}\n${rows.join("\n")}`;
}

const cleanTsv = (value: string) => value.replace(/[\t\r\n]+/g, " ").trim();

export function exportAnkiTsv(words: WordEntry[]): string {
  return words.map((word) => {
    const back = [word.translation, word.definitions.join("<br>"), word.examples.map((item) => `${item.text}${item.translation ? ` — ${item.translation}` : ""}`).join("<br>")]
      .filter(Boolean)
      .join("<br>");
    return `${cleanTsv(word.word)}\t${cleanTsv(back)}\t${cleanTsv(word.bookId)}`;
  }).join("\n");
}

export function exportEchoTypeJson(words: WordEntry[], bookNames: Map<string, string>): string {
  const exportedAt = Date.now();
  const favorites = words.map((word) => ({
    id: word.id,
    normalizedText: word.word,
    text: word.word,
    type: "word",
    folderId: word.bookId,
    sourceContentId: word.sourceUrl || undefined,
    targetLang: "zh-CN",
    nextReview: undefined,
    autoCollected: false,
    createdAt: word.createdAt,
    updatedAt: word.updatedAt,
    metadata: { translation: word.translation, definitions: word.definitions, synonyms: word.synonyms, antonyms: word.antonyms, examples: word.examples, context: word.context }
  }));
  const contents = words.map((word) => ({
    id: `extension-${word.id}`,
    title: word.translation ? `${word.word} · ${word.translation}` : word.word,
    text: word.word,
    type: "word",
    category: bookNames.get(word.bookId) ?? word.bookId,
    tags: word.tags,
    source: "imported",
    createdAt: word.createdAt,
    updatedAt: word.updatedAt
  }));
  return JSON.stringify({ format: "echotype-wordbook-v1", exportedAt, favorites, contents }, null, 2);
}
