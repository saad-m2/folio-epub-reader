# SPIKE-003 Builder Report — epub.js remaining adoption gates

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


Date: 2026-09-17  
Status: **RERUN COMPLETE — behavioral failures observed; adoption gate not met**

> **Final-review correction:** The independent evidence review classified the apparent continuous, mode-switch, and appearance results as invalid/incomplete assertions, not valid epub.js behavioral contradictions. This builder report is retained for execution provenance; `SPIKE-003-ESCALATION.md` is the authoritative final disposition.

## Claim under test

Within the existing hardened Electron 38.7.2 + epub.js 0.3.93 disposable topology, ordinary reflowable EPUBs can satisfy the remaining adoption contracts: continuous progression, paginated chapter boundaries and inputs, semantic mode switching, section-start appearance fallback, approximate close/reopen restoration, TOC/deepest-section progress, physical interaction, hostile-content containment, deliberate unsupported-book handling, accessibility/visual checks, and provisional performance/memory limits.

The owner has explicitly dropped exact page/offset preservation across appearance changes. SPIKE-003 still requires appearance/window reflow to land at the start of the deepest active navigable TOC entry; this is a separate, weaker contract.

## Success and failure criteria used

Success requires runtime evidence for every applicable gate in the authorized spike definition, with synthetic/static observations labeled as proxies. Failure requires a valid behavioral assertion showing that a required contract cannot be met without a deep fork, custom paginator, weakened Electron hardening, publication scripting, a privileged bridge, or unbounded renderer resource access. Host startup failure is inconclusive.

## Builder execution

The existing disposable harness and dependency lockfile were used. No production files or renderer ADR were changed. The first launch was blocked by the workspace host GPU runtime; the authorized one-time rerun then ran Electron directly on the Windows host with hardening unchanged. The authoritative output is retained as [spike003-targeted-rerun-results.json](../../../spikes/renderer/evidence/spike003-targeted-rerun-results.json), with [spike003-targeted-rerun.png](../../../spikes/renderer/evidence/spike003-targeted-rerun.png) as the captured screenshot. The initial environment failure and fixture hashes remain in [spike003-runtime-attempt-2026-09-17.md](../../../spikes/renderer/evidence/spike003-runtime-attempt-2026-09-17.md).

The authoritative rerun command was:

```powershell
$env:SPIKE_TARGETED_RERUN='1'; .\node_modules\.bin\electron.cmd .; $code=$LASTEXITCODE; Remove-Item Env:SPIKE_TARGETED_RERUN; exit $code
```

It ran with Node 24.19.0, Electron 38.7.2, epub.js 0.3.93, and JSZip 3.10.1. Static tests passed before launch.

## Authoritative rerun result

The run produced actual Electron/epub.js observations. The key results were:

- **Behavioral fail — continuous cross-spine progression:** scrolling the ordinary EPUB's continuous publication left the locator at `chapter1.xhtml`; the publication scroller height was only 859px and the locator did not advance to `chapter2.xhtml`.
- **Proxy only — paginated inputs/chapter boundary:** keyboard inputs were dispatched synthetically; far-edge and central clicks were synthetic `MouseEvent`s, not native pointer input. The observed chapter 2 location reported `displayed.page: 1` of 2.
- **Behavioral fail — deep-marker mode switch:** the marker CFI remained resolvable, but after switching to paginated mode the mode was reported as continuous and the marker was not visible. This is a direct failure of the tested semantic mode-switch contract, subject to independent review classification.
- **Proxy only — appearance section-start fallback:** styles were applied and `tocValue` remained `shared.xhtml#two`, but the marker was not visible and the test did not prove section-start placement.
- **Behavioral pass — close/reopen:** the saved composite locator and post-reopen locator both resolved to `shared.xhtml` with the same CFI in the tested run.
- **Proxy only — selection/copy/focus/geometry:** a programmatic selection, synthetic context menu, host focus, and geometry were observed. The geometry had a negative Y coordinate, so native usability was not established.
- **Containment observation incomplete:** scripts were absent, popup returned null, location stayed `about:srcdoc`, and Electron hardening remained enabled. CSP blocked the iframe before the session request hook, so `blockedRequests` was empty and the run did not establish the full required attempted-operation/session-level request contract. No fake attempt log was used.
- **Inconclusive:** unsupported profiles, Narrator/native visual checks, and memory/performance gates. The owner-approved thresholds were recorded in the JSON, but no supported memory sampler or stress corpus was available.

The raw per-step timings include 746ms for the continuous probe, 1,256ms for the paginated-input probe, 1,273ms for mode switching, 1,904ms for the appearance sequence, 883ms for reopen, 112ms for the selection proxy, and 1,605ms for containment. These are measurements, not accepted performance-gate passes.

## Gate inventory from the existing retained evidence

| Gate | Builder classification | Evidence / reason |
|---|---|---|
| Continuous scrolling across spine | Inconclusive | Existing smoke probe shows a scrolled-doc iframe, but not a deliberate cross-spine progression assertion. |
| Paginated chapter boundary | Supported by prior narrow run | `focused-rerun-results.json` records `tail.xhtml`, heading `Part Three`; not rerun in this attempt. |
| All mandated paginated inputs | Inconclusive | Only synthetic keyboard evidence exists; wheel, far-edge clicks, central-click controls, Space/PageDown and native pointer input were not run. |
| Mode-switch semantic continuity | Contradicted by prior focused run | Prior trace retained a valid deep marker but epub.js reported the visible location in `[one]` after relocation. This requires independent review; current attempt could not reproduce due host startup. |
| Appearance section-start fallback | Inconclusive / prior failure trace | `settled-appearance-error.json` shows CFI resolved to `#two-mid`, but the target was not visibly relocated and the wait timed out. |
| Close/reopen approximate section restoration | Inconclusive | Prior run did not complete the required valid non-initial restore assertion. |
| Deepest nested TOC and range progress | Inconclusive / prior assertion failure | Prior trace calculated progress but the active visible location was null/mismatched. |
| Physical selection/copy/focus/translation geometry | Proxy only | Programmatic range and synthetic context menu exist; native pointer and copy behavior were not demonstrated. |
| Hostile-content containment | Contradicted by prior focused run | Prior trace ended with `afterUrl: chrome-error://chromewebdata/` and no intercepted request log; this needs independent review, but is not a fresh current run. |
| Unsupported profiles | Inconclusive | No complete fixed-layout, required-script, DRM, media-overlay, malformed fixture matrix was run. |
| Accessibility/visual | Inconclusive | No Narrator or representative high-DPI manual pass was executed. |
| Performance/memory | Inconclusive | No measurements; thresholds require owner acceptance before gate grading. |
| SPIKE-002 archive/resource boundary | Not run by design | Explicitly separate mandatory gate; SPIKE-003 must not execute it. |

## Disposition

The one authorized targeted rerun is complete. It demonstrates that the tested epub.js topology does not currently satisfy all remaining adoption gates: continuous cross-spine progression and deep-marker mode switching failed behaviorally, while several required gates remain unverified or proxy-only. The spike therefore cannot support an epub.js renderer ADR. Independent evidence review should classify the failures and decide whether the owner contract is met or the experiment is escalated; no further rerun is authorized. SPIKE-002 remains separate and was not run.
