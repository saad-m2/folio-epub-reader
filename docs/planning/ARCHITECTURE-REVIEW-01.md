# Architecture Review 01: Windows EPUB Reader

> Historical review. Its hostile-publication and helper findings are superseded by the trusted-local binary-handoff decision in `ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`.

**Review status:** Independent senior technical review  
**Reviewed sources:** `docs/PRODUCT.md` and `docs/planning/TECHNICAL-PROPOSAL.md`  
**Product authority:** `docs/PRODUCT.md`  
**Date:** 2026-09-16

## Overall assessment

The proposal is stronger than a typical first architecture pass. It correctly identifies the genuinely hard parts of this product: vertically stacked reflowed pages, stable locations across reflow, selection geometry, hostile EPUB containment, source-file lifecycle, and explicit AI consent. Its choice of Electron is reasonable for this product, not merely fashionable: the core reader is browser-layout work, and a native XAML shell would create a second UI stack without removing the difficult reader work. React, a narrow preload API, SQLite without an ORM, and OS-backed key protection are also defensible choices.

However, the proposal is not ready to drive implementation planning unchanged. It claims more renderer independence than the design has actually earned, models “chapter progress” as spine-item progress even though those are not equivalent, leaves changed-in-place EPUB behavior unsafe or ambiguous, and puts too much hostile archive processing in the process that also owns the database and secrets. There are also smaller but real Windows storage, translation-flow, and scope issues.

I found no reason to reject Electron, React, Fluent UI, or SQLite. I also found no basis for switching to WinUI, WPF, or Tauri merely to make the stack look more Windows-native or smaller. The central decision that remains conditional is the EPUB engine and the loading/security topology around it.

### Finding summary

| Severity | Finding |
|---|---|
| HIGH | The renderer is not actually a drop-in adapter choice; loading, origin, selection, and containment topology depend on the engine. |
| HIGH | The position model silently equates spine items with user-visible chapters. |
| HIGH | Untrusted ZIP/XML processing is placed in the fully privileged main process without a firm isolation requirement. |
| MEDIUM | Duplicate and changed-file rules are underspecified and can attach old progress to different content. |
| MEDIUM | The proposed Windows data location is factually inaccurate and risks roaming machine-local data. |
| MEDIUM | The post-configuration translation flow adds an extra continuation/test gate not required by the product. |
| MEDIUM | AI/provider output is treated as untrusted in principle but no plain-text-only rendering rule is specified. |
| LOW | A dynamic signed font-catalog mechanism is premature for the MVP. |
| LOW | Some “owner decisions” and assumptions introduce scope that should simply be deferred. |

There are no `BLOCKER` findings. There are three `HIGH` findings that should be revised before implementation planning.

## Findings

### HIGH-01 — The renderer choice is not isolated by the proposed adapter

**Relevant proposal sections:** Executive recommendation; 3.3 EPUB engine; 4.1–4.2 Runtime topology and process responsibilities; 5.2–5.4 EPUB package service, book resource protocol, and reader controller; 15 Spike A.

**Issue:** The proposal says the shell, resource service, security boundary, and tests do not depend on which engine implements `EpubRenderer`, while also acknowledging that engines use materially different document-loading and frame models. Those two positions are inconsistent. A cross-origin `book://<session>/...` publication frame protects the app origin, but it also prevents the app renderer from directly reading selection ranges and DOM geometry. Engines such as epub.js commonly create and manage sandboxed iframes and expect a particular degree of document access. A Readium Desktop fallback is not a like-for-like adapter swap: it brings its own streamer, navigator, preload/webview conventions, locator types, CSS system, and process topology. A Readium/Thorium maintainer has explicitly described `r2-navigator-js` as “not really usable outside Thorium,” which makes it a separate integration strategy rather than a credible final item in a drop-in fallback chain ([maintainer discussion](https://github.com/edrlab/thorium-reader/discussions/2953)).

The conceptual `EpubRenderer` interface also omits several things that determine the architecture: how publication bytes are supplied, who creates frames, how user styles are injected, how selection is observed across origins, how resource lifetimes work, how navigation is authorized, and where the security policy is enforced. Those omissions make the interface look more stable than it is.

**Why it matters:** The central product interactions—selection, translation anchoring, continuous pages, location restoration, and containment—sit precisely at this boundary. If the spike selects a different engine, the proposed custom protocol, package service, frame topology, and test harness may all need to change. Treating them as settled now encourages parallel implementation against abstractions that may be discarded and will make AI-agent-assisted development harder by creating a false contract.

**Recommendation:** Keep Electron as the shell decision, but make the publication-loading topology explicitly provisional until the renderer spike is complete. The spike should produce an ADR that fixes, together, the chosen engine, resource-delivery mechanism, frame/origin model, selection bridge, locator representation at the adapter boundary, and CSP/sandbox enforcement point. Define only the smallest façade justified by that working implementation. Do not promise Readium as an interchangeable adapter; if lightweight engines fail, reassess Readium as a separate architecture option with an explicit cost estimate.

The spike should also test the real distinction between epub.js’s documented continuous manager—which displays vertically scrolling sections—and the product’s required vertical sequence of generated pages. Passing ordinary `scrolled-doc` or continuous-section rendering is not sufficient ([epub.js documentation](https://github.com/futurepress/epub.js/)).

**Resolution:** **Technical spike**, followed by a **simple proposal revision** and renderer ADR. The existing Spike A is the right vehicle, but the proposal must stop describing downstream topology as engine-independent before the spike proves it.

### HIGH-02 — “Chapter progress” is modeled as spine-item progress

**Relevant proposal sections:** 2.2 Stable locations; 6.4 Reading-position representation; 7.2 Page modes; 10.1 adapter contract tests.

**Issue:** The proposed locator stores a spine href and progression within that spine item, then states that this “matches PRODUCT.md.” It does not necessarily match. An EPUB spine defines default reading order; it does not define user-visible chapters ([EPUB 3.3 spine definition](https://www.w3.org/TR/epub-33/#sec-spine-elem)). A table-of-contents entry can point partway into a spine item, multiple TOC entries can point into one item, and a logical chapter can span multiple spine items. Nested TOCs add another ambiguity. The proposal therefore silently changes “current chapter name and progress within that chapter” into “current content document and progress within that document.”

**Why it matters:** This affects a visible requirement, not just persistence internals. The UI may show the wrong chapter title or jump from 90% to 10% at an arbitrary file boundary. Reopening at an “approximate percentage within the chapter” will be incorrect for books whose packaging does not align one XHTML file to one chapter. TOC highlighting can disagree with the progress label. Fixing this after the reader and database contracts are built would cut across the renderer, locator logic, UI, fixtures, and persistence.

**Recommendation:** Separate the precise content anchor from the user-visible navigation section. Persist a durable content locator (CFI/text quote/resource position) and derive an active navigational range from the EPUB navigation document/NCX. Represent TOC entries as ordered ranges in reading order, including fragment anchors inside a resource. Calculate displayed chapter progress within the active range, not automatically within the containing spine item. Define fallbacks for missing or unusable TOCs without relabeling a spine item as a chapter.

Add fixtures where (a) two chapters share one XHTML file, (b) one chapter spans multiple files, (c) a nested TOC has non-leaf headings, and (d) the TOC is absent or malformed. The renderer spike need only prove that the chosen engine exposes enough location information; the range mapping itself can be normal implementation work.

**Resolution:** **Reasoning/research** plus a **simple proposal revision**. Product-owner input is needed only for the UI convention in ambiguous nested/no-TOC cases, not for recognizing that spine items and chapters are different concepts.

### HIGH-03 — Hostile archive processing is concentrated in the privileged main process

**Relevant proposal sections:** 4.2 Process responsibilities; 5.2 EPUB package service; 7.1 Import and open path; 9.3 EPUB containment; 12 Important architectural risks.

**Issue:** The main process is assigned ZIP validation, XML/package parsing, metadata and cover extraction, hashing, resource serving, filesystem access, SQLite, secret decryption, and outbound network access. The proposal has good quota rules, but treats a utility process as an optional response only if later fuzzing shows instability. Quotas do not by themselves prevent parser bugs, synchronous CPU starvation, decompression stalls, native-addon failures, or a process crash. Some limits can only protect the app if they are enforced incrementally before allocation/decompression, rather than after a library has materialized an entry.

**Why it matters:** EPUB is explicitly untrusted input and opening it is the product’s primary operation. A crafted book that blocks or crashes the Electron main process takes down the whole app and can interrupt progress writes. More seriously, the main process is the only process that holds decrypted AI credentials and unrestricted filesystem/network capabilities. The proposal’s otherwise good renderer sandbox does not mitigate vulnerabilities in parsers running in main.

**Recommendation:** Make resource isolation part of the baseline, not a post-fuzzing possibility. Put archive inspection, hashing, XML parsing, and entry decompression in a dedicated worker/utility boundary with a narrow message protocol, hard cancellation/time limits, incremental byte accounting, and no access to repositories, secrets, or translation networking. The main process should authorize a source path/session and broker results, not parse arbitrary publication structures itself. Keep image decoding in Chromium’s sandboxed renderer where possible; do not decode arbitrary cover or book images in main. If a selected library cannot stream or enforce pre-allocation limits, reject it.

This need not become a miniature distributed system: one disposable helper per import/open session or a single supervised helper is sufficient. The goal is crash/resource containment and capability separation, not enterprise process orchestration.

**Resolution:** **Technical spike** for the chosen archive library’s streaming/quota behavior, followed by a **simple proposal revision**. The spike can be small and can run alongside the renderer proof, but its exit criteria must include cancellation and main-process responsiveness under malicious fixtures.

### MEDIUM-01 — Duplicate and changed-file identity behavior is not safe enough

**Relevant proposal sections:** 2.5 Original-file lifecycle; 5.1 Library application service; 6.3 Duplicate and changed-file identity; 7.1 Import and open path.

**Issue:** Section 6.3 lists path, SHA-256, publication identifier, size, and modification time, then says “a match triggers” replacement confirmation. Those signals are not equally authoritative. Publication identifiers are publisher-supplied and may be missing, duplicated, or reused across editions. A normalized path identifies a location, not immutable content. Separately, the proposal says changed bytes are revalidated and fingerprints updated, but does not say whether stale metadata/progress remain attached or whether the user is told that the referenced book changed.

Windows path handling also needs more precision. Case-insensitive comparison, drive-letter aliases, UNC paths, junctions, inaccessible targets, and paths that cannot currently be resolved make “normalized canonical path” an unreliable universal identity key.

**Why it matters:** False duplicate matches can replace the wrong library entry. A file overwritten in place can inherit a locator from a different edition and reopen at an unrelated passage. Silent fingerprint updates erase the evidence needed to distinguish an expected file update from an unexpected substitution. These failures directly affect the product’s promises around original-file ownership and reliable position restoration.

**Recommendation:** Define evidence tiers rather than treating every match alike:

- same stored path plus same hash: the existing entry;
- different path plus same hash: exact duplicate candidate;
- same path plus changed hash: changed-in-place publication requiring an explicit refresh/replacement policy;
- matching package identifier without matching bytes: only a weak hint, never sufficient by itself to declare an exact duplicate.

Keep the previous fingerprint until a changed-file decision succeeds. Never apply a locator blindly across changed bytes; attempt resolution only under the product-approved replacement-progress rule and clear/fallback visibly if it does not resolve. Specify Windows path comparison separately from publication identity.

**Resolution:** **Product decision** for progress preservation and user-facing changed-file behavior, then a **simple proposal revision**. No separate technical spike is needed.

### MEDIUM-02 — The proposed Windows data location is inaccurate

**Relevant proposal sections:** 6.1 Filesystem layout; 11 Packaging and distribution.

**Issue:** The proposal says Electron’s `userData` directory is under local application data. On Windows, Electron’s default `appData` is `%APPDATA%`, and `userData` defaults to a subdirectory of it. That is the roaming profile, not `%LOCALAPPDATA%`. Electron also recommends keeping application-owned data in a subdirectory rather than directly at the `userData` root, and exposes `sessionData` separately because Chromium caches can become large ([Electron `app.getPath` documentation](https://www.electronjs.org/docs/latest/api/app)).

The proposed database contains absolute machine-local paths and DPAPI-protected secret bytes; covers, fonts, logs, and Chromium caches can be sizable. Those are poor roaming-profile data. Syncing the database between machines could also produce meaningless paths, non-portable encrypted secrets, and write conflicts.

**Why it matters:** This is a Windows-specific correctness, privacy, and support issue. It can create unexpected enterprise profile synchronization, slow sign-in/out, duplicate data on another machine, or failures that appear nondeterministic.

**Recommendation:** Choose and document an explicit Windows path policy. For this local-first, machine-bound product, place the database, covers, downloaded fonts, logs, and secret blob under an app-specific `%LOCALAPPDATA%` directory. Put Chromium `sessionData`/cache in a separate disposable local directory. Set these paths before Electron initialization as required, and test install/upgrade/uninstall retention. If any small preference is intentionally roamed, separate it from machine-local paths and secrets rather than moving the whole database.

**Resolution:** **Simple proposal revision** and routine packaged-build verification.

### MEDIUM-03 — The missing-key translation flow changes the product behavior

**Relevant proposal sections:** 8.1 Data flow and consent boundary; 8.2 Provider adapter.

**Issue:** PRODUCT.md says that after successful configuration the application returns to the book, preserves the pending selection when possible, and continues the requested translation. The proposal instead says it resumes only after a successful “save/test” and an “explicit continuation.” That can introduce two requirements the product did not specify: making Test connection a prerequisite and asking for a second Translate confirmation after the user already explicitly requested translation.

**Why it matters:** This creates friction in a core initial feature and silently changes an explicit product flow. It can also make “Configured” depend on network availability, contrary to the product’s separation between stored configuration and online action success. A valid saved key may be temporarily untestable while offline.

**Recommendation:** Treat the original Translate click as the explicit consent event. If no key exists, retain only an in-memory pending intent, open AI Settings, and after a successful Save return to the reader and continue automatically when the pending selection/session is still valid. Test connection remains an explicit diagnostic action, not a mandatory gate, unless the product owner deliberately changes the flow. If the selection can no longer be preserved, return to the book and ask the user to select again rather than sending stale text.

**Resolution:** **Simple proposal revision**. A **product decision** is required only if a second confirmation or mandatory test is intentionally desired.

### MEDIUM-04 — Translation output needs an explicit non-executable rendering rule

**Relevant proposal sections:** 5.5 Translation gateway; 8.2 Provider adapter; 8.4 Reliability and privacy; 9.1 Trust zones.

**Issue:** The proposal correctly classifies remote provider responses as untrusted and asks for a machine-validated shape, but it does not state how the returned translation is rendered. Selected EPUB text can contain prompt-injection content, and a model may return Markdown, HTML, links, image syntax, or unexpectedly large text even when instructed not to. Schema validation alone does not make a string safe for HTML or Markdown rendering.

**Why it matters:** Rendering provider output through `innerHTML` or a permissive Markdown component would create an avoidable injection/navigation surface in the trusted app renderer. It could also introduce remote resource fetches, phishing-like links, or layout/memory abuse. The product requires translated text, not rich model-generated content.

**Recommendation:** Specify that translation results are bounded plain Unicode text rendered through text nodes/normal framework escaping only. Do not interpret HTML, Markdown, URLs, or images. Enforce a response-size cap in main and renderer, normalize control characters, and make Copy copy that plain text. Keep the renderer CSP/network denial as defense in depth.

**Resolution:** **Simple proposal revision**.

### LOW-01 — The font catalog mechanism is more elaborate than the MVP needs

**Relevant proposal sections:** 5.6 Font service; 6.1 filesystem layout; 12 font-catalog risk.

**Issue:** The proposal implies a versioned catalog with a signed/versioned manifest and catalog metadata. PRODUCT.md requires an in-app catalog, verified downloads, and offline use after download; it does not require a remotely mutable catalog or independent manifest-signing infrastructure.

**Why it matters:** A remote signed catalog introduces signing-key custody, manifest update/recovery rules, extra networking, and more failure states before the actual font download. That is avoidable operational scope for a small MVP, especially while the catalog contents are still an open product detail.

**Recommendation:** Bundle a small, versioned catalog manifest with the application. Each entry should have an approved license, fixed HTTPS origin, expected hash, and family metadata. Updating the application can update the catalog. Add a remotely updateable signed catalog only if there is later a real requirement to change catalog contents independently of app releases.

**Resolution:** **Simple proposal revision**.

### LOW-02 — Some assumptions and owner questions should be removed from the MVP architecture

**Relevant proposal sections:** 13 Technical assumptions; 14 Decisions requiring owner input; 11 Packaging and distribution.

**Issue:** “Single-instance” is assumed even though PRODUCT.md does not require it, and enforcing it adds lifecycle and second-launch behavior that otherwise need not exist. Auto-update is listed as an owner decision even though it is absent from the product and the proposal already recommends deferring it. These are examples of hypothetical future behavior being allowed to consume design attention.

External-link handling is a legitimate product question because it affects visible behavior inside books. Auto-update is not needed to settle the MVP architecture; stable data migrations and manual signed releases are enough. Similarly, opening one book at a time follows the single-window product structure, but operating-system single-instance locking is a different decision.

**Why it matters:** Small speculative decisions accumulate into setup, testing, IPC, installer, and lifecycle work. They also make the proposal look less settled by presenting non-requirements as unresolved launch blockers.

**Recommendation:** Remove auto-update from decisions required before implementation and explicitly defer it. Drop the single-instance requirement unless a concrete multi-launch problem appears or the product owner asks for it. Keep stable app identity and forward migrations because they are cheap and useful independently. Retain external-link behavior and the supported Windows matrix as real owner decisions.

**Resolution:** **Simple proposal revision**.

## Technology review

### Electron vs. Tauri, WinUI, and WPF

Electron is justified for this product. The app’s distinctive work is HTML/CSS EPUB layout, DOM selection, and overlays. Electron keeps the shell and reader in one primary language and provides a known Chromium version, which is valuable when pagination is sensitive to layout-engine behavior. Its footprint and patch cadence are real costs, but no product requirement sets a small installer or memory target. Those costs should be measured after a vertical slice, not used as a reason to add a Rust or XAML stack preemptively.

Tauri would reduce distribution size but would retain the web reader, add Rust/backend bridge work, and make behavior depend on the installed WebView2 runtime. It is a reasonable fallback only if an explicit footprint target is later missed. WinUI 3 plus WebView2 would improve native shell fidelity but impose a C#/XAML-to-web boundary exactly where selection, focus, overlays, and reader state interact. WPF has the same split without a compelling greenfield advantage. None is materially better for the current product.

### React and Fluent UI

React with TypeScript and Fluent UI v9 is appropriate for the library, settings, dialogs, and overlay state. The proposal is right not to add Redux. Fluent should remain app-chrome infrastructure rather than dictate book typography. Standard Windows behavior will still require deliberate focus, context-menu, keyboard, high-DPI, and accessibility testing; Fluent branding alone does not satisfy that principle.

### EPUB engine

epub.js is a reasonable first spike candidate because its integration surface is smaller and it supports the basic EPUB concepts needed. It is not yet an approved production choice. Its normal continuous mode is not the required stacked-page model, and its iframe/DOM access assumptions must be proven compatible with the proposed isolation. foliate-js is a plausible second experiment but explicitly says its API is unstable and warns that secure use depends on CSP ([foliate-js README](https://github.com/johnfactotum/foliate-js/blob/main/README.md)). Readium is the highest-capability option but should be evaluated as a larger architecture, not a final adapter swap.

The proposal is correct not to build an EPUB engine from raw ZIP/XML/HTML primitives.

### SQLite

SQLite is reasonable despite the small data volume. The product has related library, progress, settings, and font records with deletion and migration behavior; transactions and constraints are useful. Direct SQL repositories avoid ORM overhead. `better-sqlite3` does add native rebuild/packaging work, but that is routine and testable. JSON would be somewhat simpler on day one but would move atomicity, migrations, and recovery into application code. No change is recommended, provided database work stays out of the UI thread and the data path is corrected.

### AI key and networking

Keeping the provider adapter and key in main is correct. Electron `safeStorage` currently offers asynchronous encryption APIs and uses DPAPI on Windows; the proposal accurately limits its security claim to protection from other users and accidental plaintext access, not same-user malware ([Electron safeStorage documentation](https://www.electronjs.org/docs/latest/api/safe-storage)). One provider and one app-selected model is the right MVP shape. Arbitrary endpoints, provider pickers, local models, prompt editors, and a general Ask AI capability would all be unjustified scope.

## Strong parts of the proposal

The following should probably remain unchanged:

- Electron + TypeScript + React as the baseline, with Fluent UI limited to application surfaces.
- One BrowserWindow and a simple Library/Reader/Settings navigation model.
- A context-isolated, sandboxed renderer with no Node integration, generic IPC, filesystem, SQL, key, or arbitrary network access.
- Intent-level preload methods and IPC sender/payload validation.
- Original EPUBs remain at their source paths; only disposable covers and approved fonts are cached.
- SQLite with direct repositories, migrations, transactions, and no ORM.
- No Redux or speculative global state framework.
- Page numbers are not persisted; restoration uses content-relative anchors and fallback data.
- Publication scripts, forms, remote resources, popups, permissions, and outbound networking are disabled for the MVP.
- Translation happens only after the explicit Translate action; source and results are not persisted or logged.
- DPAPI-backed `safeStorage`, with accurate limitations, is preferable to plaintext or app-owned reversible encryption.
- No arbitrary AI endpoint, multi-provider UI, prompt editor, analytics, cloud sync, file association, or auto-update service in the MVP.
- Native Windows picker and context menu integration, plus packaged Windows smoke testing.
- A representative licensed EPUB compatibility/security corpus rather than confidence based on one novel.
- A mandatory renderer/location/containment spike before broad feature implementation.

## Decisions that need revision

The architecture agent should revise these decisions before implementation planning:

1. Make resource delivery, frame/origin design, selection bridging, and the `EpubRenderer` boundary conditional on the renderer spike rather than declaring them engine-independent.
2. Replace spine-item-as-chapter progress with separate precise locators and TOC/navigation-range progress.
3. Isolate hostile archive parsing/decompression from the main process and prove streaming quotas/cancellation.
4. Define evidence-based duplicate detection and explicit behavior for files whose bytes change at the recorded path.
5. Use an explicit local, machine-bound Windows data layout and separate Chromium session/cache data.
6. Align the missing-key translation flow with PRODUCT.md: Save returns to the book and continues the already-requested translation when still valid; Test connection is not implicitly mandatory.
7. Require plain-text-only rendering of provider output.
8. Bundle the initial font catalog instead of building remote signed-catalog infrastructure.
9. Remove single-instance and auto-update decisions from the MVP architecture unless the product owner adds them.

## Questions requiring product-owner input

Only the following materially affect user-visible scope or behavior and cannot be settled purely by architecture:

1. Which AI provider/model is used, and what privacy/cost wording must accompany the user-supplied key?
2. When a duplicate is replaced—or the referenced file changes in place—under what conditions should existing progress be preserved?
3. What EPUB support profile may be stated publicly for launch: ordinary reflowable EPUB 2/3 only, with fixed-layout, scripted, media-overlay, and other unusual publications rejected?
4. For nested TOCs, which navigational level should the toolbar call the “current chapter,” and what label/progress fallback is acceptable when a usable TOC is absent?
5. Should user-clicked HTTPS links in book content be disabled, confirmed and opened in the system browser, or handled another way? Inline remote resources should remain blocked regardless.
6. What minimum Windows version, CPU architectures, and initial distribution channel are supported?

The exact metadata fallbacks, finished-state behavior, font catalog contents, and translation limit remain the open product details already identified in PRODUCT.md. Auto-update does not need an answer for this MVP.

## Recommended technical spikes

### 1. Renderer/location/containment proof — required

Retain Spike A, but revise its output. It must select not only an engine but the complete integration topology: resource loading, publication origin, frame ownership, CSP/sandbox, selection bridge, user-style injection, locator conversion, and cleanup. Test at least epub.js first; try foliate-js only if epub.js fails defined gates. If both fail, stop and estimate a Readium-based architecture rather than assuming it fits the same adapter.

Use explicit pass/fail evidence for:

- true vertically stacked generated pages, not vertically scrolling chapters;
- chapter-start page breaks;
- page mode and appearance changes retaining the same leading passage;
- selection geometry and retained highlighting without exposing preload/IPC to publication frames;
- chapter progress for TOC ranges that do not align with spine items;
- script, form, remote fetch, navigation, popup, storage, service worker, cross-book, and IPC escape attempts;
- keyboard, wheel, far-edge click, context menu, focus, and basic Narrator behavior;
- bounded memory and acceptable interaction latency on ordinary and stress books.

The current 3–5 day timebox is acceptable as a decision timebox, not as a promise that all fallbacks will be evaluated within it. A failed timebox must produce a stop/reassess result, not relaxed acceptance criteria.

### 2. Archive/resource-boundary proof — required

Run a narrow experiment with the intended ZIP/XML libraries and process boundary. Demonstrate incremental entry limits, total expanded-byte limits, compression-ratio checks, path normalization, cancellation, hard timeout, helper crash recovery, and main-process responsiveness. Include zip-slip, duplicate normalized names, XML entity/DTD attempts, huge entries, high compression ratios, and malformed central directories. Confirm that neither metadata/cover extraction nor protocol resource delivery requires whole-book or whole-entry unbounded allocation.

No separate spikes are justified for React, Fluent UI, SQLite, DPAPI/safeStorage, Electron Forge, or ordinary native picker integration. Those are routine vertical-slice work.

## Readiness

**READY FOR REVISION**

The proposal should return to the architecture agent with the findings above. Once the three `HIGH` items are reflected in the proposal and the revised renderer/archive spikes have clear exit criteria, the architecture will be in a strong position for implementation planning.
