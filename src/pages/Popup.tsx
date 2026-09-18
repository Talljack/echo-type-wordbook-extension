import { BookOpen, Check, Settings, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { QuickAddForm } from "../components/QuickAddForm";
import { applyEnrichment } from "../lib/enrichment";
import { readPageSelection, requestEnrichment } from "../lib/runtime";
import { chromeStorage, createBook, getState, saveWord, setPendingSelection, updateWord } from "../lib/storage";
import { createWordDraft, normalizeSelection } from "../lib/words";
import type { ExtensionSettings, PendingSelection, WordBook, WordEntry } from "../types";

export function Popup() {
  const [books, setBooks] = useState<WordBook[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings>();
  const [selection, setSelection] = useState<PendingSelection>({ word: "", context: "", sourceUrl: "", sourceTitle: "", capturedAt: 0 });
  const [recent, setRecent] = useState<WordEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void (async () => {
      const state = await getState();
      const pageSelection = await readPageSelection();
      const pending = state.pendingSelection && Date.now() - state.pendingSelection.capturedAt < 10 * 60_000 ? state.pendingSelection : undefined;
      const selected = pageSelection?.word ? pageSelection : pending;
      setBooks(state.wordbooks);
      setSettings(state.settings);
      setRecent([...state.words].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3));
      if (selected) setSelection(selected);
    })();
  }, []);

  const handleCreateBook = async (name: string) => {
    const result = await createBook(chromeStorage(), name);
    setBooks(result.state.wordbooks);
    setSettings(result.state.settings);
  };

  const handleSave = async ({ word, bookId, context }: { word: string; bookId: string; context: string }) => {
    const normalized = normalizeSelection(word);
    if (!normalized) { setStatus("请输入一个英文单词。"); return; }
    setBusy(true);
    setStatus("");
    const draft = createWordDraft({ word: normalized, bookId, context, sourceUrl: selection.sourceUrl, sourceTitle: selection.sourceTitle });
    const saved = await saveWord(chromeStorage(), draft);
    let current = saved.word;
    setRecent([current, ...saved.state.words.filter((item) => item.id !== current.id)].slice(0, 3));
    await setPendingSelection(chromeStorage(), undefined);

    if (settings?.autoEnrich) {
      current = { ...current, enrichmentStatus: "enriching" };
      await updateWord(chromeStorage(), current);
      try {
        const enriched = applyEnrichment(current, await requestEnrichment(current.word, current.context));
        current = { ...enriched, updatedAt: Date.now() };
        await updateWord(chromeStorage(), current);
        setStatus(saved.created ? "已加入并完成词卡优化。" : "已更新出现次数与词卡信息。");
      } catch {
        current = { ...current, enrichmentStatus: "failed" };
        await updateWord(chromeStorage(), current);
        setStatus("单词已保存；优化暂时失败，可稍后在词书中重试。");
      }
    } else {
      setStatus(saved.created ? "已加入词书。" : "这个词已在词书中，出现次数已更新。");
    }
    setRecent((items) => items.map((item) => item.id === current.id ? current : item));
    setBusy(false);
  };

  const speak = (word: string) => {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(word));
  };

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div><p className="eyebrow">ECHOTYPE</p><h1>网页生词，随手成册</h1></div>
        <button className="icon-button" aria-label="AI 设置" onClick={() => chrome.runtime.openOptionsPage()}><Settings size={18} /></button>
      </header>

      {settings && <QuickAddForm books={books} initialBookId={settings.activeBookId} initialWord={selection.word} initialContext={selection.context} busy={busy} aiEnabled={settings.aiEnabled} onSave={handleSave} onCreateBook={handleCreateBook} />}

      {status && <p className="status-message" role="status"><Check size={16} />{status}</p>}

      <section className="recent-section">
        <div className="section-heading"><h2>最近收录</h2><button className="text-button" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("library.html") })}><BookOpen size={15} />查看全部</button></div>
        {recent.length ? recent.map((word) => (
          <article className="recent-word" key={word.id}>
            <button className="sound-button" aria-label={`朗读 ${word.word}`} onClick={() => speak(word.word)}><Volume2 size={16} /></button>
            <div><strong>{word.word}</strong><span>{word.translation || (word.enrichmentStatus === "enriching" ? "正在优化…" : "等待释义")}</span></div>
            <small>{books.find((book) => book.id === word.bookId)?.name}</small>
          </article>
        )) : <p className="empty-copy">在网页上选中一个单词，然后右键“加入 EchoType 词书”。</p>}
      </section>
    </main>
  );
}
