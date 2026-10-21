# SPIKE-001 — Foliate-js evidence review and escalation

**Date:** 2026-09-17  
**Workflow status:** **ESCALATED — human decision required**  
**Renderer selection:** **OPEN**

## Scope reviewed

This addendum reviews the narrow Foliate-js candidate probe that followed the final epub.js failure. The probe tests only whether a deep semantic target in paginated mode remains resolvable and visibly restorable after one settled appearance transaction. It does not test the remaining SPIKE-001 product, interaction, containment, accessibility, performance, persistence, or unsupported-publication gates.

## Initial Foliate run

The initial retained artifact, `spikes/renderer-foliate/evidence/appearance-error.json`, reported that Foliate-js could not resolve `shared.xhtml#two-mid`.

Independent source review found this was a harness defect, not renderer evidence. The fixture package is `OEBPS/package.opf`, and Foliate stores manifest hrefs resolved relative to that OPF. The harness supplied the non-canonical `shared.xhtml#two-mid` while Foliate's direct manifest lookup expected `OEBPS/shared.xhtml#two-mid`. Because the run stopped before navigation, CFI derivation, styling, relocation, or visibility checks, it demonstrated neither a Foliate pass nor a Foliate failure.

## Targeted rerun

The harness was corrected to derive the canonical section href from the loaded book and to use it consistently for `book.resolveHref()` and `view.goTo()`. The successful result shape now records that canonical href.

Static checks passed 2/2 with exit status `0`. They confirm the inspected Electron hardening and CSP literals only; they are not runtime containment evidence.

The focused command was attempted twice for evidence capture. Both attempts exited with Windows status `-2147483645`. Electron reported repeated GPU child exits with `-1073741515`, then `ERR_FAILED` while loading the local `src/index.html`, and finally aborted because the GPU process was unusable. The page never loaded and `runAppearanceProbe()` never executed.

Retained evidence:

- `spikes/renderer-foliate/evidence/static-tests.stdout.txt`
- `spikes/renderer-foliate/evidence/static-tests.stderr.txt`
- `spikes/renderer-foliate/evidence/static-tests.exit-status.txt`
- `spikes/renderer-foliate/evidence/appearance.stdout.txt`
- `spikes/renderer-foliate/evidence/appearance.stderr.txt`
- `spikes/renderer-foliate/evidence/appearance.exit-status.txt`
- `spikes/renderer-foliate/evidence/appearance-gpu-failure.stdout.txt`
- `spikes/renderer-foliate/evidence/appearance-gpu-failure.stderr.txt`
- `spikes/renderer-foliate/evidence/appearance-gpu-failure.exit-status.txt`
- `spikes/renderer-foliate/evidence/appearance-error.json`

## Independent disposition

| Claim | Classification | Reason |
|---|---|---|
| The href-normalization defect was corrected | **SUPPORTED (static)** | The harness derives and reuses the OPF-resolved section href. |
| The corrected appearance probe executed | **CONTRADICTED** | Electron aborted before `index.html` loaded. |
| Foliate passes the focused appearance contract | **NOT DEMONSTRATED** | No Foliate behavior ran. |
| Foliate fails the focused appearance contract | **NOT DEMONSTRATED** | The observed failure belongs to the Electron/GPU startup environment, not renderer behavior. |

The Foliate candidate therefore remains **unresolved**. It is neither selected nor rejected.

## Workflow disposition

`docs/Workflow_1.md` permits a maximum of one targeted rerun and requires escalation if the result remains unresolved. That rerun is exhausted. Do not automatically run the probe again, select Foliate, reject Foliate, switch to Readium, write a renderer ADR, or begin production reader implementation.

The technical proposal's “both lightweight engines fail” branch has not literally occurred: epub.js failed the tested contract, while Foliate remains not demonstrated.

## Human decision required

1. **Authorize a fresh, explicitly bounded Foliate validation activity (recommended).** Use the corrected harness in a Windows execution context where Electron can load the local page. Keep the same Foliate commit, fixture, hardening, and pass/fail predicates. Independently review the retained runtime result.
2. **Declare the lightweight-renderer timebox exhausted.** Commission a Readium-specific architecture and cost estimate under the proposal's stop-and-reassess rule.
3. **Accept an explicit architecture-risk deviation.** Proceed without renderer proof only by overriding the proposal's mandatory evidence gate. This is not recommended.

Until the owner chooses option 1 or 2, SPIKE-001 remains escalated and renderer selection remains open.
