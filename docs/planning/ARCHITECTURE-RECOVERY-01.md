# Architecture Recovery 01: Reader Integration

> Historical recovery plan. The `book://`, SPIKE-002, and hostile-publication requirements below are superseded by the trusted-local binary-handoff decision in `ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`.

**Status:** SUPERSEDED BY OWNER RISK OVERRIDE AND IMPLEMENTATION PLAN  
**Date:** 2026-09-17  
**Scope:** EPUB reader engine and its publication-integration topology only. This addendum does not authorize production code or a new runtime spike.

## 1. Decision summary

The reader engine remains unselected. The smallest justified architecture change is to retain the approved Electron application shell, persistence, product semantics, and trust boundaries while replacing the expired lightweight-engine selection path with an owner-selected validation path:

1. a staged, Readium-specific feasibility assessment; or
2. one explicitly owner-authorized Foliate remediation of the invalid focused test.

Readium is a candidate, not a chosen replacement. Neither option authorizes reader implementation until it produces reviewed runtime evidence.

## 2. Evidence diagnosis

### What actually failed

**epub.js failed the focused product contract in the tested Electron topology.** After one settled transaction applying font size, margins, line spacing, paragraph spacing, and theme, the semantic CFI continued to resolve to the deep `#two-mid` target, but the required normal redisplay relocated visibly to section `[one]`. A forced-spine retry and paginated-rendition recreation did not recover the target. This is a behavioral failure of the required appearance-preserving relocation contract, so epub.js is **not selected**. It does not prove that epub.js cannot render ordinary EPUBs generally.

**Foliate-js did not fail the contract.** The final SPIKE-001B attempt qualified the Windows/Electron environment, opened the pinned fixture, derived `OEBPS/shared.xhtml#two-mid`, and emitted public relocation CFIs. The harness rejected each event before semantic-target evaluation because it required `event.detail.index`; Foliate's public wrapper intentionally omits that field. No valid assertion evaluated CFI stability, target intersection, appearance, or visibility. The reviewed result is therefore **INVALID_RUN**, not behavioral failure or pass.

**The lightweight timebox is exhausted.** This is a workflow constraint, not technical evidence against Foliate. The current workflow prohibits another automatic rerun. SPIKE-001 consequently ends with no renderer selected.

### What remains valid

The following decisions remain supported by the product and prior reviews and are not reopened:

- Electron on Windows 11 x64, React/Fluent UI application shell, SQLite persistence, and a narrow context-isolated preload.
- Local-first references to original EPUB files; evidence-tier identity; conditional relocation migration only after validated replacement content; and the composite, engine-neutral saved-position model.
- Deepest active navigable TOC entry for current section/progress, with title and overall-progress fallback.
- A fixed-dark application shell, global reader appearance, continuous and paginated reader modes, selection-driven optional translation, and no scripted/remote EPUB content.
- A supervised publication boundary: archive/XML parsing, decompression, hashing, and bounded resource reads must not run in the Electron main process that holds database, secret, and networking authority.
- Publication content receives no Node/Electron APIs, app preload, raw filesystem path, generic IPC, or unapproved network access. The archive-helper boundary is capability/crash containment, not a claim of an operating-system security sandbox.

## 3. Architecture decisions

1. **Keep the reader integration provisional.** Remove any implication that the pre-spike `EpubRenderer` sketch, `book://` scheme, resource bridge, frame ownership, or selection bridge is already a cross-engine contract. Engine-specific objects, URLs, locators, frames, and preloads remain confined to Reader infrastructure and do not enter persistence or general React/domain APIs.

2. **Do not adopt Readium Desktop, Thorium, `r2-navigator-js`, or `r2-streamer-js` yet.** Readium is a different system topology, not a replacement class behind the earlier adapter. Its documented Electron integration includes a Node-oriented navigator, local streamer, session setup, content preload/webviews, and reader-CSS injection. It must be assessed as one integrated design.

3. **Do not fork Thorium or enable non-MVP Readium services.** DRM/LCP, OPDS, remote-publication loading, built-in reader routes, and formats beyond ordinary non-DRM reflowable EPUB 2/3 remain out of scope. If a candidate cannot disable or make unreachable a broader service surface, it is not an acceptable MVP topology.

4. **A future selected topology must preserve the application-owned reader boundary.** The host reader UI may receive only normalized location, selection-text/range/rectangles, external-link request, unsupported-publication, and typed failure events. It must not receive raw source paths, generic capabilities, or an unbounded engine object.

5. **Correct packaging documentation.** PRODUCT.md permits an unsigned direct-download `Setup.exe` when trusted code signing cannot be obtained at no cost. Any planning text that makes paid signing mandatory conflicts with the product and must be corrected in a subsequent proposal maintenance change; this recovery does not authorize a paid signing dependency.

## 4. Candidate directions

| Direction | What changes | Benefit | Cost and risk | Decision status |
| --- | --- | --- | --- | --- |
| A. Staged Readium assessment | Evaluate a minimal `r2-navigator-js`/`r2-streamer-js` topology without adopting it. | Mature publication/locator/CSS concepts designed for Electron desktop readers. | Electron-coupled multi-package system, loopback streamer, content preload/webview model, and uncertain fit with the existing helper boundary. | Candidate; owner authorization required. |
| B. Foliate remediation | Correct the known public-event assertion and rerun the unchanged focused contract. | Lowest incremental work; directly resolves an invalid measurement rather than changing engines. | Overrides the agreed lightweight timebox. A focused pass still needs the remaining SPIKE-001 gates. | Candidate; owner authorization required. |
| C. Ship without a proven renderer or remove paginated mode | Override a product requirement/evidence gate. | Reduces immediate work only. | Product and reliability regression; no validated reader architecture. | Not recommended. |
| D. Build a custom EPUB renderer | Implement archive, navigation, pagination, CFI, CSS, and containment from primitives. | Maximum theoretical control. | Disproportionate implementation and security burden. | Remains rejected. |

The current Readium TypeScript web toolkit may be reviewed as a future alternative, but it is not evidence that the desktop packaged-EPUB topology is solved. It must not be substituted for a Readium Desktop feasibility result.

## 5. Conditional Readium topology and constraints

The following is a hypothesis to validate, not an implementation decision:

```text
App-controlled React reader host
  -> Readium navigator host region
     -> per-publication content webview/frame with audited Readium content preload
        -> authenticated loopback streamer restricted to one opaque reader session
           -> supervised publication/parser boundary -> approved original EPUB path

Electron main: source-path authorization, database, secrets, native UI, session lifecycle
```

### 5.1 Minimum safe content-preload boundary

If Readium needs a publication-content preload, it is allowed only when all of the following are demonstrated at runtime and locked by static regression tests:

- the preload is an audited, version-pinned Readium asset; it is not the app preload and receives no application secrets, filesystem path, database, shell, or Node/Electron capability;
- its API is a fixed allowlist required for navigator operation, with typed payload schemas, per-document/session correlation, maximum sizes, and no generic `send`, `invoke`, URL, path, command, or arbitrary-message operation;
- publication scripts remain disabled; no API is callable by book DOM/script, and no publication frame receives a privileged app bridge;
- it cannot create windows, navigate top-level content, loosen CSP/sandbox/session settings, make arbitrary network requests, access persistent storage across books, or address another book session;
- selection/location events are outbound normalized data only. They cannot request arbitrary resource reads or execute app actions.

**Reject Readium** if the necessary runtime proof requires an app preload in publication content, a generic/privileged bridge, executable publication scripts, disabled Electron hardening, or an unreviewable opaque preload surface.

### 5.2 Per-session loopback capability policy

The streamer cannot be treated as a harmless localhost server. A passing topology must demonstrate all of the following:

- bind only to loopback; never `0.0.0.0`, LAN interfaces, or a predictable fixed port;
- create a fresh opaque publication/session identifier and unguessable request capability for each open reader session; do not use a source path or stable library identifier in URLs;
- authorize only the navigator's expected content partition/frame and only the currently active session; reject requests without the capability, from another Electron partition/frame, after close, or after a new book replaces the session;
- disable DRM/decryption, OPDS, remote-publication URL, built-in reader, directory browsing, and all routes not essential to the current EPUB;
- permit only validated publication resources and ReadiumCSS assets, with verified MIME type, bounded response sizes, no redirects, no arbitrary URL proxying, and no response that reveals an original filesystem path;
- terminate the listener and revoke credentials/resources on close, error, process restart, and timeout; bound concurrent sessions to the MVP's one active book;
- run attacker-style runtime checks from an unrelated Electron partition and a local non-app HTTP client: guessed URL, stale credential, stolen session ID without capability, cross-book request, disabled/altered `Origin`/headers, unexpected method, traversal-like resource path, remote-publication route, and post-close retry must all fail without disclosing bytes or paths.

If Readium's required encrypted-header/session mechanism cannot be operated while keeping the private material and EPUB parser out of the main process, that is a topology failure, not permission to weaken the helper boundary.

## 6. Revised technical validation

Validation is intentionally staged. A broad compatibility/performance/accessibility program is still required before adoption, but it is not all front-loaded before the basic topology is credible.

### Stage A — Readium preflight and discriminating reader feasibility

**Purpose:** determine whether a minimal hardened Readium topology can meet the failure-triggering reader contract and the minimum security boundaries.

**Prerequisite audit:** Before runtime work, pin every direct and transitive Readium/Electron dependency; produce an SBOM and license inventory; confirm every shipped/build/distribution dependency is open source and no-fee under PRODUCT.md; identify package/preload build provenance; record Electron compatibility and all enabled server routes. Any paid/proprietary runtime, incompatible license, unpinnable content preload, or unreviewable route is a stop condition.

**Smallest runtime proof:** use the existing deep-marker fixture and hardened Electron configuration. Prove:

1. ordinary reflowable EPUB opens through an opaque authorized session with no raw source path in renderer/content;
2. paginated and continuous modes can be entered using native Readium behavior;
3. after one settled font/theme/margin/line/paragraph appearance transaction, one normal navigation/redisplay makes the same deep semantic target visible;
4. close/reopen restores that target using a normalized saved location;
5. the host receives bounded normalized location and selection geometry sufficient for the product's translation affordance;
6. the content-preload and loopback policies in sections 5.1 and 5.2 pass their focused runtime checks.

**Stage-A stop conditions:** target relocation failure; required privileged/generic content bridge; unbounded/unauthorized loopback access; main-process parsing; disabled hardening; a non-OSS/no-fee dependency; or a deep fork. Any stop condition rejects the tested Readium topology. It does not authorize a workaround that changes product or security requirements.

**Stage-A output:** a reviewed evidence packet and one of `PASS TO STAGE B`, `REJECT READIUM TOPOLOGY`, or `INCONCLUSIVE` with a precisely identified harness/environment defect. A pass is not renderer adoption.

### Stage B — archive/resource boundary and expanded acceptance, only after Stage A passes

**Purpose:** integrate the existing SPIKE-001 archive/resource proof with the selected candidate's actual streamer/parser boundary, then prove the remaining product gates.

The existing helper experiment is adapted rather than duplicated. It must establish where Readium parses ZIP/XML and serves entries, and prove incremental entry-count, expanded-byte, compression-ratio, path, XML entity/DTD, image-decoding, cancellation, timeout, crash/restart, and backpressure controls before unsafe allocation. The Electron main process must remain responsive and uninvolved in parsing/decompression.

Then expand against the committed representative/malicious corpus to prove:

- nested/non-spine-aligned TOC ranges and chapter progress;
- continuous/paginated switching, chapter-start behavior, locator fallback, changed-book migration, and close/reopen persistence;
- physical Windows keyboard, wheel, far-edge click, selection/right-click Copy, focus, and Narrator behavior;
- blocked publication scripts, forms, remote fetches, navigation, popups, service workers, persistent cross-book storage, and cross-book access;
- unsupported publication handling, performance/memory limits, cleanup, packaging, and upgrade regression coverage.

Only a reviewed Stage-B pass authorizes a renderer/topology ADR and implementation planning.

## 7. Preliminary effort estimate and stop economics

The earlier 7–10 engineering-day figure is preliminary, not validated delivery data. It is a planning range for disposable validation, not production integration:

| Gate | Estimate | Stop condition |
| --- | ---: | --- |
| Dependency, OSS/no-fee, provenance, route/preload, and Electron-compatibility audit | 0.5–1.5 days | License/provenance/route incompatibility. |
| Minimal streamer/session/content-preload topology with diagnostics | 1–2 days | Requires privileged bridge, main parser, or security relaxation. |
| Deep-marker appearance/location, modes, restore, selection-geometry proof | 2–3 days | A mandatory reader assertion fails. |
| Loopback attacker tests and evidence review | 1–1.5 days | Capability/session isolation fails. |
| If Stage A passes: adapted archive boundary, broader corpus/interactions/accessibility/performance gates | 2.5–4 days | Quotas/cancellation/crash isolation or a required acceptance gate fails. |

This totals approximately **7–12 days if it reaches Stage B**. It should stop at the first failing gate; it is not a commitment to spend the maximum. The alternative Foliate remediation remains approximately **1–2 days** for the corrected focused rerun and independent review, followed by separately scoped expansion only if it passes.

## 8. Tradeoffs and risks

- Readium may reduce custom renderer behavior but increases the owned surface: multi-package upgrades, a streamer, Electron session configuration, a content preload, and loopback capability security.
- Foliate has a known measurement defect rather than known behavior failure, but reopening it changes the agreed validation timebox and may only defer, not eliminate, broader evidence work.
- A loopback server can violate local-first privacy/security if its request capabilities, route set, and shutdown are not rigorously enforced; “localhost” is not sufficient isolation.
- A Readium content preload can be necessary for navigator behavior yet become the largest privilege-escalation risk. It is acceptable only under the minimum boundary above.
- The helper decision remains valuable, but Readium cannot be allowed to bypass it merely because its conventional streamer architecture parses EPUB packages itself.

## 9. Classification

### Architecture decisions

- Preserve the approved shell, domain model, original-file policy, persistence, content-security posture, and helper boundary.
- Keep the reader topology unselected and engine-specific internals isolated.
- Treat Readium as a separate topology and prohibit unreviewed Thorium adoption, DRM/OPDS/remote-publication scope, and security regressions.
- Require an OSS/no-fee dependency gate and correct the signing wording to allow unsigned installation when free trusted signing is unavailable.

### Technical validation

- Whether Readium can satisfy the deep appearance-relocation, mode, restore, and selection contracts.
- Whether its content preload can meet the minimum safe boundary.
- Whether its loopback streamer can meet the per-session capability/isolation policy.
- Whether Readium parsing/resource delivery can meet the existing helper/quota/crash-boundary requirements.
- Whether the expanded accessibility, containment, compatibility, performance, and packaging gates pass.
- Whether corrected Foliate behavior passes the focused contract, if its owner-authorized path is selected.

### Owner decisions

1. Authorize **Stage A Readium feasibility** under the stop conditions and preliminary 7–12 day maximum range; or
2. authorize the **bounded Foliate remediation** despite the exhausted lightweight-engine timebox; or
3. explicitly change product/risk requirements (not recommended).

The owner must not be assumed to accept Readium's larger owned surface merely because it is a plausible candidate. A Stage-A pass establishes only eligibility to spend on Stage B; it is not an adoption decision.

## 10. Disposition

**HISTORICAL DISPOSITION; SUPERSEDED FOR IMPLEMENTATION PLANNING.** At this recovery point no production renderer was selected and no reader implementation was authorized. The later owner override in section 13 selects epub.js for planning without converting prior invalid evidence into a pass.

## 11. Owner decision update — 2026-09-17

The owner chose to continue evaluating epub.js and relaxed only the exact-passage requirement for font, theme, margin, line-spacing, paragraph-spacing, and window-size reflow. This replaces neither the requirement for both reading modes nor logical-passage continuity on mode switching and reopen.

**Architecture decision:** after appearance/window reflow, epub.js must return to the start of the currently active deepest navigable TOC entry. When no usable navigation entry exists, it must remain in the same spine resource. Generated-page identity and prior offset are explicitly non-contractual. This is the smallest user-visible, deterministic contract that prevents a reflow from silently landing in a different section/book resource while not depending on unstable pagination. Mode switching remains a semantic-location contract.

**Technical validation:** epub.js has not demonstrated this new fallback, the remaining interaction, TOC/progress, containment, unsupported-publication, accessibility, performance, or production resource-boundary gates. These are defined in SPIKE-003.

**Owner decision recorded:** authorize one new bounded epub.js validation spike under the repository's maximum-one-targeted-rerun rule. This authorization does not select epub.js, authorize production implementation, or reopen the prior Foliate/Readium decision paths.

## 12. SPIKE-003 escalation update — 2026-09-17

SPIKE-003 has consumed its initial run and one authorized targeted rerun. The host rerun supports retained Electron hardening and a narrow fresh-generated-page observation at a paginated spine-chapter boundary. It does not validly assess continuous manager-flow progression, semantic `#two-mid` mode switching, visible active-section-start fallback after appearance, or composite fallback restoration; those checks used incorrect locators/containers or omitted the required assertion. Interaction, containment, unsupported-publication, Narrator/accessibility, performance/memory/cleanup, and archive/resource gates remain unresolved.

**Architecture decision:** do not infer an epub.js pass or failure from invalid/incomplete tests. Preserve the renderer as unselected and SPIKE-002 as mandatory.

**Owner decision required:** authorize a newly scoped epub.js evidence program, choose another reader-strategy assessment, or explicitly change scope/accept unvalidated risk. The exhausted SPIKE-003 workflow authorizes no additional rerun. See `docs/spikes/SPIKE-003-ESCALATION.md`.

## 13. Owner risk override — 2026-09-17

The owner chose the third option: treat Electron 38.7.2 + epub.js 0.3.93 as satisfying the SPIKE-003 architecture-selection requirements despite the retained evidence gaps. This is an owner-approved risk assumption, not a reinterpretation of the evidence. It selects the renderer for implementation planning while preserving SPIKE-003's invalid/unresolved classifications.

**Architecture decision:** Electron + epub.js is selected for the MVP behind the application-owned adapter and trust boundaries. The authoritative selected topology and release-gate plan are `docs/planning/ARCHITECTURE-IMPLEMENTATION-PLAN-01.md`.

**Not waived:** SPIKE-002 archive/resource-boundary validation, hostile-input security, and production release verification. The override covers current SPIKE-003 selection only; it does not permit renderer archive parsing, weakened hardening, or production release with the helper boundary unproven.

## Evidence consulted

- `docs/PRODUCT.md`
- `docs/planning/TECHNICAL-PROPOSAL.md`
- `docs/planning/ARCHITECTURE-REVIEW-01.md`
- `docs/planning/ARCHITECTURE-REVIEW-01-RESOLUTION.md`
- `docs/spikes/SPIKE-001-RENDERER.md`
- `docs/spikes/SPIKE-001-REVIEW.md`
- `docs/spikes/SPIKE-001-FOLIATE-ESCALATION.md`
- `docs/spikes/SPIKE-001B-FOLIATE-VALIDATION.md`
- `docs/spikes/SPIKE-001B-REVIEW.md`
- Readium Navigator, Streamer, and architecture documentation (current primary-source review).
