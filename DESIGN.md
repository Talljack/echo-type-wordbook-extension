# EchoType Wordbook — Design Contract

## 1. Visual Theme and Atmosphere

A compact “dictionary drawer” for focused learning: bright, precise, and quietly encouraging. The interface inherits EchoType’s indigo and green roles, but uses solid stepped surfaces instead of decorative gradients or expensive blur.

## 2. Color Palette and Roles

- Canvas: `oklch(0.97 0.018 278)` — cool learning workspace.
- Surface: `oklch(0.995 0.004 278)` — elevated controls and word detail.
- Ink: `oklch(0.31 0.095 278)` — primary text.
- Muted ink: `oklch(0.53 0.045 278)` — metadata.
- Indigo: `oklch(0.51 0.23 278)` — navigation and primary actions.
- Green: `oklch(0.69 0.19 145)` — successful collection and learned states.
- Red: `oklch(0.63 0.22 28)` — destructive/error states.

## 3. Typography Rules

Headings use Poppins because it is the established EchoType display face; body copy uses Open Sans for dense dictionary content. Display tracking is `-0.022em` at 32px+, `-0.012em` at 20–28px, and normal below. Body line-height is 1.55.

## 4. Component Styling

Buttons use a fixed 10px radius, a 40px minimum hit area, and `scale(.96)` on press. Inputs use a 10px radius and a visible indigo focus ring. Word detail is mostly cardless; only elevated editor/preview surfaces use shadows.

## 5. Layout Principles

Spacing follows 4/8/12/16/24/32px. The popup is a single 400px column. The library uses a 240px wordbook rail, a flexible word list, and a 360px detail pane; it collapses to stacked panes below 860px.

## 6. Depth and Elevation

Level 0 uses the canvas. Level 1 uses an opaque surface with `0 1px 3px rgba(49,46,129,.12)`. Level 2 uses `0 12px 30px rgba(49,46,129,.14)`. Borders are dividers, not container decoration.

## 7. Do’s and Don’ts

- Do put the selected word and destination wordbook before enrichment details.
- Do keep provider credentials local to the browser profile.
- Do retain source URL, page title, and surrounding sentence.
- Do use Lucide icons only.
- Don’t block saving when enrichment fails.
- Don’t use gradients, oversized marketing copy, or repeated generic cards.
- Don’t hide status behind color alone.

## 8. Responsive Behavior

Popup stays at 400px. Library panes become a two-step list/detail flow below 860px. All targets stay at least 40px; motion is disabled under `prefers-reduced-motion`.

## 9. Agent Prompt Guide

Tokens: `canvas oklch(0.97 0.018 278)`, `surface oklch(0.995 0.004 278)`, `ink oklch(0.31 0.095 278)`, `indigo oklch(0.51 0.23 278)`, `green oklch(0.69 0.19 145)`, radii `6/10/16/pill`.

- “Create a compact 400px popup on canvas, with a 28px Poppins 700 selected word, -0.012em tracking, surface editor at 16px radius, and an indigo 10px-radius action.”
- “Create a three-pane library with a 240px canvas-tinted rail, cardless rows separated by low-contrast dividers, and a 360px surface detail pane.”
- “Create an enrichment status using a 10px green dot, 13px Open Sans text, and a live-region message; never rely on green alone.”
