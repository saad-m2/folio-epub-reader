# Implementation Breakdown 01 — Windows EPUB Reader MVP

**Status:** Proposed implementation roadmap  
**Product source of truth:** `docs/PRODUCT.md`  
**Architecture source of truth:** `docs/planning/ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`

## 1. Roadmap approach

This roadmap uses six ordered epics. They deliberately follow the architecture's implementation phases because those phases encode real trust-boundary and release gates. Story order within each epic is the recommended implementation order. An epic is complete only when its exit condition is met; a partial UI demonstration does not bypass a security or behavior gate.

| Order | Epic | Increment produced |
|---:|---|---|
| 1 | Foundation and trusted-local publication proof | A hardened application shell and accepted proof that a bounded trusted EPUB can render through epub.js |
| 2 | Persistent local library | A usable offline library that references, validates, opens, replaces, and removes local EPUBs safely |
| 3 | Reader core and reading continuity | Secure continuous and paginated reading with TOC navigation, progress, restoration, and appearance reflow |
| 4 | Windows reader interaction and accessibility | The complete physical interaction model, standard text behavior, external-link handling, and accessible reader chrome |
| 5 | Settings, fonts, and optional translation | Persistent global settings, offline-capable fonts, manual local-model controls, and explicit in-context translation |
| 6 | Hardening and Windows release | A corpus-tested, contained, performant, license-inventoried Windows 11 x64 installer |

The intended delivery strategy is vertical and incremental: retain a runnable application after each story, integrate each story at the real process boundary where practical, and add regression coverage as behavior is introduced rather than deferring all verification to Epic 6.

## 2. Epic 1 — Foundation and trusted-local publication proof

### Purpose

Establish the selected Electron/React architecture and prove the bounded trusted-local binary handoff before production reader implementation proceeds.

### Included

- Electron Forge, TypeScript, React, Fluent UI v9, Vite, and exact runtime pins.
- Hardened single-window shell, app routes, local data/session paths, and fixed-dark app chrome baseline.
- Data-only shared contracts and narrowly named preload/main messages.
- Main-authorized, size-bounded complete-archive handoff to the sandboxed renderer.
- epub.js 0.3.93 binary/archive loading with ephemeral `blob:` resources and script-off publication frames.
- Deep-marker rendering, cleanup, and baseline publication-restriction evidence.

### Dependencies

This epic has no implementation dependency on another epic. Every later epic depends on its shell and contracts. The binary-handoff proof is a hard gate for production Reader work in Epic 3.

### F1. Bootstrap the hardened application shell

**Capability.** Create the pinned Electron Forge application with a single `BrowserWindow`, React routes for Library, Reader, and Settings, and early app-specific Data and Session path configuration.

**Why here.** It creates the runtime and composition roots on which every vertical slice depends.

**Acceptance criteria**

- The application starts on Windows 11 x64 and always lands on Library on a normal launch.
- Electron is pinned to 38.7.2 and epub.js to 0.3.93; other selected dependencies are pinned in the lockfile.
- The window runs with sandboxing and context isolation enabled, Node integration disabled, web security enabled, and a restrictive app CSP.
- Top-level navigation is limited to packaged `app://` content; permissions, unexpected windows, and downloads are denied.
- Mutable data is rooted under `%LOCALAPPDATA%/<App>/Data` and disposable runtime data under `%LOCALAPPDATA%/<App>/Session`, with paths set before Electron initialization.
- The renderer has no direct Node, filesystem, database, or arbitrary network access.

**Constraints/dependencies.** Follow the module boundaries in the architecture. Do not introduce a second window, production `file://` book loading, scripts, or a generic renderer bridge.

### F2. Define normalized contracts and narrow application intents

**Capability.** Establish data-only shared domain types, schemas, safe error categories, and named preload APIs for the planned Library, Reader, Settings, font, link, and translation operations.

**Why here.** All cross-process work needs a secure, stable vocabulary before features build upon it.

**Acceptance criteria**

- Shared contracts contain no Electron, DOM, React, epub.js, or SQLite row types.
- Every exposed intent has runtime schema validation, payload limits, normalized results, and a defined safe error shape.
- Main validates sender frame/origin and session ownership for session-scoped calls.
- The preload does not expose `ipcRenderer`, generic `send`/`invoke`, a generic operation field, raw paths, URLs, SQL, archive handles, or secret material.
- The trusted-book session contract has named open/close operations only; open returns a bounded transient archive buffer and session ID, never a path or generic file capability.
- Contract tests reject malformed, oversized, cross-session, wrong-origin, and unknown requests.

**Constraints/dependencies.** Depends on F1. Public contracts must remain renderer-engine-neutral; epub.js types stay inside `ReaderAdapter` infrastructure.

### F3. Build the bounded trusted-local handoff

**Capability.** Authorize an EPUB path in main, enforce the trusted-archive source-size cap, and transfer one transient archive buffer to the sandboxed renderer.

**Why here.** It establishes the one-book lifecycle used by import and Reader without exposing source paths or privileges to EPUB content.

**Acceptance criteria**

- Main accepts a path only from the native picker or library; the renderer cannot nominate paths.
- Main checks file existence, extension, and the documented source-size cap before reading bytes.
- The named session intent returns only an ephemeral `ArrayBuffer`, session ID, and bounded metadata hint; it returns no source path, handle, generic IPC, or secret.
- One active buffer is allowed. Close, replacement, error, renderer crash, and shutdown release all app references.
- A renderer archive/XML failure is an accepted trusted-local compatibility risk but cannot crash main or gain app privileges.
- Missing, unreadable, or oversized sources return typed friendly failures.

**Constraints/dependencies.** Depends on F2. Keep Electron sandboxing, scripts disabled, and remote/`file://` publication access blocked.

### F4. Prove bounded binary delivery through epub.js

**Capability.** Run the retained deep-marker fixture through the authorized binary handoff, epub.js archive mode, and script-off publication frame.

**Why here.** Architecture explicitly prohibits proceeding to production Reader work without this exact topology proof.

**Acceptance criteria**

- Package/OPF, navigation, deep `#two-mid`, XHTML, CSS, image, and declared font resolve through epub.js's ephemeral `blob:` resources.
- The renderer receives no source path or filesystem capability; publication frames receive no preload, Node/Electron API, `readerApi`, or generic IPC.
- Publication scripts, remote fetches, `file://`, forms, top-level navigation, popups, downloads, permissions, service workers, and persistent storage are blocked.
- Selection text/geometry reaches the host only through the adapter's bounded normalized event.
- Closed, stale, oversized, and failed sessions release their byte references and fail without path/secret disclosure.
- Traces record main size check, handoff, adapter timeout, frame sandbox state, and cleanup.

**Constraints/dependencies.** Depends on F3. This is a trusted-local compatibility gate, not permission to enable scripts or weaken Electron hardening.

### F5. Record the trusted-local decision; establish the regression fixture

**Capability.** Record the in-memory trusted-local EPUB decision and turn the proof into an automated regression suite usable by later epics.

**Why here.** Production code and future upgrades must implement one explicitly accepted topology rather than relying on an unrecorded spike configuration.

**Acceptance criteria**

- The decision records trusted-local selection, renderer archive parsing, source-size cap, single-book lifecycle, retained baseline restrictions, cleanup, and residual renderer denial-of-service risk.
- Deep-marker, resource loading, scripts/network/file blocking, oversized source, timeout, renderer-failure recovery, and cleanup checks run automatically against the production candidate.
- A failed proof stops the roadmap before Epic 3 and is escalated; there is no workaround using scripts, disabled Electron hardening, source-path exposure, or generic IPC.

**Constraints/dependencies.** Depends on F4. Epic 2 may use the accepted handoff, but Epic 3 cannot start its production reader path until this story passes.

**Epic exit condition.** The binary handoff renders the deep-marker fixture and size/timeout/cleanup/baseline-restriction tests pass.

## 3. Epic 2 — Persistent local library

### Purpose

Deliver the first complete user-facing vertical slice: a durable, offline visual library of references to original EPUB files, with safe import, identity, missing-file, replacement, and removal behavior.

### Included

- SQLite migrations and main-process repositories.
- Empty first-run state and cover-led recent-first library grid.
- Native file-picker import and trusted-local renderer validation.
- Opening, missing-file handling, removal, duplicate detection, and safe replacement.
- Friendly invalid/unsupported states without exposing technical diagnostics.

### Dependencies

Depends on Epic 1's shell, contracts, and accepted trusted-local handoff. Replacement migration uses the composite locator contract defined in Epic 1 and must be exercised with the same resolver semantics later used by Epic 3.

### L1. Persist the library and global state schema

**Capability.** Add ordered SQLite migrations and transactional main-process repositories for books, reading positions, preferences, font assets, and encrypted-secret metadata.

**Why here.** Library behavior and later reader/settings features need a durable source of truth with ownership confined to main.

**Acceptance criteria**

- A new profile creates the documented core records and default global preferences, including continuous reading mode.
- Only main accesses SQLite; no SQL or row representation crosses into preload or renderer contracts.
- Migrations are ordered, repeatable, and transaction-safe, including recovery from a failed migration.
- Book records retain canonical recorded path, normalized metadata, cover-cache reference, identity evidence, and added/opened timestamps without copying the EPUB.
- Reading positions store only normalized composite locator fields, never generated page number, iframe identity, or an opaque epub.js object.
- Repository tests cover restart persistence and transaction rollback.

**Constraints/dependencies.** Depends on F1–F3. Optional local translation introduces no API key or secret preference field.

### L2. Present first-run and persistent library states

**Capability.** Show the fixed-dark Library screen with the specified empty state and a visual, cover-dominated grid for imported books.

**Why here.** This is the user's home screen and the visible representation of the persisted library.

**Acceptance criteria**

- An empty first launch shows only a brief welcome message and prominent **Add books** action, with no tutorial flow.
- Each populated entry shows cover, title, author, and reading progress; it does not show “Last read.”
- Entries are ordered by most recently opened first and no alternative sorting control is offered.
- Restart reconstructs the same library from local persistence, and normal launch still opens Library rather than the last book.
- A double-click initiates opening; a single click does not open the book.
- Missing metadata/cover uses an explicit interim fallback that is isolated for later product decision rather than being treated as final product wording/design.

**Constraints/dependencies.** Depends on L1. Exact metadata and cover fallbacks remain an open product detail.

### L3. Add and validate a local EPUB

**Capability.** Let the user choose trusted EPUB files with the standard Windows picker, validate them through the bounded renderer handoff, and add valid references while remaining on Library.

**Why here.** Import is the primary way the library gains useful content.

**Acceptance criteria**

- **Add books** opens the native Windows picker restricted appropriately to EPUB selection.
- Main authorizes the selected path and performs the size/existence check; the renderer never receives or submits the raw source path.
- A valid ordinary reflowable EPUB 2/3 produces a persisted library entry and cached derived cover/metadata while the source EPUB remains byte-for-byte unchanged at its original location.
- Import does not copy the EPUB into application-managed storage and works without internet access.
- Invalid, DRM-protected, fixed-layout, script-dependent, media-overlay, or otherwise unsupported input is not added and leaves the user on Library with concise non-technical guidance.
- Technical detail is available only to redacted local diagnostics, not as the primary user error.

**Constraints/dependencies.** Depends on L1 and accepted F3/F5 trusted-local behavior. Drag/drop and Windows file association are out of scope.

### L4. Open a book or recover from a missing source file

**Capability.** Open a stored entry through a new publication session, or present the required File not found state if the original has moved, been renamed, or been deleted.

**Why here.** A reference-only library must clearly handle both the useful and broken-reference paths.

**Acceptance criteria**

- Double-clicking an available entry authorizes its stored record, revalidates changed size/mtime evidence as required, opens one active session, and updates most-recently-opened order.
- The raw path is not sent to the renderer, and only one book session is active at a time.
- A missing source remains visible in the library and produces a clear **File not found** state.
- That state offers **Remove from library** and Cancel; Cancel changes neither entry nor progress.
- A bounded handoff/open failure returns to or keeps the user in Library with a safe friendly message and releases the attempted session/archive bytes.

**Constraints/dependencies.** Depends on L3 and the session broker contract. Full readable rendering lands in Epic 3; this story can initially terminate at an authenticated reader-session handoff.

### L5. Remove a book without touching its EPUB

**Capability.** Confirm and remove a library entry and all app-owned state associated with it.

**Why here.** Removal is core library lifecycle behavior and reinforces local-file ownership.

**Acceptance criteria**

- Removal always requires confirmation.
- Confirming deletes the book record, reading position, and derived app caches in one transaction.
- The original EPUB is never deleted, moved, renamed, opened for write, or otherwise modified.
- Cancel leaves all app and source state unchanged.
- Removal of the current/attempted entry closes and revokes any session before deleting app records.
- Restart does not restore the removed entry or progress.

**Constraints/dependencies.** Depends on L1 and L2; uses the Epic 1 cleanup/revocation behavior.

### L6. Detect exact duplicates and replace library references safely

**Capability.** Use identity evidence to recognize a selected EPUB already represented in the library and ask whether to replace the existing entry.

**Why here.** Duplicate behavior is part of import and must not create ambiguous parallel entries.

**Acceptance criteria**

- Byte-hash equality is treated as exact duplicate evidence; package ID alone is never treated as proof.
- A detected duplicate prompts for replacement rather than silently adding or overwriting an entry.
- Cancel preserves the existing record and all progress.
- Replacing an unchanged-byte EPUB preserves the existing logical reading position.
- Replacement updates only app-owned records/references and does not modify either source file.
- Size/mtime changes trigger revalidation rather than being treated as identity proof.

**Constraints/dependencies.** Depends on L3 and the identity rules from the architecture.

### L7. Migrate or reset progress for changed replacements

**Capability.** Validate a changed replacement and automatically preserve progress only when the saved logical locator resolves reliably.

**Why here.** This completes the product's replacement promise and keeps unsafe guesses out of reader restoration.

**Acceptance criteria**

- The replacement is fully validated before the existing entry is changed.
- Resolution attempts the specified composite fallback order: CFI, quote/context near href, nav-range progression, then nav-range/resource start.
- A reliably resolved locator is persisted against the replacement and restores to the expected semantic passage in fixture tests.
- An unreliable locator clears/resets progress and explains that outcome clearly; the UI does not ask the user to choose a migration policy.
- A validation or transaction failure leaves the original library entry and progress intact.
- Tests cover unchanged bytes, changed content with a reliable marker, changed content with no reliable marker, and package-ID collision.

**Constraints/dependencies.** Depends on L6 and the normalized ReaderLocation/resolver contract from F2. The implementation must be reused by Epic 3 restoration rather than creating a library-only locator algorithm.

**Epic exit condition.** The offline library vertical slice passes original-file integrity, persistence, identity, missing, remove, replacement-migrate, and replacement-reset tests.

## 4. Epic 3 — Reader core and reading continuity

### Purpose

Deliver secure, comfortable reading in both modes, with TOC-aware progress and semantically correct behavior across reopening, mode changes, appearance changes, and window reflow.

### Included

- Production `ReaderAdapter` as the sole epub.js integration.
- Continuous and conventional column-based paginated modes.
- Hierarchical TOC, active section, and progress.
- Composite location capture, persistence, resolution, and cleanup.
- Global reader appearance, theme, and documented reflow behavior.

### Dependencies

Depends on all of Epic 1's proof gates and Epic 2's library/session/persistence path. Epic 4 and translation in Epic 5 depend on stable reader events, frame lifecycle, and selection geometry from this epic.

### R1. Open and close a book in continuous reading mode

**Capability.** Implement the production ReaderAdapter and render a selected book with epub.js's supported continuous/scrolled manager flow.

**Why here.** Continuous mode is the default and establishes the minimum useful reader vertical slice.

**Acceptance criteria**

- Opening from Library creates an authorized session and renders the bounded transient archive buffer without exposing the source path or a filesystem capability.
- Only `ReaderAdapter` imports epub.js or exposes CFI/rendition/frame-specific behavior internally.
- Continuous mode uses the supported continuous/scrolled manager; tests observe the manager flow container rather than only an iframe.
- Ordinary EPUB XHTML, CSS, images, and declared fonts render through epub.js `blob:` resources with publication scripts, remote resources, and `file://` blocked.
- Adapter operations are serialized with operation IDs, superseded work is cancelled, and readiness has a bounded timeout.
- Back/close, load failure, renderer failure, and opening another book deterministically destroy rendition/frames, invalidate the session, and release archive-byte references.

**Constraints/dependencies.** Hard-depends on F5 and uses L4. No custom stack of generated page surfaces, publication scripts, or generic renderer bridge.

### R2. Navigate a hierarchical table of contents

**Capability.** Show the book's normalized TOC in a closable left overlay, indicate the deepest active navigable entry, and navigate to selections.

**Why here.** TOC ranges define both user navigation and the product's chapter/progress semantics.

**Acceptance criteria**

- The overlay preserves the hierarchy supplied by EPUB nav/NCX and indicates the current deepest active entry.
- Selecting an entry navigates to its href/fragment and closes the overlay.
- Navigation ranges are derived from ordered anchors and do not assume one spine item equals one chapter.
- The toolbar snapshot exposes current section label and progress within that navigation range.
- With absent or unusable navigation, the reader shows publication title and overall progress and remains readable.
- Internal navigation cannot escape the live book session.

**Constraints/dependencies.** Depends on R1 and adapter-normalized navigation from the trusted-local F3 handoff.

### R3. Persist and restore a semantic reading location

**Capability.** Capture a bounded composite ReaderLocation during reading, save it per book, and restore the approximate position on reopen.

**Why here.** Durable reading continuity is a core product promise and underpins replacement migration and mode changes.

**Acceptance criteria**

- Location updates capture normalized href, valid CFI when available, bounded quote with context, active navId, nav-range progression, and resource progression.
- Updates are safely debounced/serialized and persist per book without storing selected text beyond the bounded locator context.
- Reopening resolves in the documented fallback order and returns to the same approximate percentage within the active section.
- The resolved marker or quote is verified as visible where such a marker exists.
- No generated page number, frame identity, opaque epub.js object, source path, or full passage is persisted.
- Missing/corrupt locator fields degrade to the next safe fallback and never prevent the book from opening.

**Constraints/dependencies.** Depends on R2 and L1. Uses the same resolver contract required by L7.

### R4. Add page-by-page mode and semantic mode switching

**Capability.** Render conventional column-based generated pages, begin new spine chapters on fresh generated pages, and switch modes while retaining the logical passage.

**Why here.** This completes the two global reading modes after location capture is reliable.

**Acceptance criteria**

- Page-by-page mode uses epub.js's supported paginated/column flow rather than a custom paginator.
- A new spine chapter starts on a fresh generated page using engine-supported boundaries/styles.
- The global mode preference defaults to continuous, persists across restart, and applies to every book.
- Switching captures the semantic visible locator, recreates/configures flow, resolves CFI then quote/context then nav progression, and verifies the intended marker/quote is visible.
- Repeated switching does not accumulate abandoned frames, handlers, sessions, or material memory growth.
- Generated page numbers are not used as durable location or progress identity.

**Constraints/dependencies.** Depends on R3. Any requirement for deep epub.js forking or custom pagination triggers the architecture escalation rule.

### R5. Apply global reading appearance and reader themes

**Capability.** Provide immediate reader controls for font size, margins, line spacing, paragraph spacing, available font family, and System/Light/Dark/Sepia reader theme.

**Why here.** Appearance is part of the reading engine because applying it changes layout and requires specified navigation behavior.

**Acceptance criteria**

- Numeric appearance properties use simple minus/plus controls and update the open reading view immediately.
- Preferences persist globally and apply when any book is opened; there are no per-book appearance settings.
- Library, Settings, and app chrome stay fixed dark regardless of reader theme.
- Versioned user styles are injected after publication styles and affect only the allowed properties.
- Book-specified text alignment is retained; text with no specified alignment is left-aligned, with no alignment override control.
- Theme/appearance changes trigger the reflow behavior in R6 rather than attempting to retain a generated page number.

**Constraints/dependencies.** Depends on R1 and L1. Downloadable font availability is completed in Epic 5; the bundled default must already work offline.

### R6. Enforce section/resource continuity during reflow

**Capability.** Apply the product's distinct appearance/window reflow rule: return to the active TOC-section start, or current spine-resource start when navigation is unavailable.

**Why here.** Reflow semantics differ intentionally from reopen and mode-switch restoration and must not be conflated with them.

**Acceptance criteria**

- Before an appearance or window-size layout mutation, the reader captures the active deepest navId or current resource fallback.
- After reflow, a book with usable navigation lands at that active navigable section's start.
- Without usable navigation, it lands at the current spine resource's start.
- The behavior works in continuous and paginated modes and does not promise exact offset/page retention.
- Automated fixtures distinguish and verify mode-switch semantic passage retention, reopen approximate section position, and reflow section/resource-start behavior.
- Rapid resize/appearance changes cancel superseded work and end in one deterministic rendition state.

**Constraints/dependencies.** Depends on R2, R4, and R5.

**Epic exit condition.** Semantic-marker, manager-flow, TOC/range, reopen fallback, mode-switch, reflow, chapter-boundary, and repeated-cleanup tests pass through the production boundary.

## 5. Epic 4 — Windows reader interaction and accessibility

### Purpose

Complete the reader's calm control model and make keyboard, pointer, selection, context-menu, focus, scaling, and assistive-technology behavior feel native on Windows.

### Included

- Hidden/revealed reader toolbar and overlay dismissal rules.
- Keyboard, wheel, and pointer page navigation.
- Standard selection, keyboard shortcuts, and right-click behavior.
- External HTTPS-link confirmation and system-browser handoff.
- Narrator, focus, keyboard-only, and high-DPI remediation.
- Stable selection geometry for the later translation surface.

### Dependencies

Depends on Epic 3's adapter events and navigation operations. Epic 5 translation depends on this epic's selection and anchor behavior.

### I1. Implement distraction-free reader controls and escape behavior

**Capability.** Hide reader controls during reading and reveal them from the central reading area or their screen-edge region, with predictable Back and Escape behavior.

**Why here.** This is the primary interaction shell around the reading surface.

**Acceptance criteria**

- The toolbar is normally hidden and contains only Back, TOC, current section/progress, mode switch, and appearance controls.
- Pointer entry into the controls' region reveals the controls.
- Clicking the central reading area reveals/hides controls without navigating a page.
- Back immediately closes the reader session and returns to Library.
- `Esc` closes the topmost open TOC/settings/translation surface first; when none is open, it closes the reader and returns to Library.
- Focus remains predictable when controls appear/disappear or an overlay closes.

**Constraints/dependencies.** Depends on R1–R2. Detailed dimensions, transitions, and final wording remain open design details.

### I2. Route page navigation input consistently

**Capability.** In paginated mode, map the required keyboard, wheel, and edge-click inputs to previous/next operations while preserving the central control zone.

**Why here.** This story implements the complete physical navigation contract on top of paginated mode.

**Acceptance criteria**

- Left/Right and Page Up/Page Down move backward/forward as expected.
- Space moves one page forward.
- Mouse-wheel input navigates pages deterministically without also scrolling app chrome.
- Far-left and far-right reading zones move backward and forward; the central zone only toggles controls.
- Inputs are ignored or adapted appropriately when an overlay owns focus and do not cause duplicate navigation.
- Packaged Windows tests exercise physical input routing, not only direct adapter method calls.

**Constraints/dependencies.** Depends on R4 and I1. App-owned routing must not expose a callable bridge to publication content.

### I3. Preserve standard Windows text selection and context actions

**Capability.** Allow text selection and normal keyboard/context-menu actions inside sandboxed publication frames without replacing them with AI UI.

**Why here.** Familiar selection behavior is a product principle and provides the safe input source for translation.

**Acceptance criteria**

- Users can select words through multi-paragraph passages in representative EPUB 2/3 content.
- Applicable standard copy/select keyboard shortcuts behave normally.
- Right-clicking selected text exposes normal Windows text-selection actions.
- The future Translate action is separate and does not replace or suppress ordinary context behavior.
- Selection changes emit only bounded normalized text, optional range CFI, and geometry through ReaderAdapter.
- Selection remains within the book frame and does not grant publication content access to app preload or IPC.

**Constraints/dependencies.** Depends on R1 and the selection route proven in F4.

### I4. Provide stable selection anchoring across the reader UI

**Capability.** Convert publication-frame selection rectangles into host coordinates and maintain or invalidate the anchor correctly as controls, overlays, pages, and sessions change.

**Why here.** Anchoring is a reader interaction primitive required before a trustworthy translation bubble can be built.

**Acceptance criteria**

- A selection produces bounded host-relative rectangles suitable for placing a small surface above or below it.
- Geometry remains correct at supported Windows scale factors, window sizes, scroll positions, and paginated pages.
- Navigation, deselection, book close, frame replacement, or invalid session clears the stale anchor.
- Opening an app overlay does not leak selection text into durable state or diagnostics.
- The original selection can remain visibly highlighted while a host-owned overlay is displayed.

**Constraints/dependencies.** Depends on I3. App chrome and all translation surfaces remain outside publication frames.

### I5. Confirm and open explicit external HTTPS links safely

**Capability.** Intercept user-activated external book links, show understandable destination information, and open confirmed HTTPS destinations in the system browser.

**Why here.** Link activation is reader input behavior with a distinct security boundary.

**Acceptance criteria**

- EPUB resources cannot silently make remote requests or navigate the reader.
- An explicit HTTPS activation raises a host confirmation showing enough destination information to understand where it goes.
- Confirm opens the destination through the narrow main-process system-browser operation; Cancel makes no external request.
- The reader itself never navigates to the external site.
- HTTP and all other external schemes are rejected by the MVP.
- Sender/session/URL validation prevents publication content from invoking an arbitrary main-process URL opener.

**Constraints/dependencies.** Depends on F2 and R1. Only HTTPS is in product scope.

### I6. Meet the Windows accessibility and scaling baseline

**Capability.** Remediate keyboard-only, focus, semantics, Narrator, contrast, and high-DPI issues across Library, Reader, overlays, and Settings shells.

**Why here.** Accessibility must be validated against the actual interaction model rather than retrofitted after packaging.

**Acceptance criteria**

- All app controls and overlays are reachable and operable by keyboard with visible focus.
- Focus enters overlays predictably, is constrained where appropriate, and returns to the invoking control on close.
- Narrator announces actionable control names/states, current section/progress, dialogs, errors, and loading status meaningfully.
- Library and Settings fixed-dark surfaces and all reader themes retain usable contrast.
- Reader controls, hit regions, selection anchors, and dialogs remain usable at the supported Windows high-DPI scale matrix.
- Native menu/context-menu and focus behavior pass packaged Windows smoke tests.

**Constraints/dependencies.** Depends on I1–I5 and the available Settings shell. Final visual tuning continues in Epic 6, but known blocking accessibility failures must be fixed here.

**Epic exit condition.** Physical Windows input, selection/context menu, overlay focus, external-link, Narrator, keyboard-only, and high-DPI smoke tests pass.

## 6. Epic 5 — Settings, fonts, and optional translation

The active Epic 5 scope and acceptance criteria are maintained in [E05 — Settings, fonts, and optional translation](epics/E05-settings-fonts-and-optional-translation.md) and [the local translation decision](LOCAL-TRANSLATION-DECISION.md). Those documents replace the earlier OpenAI key and Responses API plan in this breakdown.

Epic 5 retains global settings, bundled/optional fonts, and anchored selected-text results. Translation now uses separately installed Ollama and the fixed local German-to-English model. The reader toolbar provides explicit Load and Unload controls and actual model status. Opening the app or a book never loads the model. Selection alone never translates; a separate Translate click sends bounded text to the fixed loopback adapter only while loaded. No API key, arbitrary endpoint, cloud call, or automatic model download is part of the feature.

The seven stories are S1 settings, S2 fonts, S3 local setup detection, S4 manual Load/Unload, S5 explicit Translate and unloaded-state guidance, S6 bounded local inference, and S7 anchored result/retry. Epic 4 selection and accessibility primitives remain dependencies. The release gate covers offline reading and local translation, missing service/model, GPU memory lifecycle, cancellation, and plain-text result safety.
## 7. Epic 6 — Hardening and Windows release

### Purpose

Turn the completed feature set into a releasable Windows 11 x64 MVP by exercising the documented compatibility, containment, offline, performance, lifecycle, licensing, and installer gates in a packaged build.

### Included

- Representative valid/unsupported/malicious EPUB corpus.
- Full boundary, offline, visual, accessibility, performance, and cleanup regression runs.
- SBOM, license inventory, dependency provenance, and version-regression checks.
- Direct-download Electron Forge `Setup.exe` and install/upgrade/uninstall verification.

### Dependencies

Depends on all previous epics. It does not replace their story-level tests; it promotes them into packaged release gates and resolves issues found under production conditions.

### H1. Qualify the supported and unsupported EPUB corpus

**Capability.** Run the packaged application against a maintained corpus of ordinary reflowable EPUB 2/3 books and explicitly unsupported profiles.

**Why here.** Release confidence requires broader compatibility evidence than individual feature fixtures.

**Acceptance criteria**

- The corpus covers EPUB 2/3 navigation variants, nested TOCs, multi-spine books, CSS/images/embedded fonts, missing navigation, internal fragments, varied metadata, and representative long/stress content.
- Supported fixtures can be added, opened, read in both modes, navigated, restyled, closed, and restored offline.
- Fixed-layout, scripting-required, media-overlay/read-aloud, DRM, and unsafe/unusual unsupported fixtures fail clearly without being added or weakening containment.
- Failures remain concise and non-technical in the UI while redacted diagnostics retain actionable categories.
- Electron or epub.js version changes cannot merge/release until the same corpus, security, visual, and location suite passes.

**Constraints/dependencies.** Depends on Epics 2–5. Do not add special rendering/security exceptions for excluded profiles.

### H2. Run trusted-publication resilience and application-boundary tests

**Capability.** Verify the complete packaged trust model against malicious archives, XML, resources, frames, protocols, IPC, and session attempts.

**Why here.** Containment is a release property and must be re-proven after all feature integrations.

**Acceptance criteria**

- Troublesome ZIP/XML fixtures exercise oversized source rejection, malformed archives/XML, excessive memory/readiness time, image failures, and renderer crash/recovery.
- Script, event handler, form, object/plugin, remote resource, service worker, storage, popup, download, permission, frame, and navigation escape attempts are blocked.
- Stale/cross-session/malformed/oversized/wrong-origin IPC and closed archive-buffer use fail without path, secrets, or diagnostic leakage.
- Main remains responsive and all capabilities/handles are cleaned after failure.
- The exact F4/F5 binary-handoff regression passes in the packaged build, including post-close archive-byte release and renderer recovery.
- No diagnostics contain source paths, book/selection/translation text, or raw model output.

**Constraints/dependencies.** Depends on F5 plus all features that touch the boundary.

### H3. Prove offline-first and network isolation behavior

**Capability.** Verify ordinary reading and local translation with internet access disabled, and enforce separate loopback, font-download, and external-link boundaries.

**Why here.** Local-first operation is a top-level product promise and cross-feature acceptance gate.

**Acceptance criteria**

- With network disabled, the packaged app launches, imports, opens, reads, navigates, restyles, closes, and restores books.
- The bundled default and previously downloaded fonts work offline.
- No book content silently reaches the internet or Ollama. No account or API key is required for local translation.
- Read-only status checks may reach fixed Ollama loopback; only explicit Load and Translate intents load a model or submit book text. Opening a book and selecting text do neither.
- Local translation works offline after separate Ollama/model installation. Missing service/model is isolated from reading.
- Font download failures are isolated and friendly.
- Only a confirmed user-activated HTTPS book link is handed to the system browser.

**Constraints/dependencies.** Depends on S2 and S3–S7.

### H4. Meet reader performance and lifecycle targets

**Capability.** Measure and remediate first-read, navigation, reflow, memory, and repeated lifecycle behavior on documented ordinary and stress fixtures.

**Why here.** The architecture carries provisional quantitative release targets that require packaged runtime evidence.

**Acceptance criteria**

- On the recorded test machine/build/fixtures, first readable content is at most 2 seconds for ordinary and 5 seconds for stress fixtures.
- Page/scroll input response is at most 100 ms.
- Appearance reflow is at most 1 second ordinary and 2 seconds stress.
- Reader application working memory is at most 500 MiB, with residual growth at most 75 MiB after 20 open/reflow/close cycles; measure Ollama and GPU memory separately.
- Twenty-cycle testing finds no leaked archive-byte reference, publication session, frame, blob URL, or event handler.
- Record warm translation latency, cold manual Load time, GPU-memory release, repeated Load/Unload, book switching, and the bounded best-effort app-exit release attempt.
- If targets prove unsuitable for the agreed MVP hardware baseline, evidence is recorded and returned to the owner rather than silently changing the gate.

**Constraints/dependencies.** Depends on all reader and translation lifecycle work. Targets are provisional architecture gates, not previously validated facts.

### H5. Complete the visual, accessibility, and recovery matrix

**Capability.** Validate the integrated application across supported window sizes, DPI settings, reader themes, content shapes, error states, and keyboard/Narrator flows.

**Why here.** Cross-feature overlays and production packaging can introduce issues not visible in isolated story testing.

**Acceptance criteria**

- Library, Reader, Settings, TOC, appearance controls, dialogs, translation surfaces, and empty/loading/error states pass the agreed visual matrix.
- System/Light/Dark/Sepia reading themes remain legible while app chrome remains fixed dark.
- Keyboard-only and Narrator journeys cover first run, import, open/read/navigate, settings, translation setup guidance, Load/Unload, request, errors, and return to Library.
- Focus and selection anchors recover correctly after resize, DPI change, overlay nesting, provider error, reader close, and renderer failure.
- No UI presents postponed features as available.

**Constraints/dependencies.** Depends on I6 and Epic 5. Final wording/dimensions/transitions require resolution of the open design details below.

### H6. Produce and verify the Windows 11 x64 installer

**Capability.** Build the direct-download Electron Forge `Setup.exe` and verify its complete lifecycle on clean Windows 11 x64 environments.

**Why here.** The installed application—not a development build—is the MVP deliverable.

**Acceptance criteria**

- CI/release tooling produces a Windows 11 x64 `Setup.exe`; it does not produce Store/MSIX, ARM64, 32-bit, or auto-update deliverables.
- Clean install, first launch, normal launch, upgrade, uninstall, and reinstall are tested.
- Upgrade preserves intended library, positions, preferences, downloaded fonts, and protected key data; uninstall behavior for retained user data is documented and tested against the agreed installer policy.
- Native `better-sqlite3` or selected equivalent is rebuilt/packaged correctly and migrations run in the installed build.
- The packaged application-boundary, trusted-publication resilience, reader, offline, accessibility, and performance suites pass.
- The installer is signed only if trusted signing is available without a required fee; otherwise it is intentionally released unsigned as PRODUCT.md permits.

**Constraints/dependencies.** Depends on H1–H5. Do not introduce a paid distribution, certification, runtime, SDK, or signing requirement.

### H7. Complete dependency, license, and release evidence

**Capability.** Inventory the shipped/build supply chain and collect the evidence required to approve an MVP release.

**Why here.** Open-source/no-fee dependency compliance and reproducible security evidence are explicit product and architecture requirements.

**Acceptance criteria**

- Every direct/transitive shipped and build dependency and every font is inventoried with version, license, provenance, and applicable artifact hash.
- The release includes a generated SBOM and no dependency/font that requires a licensing fee or paid proprietary runtime/SDK/component.
- Dependency/security scans have no unresolved release-blocking finding.
- Exact Electron/epub.js pins and the trusted-local binary-handoff selection match the accepted architecture evidence.
- Release records link the corpus, application-boundary/resilience, offline, visual/accessibility, performance, cleanup, and installer results for the shipped build.
- Known residual risks and any owner-approved exceptions are explicit; no unresolved gate is described as validated.

**Constraints/dependencies.** Starts during F1 dependency selection but is accepted only after H6 verifies the shipped artifact.

**Epic exit condition.** All documented release gates pass in the packaged Windows build, supply-chain evidence is complete, and a verified direct-download `Setup.exe` is available.

## 8. Cross-epic sequencing notes

1. F1–F5 are sequential; F5 is the non-negotiable reader gate.
2. L1/L2 can proceed while the latter part of the publication proof is being documented, but L3 must use the accepted trusted-local handoff. Production R1 must wait for F5.
3. L7 establishes the shared resolver behavior with fixtures; R3 integrates that same behavior into real reopen flow. Do not create two independent algorithms.
4. R1–R3 establish the stable reading/location substrate; R4–R6 then add mode and appearance reflow semantics.
5. I1–I4 should precede translation UI because selection geometry, dismissal, focus, and overlay behavior are prerequisites, not translation-specific implementation details.
6. S1/S3 may begin after the persistence/contracts work, but S5–S7 wait for I4 and S3. S2 waits for an approved catalog decision.
7. H7 dependency/license collection starts with F1 and is maintained continuously, even though its release acceptance occurs last.

## 9. Explicitly unresolved product details

These items are ambiguous by design in PRODUCT.md and need explicit product/design decisions. They are not permission to add features or silently choose final behavior:

- Exact fallback title, author, and cover treatment when EPUB metadata is missing. L2/L3 may use isolated temporary placeholders, but final acceptance needs the chosen behavior.
- Whether reaching the end of a book creates a distinct **Finished** state. No separate state should be introduced until decided.
- The contents and organization of the downloadable font catalog. S2 cannot ship catalog entries without approval and license evidence.
- The exact translation character limit after validation. Stories use the documented initial approximately 5,000-character limit behind an internal constant.
- The predefined translation prompt/template text. The product requires one but does not include its exact content; S6 needs the approved template before release.
- Detailed visual dimensions, transitions, and final interface wording. Story acceptance specifies behavior and accessibility, not final visual design values.
- Installer retained-data behavior on uninstall is not stated. H6 needs an explicit installer-policy decision while preserving the architecture's upgrade-retention requirement.

## 10. Scope guardrails

This roadmap does not include bookmarks, highlights, annotations/notes, search, general Ask AI, prompt editing, additional AI providers/models/endpoints, cloud accounts/sync, mobile, PDF, DRM support, drag-and-drop import, Windows file association, alternative library sorting, per-book appearance/mode preferences, Store/MSIX, ARM64, 32-bit, or auto-update. They should not appear in UI, contracts, or release claims for this MVP.
