# Folio frontend implementation

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


The approved Design A is implemented in the live React renderer. The standalone HTML remains available as the original review reference.

## Changes

- Fixed-dark charcoal Library and Settings with sage actions, navigation rail, cover grid, selected-book details, and a continue-reading card driven by actual saved progress.
- Original cover images when available, with deterministic illustrated fallbacks for books without covers.
- Real empty, import, missing-file, replacement-result, opening, and removal states. EPUB files remain linked to their original locations.
- Responsive book details with pinned actions and a compact dialog at narrower widths.
- Reader controls, chapter/progress footer, contents overlay, appearance overlay, translation bubble and expanded result in the new visual system.
- Reading preferences, downloaded fonts, and model controls use the existing APIs and persistence. Settings includes Reading appearance, Font library, Local translation, and About.
- Default reading mode/theme and saved preferences are preserved. All four reader palettes match the approved design; the EPUB adapter's only functional change is the palette values.
- Native duplicate-file and external-link confirmations remain in the Electron main process. Publication security, storage contracts, supported formats, and pagination architecture are retained.
- Reader controls lock during mode/appearance application. The mode indicator reflects completed layout, and a failed mode change can be retried. Save-position failures are surfaced instead of silently claiming success.
- Keyboard focus remains visible, contents/appearance trap focus including selects, and reader footer controls become inert while an overlay is open.

## Structure

`src.tsx` is the entry point. `app.tsx` owns routes, persistence and library operations; `library-view.tsx`, `reader.tsx`, and `settings.tsx` own the three primary areas. `ui.tsx` provides shared controls, icons, and covers. `style.css`, `app.css`, and `reader.css` contain the design and live-layout bindings. No dependencies were added.

## Qualification notes

Verification uses isolated temporary application data, never the user's real library. Live font downloads and model operations are exercised through the app. A model that starts unloaded is unloaded again after testing.

The proof now waits for the actual applied reader mode, rather than the requested preference. Its polling bound allows the adapter's bounded layout sequence. Automated qualification windows disable Chromium background throttling so hidden or occluded windows can paint; normal app sessions retain the default behavior.

Runtime diagnostics identify the stage that first failed and retain that error if teardown also fails. Theme assertions were updated to the approved palette; the underlying behavior and release checks were not removed.

The recorded checks cover type checking, all 124 unit tests, the production build, trusted-publication proof, the full development runtime corpus, real Electron journeys, and responsive visual inspection. The new interaction regressions protect double-click and Enter opening at compact widths. This is frontend integration verification, not a fresh installer, Narrator, or physical display-scaling qualification.

Verified live journeys include native-picker import, open/read/contents, all four page themes, mode switching, saved library/settings after restart, removal cancellation and confirmation with the original file retained, a real Source Serif 4 download/use/restart, and explicit Ollama load → German selection → translation → copy/expand → unload. The repeat translation check was run after opening the Ollama desktop app. An early repeat failure was traced to the test harness treating an asynchronous polling predicate as truthy before loading had finished; awaited polling confirmed the real flow works.

The complete development runtime suite passed with all 12 fixtures, repeated interaction/stress cycles, memory/performance limits, script/network/IPC containment, and renderer-crash recovery. Early runs under overlapping desktop tests timed out; the final isolated canonical runs passed. Qualification disables background throttling so an occluded test window can continue painting. No model safety guards or release assertions were relaxed.
