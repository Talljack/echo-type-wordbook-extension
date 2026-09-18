import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, Sparkles, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PROVIDERS } from "../lib/providers";
import { testAiConnection } from "../lib/runtime";
import { chromeStorage, getState, saveSettings } from "../lib/storage";
import type { ExtensionSettings } from "../types";

export function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>();
  const [status, setStatus] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => { void getState().then((state) => setSettings(state.settings)); }, []);
  if (!settings) return <main className="options-shell"><p>正在读取设置…</p></main>;

  const definition = PROVIDERS[settings.aiProvider.providerId] ?? PROVIDERS.openai;
  const setProvider = (providerId: string) => {
    const next = PROVIDERS[providerId];
    setSettings({ ...settings, aiProvider: { providerId, apiKey: "", baseUrl: next.editableBaseUrl ? next.baseUrl : "", model: next.defaultModel } });
  };
  const patchProvider = (patch: Partial<ExtensionSettings["aiProvider"]>) => setSettings({ ...settings, aiProvider: { ...settings.aiProvider, ...patch } });
  const save = async () => { await saveSettings(chromeStorage(), settings); setStatus("设置已安全保存在本机浏览器中。"); };
  const test = async () => {
    setTesting(true); setStatus("正在测试连接并生成示例词卡…");
    try { const result = await testAiConnection(settings.aiProvider); setStatus(`连接成功：resilient → ${result.translation || "已生成词卡"}`); }
    catch (error) { setStatus(error instanceof Error ? error.message : "连接失败。"); }
    finally { setTesting(false); }
  };

  return (
    <main className="options-shell">
      <button className="text-button back-link" onClick={() => history.back()}><ArrowLeft size={16} />返回</button>
      <header className="options-header"><p className="eyebrow">ECHOTYPE WORDBOOK</p><h1>AI 词卡优化</h1><p>配置后，每次收词会自动补全中英释义、IPA、近反义词，以及日常、商务、影视场景例句。</p></header>

      <section className="settings-section">
        <div className="settings-title"><Sparkles size={21} /><div><h2>自动优化</h2><p>未配置 AI 时自动使用免费词典和翻译服务。</p></div><label className="switch"><input type="checkbox" checked={settings.autoEnrich} onChange={(event) => setSettings({ ...settings, autoEnrich: event.target.checked })} /><span /></label></div>
        <div className="settings-title"><KeyRound size={21} /><div><h2>启用 AI</h2><p>API Key 只保存在 chrome.storage.local，不会发送给 EchoType。</p></div><label className="switch"><input type="checkbox" checked={settings.aiEnabled} onChange={(event) => setSettings({ ...settings, aiEnabled: event.target.checked })} /><span /></label></div>
      </section>

      <section className={`provider-form ${settings.aiEnabled ? "" : "muted-form"}`}>
        <label className="field"><span>AI 服务商</span><select disabled={!settings.aiEnabled} value={settings.aiProvider.providerId} onChange={(event) => setProvider(event.target.value)}>{Object.values(PROVIDERS).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {definition.editableBaseUrl && <label className="field"><span>服务地址</span><input disabled={!settings.aiEnabled} value={settings.aiProvider.baseUrl} onChange={(event) => patchProvider({ baseUrl: event.target.value })} placeholder="https://api.example.com/v1" /></label>}
        {definition.requiresApiKey && <label className="field"><span>API Key</span><input disabled={!settings.aiEnabled} type="password" autoComplete="off" value={settings.aiProvider.apiKey} onChange={(event) => patchProvider({ apiKey: event.target.value })} placeholder="仅保存在本机" /></label>}
        <label className="field"><span>模型</span><input disabled={!settings.aiEnabled} value={settings.aiProvider.model} onChange={(event) => patchProvider({ model: event.target.value })} placeholder={definition.defaultModel || "模型 ID"} /></label>
        <div className="form-actions"><button className="secondary-button" disabled={!settings.aiEnabled || testing} onClick={() => void test()}><TestTube2 size={17} />{testing ? "测试中…" : "测试连接"}</button><button className="primary-button" onClick={() => void save()}><CheckCircle2 size={17} />保存设置</button></div>
        {status && <p className="status-message" role="status">{status}</p>}
      </section>

      <aside className="privacy-note"><ShieldCheck size={22} /><div><h2>隐私说明</h2><p>收录的单词、网页来源与密钥默认只保存在当前浏览器。启用 AI 后，单词与截取的语境会直接发送给你选择的 AI 服务商；免费模式会请求 Dictionary API 与 MyMemory。</p></div></aside>
    </main>
  );
}
