# SPIKE-001 — Electron + epub.js renderer

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


**Date:** 2026-09-16  
**Status:** Terminally escalated — epub.js failed; Foliate-js not demonstrated; lightweight-renderer timebox exhausted  
**Overall assessment:** **NO RENDERER SELECTED**

> **Historical-result note (2026-09-17):** This spike remains terminally escalated under its original exact-passage-after-appearance contract. The owner subsequently relaxed that product requirement and authorized the separate SPIKE-003 epub.js gate-validation spike. That does not convert this result into a pass or select epub.js.

## 1. Question

Can a small, security-hardened Electron host use epub.js as the MVP foundation for ordinary reflowable EPUB 2/3 reading, conventional vertical continuous flow, conventional pagination, logical-location preservation, appearance changes, TOC navigation, and selection-based UI anchoring without enabling publication scripts, Node integration, generic IPC, disabled web security, a custom pagination engine, or a deep epub.js fork?

## 2. Environment

The spike ran on Windows 11 Pro 25H2, x64 (build 26200.9457). The legacy registry `ProductName` value reports “Windows 10 Pro”, but the build/display version identify the installed Windows 11 release.

| Tool / dependency | Version | Source / disposition |
|---|---:|---|
| Node.js | 24.19.0 | Existing Codex user-local runtime |
| pnpm | 11.19.0 | Existing Codex user-local runtime |
| Git for Windows | 2.55.0 | Existing local tool |
| Electron | 38.7.2 | Installed project-locally in `spikes/renderer` |
| epub.js (`epubjs`) | 0.3.93 | Installed project-locally |
| JSZip | 3.10.1 | Installed project-locally; fixture generation and epub.js archive support |

`npm` was not on `PATH`. No global package was installed and no machine-wide configuration was changed. Electron's install script was explicitly allowlisted in the spike-local `pnpm-workspace.yaml`; unrelated transitive lifecycle scripts remain denied. The lockfile records the complete dependency graph.

## 3. Harness

The disposable harness lives in `spikes/renderer/`. It is plain HTML/CSS/JavaScript hosted by one Electron `BrowserWindow`; React and Vite were intentionally omitted because they add no evidence for the renderer decision.

The host has a narrow preload API for the native EPUB picker, allowlisted fixtures, a native Copy menu, and security diagnostics. `sandbox`, `contextIsolation`, and `webSecurity` remain enabled; `nodeIntegration` and insecure mixed content remain disabled. The isolated session denies permissions and cancels HTTP(S) requests. Main-frame IPC validates its sender. epub.js receives in-memory bytes and creates sandboxed publication iframes with `allow-same-origin` only; `allow-scripts`, forms, popups, and top navigation are not granted.

Continuous mode uses epub.js's `continuous` manager with `scrolled-doc`. Paginated mode recreates the rendition with the `default` manager, `paginated` flow, and no spread. A CFI captured before recreation is passed to the new rendition. Appearance changes use epub.js themes. Positions are stored as a small composite locator (`cfi`, `href`, progression) in harness-local storage. This storage choice is spike-only; it does not pre-empt the production persistence design.

## 4. EPUB fixtures

| Fixture | Purpose | Provenance |
|---|---|---|
| `alice-gutenberg.epub` | Real public-domain, image-bearing EPUB with author CSS and 16-entry TOC | Project Gutenberg ebook 11, downloaded from `https://www.gutenberg.org/ebooks/11.epub3.images` on 2026-09-16 |
| `ordinary-epub2.epub` | Minimal EPUB 2, NCX TOC, two spine items | Generated in-repository by the spike script |
| `toc-and-images.epub` | EPUB 3, nested TOC, two TOC entries sharing one XHTML resource, separate final chapter, image and author CSS; focused rerun uses 80 paragraphs per shared section and a deep `#two-mid` marker at nested paragraph 56 | Generated in-repository by the spike script |
| `awkward-security.epub` | Script, form, external link, remote image/CSS and long content | Generated in-repository by the spike script |

The generated fixtures are narrow probes, not a conformance suite. The generator is retained so their content and intent are reviewable and reproducible.

## 5. Results

| Requirement | Result | Evidence / notes |
|---|---|---|
| Open a local reflowable EPUB | **PASS** | The native picker path exists; allowlisted byte loading rendered EPUB 2 and EPUB 3 fixtures. |
| Ordinary EPUB 2 | **PASS** | `ordinary-epub2.epub` rendered its first chapter and exposed both NCX entries. See `probe-ordinary-epub2-epub.png`. |
| Ordinary real-world EPUB 3 | **PASS** | Project Gutenberg Alice rendered its cover image/author styling and exposed 16 TOC entries. See `probe-alice-gutenberg-epub.png`. |
| Multiple chapters | **PASS** | The TOC probe moved from `shared.xhtml` to `tail.xhtml`; the relocated event returned `epubcfi(/6/4!/4/2/1:0)`. |
| Table of contents | **PASS** | Hierarchical labels were populated; activating the final control entry navigated to `tail.xhtml`. `probe-toc-and-images-epub-toc.json` records the selected href and CFI. |
| Continuous mode | **PASS** | epub.js `continuous` + `scrolled-doc` rendered vertical reflow with ordinary browser scrolling; TOC navigation loaded a later spine item into the same flow. No generated page stack was built. |
| Paginated mode | **PASS** | epub.js `default` + `paginated` reported five generated pages for the first synthetic resource. The next control moved page 1 to page 2 and changed the CFI from `/2/1:0` to `/18/1:0`. |
| Keyboard pagination | **PASS** | The ArrowRight handler routes to the same `rendition.next()` operation and the final Electron run recorded the resulting page/CFI transition. |
| Mode switching at a deep same-resource marker | **PASS (focused rerun)** | The strengthened fixture reached `shared.xhtml` nested section `[two]` at a non-initial point CFI, then switched flow while retaining that target. |
| Logical reading position across close/reopen | **NOT DEMONSTRATED** | The focused rerun failed during the required appearance relocation sequence before the downstream reopen contract could complete. Earlier same-session restore evidence does not satisfy this strengthened gate. |
| Font, margins, line/paragraph spacing, theme retain logical position | **FAIL (focused rerun)** | After appearance reflow, direct leading-CFI redisplay and a forced-spine semantic-point-CFI retry both resolved into `[one]`, not the deep `[two]` target. Recreating the paginated rendition also failed to emit a matching target relocation within the bounded wait. |
| Text selection and geometry | **PASS** | A real DOM Range inside the publication produced selected plain text, a CFI range, and host-window geometry (`x=49`, `y≈161`, `width≈189`, `height≈47`); the fake Translate button was anchored from it and a retained epub.js highlight was added. |
| Conventional pointer selection / native Copy | **PROXY ONLY** | Programmatic DOM Range selection, synthetic `contextmenu`, and host focus were exercised. No physical pointer/right-click Copy, wheel, far-edge navigation, or manual visible pass was run. |
| Author scripts disabled | **PASS** | The hostile fixture's script did not set its marker. The iframe sandbox contained only `allow-same-origin`. |
| No Node/Electron/preload in book content | **PASS** | In the publication window, both `process` and `spikeHost` were `undefined`; the preload exposes no generic send/invoke function. |
| Forms/navigation/popups containment and hostile request attempts | **NOT COMPLETED IN LATEST RERUN** | The focused contract was fail-fast at appearance relocation, so its expanded hostile action/request-log sequence did not run to completion. Earlier narrow form/link evidence remains weak, not a focused-contract PASS. |
| Arbitrary remote publication fetch | **WEAK EARLIER EVIDENCE** | Earlier hostile image evidence showed no loaded image, but the expanded focused request-attempt log did not complete because the run failed earlier. |
| Hardened Electron settings | **PASS** | Runtime diagnostics confirmed sandbox/context isolation/web security enabled and Node integration disabled. Static regression assertions cover the same settings and CSP. |
| Deepest active TOC label/range progress | **PARTIAL** | epub.js exposes navigation entries, href/fragment targets, CFIs, spine indexes and displayed-page data needed for an adapter. The spike did not implement the final navigation-range/progress algorithm; that remains production adapter work. |
| Narrator/accessibility smoke test | **PARTIAL** | Semantic controls and an iframe reading surface are exposed, but Narrator could not be driven through the unavailable native-app automation surface. This is a required production/manual test, not an epub.js failure observed here. |

## 6. Focused rerun (2026-09-17)

The independent review required a relocation and containment rerun. The harness was strengthened with a deliberately deep same-resource marker, target-aware `relocated` event logging, computed line/paragraph-spacing checks, and bounded retry evidence. It records direct, forced-spine, and rendition-recreation attempts rather than silently accepting a changed CFI.

The project-local static command `pnpm test` passed 3/3 and `node --check` passed for the focused harness files. In the workspace-sandbox launch environment, `pnpm run test:focused-rerun` could not load the local Electron page (`ERR_FAILED`; GPU child exit `-1073741515`); the exact failed commands and diagnostics are retained in `focused-rerun-launch-error.txt`. The same focused command was then run outside that sandbox on the Windows host and reached the Electron harness.

That elevated run proved deep-marker mode switching, but failed the appearance contract. Before applying appearance, the target was `shared.xhtml` section `[two]` at `epubcfi(/6/2!/4/4[two]/100/1:0)`. Direct re-anchor after applying font, margin, line spacing, paragraph spacing, and theme relocated to `shared.xhtml` section `[one]` (`.../2[one]/116/1:31`). A forced `tail.xhtml` then semantic-point-CFI retry again relocated to `[one]`. Recreating the paginated rendition with appearance applied before displaying the semantic CFI emitted only the `[one]` relocation and then timed out waiting for the target. This is a behavioral failure of the focused appearance-relocation contract, not a PASS based on CFI existence.

Because the focused run fails fast at that point, it did not complete its strengthened close/reopen, nested TOC-progress, or hostile-containment scenarios. Those gates remain uncompleted, not failed or passed by implication.

## 7. Problems encountered

- epub.js's browser distribution requires JSZip to be present as a global; including the project-local JSZip browser build resolved this without a patch or fork.
- Switching between continuous and paginated managers is most predictable by destroying and recreating the rendition around a saved CFI. This is small adapter code but requires cleanup discipline.
- The rendition needs a brief settled interval before accepting a page-turn immediately after manager recreation. A focused probe confirmed that the next control then advances from generated page 1 to 2. Production UI should serialize relocation-affecting operations rather than fire them concurrently.
- An external stylesheet can remain represented as a DOM `styleSheet` entry even though no remote bytes loaded. Security assertions must check network/loaded-resource outcomes, not merely DOM presence.
- The Project Gutenberg book opens quickly and renders correctly, but location events may arrive after `display()`. Hidden automated Electron windows also became timer-throttled until the evidence window set `backgroundThrottling: false`; visible interactive windows were unaffected. The harness bounds the display wait at three seconds and treats `relocated` as the authoritative readiness signal. Production adapter operations should be serialized, cancellable and timeout-bounded.
- The available computer-control provider returned no native applications, so pointer/right-click and Narrator checks could not be independently automated. Runtime interaction was instead performed inside real Electron processes and documented as such.

## 8. Security observations

The tested topology did not require disabling any Electron protection. Publication scripts are blocked twice in practice: epub.js receives `allowScriptedContent: false`, and its iframe sandbox omits `allow-scripts`. Publication frames do not receive preload, Node, or Electron APIs. The host preload exposes four named intents and no generic IPC primitive; main rejects non-main-frame callers. No secret API exists in the renderer harness.

The session denies all permission requests, denies new windows, prevents top-level navigation, and cancels HTTP(S) traffic. The host CSP additionally sets `connect-src 'none'`, `object-src 'none'`, `form-action 'none'`, and a narrow `frame-src` policy. The hostile form and external link did not navigate the reader; the remote image did not load.

`allow-same-origin` is required by epub.js so the host can inspect selection and layout inside its generated iframe. That means host code can access publication DOM; it does **not** let publication code access Electron because publication scripts do not run and the nested frame has no preload. This coupling is acceptable for the MVP threat model but should be covered by hostile-fixture regression tests on every epub.js/Electron upgrade.

This renderer spike does not prove safe archive parsing or decompression limits. That is the separate required archive/resource-boundary spike.

## 9. Implementation complexity

The integration is small: one Electron main file, one narrow preload, one renderer file, and a simple UI. No epub.js source modification, fork, custom pagination engine, injected page-stack system, disabled web security, or publication-script exception was needed.

The engine-specific code that production should deliberately own is:

- rendition creation/cleanup for the two manager/flow combinations;
- CFI capture and redisplay around mode/appearance changes;
- selection CFI/rectangle conversion from iframe coordinates to host coordinates;
- theme overrides;
- TOC href/fragment to ordered navigation-range mapping;
- the fixed security/session policy and hostile corpus.

The focused rerun adds material adapter behavior: target-aware relocation filtering, explicit semantic point CFIs, forced-spine retries, and attempted rendition recreation. The final recreation attempt did not recover the target after appearance reflow. This complexity cannot currently be called acceptable for adoption; it is evidence to be independently reviewed.

## 10. Overall assessment

**FAILED / NOT SELECTED**

Basic EPUB rendering, initial hardening checks, and deep-marker flow switching have runtime evidence. The final settled-appearance probe proved the semantic CFI still resolves to `#two-mid` and the requested styles apply, but its one target-filtered display relocated to `[one]` rather than `[two]`. Under the independent review's decision rule, epub.js is **failed / not selected for this spike contract**. This does not establish a universal epub.js impossibility; it is a bounded result for the tested Electron topology, fixture, and required appearance-position behavior. Close/reopen, nested TOC range/progress, and expanded containment remain uncompleted; interaction evidence is proxy-only. The earlier overall PASS is superseded.

## 11. Recommendation

**Do not adopt epub.js from this spike record. Advance to the equivalent Foliate-js candidate probe.** The final review disposition authorizes this next-engine test after the settled transaction still relocated the deep semantic target into `[one]`.

This is not a production implementation or a broad bake-off. Foliate-js must first pass only the equivalent deep-marker paginated appearance contract, with the same security boundary and retained runtime evidence.

The separate archive/resource-boundary spike remains required regardless of the renderer outcome.

## 12. Evidence

- `spikes/renderer/evidence/smoke-results.json` — real Electron automated result set.
- `spikes/renderer/evidence/harness.png` — captured running hostile fixture with applied appearance settings.
- `spikes/renderer/evidence/probe-alice-gutenberg-epub.png` and `.json` — real-world Alice render and metadata/TOC probe.
- `spikes/renderer/evidence/probe-ordinary-epub2-epub.png` and `.json` — EPUB 2 render and NCX probe.
- `spikes/renderer/evidence/probe-toc-and-images-epub-toc.png` and `.json` — TOC navigation to `tail.xhtml`.
- `spikes/renderer/evidence/probe-toc-and-images-epub-paginated-key.png` and `.json` — settled ArrowRight pagination from generated page 1 to page 2.
- `pnpm test` — 3/3 static security regression assertions passed.
- Reproduction commands are in `spikes/renderer/README.md`.

Focused-rerun provenance is intentionally split:

- `spikes/renderer/evidence/focused-rerun-results.json` and `focused-rerun.png` are the earlier focused execution from 01:01. They use the earlier short marker fixture and contain failed preliminary contracts; they are not the final focused verdict.
- `spikes/renderer/evidence/focused-rerun-error.txt` is the latest authoritative focused-rerun artifact (01:20). It records the strengthened deep-marker fixture, elevated Electron execution, direct and forced-spine appearance relocation mismatches, and the failed paginated-rendition recreation wait.
- `spikes/renderer/evidence/focused-rerun-launch-error.txt` records the distinct workspace-sandbox Electron launch failure. It is environment diagnosis only, not renderer behavior evidence.
- `spikes/renderer/evidence/settled-appearance-error.json` is the final epub.js decision artifact. It records that the target CFI resolved to `#two-mid` before and after settled styling and that computed font, line, and paragraph spacing applied, but the one target-filtered display relocated into `[one]`.

The captured evidence is spike evidence, not a claim of comprehensive EPUB conformance, production security certification, or renderer adoption.

## 13. Workflow continuation — Foliate-js candidate

The equivalent narrow Foliate-js appearance probe was built after the epub.js disposition. Its initial run used a non-canonical manifest href and therefore produced invalid renderer evidence. The corrected targeted rerun derived Foliate's OPF-resolved href, but Electron aborted during GPU startup before the local harness page loaded. No Foliate behavior executed.

The independent disposition is **Foliate unresolved / NOT DEMONSTRATED**. Under the maximum-one-targeted-rerun rule, SPIKE-001 is now escalated for a human decision. No renderer is selected, Foliate is not rejected, and production reader implementation must not begin. See `SPIKE-001-FOLIATE-ESCALATION.md` for the retained evidence and decision options.

The owner subsequently authorized SPIKE-001B as a final, bounded Foliate validation. Both its initial evidence run and its architect-authorized instrumentation remediation were independently classified `INVALID_RUN`; the final harness assumed the public `foliate-view` relocation event contained an `index` field that the wrapper intentionally omits. The final attempt did open the fixture, resolve the canonical target, return the expected navigation destination, and emit relocation CFIs in `[two]`, but it never validly evaluated intersection with `#two-mid` or the appearance/visibility contract.

The terminal architect decision exhausts the lightweight-renderer timebox. No further epub.js or Foliate-js run is authorized. The next authorized action is a Readium-specific architecture and cost assessment, not renderer adoption or production implementation. See `SPIKE-001B-REVIEW.md`.
