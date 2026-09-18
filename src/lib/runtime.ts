import type { EnrichmentResult, PendingSelection } from "../types";

export async function readPageSelection(): Promise<PendingSelection | undefined> {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) return undefined;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) return undefined;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? "";
        const node = selection?.anchorNode;
        const parentText = node instanceof Element ? node.textContent : node?.parentElement?.textContent;
        return { word: text, context: (parentText ?? "").trim().slice(0, 500), sourceUrl: location.href, sourceTitle: document.title, capturedAt: Date.now() };
      }
    });
    return result?.result as PendingSelection | undefined;
  } catch {
    return undefined;
  }
}

export async function requestEnrichment(word: string, context: string): Promise<EnrichmentResult> {
  const response = await chrome.runtime.sendMessage({ type: "ENRICH_WORD", word, context });
  if (!response?.ok) throw new Error(response?.error || "词卡优化失败。");
  return response.result as EnrichmentResult;
}

export async function testAiConnection(config: unknown): Promise<EnrichmentResult> {
  const response = await chrome.runtime.sendMessage({ type: "TEST_AI", config });
  if (!response?.ok) throw new Error(response?.error || "连接测试失败。");
  return response.result as EnrichmentResult;
}
