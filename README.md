# EchoType Wordbook

一个与 [EchoType](https://github.com/Talljack/echo-type) 配套的开源浏览器词书插件：在任意网页选中英文单词，通过右键菜单或工具栏快速收录，并自动补全词卡。

## 功能

- 网页选词后右键“一键加入 EchoType 词书”
- 日常、商务、学术默认词书，并支持任意自定义分类
- 保存原网页标题、链接、上下文和重复遇见次数
- AI 自动生成按词性拆分的完整中英释义、IPA、5～8 条高频短语、近义词、反义词和日常/商务/影视例句
- 支持 OpenAI、Anthropic、Gemini、OpenRouter、DeepSeek、通义千问、Kimi、智谱、SiliconFlow、Groq、Ollama、自定义 OpenAI 兼容接口
- 未配置 AI 时，使用 Free Dictionary API、Datamuse 和 MyMemory 免费补全完整释义与常用短语
- 词书浏览、搜索、编辑、发音、熟悉度与重新优化
- 导出 CSV、Anki TSV、EchoType 兼容 JSON
- 所有词书与密钥默认仅保存在 `chrome.storage.local`

## 本地开发

```bash
npm install
npm run check
```

然后在 Chrome/Edge 打开扩展管理页，启用开发者模式，选择“加载已解压的扩展程序”，加载项目下的 `dist` 文件夹。

开发模式：

```bash
npm run dev
```

## 使用方式

1. 在网页中选中一个英文单词。
2. 右键选择“加入 EchoType 词书”，或点击工具栏图标。
3. 选择目标词书并确认语境。
4. 在“我的词书”中查看、编辑、重新优化或导出。

AI 设置不是必需的。启用时，词语和截取的上下文会直接发送到用户选择的服务商；扩展自身没有中转服务器。

## 数据与 EchoType

“EchoType”导出会生成 `echotype-wordbook-v1` JSON，其中包含与 EchoType `favorites` 和 `contents` 模型相匹配的数据。可作为后续直接导入/同步能力的稳定交换格式。

## 隐私

- 不采集分析数据，不包含广告。
- 单词、来源、词书和 API Key 默认仅保存在本机浏览器。
- 免费优化会访问 `dictionaryapi.dev`、`api.datamuse.com` 和 `mymemory.translated.net`。
- AI 优化只访问用户主动选择并配置的服务商。
- 自定义服务商需要广泛网络权限，完整理由见 [docs/PRIVACY.md](docs/PRIVACY.md)。

## License

MIT
