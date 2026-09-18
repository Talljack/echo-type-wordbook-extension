import { describe, expect, it } from "vitest";
import { createWordDraft, normalizeSelection, upsertWord } from "../src/lib/words";

describe("normalizeSelection", () => {
  it("keeps one English word, including apostrophes and hyphens", () => {
    expect(normalizeSelection("  “state-of-the-art”  ")).toBe("state-of-the-art");
    expect(normalizeSelection("don't")).toBe("don't");
  });

  it("rejects empty selections and trims long selections to the first token", () => {
    expect(normalizeSelection("   ")).toBe("");
    expect(normalizeSelection("serendipity is everywhere")).toBe("serendipity");
  });
});

describe("word records", () => {
  it("creates a source-aware draft", () => {
    const draft = createWordDraft({
      word: "Resilient",
      bookId: "business",
      context: "A resilient company adapts.",
      sourceUrl: "https://example.com/story",
      sourceTitle: "Story",
      now: 100
    });

    expect(draft).toMatchObject({
      word: "resilient",
      bookId: "business",
      context: "A resilient company adapts.",
      encounters: 1,
      createdAt: 100,
      updatedAt: 100,
      enrichmentStatus: "pending"
    });
  });

  it("merges a duplicate in the same book and preserves enrichment", () => {
    const existing = createWordDraft({ word: "resilient", bookId: "business", now: 100 });
    existing.translation = "有韧性的";
    existing.enrichmentStatus = "ready";

    const result = upsertWord([existing], createWordDraft({
      word: "Resilient",
      bookId: "business",
      context: "New context",
      sourceUrl: "https://example.com/new",
      now: 200
    }));

    expect(result.created).toBe(false);
    expect(result.words).toHaveLength(1);
    expect(result.words[0]).toMatchObject({
      translation: "有韧性的",
      context: "New context",
      encounters: 2,
      updatedAt: 200,
      enrichmentStatus: "ready"
    });
  });
});
