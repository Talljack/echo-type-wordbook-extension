# Privacy

EchoType Wordbook does not operate a backend and does not collect analytics.

## Local data

Words, wordbooks, source URLs, captured context, preferences, and provider credentials are stored in `chrome.storage.local` on the current browser profile.

## Network requests

- Without AI: selected words may be sent to `api.dictionaryapi.dev` and `api.mymemory.translated.net` for definitions and Chinese translation.
- With AI enabled: the selected word and captured context are sent directly to the provider configured by the user.
- The extension requests HTTPS host access because users may configure any OpenAI-compatible endpoint. Localhost access supports Ollama.

No credential or learning data is sent to the EchoType maintainers.
