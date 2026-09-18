import { afterEach, describe, expect, it, vi } from "vitest";
import { requestEnrichment } from "../src/lib/runtime";

describe("runtime enrichment requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the stored word id so background enrichment can persist after the popup closes", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      result: { translation: "突然", definitions: [], synonyms: [], antonyms: [], examples: [] }
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await requestEnrichment("suddenly", "A sentence with suddenly.", "word-123");

    expect(sendMessage).toHaveBeenCalledWith({
      type: "ENRICH_WORD",
      word: "suddenly",
      context: "A sentence with suddenly.",
      wordId: "word-123"
    });
  });
});
