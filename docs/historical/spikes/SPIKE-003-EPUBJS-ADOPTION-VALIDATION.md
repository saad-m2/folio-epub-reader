# SPIKE-003 — epub.js Remaining Adoption Gates

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


**Status:** TERMINALLY ESCALATED AS EVIDENCE; LATER OWNER-OVERRIDE SELECTION RECORDED  
**Date:** 2026-09-17  
**Scope:** Disposable Electron/epub.js evidence only. No production reader code, renderer ADR, or architecture replacement is authorized.

## 1. Purpose and owner decision

SPIKE-001 established that, in the tested paginated Electron topology, `rendition.display()` could move a valid deep semantic CFI from nested section `[two]` to `[one]` after an appearance transaction. The owner accepts that an appearance or window reflow need not preserve the same page or offset and asks to continue assessing epub.js.

This is deliberately narrow. It does not relax the product's reading-mode or reopen requirements, the no-script/no-network Electron boundary, or archive/resource safety requirements.

## 2. Continuity contracts

| Operation | Required observable result | Explicitly not promised |
|---|---|---|
| Switch continuous ↔ paginated | The saved semantic marker/CFI resolves to and is visible at the same logical passage. | Stable generated page number. |
| Close and reopen | Return to the same approximate percentage within the active navigable section, using the normalized composite locator/fallback chain. | Stable generated page number or pixel offset. |
| Font, theme, margins, line spacing, paragraph spacing, or window-size reflow | Navigate to the **start of the deepest active navigable TOC entry**. If no usable entry exists, remain in the same spine resource at its start. | The old page, offset, percentage, or exact text passage. |

The reflow contract is the minimum acceptable continuity. A spine resource can contain multiple navigable sections, so “a nonempty CFI” or merely “same book” is insufficient. The known `shared.xhtml` `[one]`/`[two]` fixture must visibly land on the `#two` section start when `[two]` was active before reflow.

## 3. Architecture decisions

- epub.js remains provisional and is accessed only through a disposable harness/adapter; no fork, custom pagination engine, publication scripts, generic IPC, Node/Electron exposure, or disabled Electron hardening is permitted.
- Appearance/window reflow uses section-start fallback; mode changes use semantic logical-location relocation. The adapter must serialize, cancel, and time-bound relocation-affecting operations.
- The persistent location stays engine-neutral: normalized resource identity, semantic locator/CFI where usable, active TOC entry identity, and bounded relative progression. Renderer-specific values do not enter general application APIs.
- SPIKE-002/archive-resource validation remains a separate mandatory adoption gate. Loading entire untrusted EPUB bytes in the renderer is permitted only in this disposable spike and proves no production resource-delivery boundary.

## 4. Evidence inventory and remaining gates

SPIKE-001 supports only basic ordinary EPUB 2/3 opening/rendering, direct TOC navigation, one ArrowRight page turn, selection range/geometry bridge, disabled inline publication script, absence of Node/preload in the tested book frame, and hardened Electron settings. The following requirements remain unverified for epub.js adoption:

1. Actual conventional continuous scrolling across content/spine progression.
2. Paginated chapter-boundary behavior: a new spine chapter begins on a fresh generated page.
3. All mandated paginated inputs: Left/Right, Page Up/Down, Space, wheel, far-left/right click; central click must reveal controls instead of turn.
4. Exact semantic mode-switch continuity, plus the new appearance/window section-start fallback contract.
5. Close/reopen restoration at the same approximate active-section percentage using the composite locator, including safe fallback.
6. Deepest-active nested TOC label and range progress where TOC entries share a resource or span resources; title/overall-progress fallback for unusable navigation.
7. Physical pointer selection, focus, normal right-click Copy, retained highlight, and usable anchored/expanded translation geometry.
8. Complete hostile-content containment: remote image/CSS/fetch attempts, forms, HTTPS/app/custom-protocol navigation, popups, iframes, service workers, persistent storage, and cross-book/session access.
9. Friendly, deliberate rejection of fixed-layout, required-script, DRM, media-overlay, and malformed/otherwise unsupported fixtures.
10. Narrator/basic keyboard accessibility; representative visual/high-DPI checks.
11. Measured first page, scroll/page/reflow latency, memory, and repeated-rendition cleanup on ordinary and stress fixtures.
12. The separate SPIKE-002 archive/XML/resource-helper quotas, cancellation, crash recovery, and safe resource delivery (not executed by SPIKE-003).

## 5. Bounded experiment

Use the existing Electron harness and retained fixtures, extending only what is necessary to make the assertions valid. Add deterministic hand-authored fixtures for: distinct spine chapters, malformed/unsupported profiles, hostile network/active-content paths, absent navigation, and ordinary/stress books. Retain raw JSON/NDJSON traces, screenshots for visual/manual assertions, timings, memory samples, static policy tests, exact dependency versions/lockfile, fixture hashes, and reproducible commands.

Test each contract from a deliberate non-initial target. A result is not a pass because a CFI, iframe, handler, or event exists; it must verify resolved marker/section, actual visible content, location change, blocked request attempt, or measured value as applicable.

### Success criteria

SPIKE-003 passes only if all of the following are independently supported by retained runtime evidence:

- every continuity contract in section 2 and every applicable gate in section 4 passes on the specified fixtures;
- hostile fixtures show attempted operations and prove they fail without remote traffic, navigation, capability exposure, persistent cross-book state, or hardening regressions;
- unsupported fixtures produce the specified friendly unsupported outcome rather than partial/unsafe rendering;
- performance/memory thresholds are proposed before measurement, recorded for both corpus classes, and accepted by the evidence review; and
- the harness uses native/supported epub.js flows with the required Electron configuration unchanged.

SPIKE-003 cannot alone select epub.js: it becomes eligible for a renderer ADR only if SPIKE-002 also passes and independent evidence review accepts both packets.

### Failure criteria

Fail epub.js for the tested topology if a valid assertion shows any required contract cannot be met without a deep fork, custom pagination system, weakened Electron hardening, enabled publication scripting, generic/privileged bridge, or an unbounded renderer resource path. A weak, missing, synthetic-only, or environment-broken observation is **inconclusive**, not a renderer failure.

If any gate fails, stop and record the exact failed contract. Do not automatically select Readium/Foliate or implement a workaround that changes the owner contract.

## 6. Validation workflow and rerun limit

Apply `.codex/skills/spike-validation.md` exactly:

1. A `spike_builder` produces the disposable evidence run.
2. An independent `evidence_reviewer` classifies every gate as supported, contradicted, or inconclusive.
3. Only if the review identifies one bounded harness/measurement defect may one targeted rerun occur.
4. The same reviewer (or another independent reviewer) reviews that rerun.
5. If it remains unresolved after that one rerun, escalate to the owner/architect. No second rerun, new technology selection, or production work is authorized.

The one-rerun limit applies to SPIKE-003 as a new owner-authorized spike. It does not reopen the exhausted SPIKE-001/Foliate workflow.

## 7. Unresolved owner decisions

- Before the performance gate runs, the owner must accept concrete latency/memory thresholds suitable for the MVP hardware baseline; the repository currently contains no approved numeric targets.
- If a renderer requires a product contract change beyond the reflow fallback in section 2, the owner must decide it explicitly. Architecture must not weaken another behavior to obtain a pass.

## 8. Final evidence-review disposition — 2026-09-17

The initial attempt and its one authorized targeted rerun are complete. The rerun executed successfully on the Windows host with the required Electron hardening retained. It supports only the narrow finding that crossing into the tested paginated second spine chapter yielded generated page 1. It does not establish the required physical-input behavior, which remained synthetic/proxy evidence.

The reviewer found no valid new behavioral contradiction of the relaxed epub.js continuity contract, but neither did it establish that contract:

- The continuous test scrolled the publication iframe instead of epub.js's manager-flow container, so it cannot evaluate continuous cross-spine progression.
- The mode-switch test redisplayed the leading `#two` CFI rather than the saved deep `#two-mid` semantic CFI; it cannot evaluate same-passage continuity.
- The appearance test applied styles but did not assert visible `#two` section-start placement.
- The close/reopen path restored an immediately resolvable locator and never exercised the composite-locator fallback chain.
- Interaction, containment, unsupported-publication, Narrator/accessibility, visual/high-DPI, performance/memory/cleanup, and SPIKE-002 archive/resource gates remain unresolved.

The original SPIKE-001 exact-passage-after-appearance failure remains historical evidence for that superseded contract. It is not a failure of the relaxed SPIKE-003 contract. Conversely, the new evidence does not select epub.js.

Under `.codex/skills/spike-validation.md`, the maximum one targeted rerun has been consumed. **No further SPIKE-003 rerun is authorized.** See `SPIKE-003-ESCALATION.md` for evidence references and owner choices.

## 9. Disposition

**TERMINALLY ESCALATED AS EVIDENCE.** At this spike's close, production implementation and a renderer-selection ADR were blocked. The later owner override selected epub.js for architecture planning despite the gaps; it does not alter this disposition or authorize another SPIKE-003 rerun. SPIKE-002 remains mandatory independently. See `docs/historical/planning/ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`.
