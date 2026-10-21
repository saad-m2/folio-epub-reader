# SPIKE-001B — Independent evidence review

**Date:** 2026-09-17  
**Verdict:** **INVALID_RUN**  
**Workflow disposition:** **TERMINALLY ESCALATED — NO RENDERER SELECTED**

## Evidence reviewed

- `docs/spikes/SPIKE-001B-FOLIATE-VALIDATION.md`
- the complete `spikes/renderer-foliate/src/` harness
- the pinned Foliate-js source at commit `78914aef4466eb960965702401634c2cb348e9b1`
- `spikes/renderer-foliate/evidence/spi001b-final-static.*`
- `spikes/renderer-foliate/evidence/spi001b-final-authoritative.*`
- `spikes/renderer-foliate/evidence/attempt-2026-09-17T11-06-51-561Z-provenance.json`
- `spikes/renderer-foliate/evidence/attempt-2026-09-17T11-06-51-561Z-startup.json`
- `spikes/renderer-foliate/evidence/attempt-2026-09-17T11-06-51-561Z-checkpoints.ndjson`
- `spikes/renderer-foliate/evidence/attempt-2026-09-17T11-06-51-561Z-checkpoint-latest.json`
- `spikes/renderer-foliate/evidence/attempt-2026-09-17T11-06-51-561Z-behavioral-error.json`

## Findings

| Claim | Classification | Review |
|---|---|---|
| Pinned Electron, Foliate commit, fixture, lockfile, and harness sources were used | **SUPPORTED** | Recorded hashes and submodule commit match the retained inputs. |
| Windows/Electron environment qualification succeeded | **SUPPORTED** | The host page loaded with normal GPU configuration, no diagnostic switches, renderer readiness, and a successful trivial expression. |
| Hardened configuration was retained | **SUPPORTED** | Static checks pass 2/2 and runtime configuration retains sandboxing, context isolation, disabled Node integration, web security, CSP restrictions, denied permissions/network/popups/navigation, and narrow IPC. |
| Foliate opened the fixture and resolved the canonical target | **SUPPORTED** | Checkpoints record fixture read/open, `OEBPS/shared.xhtml#two-mid`, destination index `0`, and the expected initial `goTo()` return. |
| No relocation occurred | **CONTRADICTED** | Five public relocation events were recorded; four CFIs are in section `[two]`. |
| Public relocation events should contain `event.detail.index` | **CONTRADICTED** | Foliate's `View` receives the inner renderer index but re-emits `lastLocation` without it. The harness's index filter was incompatible with the public event shape. |
| Foliate failed to reach `#two-mid` | **NOT DEMONSTRATED** | The invalid index guard rejected every event before marker-intersection evaluation. |
| The settled appearance/redisplay contract passed or failed | **NOT DEMONSTRATED** | No target CFI, computed appearance, final marker range, screenshot, or final visibility assertion was reached. |
| `BEHAVIORAL_FAIL` is supported | **CONTRADICTED** | The timeout results from an invalid event-field assumption and cannot establish renderer failure. |

The attempt is therefore `INVALID_RUN`. It is not `NON_EXECUTION`, because Electron and Foliate executed, and it is not `BEHAVIORAL_FAIL`, because the required semantic assertion was never validly applied.

## Terminal workflow decision

- epub.js is **failed / not selected** on behavioral evidence.
- Foliate-js is **not demonstrated** and is neither selected nor rejected on behavioral grounds.
- The architect-authorized final lightweight attempt has been consumed.
- `Workflow_1.md` permits no further automatic rerun.
- SPIKE-001 ends **terminally escalated with no renderer selected**.
- A production renderer ADR and production reader implementation are not authorized.

The only authorized next action is a **Readium-specific architecture and cost assessment** that treats Readium as a distinct topology and defines any proposed runtime spike separately. It does not authorize a Readium spike or implementation by itself.
