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
});
