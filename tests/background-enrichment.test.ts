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
          ? [{ word: "adequate", tags: ["adj", "v"] }, { word: "information", tags: ["n"] }, { word: "support", tags: ["n"] }, { word: "him", tags: ["n"] }]
          : url.searchParams.get("md") === "dp"
            ? [{ word: "provide", tags: ["v"], defs: ["v\tMake something available for use."] }]
          : [{ word: "provide for" }, { word: "service provider" }];
        return { ok: true, json: async () => payload } as Response;
      }
      const query = url.searchParams.get("q") ?? "";
      if (url.hostname === "dict.youdao.com") {
        const translations: Record<string, string> = {
          "provide support": "提供支持：为某人或某事物提供帮助。",
          "provide for": "v. 供养；为……做准备"
        };
        return { ok: true, json: async () => translations[query] ? {
          ec: { word: [{ trs: [{ tr: [{ l: { i: [translations[query]] } }] }] }] }
        } : {} } as Response;
      }
      const translations: Record<string, string> = {
        provide: "提供",
        "Make something available for use.": "使某物可供使用。",
        "Supply someone with something.": "向某人提供某物。",
        "provide information": "提供信息",
        "provide support": "接应",
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
      { text: "provide for", translation: "供养" }
    ]));
    expect(result.phrases.map((phrase) => phrase.text)).not.toContain("provide adequate");
    expect(result.phrases).toContainEqual({ text: "provide support", translation: "提供支持" });
    expect(result.phrases.map((phrase) => phrase.text)).not.toContain("provide such");
    expect(result.phrases.map((phrase) => phrase.text)).not.toContain("provide him");
  });

  it("prefers the common word meaning and the highest-match phrase translation", async () => {
    vi.stubGlobal("chrome", chromeMock);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "api.dictionaryapi.dev") return { ok: false, status: 404 } as Response;
      if (url.hostname === "freedictionaryapi.com") return { ok: false, status: 404 } as Response;
      if (url.hostname === "api.datamuse.com") {
        if (url.searchParams.get("md") === "dp") return { ok: true, json: async () => [{ word: "run", tags: ["v"], defs: ["v\tTo move swiftly."] }] } as Response;
        if (url.searchParams.has("rel_bga")) return { ok: true, json: async () => [] } as Response;
        return { ok: true, json: async () => [{ word: "run through" }] } as Response;
      }
      const query = url.searchParams.get("q") ?? "";
      if (query === "run") return { ok: true, json: async () => ({
        responseData: { translatedText: "得分" },
        matches: [
          { translation: "得分", match: 1, quality: "74", "usage-count": 5 },
          { translation: "跑步", match: 0.99, quality: "74", "usage-count": 6 }
        ]
      }) } as Response;
      if (query === "run through") return { ok: true, json: async () => ({
        responseData: { translatedText: "贯穿始终" },
        matches: [
          { translation: "贯穿始终", match: 0.85, quality: "70", "usage-count": 2 },
          { translation: "钻龙肚", match: 0.54, quality: "74", "usage-count": 2 }
        ]
      }) } as Response;
      return { ok: true, json: async () => ({ responseData: { translatedText: "快速移动" } }) } as Response;
    }));

    const { enrichWithFreeServices } = await import("../src/background/index");
    const result = await enrichWithFreeServices("run");
    expect(result.translation).toBe("跑步");
    expect(result.phrases).toContainEqual({ text: "run through", translation: "贯穿始终" });
  });
});
