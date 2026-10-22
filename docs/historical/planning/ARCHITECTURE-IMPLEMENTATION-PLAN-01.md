# Architecture Implementation Plan 01 - Trusted Local EPUB MVP

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


**Status:** Authoritative implementation architecture
**Date:** 2026-09-22
**Product source:** `docs/product/PRODUCT.md`  
**Translation decision:** `LOCAL-TRANSLATION-DECISION.md`

## 1. Decision

The MVP is a single-window Windows 11 x64 Electron application using Electron 42.11.6, TypeScript, React, Fluent UI React v9, SQLite, and epub.js 0.3.93.

E06 security maintenance (2026-10-02) supersedes the original Electron 38.7.2 pin: the full production/build audit found runtime advisories excluded by the previous production-only scan. Electron 42.11.6, Forge 8.0.1, Vitest 4.1.11, and patched XML/tar dependencies are now pinned. Historical spike evidence retains its original versions. The native binary handoff remains unchanged; the E06 packaged corpus re-proves it on the new runtime. See [E06 release evidence](../../../release-artifacts/E06-RELEASE-EVIDENCE.md) for results and unresolved gates.

Users intentionally select local EPUBs that they trust. The reader therefore uses epub.js's native in-memory archive path rather than a hostile-publication service: main authorizes a picker or existing-library path, checks a bounded file size, reads the complete EPUB bytes, and sends those bytes to the sandboxed renderer through a named IPC intent. epub.js opens that `ArrayBuffer` with its normal JSZip/blob-URL flow.

This replaces the previous `book://` capability, publication helper, parser-placement branches, and SPIKE-002 gate. The previous evidence and failed `book://` experiment remain historical records only.

## 2. Trust model

This is a **trusted-local-publication** product model, not a hostile-document sandbox. It accepts the residual risk that a malformed or malicious EPUB can crash or exhaust the sandboxed renderer. It does not accept that a publication can gain filesystem, database, secret, shell, generic IPC, or network access.

The MVP keeps these baseline controls:

- App renderer: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, and `webSecurity: true`.
- Preload: immutable named intents only; no `ipcRenderer`, Node APIs, filesystem, raw SQL, generic channels, or secret material.
- Publication: `allowScriptedContent: false`; no publication preload; iframe sandbox omits `allow-scripts`; forms, popups, downloads, permission requests, top-level navigation, `file://`, and remote HTTP(S) requests are blocked.
- Network: the app renderer has no general network access. Main may use only the fixed Ollama loopback endpoint for explicit translation intents, approved font origins for font downloads, and confirmed external HTTPS links. Publication frames cannot reach loopback or the internet.
- Resource limits: one active book, a documented maximum archive size, and a renderer readiness timeout. Main checks the source-file size before allocating or transferring bytes. The renderer destroys the rendition/book and drops the `ArrayBuffer` on close, failure, replacement, or app shutdown.
- Persistence: only normalized metadata, navigation, identity evidence, and locations cross back to main. The original source path remains main-only; the complete archive is transient and never persisted under app data.

The app must explain that it is intended for books the user trusts. Scripted EPUBs, fixed-layout EPUBs, DRM, and media overlays remain unsupported; scripts are never enabled as a trusted-book convenience.

## 3. Runtime topology

```text
Windows user
  -> Electron main
     - native picker, library/SQLite, explicit font/link operations, fixed local Ollama gateway
     - authorizes source path, checks size, reads complete EPUB bytes
     - transfers a bounded ArrayBuffer and receives normalized results
  -> sandboxed React renderer
     - owns the ephemeral ArrayBuffer and epub.js ReaderAdapter
     - epub.js / JSZip parses the archive and creates blob: resource URLs
     - sandboxed script-off publication iframe(s)
```

There is one `BrowserWindow`, one active book, and one app route: Library, Reader, or Settings. The renderer never receives the source path. It receives a transient `{ sessionId, archiveBytes, metadataHint }` handoff after main authorizes the source. `archiveBytes` is not a general file-read capability and cannot be requested for arbitrary paths.

### Open lifecycle

1. Main obtains the path from the native picker or an existing library record.
2. Main checks that the file exists, has the accepted extension, and is at or below `maxTrustedArchiveBytes` (initially 128 MiB). It computes identity evidence without modifying the source.
3. Main reads the file once and responds to named `openBookSession` with a transferable/copyable `ArrayBuffer`, a random session ID, and bounded metadata hint.
4. `ReaderAdapter` calls epub.js with the archive bytes. Its binary/archive mode creates ephemeral `blob:` URLs for package, XHTML, CSS, images, and fonts.
5. The adapter reports normalized metadata, TOC, locations, selection geometry, and safe failure categories. Main validates all returned data before persistence.
6. On close, failure, a new open, renderer crash, or shutdown, the adapter destroys epub.js objects and frames, releases byte references, and main invalidates the session ID.

No `book://`, app-owned loopback HTTP server, `file://` publication URL, extraction directory, archive helper process, or renderer path access is part of the production architecture. Ollama is a separately installed local service; its fixed loopback API is used only by main for user-initiated translation operations.

## 4. Reader adapter

`ReaderAdapter` is the only module importing epub.js. It owns archive open, rendition lifecycle, continuous/paginated manager selection, EPUB CFI conversion, iframe event hooks, user-style injection, link interception, and cleanup. Engine objects, blob URLs, frames, and CFIs do not enter ordinary React components, shared contracts, or persistence.

```ts
type ReaderMode = "continuous" | "paginated";
type ReaderLocation = {
  href: string; cfi?: string; quote?: string;
  navId?: string; navProgress?: number; resourceProgress?: number;
};

interface ReaderAdapter {
  open(input: { sessionId: string; archiveBytes: ArrayBuffer; initialLocation?: ReaderLocation }): Promise<ReaderSnapshot>;
  goTo(target: ReaderLocation | TocTarget): Promise<ReaderSnapshot>;
  setMode(mode: ReaderMode, restore: ReaderLocation): Promise<ReaderSnapshot>;
  applyAppearance(change: Appearance, fallback: TocTarget | ResourceTarget): Promise<ReaderSnapshot>;
  next(): Promise<void>; previous(): Promise<void>;
  subscribe(listener: (event: ReaderEvent) => void): Unsubscribe;
  close(): Promise<void>;
}
```

Operations are serialized, superseded operations are cancelled, and open/display has a finite timeout. The adapter uses epub.js's supported continuous/scrolled flow and paginated/column flow; no custom paginator or vertical stack of synthetic pages is permitted.

## 5. Publication behavior

Publication scripts remain disabled. The iframe has no app preload, Node, Electron API, `readerApi`, storage, permissions, popup capability, or top-level navigation capability. The application session blocks remote HTTP(S), `file:`, downloads, and unexpected navigations. The app intercepts user-activated HTTPS links and asks for confirmation before main opens the validated destination in the system browser.

Selection is observed by the adapter from the script-off iframe and normalized to bounded text, optional CFI, and host-relative geometry. It is not a publication-callable IPC bridge. The renderer may inspect the publication DOM solely because the trusted-local model uses same-origin `blob:` content with scripts disabled.

## 6. Persistence and privacy

SQLite and source paths remain main-process-only. Persisted locations contain normalized href, optional CFI, bounded quote/context, navigation identity/progression, and resource progression. Do not persist archive bytes, generated pages, DOM/frame identity, blob URLs, selected text, or an epub.js object.

Translation uses a main-process adapter to the fixed `127.0.0.1:11434` Ollama API and the fixed Hy-MT2-7B Q4_K_M model. There is no API key, model download inside the app, or user-supplied endpoint. Only explicit **Load** warms the model; opening the app, book, or selection never does. **Unload** releases GPU memory while reading continues. Selected text is sent only after a separate **Translate** click while the model is loaded; output is bounded plain text and never interpreted as HTML or Markdown. See `LOCAL-TRANSLATION-DECISION.md` for state, lifecycle, and failure contracts.

## 7. Testing and release gates

Test the real Electron 42.11.6 + epub.js 0.3.93 binary handoff with a redistributable deep-marker fixture. It must open package/navigation/spine XHTML, CSS, image, and declared font; reach `#two-mid`; render in continuous and paginated modes; report selection geometry; and release rendition/frame/archive-byte references on close.

The trusted-local corpus still covers malformed ZIP/XML, oversized source files, excessive memory/readiness time, unsupported profiles, scripts, forms, remote URLs, `file://` URLs, popups, and navigation attempts. The expected result is a bounded renderer failure or a friendly unsupported/invalid result, never app privilege, source-path leakage, unrequested network access, or a main-process crash. This is resilience testing, not a claim of hostile-content isolation.

Required packaged-release checks include offline import/open/read/restore and local translation, no remote book traffic, script-off frames, no publication preload/Node access, session cleanup, source-file integrity, memory limits for one open book, manual model load/unload and GPU-memory release, accessibility, installer lifecycle, and dependency/version regression.

Owner scope revision (2026-10-02): this is primarily a personal-use application, so clean-machine/VM installer qualification is waived. Offline UI qualification remains required. The owner permits reasonable memory above the provisional 500 MiB target after leak investigation. Conservative aggregate working-set guards are now 768 MiB for ordinary fixtures and 1,024 MiB for stress fixtures on the documented host; 20-cycle residual growth remains limited to 75 MiB, with retained JavaScript heap growth additionally checked after diagnostic collection. These higher ceilings do not excuse progressive retention, unreleased publication resources, or impractical measured use. Ollama/model GPU memory remains separately measured.

## 8. Risks and escalation

| Risk | Mitigation | Escalate when |
| --- | --- | --- |
| Large/troublesome trusted EPUB exhausts renderer memory | 128 MiB source cap, one active book, open timeout, deterministic teardown | Ordinary supported books exceed the recorded memory/performance budget. |
| epub.js/JSZip parser fault crashes renderer | Renderer sandbox, restart/reopen recovery, exact version pin and corpus regression | A fault reaches main privileges or ordinary books are unreliable. |
| Active book content reaches a remote or local resource | Scripts off, no general renderer network, session request blocking, link confirmation | Any unrequested request, `file://` access, popup, or navigation succeeds. |
| Renderer compromises app data/secrets | Electron sandbox, context isolation, no Node, narrow validated preload | Publication content can invoke privileged IPC or read a secret/path. |

## 9. Delivery phases

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0. Foundation and trusted-local proof | Hardened shell, typed intents, bounded binary handoff, exact deep-marker epub.js render | Archive opens through `ArrayBuffer`; scripts/network/file access stay blocked; close releases resources. |
| 1. Library | SQLite, picker import, metadata, identity, missing/remove/replace | Original file untouched and all local lifecycle flows pass. |
| 2. Reader | ReaderAdapter, both flows, TOC, locations, appearance | Semantic marker, manager-flow, reflow, and cleanup tests pass. |
| 3. Interaction | Controls, input, selection, link confirmation, accessibility | Windows interaction/accessibility smoke tests pass. |
| 4. Settings and translation | Preferences, fonts, local setup guidance, manual model controls, German-to-English translation | Offline reading unaffected; load/unload, missing-runtime, cancellation, and plain-text rules pass. |
| 5. Release | Corpus, resilience, performance, packaging | Packaged Windows 11 x64 gates pass. |
