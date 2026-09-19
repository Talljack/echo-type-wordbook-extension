import { BookOpen, Download, ExternalLink, FolderPlus, RefreshCw, Search, Settings, Trash2, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { downloadText } from "../lib/download";
import { applyEnrichment, buildSupplementalContexts } from "../lib/enrichment";
import { exportAnkiTsv, exportCsv, exportEchoTypeJson } from "../lib/export";
import { requestEnrichment } from "../lib/runtime";
import { chromeStorage, createBook, deleteBook, getState, removeWord, updateWord } from "../lib/storage";
import { filterWords } from "../lib/words";
import type { WordBook, WordEntry } from "../types";

export function Library() {
  const [books, setBooks] = useState<WordBook[]>([]);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [bookId, setBookId] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [newBookName, setNewBookName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const state = await getState();
    setBooks(state.wordbooks);
    setWords(state.words);
    setSelectedId((id) => id && state.words.some((word) => word.id === id) ? id : state.words[0]?.id ?? "");
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => filterWords(words, query, bookId), [words, query, bookId]);
  const selected = words.find((word) => word.id === selectedId) ?? filtered[0];
  const supplementalContexts = selected ? buildSupplementalContexts(selected.word, selected.senses ?? [], selected.examples ?? [], selected.context, 3) : [];
  const supplementalText = new Set(supplementalContexts.map((item) => item.text));
  const remainingExamples = selected?.examples.filter((item) => !supplementalText.has(item.text)) ?? [];
  const counts = useMemo(() => new Map(books.map((book) => [book.id, words.filter((word) => word.bookId === book.id).length])), [books, words]);

  const patchWord = async (patch: Partial<WordEntry>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    const state = await updateWord(chromeStorage(), next);
    setWords(state.words);
    setStatus("修改已保存。");
  };

  const enrich = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus("正在优化词卡…");
    try {
      const next = { ...applyEnrichment(selected, await requestEnrichment(selected.word, selected.context, selected.id)), updatedAt: Date.now() };
      const state = await updateWord(chromeStorage(), next);
      setWords(state.words);
      setStatus("词卡已更新。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "优化失败。");
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!newBookName.trim()) return;
    const result = await createBook(chromeStorage(), newBookName);
    setBooks(result.state.wordbooks);
    setNewBookName("");
    setBookId(result.book.id);
  };

  const removeBookById = async (id: string) => {
    if (!confirm("删除词书后，其中单词会移动到第一本词书。继续吗？")) return;
    try {
      const state = await deleteBook(chromeStorage(), id);
      setBooks(state.wordbooks); setWords(state.words); setBookId("all");
    } catch (error) { setStatus(error instanceof Error ? error.message : "删除失败。"); }
  };

  const removeSelected = async () => {
    if (!selected || !confirm(`从词书中删除 “${selected.word}”？`)) return;
    const state = await removeWord(chromeStorage(), selected.id);
    setWords(state.words); setSelectedId(state.words[0]?.id ?? "");
  };

  const exportWords = (format: "csv" | "anki" | "echotype") => {
    const scoped = bookId === "all" ? words : words.filter((word) => word.bookId === bookId);
    const names = new Map(books.map((book) => [book.id, book.name]));
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") downloadText(`wordbook-${stamp}.csv`, exportCsv(scoped, names), "text/csv;charset=utf-8");
    if (format === "anki") downloadText(`wordbook-anki-${stamp}.tsv`, exportAnkiTsv(scoped), "text/tab-separated-values;charset=utf-8");
    if (format === "echotype") downloadText(`wordbook-${stamp}.json`, exportEchoTypeJson(scoped, names), "application/json;charset=utf-8");
  };

  const speak = (word: string) => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(word)); };

  return (
    <main className="library-shell">
      <header className="library-topbar">
        <div className="brand-lockup"><span className="brand-mark">W</span><div><p className="eyebrow">WORDBOOK COLLECTOR</p><h1>我的词书</h1></div></div>
        <div className="topbar-actions">
          <div className="export-menu">
            <Download size={17} /><span>导出</span>
            <button onClick={() => exportWords("csv")}>CSV</button><button onClick={() => exportWords("anki")}>Anki</button><button onClick={() => exportWords("echotype")}>JSON</button>
          </div>
          <button className="icon-button" aria-label="AI 设置" onClick={() => chrome.runtime.openOptionsPage()}><Settings size={19} /></button>
        </div>
      </header>

      <div className="library-grid">
        <aside className="book-rail">
          <button className={`book-row ${bookId === "all" ? "active" : ""}`} onClick={() => setBookId("all")}><BookOpen size={17} /><span>全部单词</span><b>{words.length}</b></button>
          <p className="rail-label">词书</p>
          {books.map((book) => (
            <div className={`book-row-wrap ${bookId === book.id ? "active" : ""}`} key={book.id}>
              <button className="book-row" onClick={() => setBookId(book.id)}><i style={{ backgroundColor: book.color }} /><span>{book.name}</span><b>{counts.get(book.id) ?? 0}</b></button>
              <button className="mini-delete" aria-label={`删除词书 ${book.name}`} onClick={() => void removeBookById(book.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          <div className="book-create"><input aria-label="新词书名称" value={newBookName} onChange={(event) => setNewBookName(event.target.value)} placeholder="新建词书" onKeyDown={(event) => { if (event.key === "Enter") void create(); }} /><button aria-label="创建词书" onClick={() => void create()}><FolderPlus size={16} /></button></div>
        </aside>

        <section className="word-list-pane">
          <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词、中文或笔记" /></label>
          <div className="list-summary"><strong>{filtered.length}</strong> 个单词 <span>· 最近更新优先</span></div>
          <div className="word-list">
            {filtered.map((word) => (
              <button key={word.id} className={`word-row ${selected?.id === word.id ? "selected" : ""}`} onClick={() => setSelectedId(word.id)}>
                <div><strong>{word.word}</strong><span>{word.pronunciation}</span></div>
                <p>{word.translation || word.definitions[0] || "等待优化"}</p>
                <small className={`status-dot ${word.enrichmentStatus}`} title={word.enrichmentStatus} />
              </button>
            ))}
            {!filtered.length && <div className="empty-state"><BookOpen size={28} /><h2>这里还没有单词</h2><p>在网页中选词并使用右键菜单即可收录。</p></div>}
          </div>
        </section>

        <section className="detail-pane">
          {selected ? <>
            <div className="detail-heading">
              <div><div className="word-title-line"><h2>{selected.word}</h2><button className="sound-button" aria-label={`朗读 ${selected.word}`} onClick={() => speak(selected.word)}><Volume2 size={18} /></button></div><p>{selected.pronunciation} {selected.partOfSpeech && <em>{selected.partOfSpeech}</em>}</p></div>
              <button className="icon-button danger" aria-label="删除单词" onClick={() => void removeSelected()}><Trash2 size={18} /></button>
            </div>
            <label className="field"><span>核心释义（可编辑）</span><input value={selected.translation} onChange={(event) => setWords((items) => items.map((item) => item.id === selected.id ? { ...item, translation: event.target.value } : item))} onBlur={(event) => void patchWord({ translation: event.target.value })} /></label>
            {!!selected.senses?.length && <DetailSection title="完整释义"><div className="sense-list">{selected.senses.map((item, index) => <div className="sense-row" key={`${item.partOfSpeech}-${item.definition}`}><span className="sense-number">{index + 1}</span><div className="sense-copy">{item.partOfSpeech && <small>{item.partOfSpeech}</small>}<strong>{item.translation || "中文释义暂缺"}</strong><p>{item.definition}</p></div></div>)}</div></DetailSection>}
            {!selected.senses?.length && !!selected.definitions.length && <DetailSection title="英文释义">{selected.definitions.map((item, index) => <p key={item}><b>{index + 1}.</b> {item}</p>)}</DetailSection>}
            {!!selected.phrases?.length && <DetailSection title="常用短语"><div className="phrase-list">{selected.phrases.map((item) => <div className="phrase-row" key={item.text}><strong>{item.text}</strong><span>{item.translation}</span></div>)}</div></DetailSection>}
            {!!selected.synonyms.length && <DetailSection title="近义词"><div className="chips">{selected.synonyms.map((item) => <span key={item}>{item}</span>)}</div></DetailSection>}
            {!!selected.antonyms.length && <DetailSection title="反义词"><div className="chips antonym">{selected.antonyms.map((item) => <span key={item}>{item}</span>)}</div></DetailSection>}
            {!!remainingExamples.length && <DetailSection title="更多场景例句">{remainingExamples.map((item) => <blockquote key={item.text}><small>{item.source}</small><p>{item.text}</p>{item.translation && <span>{item.translation}</span>}</blockquote>)}</DetailSection>}
            {(selected.context || supplementalContexts.length > 0) && <DetailSection title={`收藏语境（${(selected.context ? 1 : 0) + supplementalContexts.length}）`}><div className="context-stack">{selected.context && <blockquote className="source-quote"><small className="context-sense">网页原句{typeof selected.contextSenseIndex === "number" && selected.contextSenseIndex >= 0 && selected.senses?.[selected.contextSenseIndex] ? ` · 对应释义 ${selected.contextSenseIndex + 1} · ${selected.senses[selected.contextSenseIndex].translation}` : ""}</small><p>{selected.context}</p>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">查看来源 <ExternalLink size={13} /></a>}</blockquote>}{supplementalContexts.map((item) => <blockquote className="source-quote supplemental-context" key={item.text}><small className="context-sense">补充语境{item.senseIndex >= 0 && selected.senses?.[item.senseIndex] ? ` · 对应释义 ${item.senseIndex + 1} · ${selected.senses[item.senseIndex].translation}` : ""}</small><p>{item.text}</p>{item.translation && <span>{item.translation}</span>}</blockquote>)}</div></DetailSection>}
            <label className="field"><span>学习笔记</span><textarea rows={3} value={selected.note} placeholder="写下记忆方法或易错点" onChange={(event) => setWords((items) => items.map((item) => item.id === selected.id ? { ...item, note: event.target.value } : item))} onBlur={(event) => void patchWord({ note: event.target.value })} /></label>
            <label className="field"><span>熟悉度</span><select value={selected.mastery} onChange={(event) => void patchWord({ mastery: Number(event.target.value) as WordEntry["mastery"] })}><option value="0">新词</option><option value="1">初见</option><option value="2">学习中</option><option value="3">熟悉</option><option value="4">已掌握</option></select></label>
            <button className="secondary-button full-width" disabled={busy} onClick={() => void enrich()}><RefreshCw size={17} className={busy ? "spin" : ""} />{busy ? "正在优化…" : "重新优化词卡"}</button>
            {status && <p className="status-message" role="status">{status}</p>}
          </> : <div className="empty-state"><BookOpen size={32} /><h2>选择一个单词</h2><p>查看释义、相关词和例句。</p></div>}
        </section>
      </div>
    </main>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h3>{title}</h3>{children}</section>;
}
