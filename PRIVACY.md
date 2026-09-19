# Wordbook Collector Privacy Policy

Last updated: September 19, 2026

Wordbook Collector helps users save English words encountered on webpages and turn them into study cards. This policy explains what data the extension handles and why.

## Data handled by the extension

- **Selected webpage content:** The word selected by the user, the surrounding paragraph used as learning context, the page title, and the page URL.
- **User-created content:** Wordbooks, notes, familiarity ratings, saved contexts, and generated study-card content.
- **AI configuration:** Provider name, endpoint, model, and API key entered by the user.

## How data is used

- Saved words and study data are stored locally with `chrome.storage` so the user can browse, edit, review, and export their wordbooks.
- When automatic dictionary enrichment is used, the selected word or dictionary text may be sent over HTTPS to dictionary and translation services used by the extension: Youdao Dictionary, DictionaryAPI.dev, Free Dictionary API, Datamuse, and MyMemory Translation.
- If the user explicitly enables and configures an AI provider, the selected word and its saved context are sent directly over HTTPS to the provider chosen by the user to generate translations, senses, phrases, and examples. The extension does not enable AI or choose a paid provider without the user's action.
- API keys are stored locally and are sent only to the provider endpoint configured by the user. Wordbook Collector does not operate an intermediary server and does not receive those keys.

## Data sharing and sale

Wordbook Collector does not sell user data, use it for advertising, or share it with data brokers. Data is transmitted only when necessary to provide the dictionary, translation, or user-configured AI features described above.

## Retention and deletion

Wordbook data remains on the user's device until the user deletes an entry, clears the extension's local data, or uninstalls the extension. Data sent to third-party services is subject to the privacy and retention policies of those services.

## Permissions

- `activeTab` and `scripting`: Read the word the user deliberately selects and its surrounding paragraph after the user invokes the extension.
- `contextMenus`: Provide the “Add to Wordbook” action for selected text.
- `storage`: Save wordbooks, settings, notes, and study cards locally.
- Website access: Contact dictionary/translation services and the AI endpoint configured by the user. The extension does not continuously monitor browsing activity.

## Limited Use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions or deletion assistance, open an issue at <https://github.com/Talljack/echo-type-wordbook-extension/issues>.

---

# Wordbook Collector 网页生词本隐私政策

更新日期：2026 年 9 月 19 日

Wordbook Collector 网页生词本用于收藏用户在网页中遇到的英文单词，并生成可学习的词卡。本政策说明扩展会处理哪些数据以及处理目的。

## 扩展处理的数据

- **用户主动选择的网页内容：** 选中的单词、作为学习语境的所在段落、网页标题和网页地址。
- **用户创建的内容：** 词书、笔记、熟悉度、收藏语境以及自动生成的词卡内容。
- **AI 配置：** 用户填写的服务商、接口地址、模型和 API Key。

## 数据用途

- 单词及学习数据通过 `chrome.storage` 保存在用户本机，用于浏览、编辑、复习和导出词书。
- 使用免费词典优化时，扩展可能通过 HTTPS 将选中的单词或词典文本发送给有道词典、DictionaryAPI.dev、Free Dictionary API、Datamuse 和 MyMemory Translation。
- 只有用户主动开启并配置 AI 后，扩展才会将单词及收藏语境通过 HTTPS 直接发送给用户选择的 AI 服务商，用于生成翻译、义项、短语和例句。
- API Key 仅保存在本机，并且只发送给用户配置的服务商接口。本扩展不运营中转服务器，也不会接收这些密钥。

## 数据共享与出售

本扩展不出售用户数据，不将数据用于广告，也不向数据经纪商共享数据。扩展只会在提供上述词典、翻译或用户配置的 AI 功能所必需时传输数据。

## 保存与删除

词书数据会保存在用户设备上，直到用户删除词条、清除扩展本地数据或卸载扩展。发送给第三方服务的数据受相应服务商的隐私和保存政策约束。

## 权限说明

- `activeTab` 与 `scripting`：用户主动调用扩展后，读取用户明确选中的单词及其所在段落。
- `contextMenus`：为选中的文本提供“加入词书”菜单。
- `storage`：在本机保存词书、设置、笔记和词卡。
- 网站访问权限：访问词典、翻译服务以及用户自行配置的 AI 接口。扩展不会持续监控用户的浏览活动。

## 有限使用声明

从 Google API 获取的信息将按照 Chrome Web Store 用户数据政策（包括有限使用要求）进行使用。

## 联系方式

如有隐私或数据删除相关问题，请在 <https://github.com/Talljack/echo-type-wordbook-extension/issues> 提交 Issue。
