import type { ExtensionSettings, PendingSelection, WordBook, WordEntry } from "../types";
import { upsertWord } from "./words";

export interface StorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface ExtensionState {
  wordbooks: WordBook[];
  words: WordEntry[];
  settings: ExtensionSettings;
  pendingSelection?: PendingSelection;
}

const DEFAULT_BOOKS = (now: number): WordBook[] => [
  { id: "daily", name: "日常", color: "#4f46e5", description: "高频生活表达与日常阅读生词", createdAt: now, updatedAt: now },
  { id: "business", name: "商务", color: "#0f766e", description: "会议、邮件、谈判和行业表达", createdAt: now, updatedAt: now },
  { id: "academic", name: "学术", color: "#b45309", description: "论文、课程与知识阅读词汇", createdAt: now, updatedAt: now }
];

const DEFAULT_SETTINGS: ExtensionSettings = {
  activeBookId: "daily",
  autoEnrich: true,
  aiEnabled: false,
  aiProvider: { providerId: "openai", apiKey: "", baseUrl: "", model: "gpt-4.1-mini" }
};

export function chromeStorage(): StorageArea {
  if (typeof chrome !== "undefined" && chrome.storage?.local) return chrome.storage.local as unknown as StorageArea;
  return {
    async get(keys) {
      const wanted = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(wanted.flatMap((key) => {
        const raw = localStorage.getItem(`echotype:${key}`);
        if (raw === null) return [];
        try { return [[key, JSON.parse(raw)]]; }
        catch { localStorage.removeItem(`echotype:${key}`); return []; }
      }));
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        if (value === undefined) localStorage.removeItem(`echotype:${key}`);
        else localStorage.setItem(`echotype:${key}`, JSON.stringify(value));
      }
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) localStorage.removeItem(`echotype:${key}`);
    }
  };
}

export async function initializeStorage(area: StorageArea = chromeStorage(), now = Date.now()): Promise<ExtensionState> {
  const saved = await area.get(["wordbooks", "words", "settings", "pendingSelection"]);
  const wordbooks = Array.isArray(saved.wordbooks) ? saved.wordbooks as WordBook[] : DEFAULT_BOOKS(now);
  const words = Array.isArray(saved.words) ? saved.words as WordEntry[] : [];
  const settings = saved.settings && typeof saved.settings === "object"
    ? { ...DEFAULT_SETTINGS, ...(saved.settings as Partial<ExtensionSettings>), aiProvider: { ...DEFAULT_SETTINGS.aiProvider, ...(saved.settings as Partial<ExtensionSettings>).aiProvider } }
    : DEFAULT_SETTINGS;
  const next: ExtensionState = {
    wordbooks,
    words,
    settings,
    ...(saved.pendingSelection && typeof saved.pendingSelection === "object" ? { pendingSelection: saved.pendingSelection as PendingSelection } : {})
  };
  await area.set({ wordbooks, words, settings });
  return next;
}

export async function getState(area: StorageArea = chromeStorage()): Promise<ExtensionState> {
  return initializeStorage(area);
}

function bookId(name: string, now: number): string {
  const slug = name.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 28);
  return `${slug || "book"}-${now.toString(36)}`;
}

export async function createBook(area: StorageArea, name: string, color = "#4f46e5", now = Date.now()) {
  const state = await getState(area);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("词书名称不能为空。");
  if (state.wordbooks.some((book) => book.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) throw new Error("同名词书已存在。");
  const book: WordBook = { id: bookId(trimmed, now), name: trimmed, color, description: "自定义词书", createdAt: now, updatedAt: now };
  const next: ExtensionState = { ...state, wordbooks: [...state.wordbooks, book], settings: { ...state.settings, activeBookId: book.id } };
  await area.set({ wordbooks: next.wordbooks, settings: next.settings });
  return { book, state: next };
}

export async function updateBook(area: StorageArea, book: WordBook) {
  const state = await getState(area);
  const wordbooks = state.wordbooks.map((item) => item.id === book.id ? { ...book, updatedAt: Date.now() } : item);
  await area.set({ wordbooks });
  return { ...state, wordbooks };
}

export async function deleteBook(area: StorageArea, id: string) {
  const state = await getState(area);
  if (state.wordbooks.length <= 1) throw new Error("至少保留一本词书。");
  const wordbooks = state.wordbooks.filter((book) => book.id !== id);
  const fallbackId = wordbooks[0].id;
  const words = state.words.map((word) => word.bookId === id ? { ...word, bookId: fallbackId, updatedAt: Date.now() } : word);
  const settings = { ...state.settings, activeBookId: state.settings.activeBookId === id ? fallbackId : state.settings.activeBookId };
  await area.set({ wordbooks, words, settings });
  return { ...state, wordbooks, words, settings };
}

export async function saveWord(area: StorageArea, incoming: WordEntry) {
  const state = await getState(area);
  const result = upsertWord(state.words, incoming);
  await area.set({ words: result.words });
  return { ...result, state: { ...state, words: result.words } };
}

export async function updateWord(area: StorageArea, word: WordEntry) {
  const state = await getState(area);
  const words = state.words.map((item) => item.id === word.id ? { ...word, updatedAt: Date.now() } : item);
  await area.set({ words });
  return { ...state, words };
}

export async function removeWord(area: StorageArea, id: string) {
  const state = await getState(area);
  const words = state.words.filter((word) => word.id !== id);
  await area.set({ words });
  return { ...state, words };
}

export async function saveSettings(area: StorageArea, settings: ExtensionSettings) {
  await area.set({ settings });
  return settings;
}

export async function setPendingSelection(area: StorageArea, selection?: PendingSelection) {
  if (selection) await area.set({ pendingSelection: selection });
  else await area.remove("pendingSelection");
}
