import { describe, expect, it } from "vitest";
import { chromeStorage, createBook, initializeStorage, saveWord, setPendingSelection } from "../src/lib/storage";
import type { StorageArea } from "../src/lib/storage";
import { createWordDraft } from "../src/lib/words";

function memoryStorage(seed: Record<string, unknown> = {}): StorageArea {
  const state = { ...seed };
  return {
    async get(keys) {
      const wanted = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(wanted.filter((key) => key in state).map((key) => [key, state[key]]));
    },
    async set(items) {
      Object.assign(state, items);
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key];
    }
  };
}

describe("storage", () => {
  it("uses localStorage as a development preview fallback", async () => {
    localStorage.clear();
    const area = chromeStorage();
    await area.set({ preview: "ready" });
    expect(await area.get("preview")).toEqual({ preview: "ready" });
  });

  it("removes a consumed pending selection without leaving invalid storage", async () => {
    localStorage.clear();
    const area = chromeStorage();
    await setPendingSelection(area, { word: "resilient", context: "", sourceUrl: "", sourceTitle: "", capturedAt: 1 });
    await setPendingSelection(area, undefined);
    expect(await area.get("pendingSelection")).toEqual({});
  });

  it("recovers from invalid preview storage values", async () => {
    localStorage.setItem("echotype:pendingSelection", "undefined");
    expect(await chromeStorage().get("pendingSelection")).toEqual({});
  });

  it("initializes default wordbooks and settings without overwriting existing data", async () => {
    const area = memoryStorage({ words: [{ id: "kept" }] });
    const state = await initializeStorage(area, 100);
    expect(state.wordbooks.map((book) => book.name)).toEqual(["日常", "商务", "学术"]);
    expect(state.settings).toMatchObject({ activeBookId: "daily", autoEnrich: true, aiEnabled: false });
    expect(state.words).toEqual([{ id: "kept" }]);
  });

  it("creates a custom wordbook and makes it active", async () => {
    const area = memoryStorage();
    await initializeStorage(area, 100);
    const result = await createBook(area, "影视英语", "#ef4444", 200);
    expect(result.book.name).toBe("影视英语");
    expect(result.state.settings.activeBookId).toBe(result.book.id);
  });

  it("persists duplicate encounters as one word", async () => {
    const area = memoryStorage();
    await initializeStorage(area, 100);
    await saveWord(area, createWordDraft({ word: "resilient", bookId: "daily", now: 200 }));
    const result = await saveWord(area, createWordDraft({ word: "Resilient", bookId: "daily", now: 300 }));
    expect(result.created).toBe(false);
    expect(result.state.words).toHaveLength(1);
    expect(result.word.encounters).toBe(2);
  });
});
