# SPIKE-003 Escalation — epub.js Adoption Evidence

**Date:** 2026-09-17  
**Status:** TERMINALLY ESCALATED  
**Decision:** No renderer selected; no production reader implementation authorized.

> **Owner override (2026-09-17):** This evidence disposition remains historically accurate. The owner subsequently selected Electron 38.7.2 + epub.js 0.3.93 for architecture planning despite these gaps. That is a risk override, not an empirical SPIKE-003 pass; see `docs/planning/ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`.

## Evidence conclusion

SPIKE-003 completed its initial attempt and its single authorized targeted rerun. The host rerun successfully executed Electron 38.7.2 with sandboxing, context isolation, web security, and disabled Node integration retained. It also supports a narrow paginated observation: after crossing into the test's second spine chapter, epub.js reported generated page 1.

Those findings are insufficient to adopt epub.js. The independent reviewer did **not** find a valid contradiction of the owner-relaxed reflow contract, because the required assertions were not actually run:

| Gate | Final classification | Why |
|---|---|---|
| Paginated fresh chapter page | Supported, narrow | The tested second spine chapter reported generated page 1. Physical input evidence is still proxy-only. |
| Continuous cross-spine progression | Invalid / unresolved | The test scrolled an inner publication iframe, not epub.js's continuous manager-flow container. |
| Mode switch retains logical passage | Invalid / unresolved | The test restored leading `#two`, not saved semantic `#two-mid`. |
| Appearance/window fallback reaches active-section start | Invalid / unresolved | Styles applied, but no assertion proved visible `#two` section-start placement. |
| Composite reopen fallback | Unresolved | The immediately resolvable CFI path succeeded; fallback was never invoked. |
| Interaction and translation anchoring | Unresolved | Keyboard/click/context-menu/selection evidence was synthetic or programmatic; geometry was not native-usable proof. |
| Hostile-content containment | Unresolved | Hardening and absent inline script were observed, but attempted-operation/request evidence did not prove the full remote, navigation, storage, service-worker, iframe, popup, and cross-book contract. |
| Unsupported publications | Unresolved | No complete fixed-layout, required-script, DRM, media-overlay, and malformed fixture outcomes. |
| Accessibility, visual, performance, memory, cleanup | Unresolved | No Narrator/high-DPI manual run, stress corpus, supported memory sampler, or cleanup-cycle evidence. |
| Archive/resource boundary | Not run by design | SPIKE-002 remains a separate mandatory gate. |

The original SPIKE-001 evidence still records that exact deep-passage restoration after appearance changes failed in the prior contract. The owner replaced that contract with section-start fallback. Therefore the correct combined disposition is **not selected / not rejected for the relaxed contract**.

## Workflow constraint

The maximum-one-targeted-rerun rule in `.codex/skills/spike-validation.md` has been exhausted for SPIKE-003. The invalid assertions cannot be repaired as another rerun. No technology switch follows automatically from this escalation.

## Owner choices

1. **Authorize a new, separately scoped epub.js validation program.** It must have a new timebox and explicit budget, use the correct manager-flow/semantic-marker assertions, and cover the remaining gates listed above. This is the only path to obtain evidence for epub.js; it is not a continuation of SPIKE-003.
2. **Choose a different reader strategy for assessment.** Readium remains a distinct topology requiring its own owner-authorized feasibility assessment; it is not selected or implied by this escalation. Foliate remains unresolved under its earlier exhausted workflow.
3. **Change product/scope or explicitly accept unvalidated risk.** For example, remove affected reader behaviors or authorize implementation without a selected renderer. This is an owner risk decision; architecture does not recommend treating incomplete evidence as a pass.

Until one choice is made, retain the current product contract and no renderer selection.

## Retained evidence

- `spikes/renderer/evidence/spike003-targeted-rerun-results.json`
- `spikes/renderer/evidence/spike003-targeted-rerun.png`
- `spikes/renderer/evidence/spike003-runtime-attempt-2026-09-17.md`
- `docs/spikes/SPIKE-003-BUILDER-REPORT.md`
- `docs/spikes/SPIKE-003-EPUBJS-ADOPTION-VALIDATION.md`
