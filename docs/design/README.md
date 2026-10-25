# Design and UI

The approved direction is Design A, Quiet bookshelf, implemented in the live React renderer under the Leaf name. [Prototype and design rationale](frontend-a/README.md) and the [standalone HTML](frontend-a/index.html) retain the approved visual reference with branding updated to Leaf. Prototype imports, pagination, fonts, and translation are simulated; use the application source for implemented behavior.

## Current visual rules

- Library and Settings use fixed charcoal surfaces, muted sage actions, thin borders, restrained corners, and book-led hierarchy.
- Reader themes are System, Light, Dark, and Sepia, independent of the fixed-dark app shell.
- Cover grid, selected-book details, and continue-reading information use actual library state. Narrow layouts use a compact details dialog.
- Reader controls, TOC, appearance, and translation surfaces share the visual system. Keep focus visible, contain focus in modal overlays, and restore it on dismissal.
- The general **Reader settings** panel groups appearance with translation-service selection/status and local Load/Unload. Keep cloud credential setup in main Settings and avoid separate top-right translation controls.
- Model loading and selected-text translation remain separate actions. UI polish must preserve source-file ownership, reader continuity, native confirmations, and offline reading.

## Implementation map

| Change | Start in |
| --- | --- |
| Routes, library operations and data flow | [app.tsx](../../src/renderer/app.tsx) |
| Library cards, details, compact interactions | [library-view.tsx](../../src/renderer/library-view.tsx) |
| Reader controls, overlays and translation surfaces | [reader.tsx](../../src/renderer/reader.tsx) |
| Preferences, fonts, model guidance and About | [settings.tsx](../../src/renderer/settings.tsx), [settings-updates.tsx](../../src/renderer/settings-updates.tsx) |
| Shared buttons, dialogs, icons and fallback covers | [ui.tsx](../../src/renderer/ui.tsx) |
| Tokens and live styles | [style.css](../../src/renderer/style.css), [app.css](../../src/renderer/app.css), [reader.css](../../src/renderer/reader.css) |
| Styles applied within book content | [reader-adapter.ts](../../src/renderer/reader-adapter.ts) |

The [frontend integration record](../historical/reviews/FRONTEND-IMPLEMENTATION.md) reports the checks made during integration. Its fixed test count and runtime journeys are historical evidence. A new change needs relevant verification; physical Windows display scaling and Narrator are separate from responsive window inspection. See [development](../development/README.md) and [release qualification](../release/QUALIFICATION.md).
