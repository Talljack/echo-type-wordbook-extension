import { afterEach, describe, expect, it, vi } from "vitest";

const chromeMock = {
  runtime: {
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() }
  },
  contextMenus: {
    removeAll: vi.fn(),
    create: vi.fn(),
    onClicked: { addListener: vi.fn() }
  },
  action: { openPopup: vi.fn() },
  windows: { create: vi.fn() }
};

describe("free enrichment resilience", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("stores the Chinese meaning even when the English dictionary stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("chrome", chromeMock);
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("dictionaryapi.dev")) return new Promise<Response>(() => undefined);
      return Promise.resolve({
        ok: true,
        json: async () => {
          if (init?.signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
          return { responseData: { translatedText: "突然" } };
        }
      } as Response);
    }));

    const { enrichWithFreeServices } = await import("../src/background/index");
    const timedOut = Symbol("timed-out");
    const outcome = Promise.race([
      enrichWithFreeServices("suddenly"),
      new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), 6_000))
    ]);
    await vi.advanceTimersByTimeAsync(6_001);
    const result = await outcome;

    expect(result).not.toBe(timedOut);
    expect(result).toMatchObject({ translation: "突然" });
  });

  it("adds translated senses and common phrases without AI", async () => {
    vi.stubGlobal("chrome", chromeMock);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "api.dictionaryapi.dev") {
        return { ok: true, json: async () => [{
          phonetic: "/prəˈvaɪd/",
          meanings: [{
            partOfSpeech: "verb",
            definitions: [
              { definition: "Make something available for use." },
              { definition: "Supply someone with something." }
            ]
          }]
        }] } as Response;
      }
      if (url.hostname === "api.datamuse.com") {
        const payload = url.searchParams.has("rel_bga")
          ? [{ word: "information" }, { word: "support" }]
          : url.searchParams.get("md") === "dp"
            ? [{ word: "provide", tags: ["v"], defs: ["v\tMake something available for use."] }]
          : [{ word: "provide for" }, { word: "service provider" }];
        return { ok: true, json: async () => payload } as Response;
      }
      const query = url.searchParams.get("q") ?? "";
      const translations: Record<string, string> = {
        provide: "提供",
        "Make something available for use.": "使某物可供使用。",
        "Supply someone with something.": "向某人提供某物。",
        "provide information": "提供信息",
        "provide support": "提供支持",
        "provide for": "供养；为……做准备"
      };
      if (query === "provide information") {
        return { ok: true, json: async () => ({
          responseData: { translatedText: "错误翻译" },
          matches: [
            { translation: "错误翻译", quality: "74" },
            { translation: "提供信息", quality: "74" },
            { translation: "提供信息。", quality: "72" }
          ]
        }) } as Response;
      }
      return { ok: true, json: async () => ({ responseData: { translatedText: translations[query] ?? query } }) } as Response;
    }));

    const { enrichWithFreeServices } = await import("../src/background/index");
    const result = await enrichWithFreeServices("provide");

    expect(result.senses).toEqual([
      { partOfSpeech: "verb", definition: "Make something available for use.", translation: "使某物可供使用。" },
      { partOfSpeech: "verb", definition: "Supply someone with something.", translation: "向某人提供某物。" }
    ]);
    expect(result.phrases).toEqual(expect.arrayContaining([
      { text: "provide information", translation: "提供信息" },
      { text: "provide support", translation: "提供支持" },
      { text: "provide for", translation: "供养；为……做准备" }
    ]));
  });
});
