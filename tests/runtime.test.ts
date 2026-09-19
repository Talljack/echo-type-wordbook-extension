import { afterEach, describe, expect, it, vi } from "vitest";
import { readPageSelection, requestEnrichment } from "../src/lib/runtime";

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

  it("captures the surrounding block when the selected word is wrapped in an inline element", async () => {
    document.body.innerHTML = `<p><strong>Running</strong> is a method of locomotion by which humans move quickly on foot.</p>`;
    const selectedNode = document.querySelector("strong")?.firstChild;
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "Running",
      anchorNode: selectedNode
    } as Selection);
    const executeScript = vi.fn(async ({ func }: { func: () => unknown }) => [{ result: func() }]);
    vi.stubGlobal("chrome", {
      tabs: { query: vi.fn().mockResolvedValue([{ id: 7, url: "https://example.com/running" }]) },
      scripting: { executeScript }
    });

    const selection = await readPageSelection();

    expect(selection).toEqual(expect.objectContaining({
      word: "Running",
      context: "Running is a method of locomotion by which humans move quickly on foot."
    }));
  });
});
