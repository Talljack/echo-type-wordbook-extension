# Dogfood Report: EchoType Wordbook Chrome Extension

| Field | Value |
|-------|-------|
| **Date** | 2026-09-18 |
| **Browser** | Google Chrome for Testing 153.0.8010.52 (isolated temporary profile) |
| **Extension** | Local unpacked `dist/` build |
| **Session** | `echotype-cft-qa` |
| **Scope** | Reddit text selection, context-menu collection, fallback translation, popup-close persistence, library display |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

## Verification log

- Loaded the unpacked extension in an isolated Google Chrome for Testing profile.
- Selected `Example` on example.com and confirmed the EchoType context-menu item appeared.
- Selected `suddenly` on Reddit and reproduced a word stuck at “等待优化”.
- Fixed the stalled dictionary request so it cannot block a successful Chinese translation response.
- Moved enrichment persistence into the background service worker so closing the popup no longer loses the result.
- Re-enriched `suddenly`, immediately navigated away, and confirmed the library stored `突然` with status `ready`.
- Selected a fresh Reddit word, `tomorrow`, through a real mouse drag; used the context menu; clicked “加入词书”; immediately closed the popup; and confirmed the library stored `明天` with status `ready`.
- Full automated verification: 24 tests passed; typecheck, production build, and package verification passed.

## Issues

### Resolved during testing

1. **High — Closing the add popup could leave a word permanently waiting for enrichment.** Enrichment is now persisted by the background service worker using the stored word ID.
2. **High — A stalled English dictionary request blocked an already-successful Chinese translation.** Each free service now has an independent timeout, and the translation response body is read before abort cleanup.

Evidence:

- `screenshots/reddit-word-translation-persisted.png`
- `screenshots/reddit-tomorrow-selected.png`
- `screenshots/reddit-tomorrow-translated.png`
