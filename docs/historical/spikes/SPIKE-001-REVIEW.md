# SPIKE-001 Independent Evidence Review

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


**Reviewer scope:** This review assesses whether the retained SPIKE-001 artifacts support the report's conclusions. It does not redesign the application or modify the spike.

## Verdict

**Final recommendation: RE-RUN SPECIFIC TESTS**

The artifacts show that epub.js can render the supplied EPUB 2/3 samples in Electron, create both requested rendition configurations, expose CFI-based locations, and run with the shown Electron hardening options. They do not yet demonstrate several decision gates that the spike report calls PASS. In particular, the automated PASS predicates frequently establish only that a CFI exists after an operation, rather than that the reader reached or retained the intended passage.

This is a harness-evidence problem, not evidence of an epub.js limitation. It does not justify moving to Foliate-js yet, but it also does not justify adopting epub.js for production on the current record.

## Evidence reviewed

- `spikes/renderer/src/main.cjs`, `preload.cjs`, `renderer.js`, and `index.html`
- all retained JSON and PNG evidence under `spikes/renderer/evidence/`
- `spikes/renderer/test/static-security.test.cjs` and `package.json`
- the fixture generator and supplied fixture set
- `docs/product/PRODUCT.md`, `docs/historical/planning/TECHNICAL-PROPOSAL.md`, and `docs/historical/spikes/SPIKE-001-RENDERER.md`

`pnpm test` was reproducibly run. It passed 3/3, but all three tests are static source inspections. `package.json` references `test/smoke.cjs`, which is not present; therefore that named automated test command is not reproducible from the retained spike.

## Result-by-result assessment

| Spike result | Classification | Review |
|---|---|---|
| Local EPUB opening; ordinary EPUB 2 and real EPUB 3 basic render/TOC load | **SUPPORTED** | Runtime probe JSONs show metadata, initial locations, and 2/16 TOC entries respectively. The associated screenshots show rendered content. This establishes basic compatibility for these narrow samples, not broad EPUB compatibility. |
| Continuous scrolling | **WEAK EVIDENCE** | The harness selects epub.js `continuous` + `scrolled-doc`, and the smoke result observes an iframe. That does not assert a real scroll operation, vertical offset progression, later-spine loading during scroll, or the absence of generated page behavior. The TOC probe loads a later spine item, but by direct `rendition.display()`, not scrolling. |
| Paginated mode | **SUPPORTED** | The focused paginated-key probe records `currentMode: paginated`, a generated total of five, and page 2 with a later CFI. The PNG is consistent with paginated rendition output. The smoke PASS by itself is weak because it only checks the mode and a nonempty CFI; the focused probe supplies the meaningful runtime evidence. |
| Chapter begins on a fresh generated page | **NOT DEMONSTRATED** | No retained assertion crosses a chapter boundary in paginated mode. The five-page result is for one synthetic spine item. |
| Keyboard pagination | **WEAK EVIDENCE** | The focused probe supports one ArrowRight transition to page 2. However the committed `smoke-results.json` says its key handler count changed while page and CFI remained unchanged, despite recording PASS because the predicate checks only handler invocation. No retained tests cover required PageUp/PageDown, Space, wheel, or far-edge clicks. |
| Mode switching retains position | **NOT DEMONSTRATED** | `switchMode()` captures the current leading CFI and redisplays it, but the smoke assertion is only `Boolean(before.cfi && after.cfi)`. It never compares them or verifies content at a deliberately non-initial target. The report's claim of an identical CFI is not supported by its own retained smoke output: it reports a start CFI before/after at the initial `Part One` position. |
| Save/restore retains position | **NOT DEMONSTRATED** | The code stores a composite-looking object, but restoration passes only `saved.cfi`; `href` and progression are unused. Its PASS predicate only requires a saved and a resulting CFI. The test reloads bytes in the same Electron session and does not first navigate to a non-initial passage or compare the restored passage. It therefore does not prove close/reopen restoration or the proposed composite locator. |
| Appearance changes retain position | **NOT DEMONSTRATED** | Font size, margin, and theme are set, but the PASS condition is merely that a CFI exists after the update. There is no equality/semantic-position assertion, no deliberately non-initial target, and no coverage of line or paragraph spacing required by the product. The code does apply the three tested epub.js theme APIs at runtime. |
| TOC navigation and hierarchy | **SUPPORTED** | The generated EPUB 3 has nested entries and two entries sharing `shared.xhtml`; the TOC probe selects `tail.xhtml` and records its resulting location. This demonstrates population and direct navigation, including a separate final spine item. |
| Deepest active TOC label and chapter/section progress | **NOT DEMONSTRATED** | The report labels this partial, correctly. The harness flattens labels into a select and does not calculate active nested entry or navigation-range progress. This is a decision-gate gap because shared-resource entries are precisely the hard case. |
| Text selection, range CFI, and anchor geometry | **SUPPORTED** | A real DOM Range in an epub.js publication iframe produced text, a CFI range, and nonzero host-coordinate geometry; the harness adds an epub.js highlight and positions a host action from it. This is useful proof of the bridge mechanism. It is not a user-input test. |
| Conventional selection, native Copy, context menu, focus, and pointer interaction | **NOT DEMONSTRATED** | The host contains a context-menu hook and native role-based Copy menu, but no retained runtime evidence invokes it through a physical pointer/right click. No evidence covers focus transfer, wheel, or far-edge page clicks. This matches the spike report's stated limitation rather than an epub.js failure. |
| Publication scripts disabled | **SUPPORTED** | The hostile fixture's inline script marker is absent in the rendered document, while the rendition requests `allowScriptedContent: false` and the actual iframe sandbox value is `allow-same-origin`. This is runtime evidence for the tested inline script. |
| Book frames lack Node/Electron/preload access | **SUPPORTED** | The runtime probe reads the publication frame and records both `process` and `spikeHost` as `undefined`. The preload exposes named operations only, and main-frame sender validation is implemented. This establishes the tested frame's isolation, not every possible future frame/origin case. |
| Forms, external navigation, and popups contained | **WEAK EVIDENCE** | The runtime probe clicks the hostile form button and link and observes `about:srcdoc` unchanged. That is meaningful for those elements, but the link is also prevented by a renderer content hook before navigation. No actual popup attempt, app/custom-protocol navigation, iframe, service worker, storage, or cross-book access test is retained. |
| Remote-resource blocking | **WEAK EVIDENCE** | The hostile image has `naturalWidth=0`, a useful negative result. But `blockedRequests` is empty, including for the remote stylesheet left in the DOM, so the evidence cannot distinguish a prevented fetch from epub.js not attempting to load that resource. It does not prove remote CSS URL, script `fetch`, or other remote-resource paths were blocked. The session cancellation and CSP are implementation/static evidence, not a demonstrated network outcome. |
| Hardened Electron configuration | **SUPPORTED** | Runtime diagnostics report sandbox/context isolation/web security enabled and Node integration disabled. `pnpm test` independently confirms the literals are present in source. No unsafe Electron setting, disabled web security, script exception, custom pagination engine, or epub.js fork is evidenced. |
| Small/acceptable epub.js-specific complexity | **WEAK EVIDENCE** | There is no fork or custom pagination engine, which supports the narrow claim. The retained adapter is nevertheless material: rendition teardown/recreation, timing delays, CFI handoff, iframe selection geometry, theme overrides, content hooks, and security policy. The spike did not measure cleanup/leaks or stress it under repeated changes, so “reasonable production complexity” is a judgment not yet validated. |
| Performance, memory, and latency gates | **NOT DEMONSTRATED** | No retained measurements or stress fixture exercise supports the mandatory proposal gate. |
| Unsupported/fixed-layout/required-script/DRM/media-overlay rejection | **NOT DEMONSTRATED** | The hostile fixture demonstrates disabled scripting, not a friendly, deliberate unsupported-publication path. No retained fixed-layout, DRM, or media-overlay test exists. |
| Narrator/accessibility smoke test | **NOT DEMONSTRATED** | The report accurately records this as partial; no runtime evidence exists. |

## Important evidence defects

The following are material because they turn claimed behavioral passes into existence checks:

- `runAutomatedEvidence()` records mode switching, appearance, and restore as PASS when both sides have any CFI. It does not compare equality, resolve a content marker, or choose a non-initial location first.
- Its keyboard PASS checks only `keyNavigationCount`. The retained smoke output itself records page `1 -> 1` and the same CFI.
- The report's stronger statement about a successful page transition is instead supported only by the focused `probe-toc-and-images-epub-paginated-key.json` artifact.
- The test script named by `test:smoke` is absent. The retained `pnpm test` suite is valuable as a guard against obvious configuration edits, but it demonstrates no runtime behavior.
- The harness calls `ePub()` with a whole EPUB byte array in the renderer and lets epub.js/JSZip open it. That is acceptable for a disposable renderer experiment, but it does not prove the production resource-delivery boundary or bounded archive handling promised by the technical proposal; SPIKE-002 remains required.

## Smallest rerun needed

Keep the same harness and fixtures. Add one reproducible Electron runtime test file (and retain its raw result) containing these two scenarios:

1. **Relocation contract:** navigate to a known mid-resource CFI/semantic marker in the shared-resource fixture, then separately switch flow, change all intended appearance properties, and close/reopen the rendition. After each operation assert the resolved marker/CFI and relative section location, not merely CFI presence. In paginated mode, cross from the end of one spine item to the next and assert that the new chapter starts on a fresh generated page. Include the TOC-range calculation for the nested `shared.xhtml` entry and its chapter/section progress.
2. **Interaction and containment contract:** in a visible/manual Electron pass, verify pointer selection, right-click Copy, wheel/far-edge page navigation, and focus. In the hostile fixture, attempt remote image/CSS and script fetch, form, popup, HTTPS/app-protocol navigation, iframe/service worker/storage as applicable; retain the request-attempt log and assert no request/navigation/API access succeeds. Keep the existing script and Node/preload checks.

These are reruns of the stated spike gates, not a new renderer implementation. If they pass without weakening Electron settings, publication scripting, or the frame boundary, then epub.js would have sufficient evidence to proceed to the separate archive/resource spike. If the relocation or containment contracts fail because of epub.js rather than a harness defect, test Foliate-js next.

## Focused-rerun review addendum — 2026-09-17

**Independent recommendation: ONE NARROW EPUB.JS RERUN**

The strengthened fixture and latest authoritative trace support a real deep-marker continuous-to-paginated relocation result, but they do not support adopting epub.js. Appearance-position preservation is contradicted under the tested sequence: direct redisplay, a forced-spine retry, and rendition recreation all resolved the intended `shared.xhtml#two-mid` semantic CFI into the earlier `[one]` section instead of `[two]`.

That failure is not yet clean evidence of an intrinsic epub.js limitation. The harness fires multiple theme/reflow operations without waiting for a settled transaction, its first direct relocation listener may consume an appearance-generated event, and recreated renditions attempt paragraph-spacing injection before publication contents exist. The latest fail-fast run also does not demonstrate strengthened close/reopen restoration, nested TOC progress, expanded hostile-content containment, native pointer/wheel/Copy behavior, accessibility, performance/memory, or unsupported-publication handling.

The smallest remaining epub.js observation is one paginated deep-marker transaction: prove that the semantic CFI resolves to `#two-mid`, apply all appearance settings through a serialized/settled update, record the resulting computed styles, prove that the same CFI still resolves to `#two-mid`, then perform one target-filtered display and assert marker visibility. If that settled transaction still resolves into `[one]`, invoke the proposal's next-engine rule and run the equivalent focused contract on Foliate-js. If it passes, continue only the still-missing epub.js gates; adoption remains premature until those gates are demonstrated.

### Settled-appearance disposition

The authoritative `settled-appearance-error.json` resolves the remaining material confounder. Runtime computed styles show the requested appearance values were applied, and `contents.range(targetCfi)` still resolves the unchanged semantic CFI to `#two-mid` after styling. The single target-filtered `display(targetCfi)` then emits a location in `[one]` and never reaches the required `[two]` target during the bounded wait.

The empty quiescence-event list is weak evidence of complete event quiescence because its listener starts after appearance application, but that limitation is not material here: correct post-style computed values and DOM CFI resolution are established before the display call, and the target-filtered listener remains active throughout the display wait. The appearance-position gate is therefore **CONTRADICTED** for the tested epub.js topology.

**Final epub.js disposition: FAILED / NOT SELECTED.** Renderer selection remains open. Per the proposal's next-engine rule, the workflow proceeds to an equivalent focused Foliate-js Spike A experiment, beginning with this same deep-marker paginated appearance contract before expanding to the remaining relocation, interaction, containment, accessibility, performance, and unsupported-publication gates.
