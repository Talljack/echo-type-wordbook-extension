import { BookPlus, FolderPlus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { WordBook } from "../types";

interface QuickAddValue {
  word: string;
  bookId: string;
  context: string;
}

interface QuickAddFormProps {
  books: WordBook[];
  initialBookId: string;
  initialWord: string;
  initialContext: string;
  busy?: boolean;
  aiEnabled?: boolean;
  onSave(value: QuickAddValue): Promise<void>;
  onCreateBook(name: string): Promise<void> | void;
}

export function QuickAddForm({ books, initialBookId, initialWord, initialContext, busy = false, aiEnabled = false, onSave, onCreateBook }: QuickAddFormProps) {
  const [word, setWord] = useState(initialWord);
  const [bookId, setBookId] = useState(initialBookId);
  const [context, setContext] = useState(initialContext);
  const [creatingBook, setCreatingBook] = useState(false);
  const [bookName, setBookName] = useState("");

  useEffect(() => setWord(initialWord), [initialWord]);
  useEffect(() => setContext(initialContext), [initialContext]);
  useEffect(() => setBookId(initialBookId), [initialBookId]);

  const create = async () => {
    if (!bookName.trim()) return;
    await onCreateBook(bookName.trim());
    setBookName("");
    setCreatingBook(false);
  };

  return (
    <form className="quick-form" onSubmit={(event) => { event.preventDefault(); void onSave({ word, bookId, context }); }}>
      <label className="field word-field">
        <span>英文单词</span>
        <input value={word} onChange={(event) => setWord(event.target.value)} placeholder="选中网页单词，或在这里输入" autoFocus />
      </label>

      <div className="field-row">
        <label className="field grow">
          <span>保存到词书</span>
          <select value={bookId} onChange={(event) => setBookId(event.target.value)}>
            {books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
          </select>
        </label>
        <button className="icon-button align-end" type="button" aria-label="新建词书" title="新建词书" onClick={() => setCreatingBook((value) => !value)}><FolderPlus size={18} /></button>
      </div>

      {creatingBook && (
        <div className="inline-create">
          <input aria-label="新词书名称" value={bookName} onChange={(event) => setBookName(event.target.value)} placeholder="如：影视英语" />
          <button type="button" className="secondary-button" onClick={() => void create()}>创建</button>
        </div>
      )}

      <label className="field">
        <span>网页语境 <small>可选</small></span>
        <textarea value={context} onChange={(event) => setContext(event.target.value)} rows={3} placeholder="保留这个词出现时的句子" />
      </label>

      <div className="enrich-hint">
        <Sparkles size={16} aria-hidden="true" />
        <span>{aiEnabled ? "将用 AI 补全中英释义、近反义词与场景例句" : "将用免费词典补全释义、发音与相关词"}</span>
      </div>

      <button className="primary-button full-width" type="submit" disabled={!word.trim() || !bookId || busy}>
        <BookPlus size={18} />
        {busy ? "正在制作词卡…" : "加入词书"}
      </button>
    </form>
  );
}
