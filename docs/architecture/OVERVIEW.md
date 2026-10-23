# Current architecture

Status: current implementation guide, checked against source on 2026-10-22. The original [implementation plan](../historical/planning/ARCHITECTURE-IMPLEMENTATION-PLAN-01.md) is preserved for rationale and delivery history; this guide replaces it for current orientation.

## Runtime and ownership

Leaf uses Electron, TypeScript, React, Vite, epub.js, JSZip, and Zod. SQLite uses Node's built-in `node:sqlite` binding in main, rather than the `better-sqlite3` binding proposed in older plans. `package.json` and the lockfile define exact versions. The live UI implements the approved Quiet bookshelf design with shared React controls and CSS; the presence of Fluent UI in dependencies does not describe the current component structure.

There is one BrowserWindow, one active publication, and Library, Reader, and Settings routes. Main owns filesystem access, library persistence, native dialogs, app lifecycle, font downloads, confirmed external links, updates, and the fixed local Ollama gateway. The sandboxed renderer owns React UI, bounded EPUB validation, layout, and the transient archive. Preload exposes named operations; main validates payloads, sender frame/origin, and session ownership as applicable.

## Code map

| Area | Files |
| --- | --- |
| Main composition, IPC, native picker/dialogs, protocols, shutdown | [src/main/index.ts](../../src/main/index.ts) |
| Windows data/session paths | [paths.ts](../../src/main/paths.ts) |
| Library, SQLite migrations, identity, source validation, cover cache | [library.ts](../../src/main/library.ts) |
| Authorized transient archive sessions | [publications.ts](../../src/main/publications.ts) |
| Safe errors and IPC sender validation | [security.ts](../../src/main/security.ts) |
| Typed payloads, limits, locators, appearance | [shared/contracts.ts](../../src/shared/contracts.ts) |
| Named bridge exposed to the app renderer | [preload/index.ts](../../src/preload/index.ts) |
| React entry, routes/imports, library UI | [src.tsx](../../src/renderer/src.tsx), [app.tsx](../../src/renderer/app.tsx), [library-view.tsx](../../src/renderer/library-view.tsx) |
| Reader UI, engine integration, restoration, validation | [reader.tsx](../../src/renderer/reader.tsx), [reader-adapter.ts](../../src/renderer/reader-adapter.ts), [reader-location.ts](../../src/renderer/reader-location.ts), [publication-validation.ts](../../src/renderer/publication-validation.ts) |
| Settings and shared visual controls | [settings.tsx](../../src/renderer/settings.tsx), [ui.tsx](../../src/renderer/ui.tsx), [design guide](../design/README.md) |
| Optional fonts and local translation | [fonts.ts](../../src/main/fonts.ts), [translation.ts](../../src/main/translation.ts) |
| Update controller and UI | [updates.ts](../../src/main/updates.ts), [settings-updates.tsx](../../src/renderer/settings-updates.tsx), [squirrel.ts](../../src/main/squirrel.ts) |
| Runtime/offline qualification | [main release tests](../../src/main/release-tests.ts), [renderer release tests](../../src/renderer/release-tests.ts), [offline-test.ts](../../src/main/offline-test.ts) |

## Publication lifecycle and security

The accepted model is [trusted local EPUBs](decisions/TRUSTED-LOCAL-EPUB.md). Main authorizes a picker or library source, checks the `.epub` extension and 128 MiB source cap, and transfers one transient archive buffer with a random session ID. The source path stays in main. Renderer validation checks package structure and unsupported declarations; epub.js/JSZip parse in the sandboxed renderer and create transient blob resources. Import commit checks the source against the hash of the handed-off bytes.

There is no production publication helper, `book://` capability, extraction directory, or app-owned loopback publication server. Malformed content can still crash or exhaust the renderer under the trusted-local risk model. The archive-size cap is not a decompression sandbox.

Electron sandboxing, context isolation, and web security stay enabled, with Node integration disabled. Publication scripts are disabled and frames have no app preload. App-session policy/CSP restrict network, file access, navigation, windows, permissions, and downloads. Main provides the separate explicit font, local translation, updater, and confirmed external HTTPS capabilities. Publication frames cannot directly invoke them. Close, replacement, failures, renderer loss, and shutdown must invalidate sessions and release publication resources.

## Persistence and continuity

Normal application data lives at `%LOCALAPPDATA%/Windows EPUB Reader/Data`; Chromium session data lives in the sibling `Session` folder. Library entries reference original EPUBs. Removal changes app-owned records and caches, never the source book. SQLite stores books, composite reading locations, global preferences, font state, and cached covers. A legacy encrypted-secrets table exists; local translation does not use API keys.

Locations include normalized href, optional CFI, bounded quote/context, navigation identity/progression, and resource progression. Restoration and replacement resolution use semantic fallbacks; generated page numbers and blob/frame identities are not durable positions. TOC progress follows navigational ranges and the deepest active entry, not an assumption that one spine resource is one chapter.

Mode and page-layout switching aim to retain the same logical passage through the semantic restoration flow. Appearance or window reflow follows the distinct rule of returning to the active section start, or current resource start without usable navigation. Paginated mode defaults to a single page (`spread: "none"`); the separate global `pageLayout` preference enables two-page spreads (`spread: "always"`), with epub.js falling back to one page below its 800px spread threshold. Continuous mode never uses spreads. Missing layout preferences default to single-page without a database migration.

## Optional services and delivery

The current product name is Leaf, formerly Folio. Runtime and Windows product display names use Leaf. Legacy package/executable/Squirrel identifiers, the Windows EPUB Reader data path, and the configured GitHub release repository are retained for compatibility; see [release naming](../release/UPDATES.md#product-name-and-upgrade-compatibility).

The [local translation decision](decisions/LOCAL-TRANSLATION.md) defines fixed loopback Ollama access, explicit Load/Unload, session-bound selected-text translation, cancellation, and temporary plain-text results. The font manager bundles Liberation Sans and offers pinned Atkinson Hyperlegible and Source Serif 4 downloads with integrity checks and offline cache use.

Windows x64 packaging uses Electron Forge and Squirrel. Version 0.2.0 added explicit user-triggered update checks via the configured GitHub release repository. See [release instructions](../release/UPDATES.md) and [qualification scope](../release/QUALIFICATION.md). Historical checks are evidence for their recorded builds, not a guarantee for a new candidate.
