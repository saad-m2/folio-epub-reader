# Epic 05 implementation review

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


**Reviewed:** 2026-09-29  
**Scope:** S1–S7, settings, fonts, and optional local translation.  
**Status:** Implementation is in place. Physical Windows validation remains open.

## Implemented

- Settings exposes global mode, theme, font family, size, margins, line spacing, and paragraph spacing. Changes persist through the existing library preferences and the reader's quick appearance controls apply immediately.
- Liberation Sans is bundled with its license and verified by a pinned hash. The font is supplied to sandboxed publication frames as a data URL so normal reading does not need network access. The font manager offers two pinned optional assets through fixed HTTPS downloads, bounded size and time, hash validation, persistence, and corrupt-cache fallback.
- Main owns a fixed Ollama loopback gateway and model identifier. Status reads do not load the model. Load and Unload are explicit, serialized, and bounded; app exit makes a bounded unload attempt when this app loaded the model.
- The reader registers a short-lived, session-bound selection token before showing Translate. Main validates the token and active session. Translation checks loaded state, sends only selected text with a fixed German-to-English prompt, bounds output, and maps failures to safe categories. Unload, selection change, and book close invalidate pending results.
- The reader shows anchored loading, result, and error surfaces, with Copy, dismissal, long-result expansion, and explicit retry while the selection remains valid. Settings provides separate Ollama and model setup guidance.

## Verification

- `pnpm check`: passed.
- `pnpm test`: passed, 70 tests in 10 files, including focused Ollama gateway and font manager tests.
- `pnpm build`: passed; Vite reports an existing large-chunk advisory.
- No desktop or Electron UI automation was run at the user's request.

## Open exit checks

- On a permitted Windows app run, validate first-launch font rendering, font downloads and offline restart, selection highlighting and bubble placement, long-result expansion, keyboard focus, Load/Unload cancellation, missing Ollama/model, shared-service state changes, and German literary translation quality and timing. No such run was made during this implementation.

The Epic 5 exit condition remains open until the requested deferred runtime checks pass.

## Optional catalog decision

| Font | Pinned asset | SHA-256 | License evidence |
| --- | --- | --- | --- |
| Atkinson Hyperlegible Regular | [Google Fonts commit `1b22086`](https://raw.githubusercontent.com/google/fonts/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Regular.ttf) | `7fb917c89019896d0b52ee84b7cbb3304c18cb90b19a62f5e32712bd23e97669` | [OFL and Braille Institute copyright](https://github.com/google/fonts/blob/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/OFL.txt) |
| Source Serif 4 Roman variable | [Google Fonts commit `7b203a6`](https://raw.githubusercontent.com/google/fonts/7b203a635ebe80801c80f29633d4fc467cd1214e/ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf) | `97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b` | [OFL and Adobe copyright metadata](https://github.com/google/fonts/blob/7b203a635ebe80801c80f29633d4fc467cd1214e/ofl/sourceserif4/METADATA.pb) |

The catalog uses one Roman asset per family. Italic faces are outside this initial catalog. The pinned asset bytes and SHA-256 values were verified on 2026-09-29.
