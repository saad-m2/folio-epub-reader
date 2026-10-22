# Technical Proposal: Windows EPUB Reader

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


**Status:** Superseded for implementation planning by `ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`; retained as evidence/history. Its hostile-publication helper and `book://` proposals are superseded by the trusted-local binary-handoff decision. Its OpenAI/key/Responses translation proposal is superseded by `LOCAL-TRANSLATION-DECISION.md`.  
**Date:** 2026-09-16  
**Product source of truth:** [`docs/product/PRODUCT.md`](../../product/PRODUCT.md)

## Executive recommendation

Build the MVP as a single-window **Electron desktop application** using **TypeScript, React, and Fluent UI React v9**. Keep all filesystem, database, secret, and network access in the Electron main process. Expose a small, typed, intent-level API to a sandboxed renderer through a context-isolated preload. Store library data, global settings, and reading positions in **SQLite**; store the AI key encrypted with Electron `safeStorage`, which uses Windows DPAPI.

The owner has selected **epub.js 0.3.93** with Electron 38.7.2 for architecture planning through an explicit SPIKE-003 risk override. This is not empirical proof that SPIKE-003's unresolved gates passed. The final selected topology, remaining SPIKE-002 gate, release risks, and implementation phases are authoritative in `ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`.

This recommendation accepts Electron's larger installed size and memory floor in exchange for the fastest safe path to a polished EPUB experience, a single primary language across shell and reader, mature desktop tooling, predictable Chromium rendering, and strong seams for parallel work by later coding agents.

## 1. Summary of relevant product constraints

The architecture must preserve these product facts:

- This is a Windows desktop application for local, non-DRM EPUB files. It is not a hosted web application.
- Import stores a reference to the original file. It must never copy, move, edit, or delete the EPUB.
- Ordinary reading, library management, navigation, appearance settings, and progress restoration must work offline.
- The reader needs two conventional views over the same reflowable content: normal vertical scrolling and column/page-based pagination. A chapter begins on a fresh generated page in paginated mode; continuous mode may use ordinary chapter separation without synthetic page surfaces.
- Page numbers are intentionally unstable. Position must survive reflow caused by window size, font, spacing, margins, theme, and mode changes.
- Book text remains selectable. Standard keyboard and right-click text behavior must coexist with an app-specific Translate affordance.
- AI translation is optional, user-initiated, temporary, and supplied with a user-owned API key. Book text must not leave the machine merely because it was selected.
- The app shell is always dark. Reader theme and other reading preferences are global.
- Additional fonts are downloadable, integrity-checked application assets and must remain usable offline.
- EPUB files are untrusted archives containing web content. Security is a core architectural constraint, not a later hardening exercise.
- The library is small, local, and single-user. The MVP has no account, cloud sync, annotations, search, DRM, PDF, or file association.

The product still leaves metadata fallbacks, “finished” semantics, the exact font catalog contents, the final translation limit, and visual wording/details open. These do not block the architecture. Provider/model, replacement progress, supported EPUB profile, current-section semantics, external-link behavior, and Windows distribution are now settled owner inputs reflected below.

## 2. Major technical challenges

### 2.1 Two conventional reading flows with position continuity

The reader needs the conventional modes already offered by credible EPUB engines: vertically scrolling reflowable content and column/page-based pagination. No custom vertically stacked page-surface system is required. The remaining cross-mode challenge is to capture a logical content locator before changing flow/layout and restore the same passage as closely as possible afterward. This is important, but materially less risky than inventing a pagination/virtualization system. Continuous-layout behavior is therefore no longer the largest renderer uncertainty; frame/origin containment, selection bridging, and locator conversion are.

### 2.2 Stable locations without stable pages

A pixel offset and a generated page number both become invalid after reflow. EPUB CFI is precise but can fail when a file is replaced or malformed. A chapter percentage is robust but approximate. Restoration therefore needs a layered, engine-independent locator rather than one coordinate.

### 2.3 Rendering hostile packaged web content

EPUB can contain HTML, SVG, CSS, scripts, forms, remote URLs, malformed ZIP paths, oversized compressed entries, and resources crafted to exploit a renderer or archive library. The W3C EPUB Reading Systems specification recommends a unique origin per publication and treating scripts as potentially malicious. The MVP does not need scripted EPUB functionality, so it should be disabled.

### 2.4 Native-feeling text interaction across an embedded document

Selection, selection rectangles, context menus, focus, keyboard commands, overlays, and accessibility all cross the boundary between the app UI and the EPUB document. Translation must anchor to a selection while ordinary Copy and selection behavior remain conventional.

### 2.5 Original-file lifecycle

Files may disappear, change in place, live on removable or network storage, or be re-selected under a different path. Import, duplicate recognition, cover caching, open-time validation, and progress identity must be explicit and must never mutate the source.

### 2.6 Optional networking without contaminating offline reading

Only font downloads and explicit translation requests may need network access. A provider outage, invalid key, font-catalog failure, or offline state must not affect book opening or reading. Keys and selected text must stay outside the untrusted document and UI logs.

## 3. Architecture options considered

### 3.1 Desktop application framework

| Option | Strengths | Weaknesses for this product | Assessment |
|---|---|---|---|
| **Electron** | One TypeScript ecosystem for shell and EPUB integration; bundled Chromium is predictable; mature IPC, native dialogs, menus, packaging, and automation; Readium Desktop is already Electron-oriented | Larger download/RAM footprint; requires disciplined sandboxing and frequent framework updates; visual Windows fidelity is implemented rather than inherited | **Recommended.** The reader is predominantly web-layout work, and delivery/testability outweigh footprint for this MVP. |
| **Tauri 2 + WebView2** | Small binaries; Windows uses the evergreen WebView2 runtime; Rust backend and capability allowlists make privilege boundaries explicit; NSIS/MSI tooling included | Two-language stack; more bridge work; webview/runtime variation; fewer proven desktop EPUB integrations; Windows-native appearance still requires web styling | Strong runner-up if installed size becomes a hard constraint. It does not remove the difficult web-reader work and lowers initial velocity. |
| **WinUI 3 + WebView2** | Microsoft's recommended native framework for new Windows applications; strongest native controls, accessibility, windowing, and Fluent behavior | Splits the UI between XAML/C# and HTML/TypeScript; reader overlays and state cross a higher-friction bridge; more integration and end-to-end test surface | Appropriate if strict native UI fidelity is the dominant requirement. For this content-centric MVP, the hybrid complexity is not justified. |
| **WPF + WebView2** | Very mature .NET tooling and control ecosystem; predictable deployment patterns | Same two-stack reader boundary as WinUI; less natural fit for a new modern visual product; no relevant advantage over WinUI for this greenfield app | Not recommended for new work here. |

Microsoft recommends WinUI 3 for a new *native* Windows application, while WebView2 is the supported embedded HTML engine. That guidance is real, but it does not make XAML the simplest choice for an EPUB reader whose core is HTML/CSS layout. Electron also provides native Windows file dialogs, menus, clipboard behavior, and window controls; Fluent UI and deliberate keyboard/focus work cover the product's Windows-familiarity requirement.

Electron must be kept current because it carries Chromium and Node security responsibility. The application should pin an Electron major, update on a regular cadence, and run its EPUB/security corpus before each upgrade.

### 3.2 UI technology

| Option | Assessment |
|---|---|
| **React + TypeScript + Fluent UI React v9** | Recommended. Mature component/test ecosystem, accessible primitives, Windows-adjacent visuals, and broad familiarity for people and coding agents. Use Fluent for app chrome, not for book typography. |
| Svelte/Vue | Both can reduce component boilerplate, but bring no reader capability advantage and are less likely to match the future contributor pool. |
| Vanilla TypeScript/Web Components | Viable for the reader internals, but less productive for library, settings, dialogs, and stateful overlays. |
| Native XAML shell plus web reader | Best native fidelity, highest cross-boundary cost; rejected with WinUI above. |

Do not add Redux or another global state framework initially. React state/reducers plus small feature services are sufficient. Persisted state lives behind main-process repositories; transient reader state stays within the Reader feature.

### 3.3 EPUB engine

| Option | Strengths | Weaknesses | Assessment |
|---|---|---|---|
| **epub.js 0.3.x** | Small integration surface; BSD license; established use; supports archived EPUB, TOC, themes, selection hooks, conventional paginated/continuous flows, CFI, and scripts disabled by default | Latest npm publication is old; type quality and maintenance cadence are concerns; loading/security model and cross-flow relocation must be proven with selection access | **First spike candidate, not yet the production choice.** Lowest complexity if it passes. |
| **foliate-js** | Modern modular JavaScript, active real-reader use, random-access loading, pagination/progress/CFI, and useful security guidance | Its own README calls the API unstable; fewer versioned releases and less integration documentation; broader format scope is unnecessary | Second spike candidate if epub.js fails. It is evaluated against the same product gates, not assumed to share the same internal topology. |
| **Readium Desktop / r2-navigator-js + r2-streamer-js** | Most complete and standards-oriented desktop stack; active Thorium usage; mature locator, publication, CSS, and accessibility concepts | Electron-coupled multi-package system, local streamer, preload/webview model, and much larger conceptual surface; not designed as a like-for-like adapter for a lightweight engine | Capability fallback requiring a separate architecture/cost reassessment if both lightweight candidates fail. |
| Build a renderer from ZIP/XML/HTML primitives | Full control over page model and security | Reimplements years of pagination, writing-mode, CFI, navigation, CSS, and malformed-book behavior | Rejected. It is not practical or safer for the MVP. |

Engine objects must not leak into persisted data or general React components. The exact reader façade is intentionally deferred until Spike A proves a working engine/topology; only then should an ADR freeze the smallest stable interface supported by that implementation.

### 3.4 Persistence

| Option | Assessment |
|---|---|
| **SQLite in the main process** | Recommended. Atomic transactions, explicit schema migrations, constraints, deterministic tests, and easy evolution. The small data volume does not make these benefits irrelevant. |
| JSON files / `electron-store` | Initially simpler, but atomic multi-record changes, schema migration, corruption recovery, indexing, and concurrent updates become application code. Suitable only for a prototype. |
| IndexedDB in the renderer | Ties durable data to Chromium origin/profile state, weakens the privilege boundary, and complicates backup and integration tests. Rejected. |

Use a pinned, mature SQLite binding such as `better-sqlite3`, accessed only through repositories. Its native-addon rebuild/packaging requirement is known and testable. Do not introduce an ORM; a small set of parameterized SQL migrations and repository methods is clearer for this schema.

### 3.5 AI integration shape

| Option | Assessment |
|---|---|
| **One OpenAI adapter in the main process** | Selected. Keeps the key and network outside renderer/book content, permits deterministic mocks, and avoids building a multi-provider product. |
| Call provider directly from the renderer | Rejected: exposes the key to a larger attack surface and weakens request policy. |
| General local AI runtime | Rejected for MVP: large distribution, model management, hardware variance, and a different product experience. |
| User-configurable arbitrary endpoint/OpenAI-compatible API | Adds SSRF, support, validation, and confusing settings not present in PRODUCT.md. Do not add without a product decision. |

OpenAI is the sole MVP provider and `gpt-5.6-luna` is the initial internal model. Keep the model ID in one validated main-process configuration value owned by the OpenAI adapter so a later app release can change it without database/schema, IPC, or UI changes. The UI exposes only OpenAI key configuration and target language—no provider/model picker or arbitrary endpoint.

### 3.6 Local book handling

| Option | Assessment |
|---|---|
| **Reference original + lazy archive access** | Recommended and required by PRODUCT.md. Preserves user ownership, avoids duplicate storage, and can bound memory when resources are served entry-by-entry. It requires explicit missing/changed-file handling. |
| Copy EPUB into an app-managed library | Operationally convenient and resilient to moved files, but directly contradicts the authoritative product behavior. Rejected. |
| Permanently unpack beside app data | Duplicates potentially large content, expands the attack surface for path traversal and cleanup, and creates many files. Rejected. |
| Extract to a temporary directory per open | Simpler for some engines but causes startup/disk churn and requires crash-safe cleanup. Keep only as a measured fallback if the chosen engine cannot consume the controlled resource protocol. |

The app may retain small derived cover thumbnails and downloaded fonts. Those are disposable app assets, not a second EPUB collection.

## 4. Recommended architecture

### 4.1 Runtime topology

```text
┌──────────────────────────────── Electron main process ────────────────────────────────┐
│ Window/lifecycle  IPC validation  Library service  SQLite repositories                │
│ Publication-session broker        Translation gateway  Secret store  Font service     │
│ Native dialogs/menus              Diagnostics                                         │
└───────────────┬───────────────────────┬────────────────────────────────────────────────┘
                │ narrow helper protocol│ narrow typed IPC via contextBridge
┌───────────────▼───────────────────┐   │
│ Disposable publication helper    │   │
│ ZIP/XML/hash/resource operations │   │
│ No DB, secrets, provider network │   │
└───────────────────────────────────┘   │
                                        │
┌──────────────────────────── sandboxed, context-isolated renderer ──────────────────────┐
│ React app shell                                                                    │
│  ├─ Library feature                                                                 │
│  ├─ Reader feature ─ provisional engine/topology selected by Spike A                │
│  └─ Settings feature                                                                │
│ No Node.js, filesystem, SQLite, secrets, arbitrary fetch, or generic IPC           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

There is one BrowserWindow and one navigation state machine: Library, Reader, or Settings. Do not create separate settings windows or a local HTTP server for the application shell. The helper boundary is a baseline capability/crash boundary; whether it streams publication resources through a custom scheme, another broker, or an engine-specific mechanism remains provisional until Spikes A and B complete.

### 4.2 Process responsibilities

**Main process (trusted):** owns OS integration, database access, secret decryption, translation/font networking, and authorization of user-selected source paths. It brokers publication sessions but does not parse arbitrary ZIP/XML or decompress book entries. It validates every IPC/helper request and response against shared schemas and never accepts raw SQL, URLs, paths, or command names from the renderer when a narrower operation can be exposed.

**Publication helper (untrusted-input worker):** receives only an authorized source path/session and bounded operations. It performs hashing, ZIP inspection, XML/package/TOC parsing, metadata extraction, and entry decompression with incremental accounting, cancellation, and time limits. It has no repository, secret, translation, font-network, shell, or generic IPC capability. A crash or timeout terminates the session and produces a safe import/open failure rather than taking down the main process. The exact Electron `utilityProcess`/child-process mechanism and ZIP library are selected by Spike B.

**Preload (tiny trusted bridge):** exposes an immutable `readerApi` containing intent-level operations such as `chooseBooks`, `listLibrary`, `openBookSession`, `saveLocator`, `translateSelection`, and `saveSettings`. It does not expose `ipcRenderer`, filesystem APIs, HTTP, or generic `invoke(channel, payload)`.

**Renderer (unprivileged UI):** owns React views, overlays, and view state. Where the EPUB engine runs and how it owns frames are provisional outputs of Spike A. The renderer treats all EPUB metadata and content as untrusted display data and receives an opaque book-session identifier rather than a general filesystem path.

**Publication frames (least trusted):** display one publication's content with scripts, forms, popups, top navigation, permissions, and outbound network disabled. They cannot invoke application IPC.

### 4.3 Technology baseline

- Electron, current supported stable major, upgraded deliberately rather than with unbounded version ranges.
- TypeScript in strict mode for main, preload, renderer, shared contracts, and tests.
- React and Fluent UI React v9 for application surfaces; CSS custom properties for reader themes and typography.
- Vite for renderer bundling; Electron Forge for packaging/rebuild integration and distributables.
- SQLite with direct repositories and ordered migrations.
- Zod or an equivalently small runtime-schema library at IPC and provider boundaries. Static TypeScript types alone do not validate hostile or stale runtime data.
- No EPUB engine types in persisted/shared domain contracts. After Spike A, confine the chosen engine and topology to the Reader infrastructure package behind the smallest proven façade.

### 4.4 Repository/module structure

The future codebase should be organized by deployable boundary first and domain feature second, for example:

```text
src/
  main/             # privileged process and composition root
    library/
    publications/
    persistence/
    translation/
    fonts/
    security/
  publication-helper/ # hostile ZIP/XML/hash/decompression boundary
  preload/          # the sole renderer capability bridge
  renderer/
    app/
    library/
    reader/
    settings/
  shared/           # data-only contracts, validation schemas, domain values
tests/
  fixtures/epub/    # redistributable valid, malformed, edge, and malicious fixtures
  integration/
  e2e/
```

`shared` must remain dependency-light and contain no Electron objects, DOM objects, database rows, or renderer-engine types. This keeps agent work separable: storage, translation, library UI, and renderer work can proceed against reviewed contracts without editing the same composition files.

## 5. Component boundaries

### 5.1 Library application service

Coordinates import, duplicate detection, removal, ordering, missing-file checks, and open-book sessions. It returns user-safe error categories (`FILE_NOT_FOUND`, `INVALID_EPUB`, `UNSUPPORTED_EPUB`) plus an internal diagnostic correlation ID. Removing a record deletes derived caches and progress in one transaction but never touches the original path.

### 5.2 EPUB package service

The main-process portion authorizes only files chosen through the native picker or already recorded in the library and supervises a short-lived publication helper. The helper validates ZIP/container/package structure, extracts normalized metadata and TOC, computes identity signals, and performs bounded resource reads for a short-lived reader session. It is the only component that understands archive paths; database rows, decrypted secrets, and general network access are not available inside it.

### 5.3 Candidate publication resource delivery (provisional)

One candidate topology registers two custom secure schemes before Electron is ready:

- `app://` serves only packaged application assets.
- `book://<opaque-session>/<normalized-entry>` serves only entries in the currently opened EPUB.

Do not use `file://`. If this topology wins, the main-process protocol handler maps an opaque, unguessable session to one approved helper session and never parses/decompresses the archive itself. The helper canonicalizes archive paths, rejects traversal/absolute paths/symlinks, enforces declared and expanded-size limits incrementally, and returns bounded bytes plus a verified MIME type. Each book session receives a distinct origin-like host. The scheme must not be registered with `bypassCSP`.

This protocol is not an approved engine-independent contract. The adapter must not work around cross-origin limitations by disabling `webSecurity`. Some engines fetch XHTML and write it into a sandboxed document so the host can observe selection; others navigate a frame to the publication origin and need a narrowly isolated content bridge. Spike A must determine which model the selected engine can secure and may replace this protocol design. A unique publication document origin is preferred; if epub.js can function only by combining same-origin publication DOM with executable book script, it fails the security gate. In every acceptable model, publication scripts remain off and the app preload is not injected into publication subframes.

### 5.4 Reader domain controller

Owns mode, active locator, active navigation section, TOC navigation, appearance application, control visibility, selection state, and translation surface state. The following is a requirements sketch for Spike A, not an interface safe for parallel implementation:

```text
open(session, initialLocator, preferences)
close()
goTo(locator | tocTarget)
nextPage() / previousPage()
setMode(mode, anchorLocator)
setAppearance(preferences, anchorLocator)
getCurrentLocator()
onLocationChanged / onSelectionChanged / onDocumentError
```

Spike A must extend or reshape this façade to cover the selected topology's resource loading, frame lifecycle, user-style injection, selection bridge, locator conversion, security enforcement, and cleanup. The resulting ADR—not this sketch—is the implementation contract. Its purpose remains to keep engine objects out of general React components and persisted data.

### 5.5 Translation gateway

Accepts only `{selectedText, targetLanguage, requestId}` after renderer and main-process length validation. It constructs the fixed system/developer prompt and calls the OpenAI Responses API through an OpenAI-specific adapter using an internally configured model ID (`gpt-5.6-luna` initially), with no tools enabled. It applies timeouts/cancellation, validates and bounds the response, and maps OpenAI failures to stable product-facing categories. It returns normalized plain Unicode text only; it never persists source or result. The UI renders it through normal framework escaping/text nodes and never interprets it as HTML, Markdown, links, images, or other executable/rich content.

### 5.6 Font service

Owns a small versioned catalog manifest bundled with the application, an HTTPS origin allowlist, expected length/hash validation, atomic installation, and installed-font inventory. Each bundled entry includes approved license/family metadata and a fixed download location/hash. Updating the application updates the catalog; a separately mutable or signed remote catalog is deferred until there is a real independent-update requirement. Reader CSS can reference installed font resources through a controlled application asset route. EPUB content cannot discover arbitrary files in the font directory.

### 5.7 Persistence and secret services

Repositories expose domain operations, not SQL. The secret service alone calls Electron `safeStorage`; the API key never crosses into the renderer. The renderer receives only configured/not-configured status and masked provider metadata if the product later needs it.

## 6. Data and storage approach

### 6.1 Filesystem layout

Electron's default Windows `userData` location is derived from roaming `%APPDATA%`, which is wrong for machine-local absolute paths and DPAPI-protected bytes. Resolve an app-specific directory under the Windows Local App Data known folder and set Electron's `userData` and `sessionData` paths before initialization:

```text
%LOCALAPPDATA%/<Publisher>/<Product>/Data/
  library.sqlite3
  covers/            # derived, disposable cover thumbnails only
  fonts/             # verified optional fonts and catalog metadata
  logs/               # bounded local diagnostics; no keys or selected/book text

%LOCALAPPDATA%/<Publisher>/<Product>/Session/
  chromium/           # disposable Chromium session/cache data
  publications/       # disposable helper/session data, if the selected topology needs it
```

No MVP preference is intentionally roamed. An EPUB is never placed below app data. Covers and other derived thumbnails are caches, not replacement book copies. Deleting a library entry may remove its derived cover and locator; it must not call delete on the source path. Packaged install, upgrade, uninstall, and data-retention tests must exercise the explicit paths.

### 6.2 Logical schema

Keep schema details private to repositories, but model these concepts:

- `books`: stable app UUID, original path, normalized comparison path, file size/mtime snapshot, content SHA-256, publication identifier if valid, title/authors, cover-cache key, import time, last-opened time, and format/profile flags.
- `reading_positions`: one row per book with versioned locator JSON and update time.
- `settings`: versioned global reader preferences, mode, target language, and non-secret OpenAI configuration status/version where needed. The internal model ID is application configuration, not a user setting.
- `installed_fonts`: catalog ID/version, family metadata, local asset key, hash, license/catalog metadata.
- `secrets`: the DPAPI-protected OpenAI API-key bytes, or an equally narrow separate encrypted store.
- `schema_migrations`: applied migration IDs.

Use foreign keys and transactions. Rollback-journal mode is sufficient for this single-process, low-write workload and makes backup/recovery simpler than WAL's multi-file state. Debounce position updates in the UI, then write the latest locator on meaningful relocation, navigation, return to library, window close, and graceful shutdown. The database transaction, not synchronous UI blocking, provides durability.

### 6.3 Duplicate and changed-file identity

Keep Windows path comparison separate from publication identity. Store the user-selected display path and a best-effort normalized comparison path. Comparison is case-insensitive and normalizes separators/drive-letter form when possible, but must not require resolving a currently missing/inaccessible target. Junctions, aliases, UNC forms, and network/removable availability mean path equality is evidence of the same recorded location, not proof of the same bytes.

Use explicit evidence tiers:

1. same recorded/comparison path plus same SHA-256: the existing unchanged entry;
2. different path plus same SHA-256: exact byte duplicate candidate, eligible for the product's replace confirmation;
3. same path plus changed SHA-256: changed-in-place publication requiring validation and automatic safe locator migration;
4. matching EPUB package identifier without matching bytes: weak “possibly the same publication/edition” evidence only, never enough by itself to declare an exact duplicate;
5. size and modification time: cheap signals that hashing/revalidation is required, never identity.

For changed/replacement bytes, keep the old fingerprint, metadata, and locator until the new EPUB validates. Then attempt to resolve the existing precise locator against the replacement. If it resolves reliably, commit the replacement and preserve progress. If not, commit the valid replacement with reset progress and clearly tell the user that progress could not be preserved. Byte-identical EPUBs retain progress normally. Do not add a progress-migration choice/dialog in the MVP, silently update a failed/invalid replacement, or treat package-identifier equality alone as safe migration evidence.

### 6.4 Reading-position representation

Separate a precise content anchor from the user-visible navigation section. Persist a versioned locator containing:

```text
publication-relative spine href
progression within that spine item, clamped to [0, 1]
optional EPUB CFI for precision
optional normalized text-quote context (exact/prefix/suffix) for recovery
optional total progression for display/diagnostics, never as the only anchor
optional navigation-entry identifier/path and progression within its derived range
```

Parse EPUB Navigation Document/NCX targets into ordered anchors in reading order, including fragment anchors within a resource. Derive navigation ranges between anchors; do not assume one spine item equals one chapter. A logical range may start mid-resource or span resources. The deepest currently active navigable TOC entry supplies the toolbar chapter/section label and chapter-level progress. If no usable navigation structure exists, show the publication title and overall book progress.

On restore, try the precise CFI if it resolves; otherwise resolve text context near the saved resource progression; otherwise use the stored navigation-range progression when that range still resolves; finally use the range/resource start. On a mode switch, capture the top/primary visible precise locator before layout, apply layout, then navigate back to it. On an appearance or window reflow, navigate to the active navigation-range start; if no usable range exists, navigate to the current spine-resource start. Displayed chapter progress is calculated within the selected navigation range, not automatically within the containing spine item.

Do not persist generated page number, scroll offset, DOM node references, viewport coordinates, or an engine-specific opaque object as the only location.

## 7. EPUB rendering approach

### 7.1 Import and open path

1. The native Windows picker returns one or more `.epub` paths to the main process.
2. The main process authorizes each read-only path; a supervised publication helper validates ZIP/container/OPF/navigation structure and quotas incrementally, computes identity, and extracts normalized metadata/cover bytes.
3. Only successfully parsed books are committed to the library.
4. Opening creates a short-lived opaque publication/helper session for that one archive.
5. The Spike A topology opens the publication and reads resources lazily through its approved resource bridge; `book://` is the leading candidate, not a settled contract.
6. Closing the reader revokes the session and archive handle.

Do not permanently unpack books. Lazy bounded resource access limits disk churn, avoids path-escape extraction bugs, and respects original-file ownership. Bound the number of open archive handles and release them deterministically. The main process brokers/supervises but does not decompress or XML-parse publication data.

### 7.2 Page modes

Page-by-page mode uses CSS multi-column pagination or the engine's equivalent with one logical page per viewport-width page surface. Navigation advances one generated page and reports the locator of the leading visible text.

Continuous mode uses the chosen engine's conventional vertically scrolling reflowable flow. It does not paginate content into a vertical stack and does not simulate page gaps. The engine may load/virtualize adjacent spine resources in its normal supported way. Chapters can be separated with modest spacing or another engine-supported transition, without inventing individual page surfaces.

When switching modes, capture the leading/primary visible logical locator, change the engine flow, wait for reflow, and navigate back to that locator. Exact pixels and generated page numbers are not preserved; the acceptance target is the same passage as closely as reasonably possible. In paginated mode, a new chapter starts on a fresh generated page. In continuous mode, chapter content follows the engine's normal vertical reading flow.

### 7.3 Appearance precedence

Apply reader preferences as a versioned user stylesheet injected after publication styles, limited to the adjustable properties. Preserve author alignment unless missing. Theme overrides page foreground/background and safe link colors. Font/margin/spacing controls update live, but a relocation transaction preserves the anchor across re-pagination.

Book CSS must not style application chrome or translation overlays because publication content lives inside its own frame. App UI tokens and reader typography tokens are separate.

### 7.4 Selection and context menu

The renderer adapter normalizes selection to text, range locator, and viewport rectangles. The Reader feature positions the Translate action and bubble using those rectangles, clipping/flipping to available space. It keeps an application-owned highlight/decoration when focus moves to the bubble or expanded overlay.

Electron does not supply the full browser context menu automatically as a product experience. Handle the frame's context-menu event and present a native menu with enabled standard roles such as Copy/Select All (and Cut/Paste where editable), plus no AI command. The separate near-selection Translate action satisfies PRODUCT.md without replacing normal right-click behavior.

### 7.5 Unsupported publications

Detect DRM/encryption, invalid packages, fixed-layout metadata, required scripted content, media-overlay dependencies, and unsupported unusual features before entering the reader when possible. Map these to a friendly invalid/unsupported result. The MVP supports ordinary reflowable EPUB 2 and EPUB 3; it does not execute publication scripts or add alternate layout/read-aloud systems to make excluded profiles work.

## 8. AI translation architecture

### 8.1 Data flow and consent boundary

```text
select text locally
  → show Translate action (no network)
  → explicit click
  → validate length/configuration
  → main-process translation gateway
  → allowlisted OpenAI HTTPS API
  → normalized result/error
  → temporary bubble/overlay
```

Selection events never call the network. The first Translate click is the consent event. If configuration is missing, keep only an in-memory pending translation intent identified by book/session and selection locator, then open AI Settings. After a successful **Save**, return to the reader and automatically continue that already-requested translation when the session and preserved selection are still valid. If they are no longer valid, return without submitting stale text and ask the user to select again. `Test connection` is an optional diagnostic action, not a save prerequisite, and no second Translate confirmation is introduced.

### 8.2 Provider adapter

Define a narrow internal OpenAI adapter with `testTranslationConnection` and `translate`. `testTranslationConnection` is a named main-only operation: it accepts no book text or caller-selected provider/model/URL, sends one fixed minimal non-book payload through the same fixed Responses client/model, validates its small response, maps the same safe error categories, and never logs or persists request/response text. A settings-specific typed preload intent may request it, but it is optional and never required for Save or Translate. Use the official OpenAI SDK with the Responses API, provided it preserves explicit timeouts/abort behavior; otherwise call that API directly. The adapter owns one internal model configuration value, initially `gpt-5.6-luna`. Do not persist the model as a user setting or expose provider, model, temperature, prompt, base URL, or endpoint controls. Use no tools or conversation state for translation requests and request a small validated response shape.

The predefined prompt should:

- place instructions separately from source text;
- delimit the source as data;
- request translation only into the selected target language;
- preserve meaning and basic paragraph structure;
- return only a machine-validated result shape;
- state that instructions inside the source are content, not commands.

Prompt injection cannot be “solved” by wording alone, but the only capability available to the model call is returning text. No tools, browsing, file access, conversation history, or application command execution are attached, so a malicious passage has little leverage.

Provider output is untrusted data even when it matches the response schema. Enforce a bounded response size in main and renderer, normalize disallowed control characters while preserving ordinary Unicode/paragraphs, and render only as escaped plain text. Copy copies that same plain text. Never pass the result to `innerHTML`, a Markdown renderer, linkifier, image loader, or URL opener.

### 8.3 Key storage

Use asynchronous Electron `safeStorage` in the main process and persist only the encrypted blob. On Windows this is protected by DPAPI for the current user. This protects the key from other Windows users and accidental plaintext inspection, not from malware running as the same user; Settings copy should not claim stronger protection.

Windows Credential Manager is a credible alternative, but typical Node integrations add another native dependency and a separate lifecycle/API surface. Plaintext settings or reversible app-owned encryption provide materially weaker protection. `safeStorage` is preferred because it is maintained with Electron, uses the operating-system protection already available to this Windows app, and keeps the secret implementation behind one replaceable service.

Saving replaces the encrypted value atomically. Remove-key deletes it and clears in-memory provider clients. The app never logs, returns, or displays the full key after save. A renderer compromise can request the narrow `translate` operation but cannot read the key; main-process length, rate, session, and sender checks constrain abuse.

### 8.4 Reliability and privacy

- Validate the approximate 5,000-character limit in both renderer and main process. Make the exact number configuration, not schema.
- Use abortable requests, a finite timeout, bounded retry only for safe transient failures, and one active request per translation surface.
- Map authentication, network/offline, throttling, timeout, provider, and cancellation errors to product-safe messages.
- Do not cache or persist source/translation text and do not include it in diagnostics.
- Send only selected text, target language, and the minimum fixed instructions. No title, author, surrounding chapter, library, or device identifiers.
- Restrict main-process translation requests to OpenAI's documented HTTPS API hosts. Font downloads use a separate allowlist.

`Test connection` invokes `testTranslationConnection`, a tiny fixed non-book payload through the same OpenAI Responses API and configured model. It validates only the saved key and current access to `gpt-5.6-luna`; it consumes a small amount of API usage and cannot guarantee future quota or outage availability. It is optional and never a prerequisite for save or translation.

## 9. Security model

### 9.1 Trust zones

From most to least trusted:

1. signed application code in the Electron main process;
2. minimal preload bridge;
3. bundled app renderer code;
4. the bounded publication helper and its validated messages;
5. EPUB metadata, archives, and publication documents;
6. remote translation/font services and their responses.

Data is validated whenever it crosses toward a more trusted zone. The renderer is not trusted merely because its initial HTML is bundled; an EPUB/parser/XSS issue must not become filesystem or secret access.

### 9.2 Electron hardening baseline

- `nodeIntegration: false`, `contextIsolation: true`, renderer `sandbox: true`, `webSecurity: true`.
- No remote application code, inline executable script, `eval`, or development tools in release builds.
- Restrictive app CSP; no general renderer `connect-src` network access.
- Custom protocols instead of `file://`.
- Deny permissions by default, deny new windows/popups/downloads, and block top-level navigation away from `app://`.
- Validate IPC sender frame/origin, channel payload, authorization to the active book session, and response shape.
- Expose no generic shell/open-path/fetch/read-file IPC. Intercept publication link activation. For an explicit HTTPS link, show an app-owned confirmation containing the normalized destination host and full destination URL; only on confirmation may a narrow main-process operation open that validated URL in the system browser. Never navigate the reader to it, and reject non-HTTPS external schemes in the MVP.
- Enable appropriate Electron fuses to disable unused capabilities, including packaged-app Node CLI/debug behaviors where compatible with the test setup.
- Code-sign releases and keep Electron/current dependencies on a scheduled update cadence.

### 9.3 EPUB containment

- Disable all publication scripts, event-handler attributes, forms/submission, plugins/objects, service workers, storage, downloads, popups, and permissions.
- Inject or enforce a publication CSP roughly equivalent to `default-src 'none'`, allowing styles, fonts, images, and media only from that publication's `book://` origin plus narrowly required `data:`/`blob:` cases. `script-src 'none'`, `connect-src 'none'`, `frame-src 'none'`, `object-src 'none'`, `form-action 'none'`, and `base-uri 'none'` are the starting point.
- Block remote publication resources in the MVP. This protects offline behavior and prevents tracking. Missing remote assets should degrade as unsupported/missing content, not trigger network access.
- Assign a distinct resource authority/session to each opened publication. Do not share cookies/storage; preferably disable persistence for the book partition entirely.
- Parse XML with external entities and DTD fetching disabled.
- Enforce archive quotas: entry count, total expanded bytes, individual entry size, compression ratio, nesting/path length, and image dimension/decoded-size limits. Abort cleanly on quota violation.
- Normalize paths before lookup and reject `..`, absolute paths, drive/UNC syntax, NUL, ambiguous separators, and duplicate normalized names.
- Perform archive hashing, ZIP/XML parsing, metadata extraction, and entry decompression in the supervised publication helper, not main. Apply entry count, expanded-byte, compression-ratio, and time/cancellation limits before or during allocation/streaming; terminate and recreate a stuck/crashed helper.
- Keep arbitrary image decoding out of main. Let the sandboxed Chromium image decoder handle book images where possible; bound cover bytes/dimensions before creating display assets.

Sanitizing HTML is useful defense in depth but is not the primary boundary because an aggressive sanitizer can break valid EPUB semantics and CSS. Script-off sandboxing, unique publication resource scope, CSP, confined resource delivery, and disabled network remain mandatory even if markup sanitation is added.

### 9.4 Other sensitive data

Library paths reveal user information. Keep them local, do not emit them to telemetry, and redact them from normal logs. Diagnostic logs are bounded, local, and contain categories/correlation IDs rather than book text, selections, keys, or provider response bodies. The proposal assumes no telemetry for MVP.

## 10. Testing strategy

### 10.1 Test pyramid

**Unit tests (fast, majority):** domain identity rules, locator fallback/resolution, progress calculations, preference validation, path normalization, archive quotas, provider error mapping, prompt construction, and database migrations. Use Vitest or the standard Node test runner consistently rather than both.

**Component tests:** React Testing Library for library, settings, overlays, keyboard/focus behavior, and error states. After Spike A freezes the reader façade, the Reader UI uses a fake implementation so most interaction tests do not load a real book.

**Reader integration contract tests:** define these only after Spike A. Verify open/close, resource/frame lifetime, TOC and navigation ranges, relocation, CFI/progression, mode changes, selection geometry, themes, security enforcement, and cleanup. They protect the chosen integration and any later replacement; they do not imply that Readium or every engine is a drop-in swap.

**Persistence/integration tests:** create a fresh temporary user-data directory and real SQLite database; run every migration from supported prior versions, transactions, remove cascades, encrypted-key lifecycle through a mock secret backend, and changed/missing-file flows.

**Electron end-to-end tests:** Playwright's Electron support is currently marked experimental, so keep the suite focused: first run, native picker stub, import, double-click open, both reading modes, TOC, appearance reflow/restore, app restart/position restore, missing file, translation success/error/configuration flow, and removal. Native dialogs are stubbed at the Electron main boundary as Playwright recommends; a small manual/packaged Windows smoke test covers actual OS dialogs and context menus.

### 10.2 EPUB corpus

Commit only redistributable fixtures and record their provenance/license. Include:

- minimal EPUB 2 and EPUB 3 reflowable books;
- nested TOC, two chapters sharing one XHTML resource, one chapter spanning multiple resources, absent/malformed TOC, multiple authors, absent metadata/cover, embedded and obfuscated fonts, images/SVG, RTL and vertical-writing samples if in supported scope;
- long chapters, many chapters, large images, unusual CSS, footnotes/internal links;
- malformed ZIP/container/OPF/navigation and missing resources;
- zip-slip paths, XML entities, huge compression ratios, remote URLs, scripts, forms, iframes, SVG scripting, CSS URL exfiltration, and attempted app/protocol navigation.

Use relevant Readium/W3C public test publications where license permits, plus small hand-authored fixtures targeting product contracts. Never base compatibility confidence on one sample novel.

### 10.3 Non-functional gates

- Visual snapshots at a small matrix of window sizes, scaling settings, reader themes, and modes; review intentionally rather than asserting every browser pixel.
- Keyboard and focus-path tests, screen-reader smoke checks with Windows Narrator, and automated accessibility scans for app UI. Publication accessibility cannot be repaired wholesale, but the reading system must not make it worse.
- Cold start, time-to-first-page, re-pagination latency, wheel/page navigation, and memory tests on a representative ordinary book plus a large stress fixture.
- Offline tests that deny all networking and still exercise every non-AI/non-download acceptance path.
- Packaged-build tests on supported Windows versions/architectures. Development mode is not a release surrogate.
- Dependency/license/security scanning and a release test that asserts hardened Electron preferences and CSP.

## 11. Packaging and distribution approach

Use **Electron Forge** to package a signed direct-download Windows `Setup.exe`. Forge is Electron's recommended packaging route and integrates native-module rebuilds. Produce a Windows 11 x64 per-user installer (Squirrel.Windows or another reviewed Forge maker) and a zipped unpacked artifact only for internal diagnostics. Do not make a portable mutable-data build the primary product.

Release requirements:

- Target and test Windows 11 x64 only for MVP. Do not produce ARM64 or 32-bit artifacts.
- Authenticode-sign the executable and installer. Unsigned Windows desktop software creates avoidable SmartScreen friction and weakens release trust.
- Reproducible lockfile install, SBOM/license inventory, hashes, and retained build provenance.
- Clean-machine install, launch, upgrade, uninstall, and retained-user-data tests.
- Uninstall removes application binaries; user-data removal should be an explicit user choice, not automatic loss of library/progress.

Microsoft Store/MSIX, ARM64, and auto-update are deferred. Keep ordinary platform-neutral domain code, stable app identity, and forward database migrations, but add no Store packaging, ARM build, or update-service work solely for possible future distribution.

Electron bundles its Chromium runtime, so it does not depend on a separately installed WebView2. This increases package size but removes renderer-version variability and offline bootstrap concerns. Tauri would materially improve installer size; that trade should be revisited only if a size target is established.

## 12. Important architectural risks

| Risk | Impact | Mitigation / trigger |
|---|---|---|
| Chosen engine cannot preserve a meaningful locator across conventional continuous/paginated flows | Mode switching or restoration lands at the wrong passage | Spike A verifies cross-flow relocation on representative books; retain the composite locator and engine-specific conversion inside the reader integration. |
| epub.js maintenance/type debt | Upgrade and Chromium regressions become ours | Pin exact version, own adapter tests and small compatibility patches; switch if patch burden exceeds the adapter. |
| CFI/location drift across malformed or replaced books | User resumes at wrong passage | Composite locator and fallback chain; validate replacement first; preserve only when the old locator resolves reliably, otherwise reset and notify. |
| EPUB content escapes its frame or makes network requests | Secret/file/privacy compromise | Scripts off, unique sessions, strict CSP/resource bridge, no renderer Node/network, IPC sender checks, malicious corpus. |
| ZIP/image bombs or parser faults exhaust/crash the publication helper | Import/open fails; repeated hostile inputs may cause denial of service | Required helper boundary and Spike B; incremental quotas, timeouts, cancellation, crash recovery, lazy reads, and decoded-image limits. Main remains responsive. |
| Publication helper is process-isolated but not necessarily an OS security sandbox | A parser remote-code-execution flaw could retain same-user OS access even without app secrets/repositories wired in | Prefer memory-safe/pure libraries, least helper surface, current dependencies, no credentials/network clients, and renderer sandbox for active content; reassess AppContainer-level isolation only if threat model or library evidence warrants the added complexity. |
| Author CSS conflicts with user appearance | Unreadable books or broken layout | Scoped user stylesheet with explicit precedence and compatibility corpus; avoid broad CSS reset. |
| Native SQLite addon complicates Electron upgrades | Packaging/build failures | Forge rebuild in CI and packaged smoke test on every Electron bump; repository keeps binding replaceable. |
| OpenAI/model changes alter translation quality, price, or API behavior | User-visible failures/cost changes | Narrow OpenAI adapter, centralized `gpt-5.6-luna` configuration, contract mock plus opt-in live smoke test, friendly error mapping. |
| DPAPI protection is misunderstood as a vault against same-user malware | False security promise | Accurate settings copy, least privilege, never expose key, no plaintext logs. |
| Font catalog introduces licensing or supply-chain problems | Legal/security issue | Small app-bundled catalog, owner-approved licenses, fixed HTTPS origins, and per-file hashes. No remote catalog update mechanism in MVP. |
| Electron footprint feels disproportionate | Product perception/distribution cost | Measure signed installer and idle/reading memory after vertical slice; reconsider Tauri only against an explicit target. |
| Browser/runtime upgrade changes pagination | Location/visual regressions | Golden corpus and performance/visual gates before Electron major upgrades. |

## 13. Technical assumptions

These assumptions are necessary to propose an architecture; they are not new product features:

- MVP is a single-user, single-window application and opens one book at a time. No operating-system single-instance lock or second-launch behavior is specified.
- Ordinary reflowable EPUB 2/3 is the MVP compatibility target. Fixed-layout, required scripted content, media-overlay/read-aloud features, DRM, and other unsafe/unsupported unusual features are explicitly rejectable.
- Publication scripts and remote publication resources are disabled for MVP.
- No analytics or crash-upload service is included. Local redacted diagnostic logs are acceptable.
- OpenAI is the sole MVP AI provider; users enter an OpenAI API key. The internal model is initially `gpt-5.6-luna`. There is no arbitrary endpoint, provider picker, or model picker.
- The app may cache a derived cover and downloaded font, but never an EPUB copy or translation.
- File references may point to removable/network storage. Availability and performance are checked at open; the app does not mirror such files.
- The default font has a redistribution license permitting bundling. Optional fonts have approved download and redistribution/use terms.
- Accessibility, high-DPI scaling, keyboard use, and Windows Narrator are quality requirements even though detailed conformance level is not specified.
- MVP packaging/support is Windows 11 x64 through a signed direct-download `Setup.exe`; Store/MSIX, ARM64, and 32-bit Windows are out of scope.
- Exact version numbers are chosen and recorded at implementation start after the renderer spike; this proposal intentionally avoids freezing September 2026 package versions without a lockfile.

## 14. Remaining non-blocking product details

No owner decision blocks technical validation. The following details remain open in PRODUCT.md and can safely wait for their feature-design phase:

- exact title, author, and cover fallbacks for missing metadata;
- whether reaching the end creates a distinct **Finished** state;
- exact bundled/downloadable font catalog contents and organization;
- final translation character limit after usability/cost validation;
- detailed visual dimensions, transitions, and final wording.

The schema and boundaries do not hard-code these outcomes. Auto-update, Microsoft Store, ARM64, and 32-bit distribution are deferred rather than unresolved MVP decisions.

## 15. Proposed technical spikes

### Spike A — renderer, location, and containment proof (mandatory)

**Historical status:** The original Spike A lightweight-engine timebox ended without a selected renderer. Its appearance-position gate is superseded only by the owner decision recorded in `SPIKE-003-EPUBJS-ADOPTION-VALIDATION.md`; it is not evidence that epub.js passed the original exact-passage contract.

**Question:** Which engine *and complete publication integration topology* can satisfy the page, location, selection, and containment requirements?

**Timebox:** 3–5 engineering days as a decision timebox before application scaffolding expands beyond a disposable harness. The timebox is not permission to relax acceptance criteria; if it expires without a passing lightweight option, stop and reassess.

Build a throwaway Electron harness, not production UI, and test epub.js against a representative subset of the committed corpus. The output must select resource delivery, publication origin/frame ownership, CSP/sandbox enforcement point, selection bridge, user-style injection, locator conversion, cleanup, and the smallest viable reader façade together. Prove:

- horizontal one-page navigation with the required keyboard/mouse inputs;
- conventional vertically scrolling reflowable continuous mode using the engine's supported flow;
- conventional paginated/column flow with chapter-on-fresh-generated-page behavior;
- mode changes that retain the same leading passage, and appearance/window reflow that returns to the start of the active TOC section (or otherwise remains in the same spine resource);
- close/reopen restoration using the proposed composite locator;
- hierarchical TOC navigation and navigation-range progress where chapters share a resource or span resources;
- deepest-active navigable TOC labeling/progress, with publication-title and overall-progress fallback when navigation is unusable;
- friendly rejection of fixed-layout, required-script, DRM, and unsupported media-overlay/unusual fixtures;
- selectable text, selection rectangles, retained highlight, native Copy context action, and anchored/expanded translation surfaces without exposing preload/IPC to book frames;
- scripts, forms, remote requests, navigation, popups, storage, service workers, app IPC, and cross-book access blocked under the candidate topology;
- keyboard, wheel, far-edge clicks, context menu, focus, and basic Narrator behavior;
- bounded memory and acceptable time-to-first-page, scroll/page latency, and re-pagination latency on ordinary and stress books.

**Exit rule:** choose epub.js only if its native/supported continuous and paginated flows meet interaction, relocation, accessibility, performance, and security gates without disabling `webSecurity`, running publication scripts, exposing app IPC/preload, or requiring a deep fork. If it fails, run the same product/security experiment—not an assumed drop-in contract—on foliate-js. If both fail, stop and estimate a Readium-based topology as a separate architecture; do not assume it fits the same façade. Record the passing topology and measured evidence as an ADR.

This spike is justified because the engine, frame/origin model, selection bridge, location mapping, and security policy are coupled and expensive to reverse.

### Spike 003 — epub.js remaining adoption gates (owner-authorized; terminally escalated)

The owner elected to continue evaluating epub.js after explicitly relaxing only the appearance/window-reflow exact-position requirement. The initial run and one authorized targeted rerun are now terminally escalated: host hardening and a narrow fresh-chapter-page observation are supported, but the remaining adoption gates are invalid or unresolved rather than passed or contradicted. This does not alter SPIKE-001's historical behavioral result or select/reject epub.js for the relaxed contract. See `docs/historical/spikes/SPIKE-003-ESCALATION.md`. A new owner-authorized validation scope, a reviewed pass of that scope, and the separate mandatory archive/resource-boundary proof remain required before a renderer ADR or reader implementation planning.

### Spike B — archive/resource boundary proof (mandatory)

**Question:** Can the intended ZIP/XML libraries and a small supervised helper enforce limits before dangerous allocation/decompression while keeping main responsive?

**Smallest useful experiment:** a command-style helper prototype, with no UI, that receives an authorized fixture path and supports inspect plus bounded entry-read operations. Exercise incremental entry-count/expanded-byte/compression-ratio limits, path normalization, duplicate normalized names, external entity/DTD denial, cancellation, hard timeout, helper crash recovery, and backpressure. Include zip-slip, malformed central directories, huge entries, high-ratio archives, and truncated XML. Then run the deep-marker fixture through the exact Electron 38.7.2 + epub.js 0.3.93 `book://` session topology, proving OPF/nav/internal CSS/image/font resolution, actual publication-frame origin/selection geometry/no-app-bridge state, CSP/session revocation, and explicit package/nav XML parser placement. Confirm that metadata/cover extraction and candidate resource delivery do not require unbounded whole-book or whole-entry allocation.

**Success criteria:** hostile fixtures produce bounded typed failures; cancellation/timeout terminates work; helper crash/restart does not crash main; main remains responsive; exposed helper operations accept only authorized session paths and have no repository, secret, shell, or provider-network messages; chosen libraries can stream or otherwise reject from metadata before unsafe allocation. The exact `book://` run must show that all required package resources resolve through a revocable session, no publication frame has an app bridge, and either helper-only package/nav parsing or explicitly bounded, helper-validated sandboxed renderer parsing is used.

**Failure rule:** reject a library/topology that materializes untrusted entries before limits can be enforced. Try a streaming-capable library or reduce the operation. Stop before Reader Phase 2 if epub.js requires whole-archive renderer loading, unvalidated package/nav XML outside the bounded sandboxed-renderer branch, a generic bridge, or security relaxation. If no practical Node helper/topology meets the criteria, reassess the parser boundary/runtime before implementation planning.

This spike fixes the helper mechanism, archive/XML libraries, message contract, and quota-enforcement points. It does not expand into general process orchestration.

No separate spikes are justified for React, Fluent UI, SQLite, DPAPI/`safeStorage`, Electron Forge, or the native picker; verify those during the first vertical slice.

## 16. High-level implementation phases

These are architectural increments, not a detailed task backlog:

1. **Risk closure and foundations:** complete Spikes A and B, record ADRs, then establish the frozen process/reader boundaries, typed IPC, security defaults, SQLite migrations, Windows 11 x64 CI, and a signed-development packaging path.
2. **Local library vertical slice:** native picker through validated EPUB import, metadata/cover cache, persistence, visual library, duplicate/missing/invalid flows, and safe removal.
3. **Reader core:** book resource sessions, chosen engine adapter, both modes, TOC, composite position save/restore, keyboard/mouse behavior, and global appearance.
4. **Fonts and polish:** bundled font, verified catalog/download/install/offline flow, accessibility, performance, visual refinement, and recovery states.
5. **Translation:** OpenAI Responses adapter with centrally configured `gpt-5.6-luna`, DPAPI-backed key lifecycle, test connection, explicit selection flow, anchored/expanded surfaces, cancellation/retry, and privacy/error handling.
6. **Release hardening:** hostile EPUB corpus, packaged Windows matrix, dependency and Electron upgrades, installer/upgrade/uninstall tests, signing, diagnostics, and final acceptance against PRODUCT.md.

Each phase should leave a runnable vertical increment and maintain the process/security boundaries. Detailed implementation tasks should be created only after this proposal and the renderer ADR are approved.

## Research basis

Primary and project-maintainer sources used for consequential claims:

- Microsoft: [Choose a Windows development path](https://learn.microsoft.com/en-us/windows/apps/get-started/) and [WebView2 in WinUI 3](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/webview2).
- Tauri: [Windows prerequisites](https://v2.tauri.app/start/prerequisites/), [capabilities](https://tauri.app/security/capabilities/), [CSP](https://v2.tauri.app/security/csp/), and [Windows installers/WebView2 choices](https://v2.tauri.app/distribute/windows-installer/).
- Electron: [application data paths](https://www.electronjs.org/docs/latest/api/app), [security checklist](https://www.electronjs.org/docs/latest/tutorial/security), [process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox), [custom protocols](https://www.electronjs.org/docs/latest/api/protocol), [native dialogs](https://www.electronjs.org/docs/latest/api/dialog), [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage), and [distribution overview](https://www.electronjs.org/docs/latest/tutorial/distribution-overview).
- EPUB engines: [epub.js README](https://github.com/futurepress/epub.js/), [epub.js API](https://github.com/futurepress/epub.js/blob/master/documentation/md/API.md), [foliate-js README](https://github.com/johnfactotum/foliate-js/blob/main/README.md), [Readium architecture](https://readium.org/architecture/projects.html), [Readium r2-navigator-js](https://github.com/edrlab/r2-navigator-js), and [Thorium Reader](https://github.com/edrlab/thorium-reader).
- Standards: [EPUB 3.3](https://www.w3.org/TR/epub-33/) and [EPUB Reading Systems 3.3](https://www.w3.org/TR/epub-rs-33/), especially their security, scripting, resource-origin, and reflow requirements.
- Data and tests: [SQLite transactions](https://www.sqlite.org/transactional.html), [SQLite WAL tradeoffs](https://www.sqlite.org/wal.html), and [Playwright Electron automation](https://playwright.dev/docs/api/class-electron).
- UI: [Microsoft Fluent UI](https://github.com/microsoft/fluentui).
- OpenAI: [`gpt-5.6-luna` model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
