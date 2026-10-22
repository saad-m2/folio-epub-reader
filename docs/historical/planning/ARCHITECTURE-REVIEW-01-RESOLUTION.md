# Architecture Review 01 Resolution

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


> Historical resolution. The helper and hostile-publication decisions below are superseded by the trusted-local binary-handoff decision in `ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`. The OpenAI/key translation decisions are superseded by `LOCAL-TRANSLATION-DECISION.md`.

**Status:** Owner decisions incorporated; technical validation required  
**Date:** 2026-09-16  
**Inputs:** [`PRODUCT.md`](../../product/PRODUCT.md), [`TECHNICAL-PROPOSAL.md`](TECHNICAL-PROPOSAL.md), and [`ARCHITECTURE-REVIEW-01.md`](ARCHITECTURE-REVIEW-01.md)

## Classification summary

There were no BLOCKER findings. All three HIGH and four MEDIUM findings are resolved below with exactly one classification each.

| Finding | Classification |
|---|---|
| HIGH-01 — Renderer is not a drop-in adapter choice | **NEEDS TECHNICAL VALIDATION** |
| HIGH-02 — Spine-item progress is not chapter progress | **ACCEPT** |
| HIGH-03 — Hostile archive work is concentrated in main | **ACCEPT** |
| MEDIUM-01 — Duplicate/changed-file behavior is unsafe or ambiguous | **NEEDS PRODUCT/OWNER DECISION** |
| MEDIUM-02 — Windows data location is inaccurate | **ACCEPT** |
| MEDIUM-03 — Missing-key flow changes product behavior | **ACCEPT** |
| MEDIUM-04 — Translation output lacks a non-executable rendering rule | **ACCEPT** |

## 1. Finding-by-finding resolution

### HIGH-01 — Renderer is not a drop-in adapter choice

**Classification: NEEDS TECHNICAL VALIDATION**

**What the critic is claiming:** The proposal overstates renderer independence. epub.js, foliate-js, and Readium differ in resource loading, frame ownership, origin rules, selection access, locator types, style injection, security enforcement, and cleanup. A narrow `EpubRenderer` sketch cannot make those architectural differences disappear, and Readium is not credibly a final drop-in fallback.

**Do I agree?** Yes.

**Why:** The disputed behavior lies at the product's most coupled boundary. A unique cross-origin publication frame improves isolation but prevents ordinary DOM/selection access. An engine that writes content into a host-observable sandboxed frame has different security properties. Readium introduces a streamer/navigator/preload topology rather than merely another implementation class. Those facts cannot be resolved through interface design on paper. The original claim that the resource service, security boundary, and tests were engine-independent was too strong.

The later product clarification removes the unusual vertically stacked generated-page requirement. That materially lowers renderer/layout risk and makes native engine flows more likely to pass, but it does not settle origin, selection, resource delivery, containment, or cross-flow locator behavior. HIGH-01 therefore remains `NEEDS TECHNICAL VALIDATION`, with a smaller experiment.

**What happens next:** The revised proposal keeps Electron/React/SQLite and the main/preload privilege split, but marks publication loading, resource delivery, frame/origin ownership, selection bridging, locator conversion, user-style injection, cleanup, and the final reader façade as provisional. Spike A must select that topology and engine together. epub.js is tested first; foliate-js is tested only if epub.js fails. If both fail, work stops for a Readium-specific architecture/cost assessment rather than forcing Readium into the same façade.

### HIGH-02 — Spine-item progress is not chapter progress

**Classification: ACCEPT**

**What the critic is claiming:** An EPUB spine item is a content resource in reading order, not necessarily a user-visible chapter. Two chapters may share a resource, one chapter may span resources, and nested navigation introduces further ambiguity. The old proposal's statement that spine progression “matches PRODUCT.md” was incorrect.

**Do I agree?** Yes.

**Why:** This is a semantic error, not an engine preference. Precise restoration and user-visible chapter progress are related but distinct. Persisting only a resource-relative percentage could produce incorrect chapter names/progress and cross-file discontinuities.

**Correction made:** The proposal now separates:

- a precise content locator (resource href, CFI, text quote, resource/total progression); and
- a navigation entry/range derived from EPUB Navigation Document or NCX anchors, including fragment anchors inside resources.

Displayed progress is calculated inside the selected navigation range. Exact restoration prefers the precise locator. Fixtures now cover chapters sharing a resource, chapters spanning resources, nested navigation, and absent/malformed navigation.

**What happens next:** The owner selected the deepest currently active navigable TOC entry, with publication title and overall progress as the fallback when navigation is unusable. Spike A must prove the chosen engine exposes enough ordered location information to implement and test that range model.

### HIGH-03 — Hostile archive work is concentrated in main

**Classification: ACCEPT**

**What the critic is claiming:** ZIP/XML parsing, hashing, decompression, cover extraction, database access, key decryption, and provider networking should not all occur in the privileged Electron main process. Quotas alone do not contain parser crashes, CPU stalls, or allocation behavior.

**Do I agree?** Yes, with one scope qualification.

**Why:** EPUB is the primary untrusted input. Moving its archive/XML operations out of main provides valuable crash/resource containment and keeps application secrets/repositories out of the parser's memory and message API. This does not automatically create an OS-level sandbox: a Node utility/child process may still run with the same Windows user permissions. Adding AppContainer-style confinement now would be substantially more complex and is not justified without stronger threat evidence. The simple robust step is a supervised, narrowly messaged helper plus the existing Chromium sandbox for active document/image content.

**Correction made:** The baseline now includes a disposable/supervised publication helper for hashing, ZIP inspection, XML/package/TOC parsing, metadata extraction, and bounded entry reads. Main authorizes a source path and brokers the session; it does not parse or decompress publication data. The helper is not wired to SQLite repositories, decrypted keys, translation/font clients, shell operations, or generic IPC.

**What happens next:** Spike B must select libraries and prove incremental limits, cancellation, timeout, helper crash recovery, and main responsiveness. A library that materializes untrusted content before limits can be enforced is rejected.

### MEDIUM-01 — Duplicate and changed-file behavior is unsafe or ambiguous

**Classification: NEEDS PRODUCT/OWNER DECISION**

**What the critic is claiming:** Path, content hash, package identifier, size, and timestamp are not equivalent identity evidence. The original “a match triggers replacement” wording could produce false duplicates or attach stale progress to changed bytes. Windows path normalization is not a universal publication identity mechanism.

**Do I agree?** Yes.

**Why:** The technical portion is resolvable: SHA-256 equality establishes exact byte identity; a package identifier is only a weak hint; path equality identifies a recorded location; size/mtime only trigger revalidation. But whether and how progress moves to changed/replacement content is explicitly a user-visible product choice.

**Correction and owner decision incorporated:** The proposal now uses evidence tiers:

- same path + same hash: unchanged existing entry;
- different path + same hash: exact duplicate candidate;
- same path + changed hash: changed-in-place publication requiring validation and the settled conditional locator-migration policy;
- package identifier match without hash match: weak hint only;
- size/mtime: revalidation triggers only.

Old metadata, hash, and locator remain intact until validation and the chosen action succeed. No locator is blindly applied across changed bytes. Path comparison is explicitly separate from publication identity and remains best-effort for missing, UNC, junction, removable, and network paths.

**What happens next:** The owner selected automatic conditional preservation: validate changed/replacement bytes first, then preserve progress only when the saved locator resolves reliably; otherwise reset progress and clearly notify the user. No migration-choice dialog or technical spike is warranted.

### MEDIUM-02 — Windows data location is inaccurate

**Classification: ACCEPT**

**What the critic is claiming:** Electron's default `userData` derives from roaming `%APPDATA%`, not `%LOCALAPPDATA%`. Absolute local paths, DPAPI-protected bytes, covers, fonts, logs, and Chromium cache should not roam between machines.

**Do I agree?** Yes.

**Why:** This is a factual Windows/Electron correction. Roaming would make source paths and encrypted secrets meaningless on another machine and could create profile size/conflict problems.

**Correction made:** The proposal now assigns the database, encrypted secret blob, covers, fonts, and logs to an app-specific `%LOCALAPPDATA%/.../Data` directory and Chromium/helper disposable state to a separate `%LOCALAPPDATA%/.../Session` directory. Electron paths are set before initialization. Install, upgrade, uninstall, and retention tests cover these explicit locations. No MVP preference is intentionally roamed.

**What happens next:** Routine packaged-build verification; no spike or owner decision is needed.

### MEDIUM-03 — Missing-key translation flow changes product behavior

**Classification: ACCEPT**

**What the critic is claiming:** Requiring a successful save/test and explicit continuation adds a mandatory connection test or second consent step that PRODUCT.md does not require.

**Do I agree?** Yes.

**Why:** The initial Translate click is already explicit consent to submit the selected text. Configuration status means a key is saved; it must not depend on current network availability. The product explicitly says to return and continue after successful configuration when the selection can be preserved.

**Correction made:** A missing-key request stores an in-memory pending intent, opens Settings, and after successful **Save** returns and automatically continues if the book session and selection remain valid. `Test connection` is optional. If the selection is stale, no request is sent and the user is asked to select again. No second Translate click is required.

**What happens next:** Implement exactly this flow later; no product decision or spike is needed unless the owner wants to change PRODUCT.md.

### MEDIUM-04 — Translation output lacks a non-executable rendering rule

**Classification: ACCEPT**

**What the critic is claiming:** Schema-valid provider output is still an untrusted string. Interpreting it as HTML, Markdown, links, or images would introduce an avoidable injection/network/navigation surface.

**Do I agree?** Yes.

**Why:** The product requires translated text, not rich provider-authored content. Plain text is both the simplest behavior and the correct security boundary.

**Correction made:** Main and renderer enforce response-size limits; unacceptable control characters are normalized while normal Unicode/paragraphs are preserved. Results are rendered only through escaped text nodes/normal React escaping. No HTML, Markdown, linkification, images, or URL handling is performed. Copy copies the same plain text.

**What happens next:** Add unit/component security tests during the translation phase; no spike or owner decision is needed.

## 2. Accepted architecture changes

The revised [`TECHNICAL-PROPOSAL.md`](TECHNICAL-PROPOSAL.md) now:

- uses conventional vertically scrolling reflowable content for continuous mode and reserves generated pages for paginated mode;
- removes custom stacked-page layout/virtualization from renderer requirements, risks, and spike gates;
- stops presenting EPUB engines and resource/frame topology as drop-in interchangeable;
- defers the final reader façade and publication integration topology to Spike A and its ADR;
- models precise restoration separately from TOC/navigation-range chapter progress;
- adds a supervised publication helper as the baseline archive/XML/decompression boundary;
- replaces ambiguous duplicate matching with evidence tiers and preserves old state until changed-file validation and migration handling succeed;
- places machine-bound data and Chromium session/cache explicitly under separate `%LOCALAPPDATA%` paths;
- restores the PRODUCT.md missing-key translation flow and keeps Test connection optional;
- renders bounded provider output as plain text only;
- fixes OpenAI as the sole MVP provider and `gpt-5.6-luna` as the internally configured initial translation model, without provider/model/endpoint UI;
- defines automatic conditional progress preservation for changed or replacement EPUBs;
- fixes the supported publication profile to ordinary reflowable EPUB 2/3 and permits friendly rejection of fixed-layout, scripting-dependent, media-overlay, DRM, and other unsupported unusual publications;
- defines the deepest active navigable TOC entry as the current chapter/section, with publication-title and overall-progress fallback;
- confirms external HTTPS links before opening them in the system browser while blocking silent remote publication fetches and in-reader external navigation;
- fixes the MVP support/distribution target to Windows 11 x64 through a signed direct-download `Setup.exe`;
- bundles the initial font catalog manifest rather than designing a remotely mutable signed catalog;
- drops the OS-level single-instance assumption and explicitly defers auto-update;
- expands the renderer spike and adds a focused archive/resource-boundary spike.

The low-severity font-catalog and speculative-scope observations were also adopted because they simplify the MVP without changing product requirements.

## 3. Rejected findings

None. No BLOCKER, HIGH, or MEDIUM finding was rejected. This does not mean every recommended mechanism was adopted without qualification: the helper is a process/capability boundary, not claimed to be an OS security sandbox, and the reviewer-requested renderer topology remains subject to evidence rather than being preselected.

## 4. Product/owner decisions

### Decisions that blocked architecture validation — now resolved

The owner has supplied the following authoritative inputs:

- **Supported EPUB profile:** ordinary reflowable EPUB 2 and EPUB 3. The app may clearly reject fixed-layout, scripting-dependent, media-overlay/read-aloud, DRM-protected, and other unusual unsupported publications. This gives Spike A a finite compatibility and security envelope.
- **Current chapter:** the deepest currently active navigable TOC entry. If usable navigation is absent, show the publication title and overall book progress. This fixes the navigation-range semantics Spike A must prove.
- **Changed/replacement progress:** after validating the new EPUB, preserve progress automatically only when the saved locator resolves reliably; otherwise reset it and clearly tell the user. Do not add a migration-choice dialog.
- **AI integration:** OpenAI only, with `gpt-5.6-luna` as the initial internal translation model. Users configure only an OpenAI API key; provider, model, and arbitrary endpoint controls are not exposed. The internal model ID remains a centralized replaceable application configuration value.
- **External links:** publication content cannot silently fetch remote resources. A user-clicked HTTPS destination is shown for confirmation and, if approved, opened only in the system browser. The reader never navigates to the external site.
- **Platform/distribution:** Windows 11 x64 through a signed direct-download `Setup.exe`. Microsoft Store, ARM64, and 32-bit Windows are outside the MVP. Ordinary platform-neutral boundaries should not gratuitously prevent later expansion, but no future-channel work is added now.

These decisions are reflected in PRODUCT.md and the revised technical proposal. None requires another architecture choice before the two technical spikes.

### Decisions that can safely wait

The metadata fallbacks, finished-state behavior, exact translation selection limit, font catalog contents, and final visual-design details remain the open product details already listed in PRODUCT.md. They are feature-level decisions, do not affect the recommended architecture, and can wait until their respective design or implementation-planning phase. There is no remaining owner decision blocking architecture validation.

## 5. Required technical spikes

### Spike A — renderer, location, and containment proof

**Question:** Which lightweight EPUB engine and complete integration topology can satisfy conventional vertical scrolling, conventional paginated reading, cross-flow logical-position preservation, selection/translation geometry, Windows interaction, and hostile-content containment?

**Why reasoning is insufficient:** The answer depends on actual iframe/origin behavior, engine DOM assumptions, layout behavior, selection access, CSP enforcement, accessibility, and Chromium performance. A paper abstraction can conceal incompatible requirements.

**Smallest useful experiment:** A disposable Electron harness using epub.js and a representative fixture subset. It must use the engine's conventional vertical scrolling and paginated/column flows, preserve position across flow/style changes, map TOC ranges across non-spine-aligned chapters, support selection/retained highlight/translation bubble and keyboard/mouse/context-menu behavior, and exercise the proposed security attacks. The experiment selects resource loading, frame/origin ownership, selection bridge, user styles, locator conversion, cleanup, and security enforcement together. Test foliate-js only if epub.js fails. Do not build product UI or a custom stacked-page layout.

**Success criteria:**

- conventional vertical scrolling in continuous mode and generated pages only in paginated mode;
- a fresh generated page for a new chapter in paginated mode, with ordinary visual chapter separation in continuous mode;
- passage retained as closely as reasonably possible across mode/appearance changes and reopen;
- navigation-range progress works when chapters share/span resources, uses the deepest active navigable TOC entry, and falls back to publication title plus overall progress when navigation is unusable;
- ordinary reflowable EPUB 2/3 fixtures pass, while fixed-layout, scripting-dependent, media-overlay, DRM, and other deliberately unsupported profiles fail safely with an understandable unsupported-publication result;
- selection geometry and retained highlighting work without publication access to preload/IPC;
- scripts, forms, remote fetch, navigation, popups, storage, service workers, cross-book access, and IPC escape attempts are blocked;
- required keyboard/mouse/context behavior and basic Narrator use work;
- bounded memory and acceptable ordinary/stress-book latency;
- no disabled `webSecurity`, executable publication scripts, deep engine fork, or custom page-stack subsystem.

**Failure/direction rule:** If epub.js fails, evaluate foliate-js against the same product/security gates. If both fail or the timebox expires without a pass, stop and produce a Readium-specific architecture/cost estimate. Do not lower the gates or pretend Readium is a drop-in implementation.

**Decision dependent on it:** Production EPUB engine, resource-delivery mechanism, publication origin/frame model, CSP/sandbox enforcement, selection bridge, location conversion, cleanup, and final reader façade/ADR.

### Spike B — archive/resource-boundary proof

**Question:** Can a simple supervised helper and chosen ZIP/XML libraries enforce limits before unsafe allocation/decompression and remain cancellable without blocking/crashing main?

**Why reasoning is insufficient:** Library APIs vary in whether metadata is trustworthy, whether reads are genuinely streaming, when allocation occurs, how cancellation propagates, and how malformed ZIP/XML input fails. Being wrong would put the primary hostile-input path back into a process holding database/secrets/network capabilities or leave denial-of-service limits ineffective.

**Smallest useful experiment:** A no-UI helper prototype with `inspect` and bounded `readEntry` operations over authorized fixture paths. Exercise entry-count, total-expanded-byte, per-entry, compression-ratio, path, and time limits; backpressure/cancellation; duplicate normalized paths; zip-slip; XML entity/DTD attempts; malformed/truncated central directories; huge/high-ratio entries; helper crash/restart; and main-process responsiveness.

**Success criteria:** Every hostile fixture ends in a bounded typed failure; limits apply before/during allocation; timeout/cancellation stops work; helper failure does not crash main; exposed operations cannot reach repositories, decrypted secrets, shell actions, provider clients, or arbitrary paths; metadata/cover extraction and candidate resource delivery do not require unbounded whole-book/entry materialization.

**Failure/direction rule:** Reject a library that allocates/decompresses before enforceable limits. Try a streaming-capable library or narrower operation. If no practical Node helper passes, reassess the parsing runtime/boundary before implementation planning.

**Decision dependent on it:** Helper mechanism, ZIP/XML libraries, helper message contract, quota points, cancellation/timeout supervision, and the resource side of the chosen reader topology.

No spikes are required for React, Fluent UI, SQLite, DPAPI/`safeStorage`, Electron Forge, or the native picker. Those are ordinary vertical-slice verification.

## 6. Remaining known risks

- The production EPUB engine and frame/resource topology remain unselected until Spike A.
- The publication helper reduces main-process crash/memory/secret exposure but is not assumed to be an OS-level Windows sandbox. A parser code-execution flaw may retain same-user OS access.
- Unusual or malformed EPUBs will still expose compatibility gaps even with a corpus; the MVP must fail safely and explain unsupported content.
- Conditional progress migration to replacement content can still land approximately rather than exactly; the settled policy therefore preserves only a reliably resolved locator and otherwise resets with a visible explanation.
- Electron carries a larger package/memory floor and requires timely Chromium/Electron upgrades.
- The SQLite native binding adds rebuild/packaging coupling, mitigated by packaged CI tests.
- DPAPI does not protect the key from malware running as the same Windows user.
- Translation quality, model behavior, prices, quotas, and provider API availability can change independently of the app.
- Original-path references remain vulnerable to user moves, renames, unavailable drives, and network latency by product design.
- A bundled font catalog simplifies trust/operations but can change only with an app release.

## 7. Recommended next step

**TECHNICAL SPIKES REQUIRED**

Run Spikes A and B and record their results as ADRs. The owner decisions and scrolling clarification have removed the product ambiguity and custom page-stack proof; the remaining uncertainties are empirical engine/topology and hostile-archive boundary questions. Do not begin implementation planning or a second architecture review before those results are available.
