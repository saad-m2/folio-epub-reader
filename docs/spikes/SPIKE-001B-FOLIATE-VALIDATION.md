# SPIKE-001B — Foliate-js Focused Renderer Validation

**Status:** **COMPLETE — INVALID_RUN; lightweight-renderer timebox exhausted**  
**Type:** Disposable, decision-relevant renderer spike  
**Parent:** SPIKE-001 renderer, location, and containment proof  
**Candidate:** Foliate-js  
**Production implementation authorized:** No

## 1. Decision context

- The MVP remains an Electron application targeting Windows 11 x64.
- Publication scripts remain disabled. Publication content must not receive Node, Electron, preload, or generic IPC access.
- `webSecurity`, renderer sandboxing, and context isolation remain enabled.
- epub.js is failed/not selected for the tested topology: after a settled appearance update, its semantic CFI still resolved to `#two-mid`, but displaying it relocated into `[one]`.
- Foliate-js is the next lightweight candidate. Its first run was invalid because the harness used a non-canonical href. The corrected attempts aborted during Electron GPU startup before the page loaded, demonstrating environment failure rather than renderer behavior.
- The owner has authorized one new, explicitly bounded Foliate validation. Product requirements and gates are unchanged.

## 2. Spike question

On a functioning Windows 11 x64 Electron host, can pinned Foliate-js, with the existing hardened topology unchanged, preserve and visibly restore a deep semantic target in a paginated reflowable EPUB after one settled appearance transaction?

Specifically:

1. Can Foliate resolve the canonical target corresponding to `shared.xhtml#two-mid`?
2. Can it derive a stable Foliate CFI for that target?
3. Does that unchanged CFI still resolve to `#two-mid` after font size, line spacing, paragraph spacing, theme colors, and paginator margin are applied?
4. Does one normal `view.goTo(targetCfi)` relocate to a range intersecting `#two-mid` and leave the target visible?

This focused contract does not attempt to complete every SPIKE-001 gate.

## 3. Scope and constraints

Reuse `spikes/renderer-foliate/`. Changes are permitted only to make evidence deterministic and complete, add environment/runtime diagnostics, fix an implementation defect that blocks the prescribed operations, or strengthen assertions without changing their meaning.

Do not change the target behavior, fixture, Foliate or Electron versions, security topology, or acceptance criteria. Do not add fallback navigation attempts or production code. One documented harness correction is permitted only if a defect prevents behavioral execution and the correction does not alter the acceptance criteria.

## 4. Pinned inputs

- Electron `38.7.2`.
- Foliate-js commit `78914aef4466eb960965702401634c2cb348e9b1`.
- Existing `spikes/renderer-foliate/pnpm-lock.yaml`.
- Existing corrected canonical-href harness.
- Existing project Node and pnpm; record exact versions. Report a version difference before interpreting failure.
- Fixture: `spikes/renderer/fixtures/toc-and-images.epub`. Record SHA-256 before execution and do not regenerate or modify it afterward.

The fixture contains `OEBPS/shared.xhtml`, sections `#one` and `#two`, and `#two-mid` at paragraph 56 inside `#two`. Derive the canonical target from the opened book's matching section ID and record it; do not hard-code it as an unverified assumption. Do not use `tail.xhtml` as a navigation workaround.

## 5. Environment qualification

The authoritative run must use Windows 11 x64, a local interactive session, the same checkout and lockfile, and Electron's normal GPU configuration. Before exercising Foliate, use the same Electron binary, working directory, session configuration, and BrowserWindow security settings to prove:

1. `app.whenReady()` completes.
2. A BrowserWindow is created.
3. `src/index.html` finishes loading.
4. Preload signals renderer readiness through a narrow named intent.
5. The renderer executes a trivial host-page expression.
6. Electron remains alive long enough to begin the probe.
7. No non-production Chromium switch materially changes layout, frame isolation, or security.

Record OS edition/build/architecture/display version; Electron, Chromium, Node, and V8 versions; host Node and pnpm; Foliate commit; lockfile, fixture, and harness hashes; `app.getGPUFeatureStatus()` after readiness; command-line switches; window visibility; and startup timestamps/durations.

The authoritative run must not use `--disable-gpu`, `--in-process-gpu`, disabled sandboxing, or similar diagnostic switches. If the page does not load, classify the result as `NON_EXECUTION`, never as a Foliate failure.

## 6. Security invariants

Preserve and record:

- `app.enableSandbox()`;
- `sandbox: true`;
- `contextIsolation: true`;
- `nodeIntegration: false`;
- `webSecurity: true`;
- `allowRunningInsecureContent: false`;
- no publication-script exception or publication-frame preload;
- no generic IPC, filesystem, shell, arbitrary path, `send`, or `invoke` API;
- IPC accepted only from the expected main host frame;
- denied permissions, canceled HTTP(S), denied windows/popups, and blocked unexpected main-frame navigation;
- CSP denial of publication scripts and network access;
- fixture bytes supplied through the existing narrow operation.

`backgroundThrottling: false` may remain. Existing static security tests must pass before the behavioral run. Any run weakening an invariant is invalid.

## 7. Ordered scenarios

Fail fast at the first unmet required assertion while retaining all evidence produced.

### Scenario 0 — Environment qualification

Start the locked Electron, create the hardened window, load the page, wait for explicit renderer readiness, record runtime/GPU diagnostics, and confirm `window.__foliateSpike.runAppearanceProbe` exists.

Pass only if all operations complete without security changes. Electron exit, fatal GPU startup, `ERR_FAILED`, failed preload initialization, or page-not-ready is `NON_EXECUTION`; do not substitute source simulation or a non-Electron execution.

### Scenario 1 — Fixture and canonical target

1. Read the exact fixture bytes through the named host API.
2. Create a `File` named `toc-and-images.epub` with MIME type `application/epub+zip`.
3. Create one `foliate-view` and call `view.open(file)`.
4. Set flow to `paginated` and paginator margin to `42px`.
5. Find exactly one opened-book section whose ID ends with `/shared.xhtml`.
6. Construct `${section.id}#two-mid` and resolve it once with `view.book.resolveHref()`.
7. Record canonical href, destination index, and resolution metadata.

Pass requires one matching section, a canonical href containing the resolved section ID and fragment, and a destination with valid index and anchor. Do not pass the relative shortcut to `goTo`.

### Scenario 2 — Establish the semantic CFI

1. Register a bounded relocation listener for the destination index.
2. Call `view.goTo(canonicalHref)` once and wait at most 12 seconds.
3. Locate the destination content document and `#two-mid`.
4. Resolve the destination anchor, normalize it to a DOM Range, and derive `targetCfi` with `view.getCFI()`.
5. Resolve the CFI through `view.resolveNavigation()` and resolve that anchor in the loaded document.

Record every relocation event, indexes, canonical href, generated CFI, marker text, resolved node/element identity, semantic containment, current range intersection, and visibility.

Pass requires timely matching relocation, the correct loaded document/marker, a nonempty CFI whose resolved anchor identifies `#two-mid` rather than only the resource or section, and visible reach before styling.

### Scenario 3 — One settled appearance transaction

Capture pre-style values, then use one `setStyles` call:

```css
body {
  font-size: 130% !important;
  color: #432 !important;
  background: #f2e4c6 !important;
}

p {
  line-height: 2 !important;
  margin-bottom: 32px !important;
}
```

Keep paginator margin `42px`. Wait two animation frames, await the active publication document's `fonts.ready`, then wait two more frames. Record settling relocations, reread computed styles, and resolve the unchanged CFI again. Do not navigate, recreate the view, regenerate the CFI, or substitute a target during settling.

Appearance pass requires finite positive font sizing consistent with 130% within normal subpixel tolerance, body color `rgb(68, 51, 34)`, background `rgb(242, 228, 198)`, marker line-height/font-size ratio `2` within `0.01`, paragraph bottom margin `32px`, paginator margin `42px`, and values read from publication content.

Semantic pass requires the unchanged CFI to resolve at the same destination index to an anchor equal to or contained by `#two-mid`.

### Scenario 4 — One target-filtered redisplay

1. Retain the same view, publication, destination, marker, and CFI.
2. Register one relocation listener accepting only the destination index and a range intersecting `#two-mid`.
3. Call `view.goTo(targetCfi)` exactly once and wait at most 12 seconds.
4. After the event, wait two animation frames and inspect `view.lastLocation`.
5. Capture a final screenshot showing the reader and identifiable target text.

Record every relocation, including rejected events and reasons, with relative timestamps and normalized range information.

Pass requires a timely matching event; expected index; accepted and final ranges intersecting `#two-mid`; a nonempty marker client rectangle intersecting the publication viewport; visible target text; retained appearance; and no fallback, second `goTo`, forced spine transition, view recreation, or CFI regeneration.

Earlier-section-only events, timeout, nonintersecting final range, offscreen marker, lost appearance, or reliance on fallback is `BEHAVIORAL_FAIL`.

## 8. Classification

Use exactly one:

- `BEHAVIORAL_PASS`: environment, security, and all focused behavioral assertions pass.
- `BEHAVIORAL_FAIL`: Electron and Foliate execute, but a required semantic, appearance, relocation, or visibility assertion fails.
- `NON_EXECUTION`: the host page or Foliate probe never begins because of environment/startup failure.
- `INVALID_RUN`: pinned inputs, fixture, security settings, or prescribed operations changed materially.

Never classify `NON_EXECUTION` or `INVALID_RUN` as a Foliate failure.

## 9. Evidence contract

Retain attempt-specific artifacts without overwriting previous evidence:

- a machine-readable provenance manifest with repository revision/dirty summary, OS/architecture, all runtime versions, Foliate commit, input/source hashes, exact command/working directory, timestamps, and classification;
- complete stdout, stderr, numeric exit status, command line, and timestamps for each authoritative command;
- BrowserWindow and session/security snapshots, command-line switches, GPU status, page-load and renderer-ready times, and static-test output;
- structured behavioral JSON containing canonical target derivation, indexes, CFI, before/after semantic resolution and visibility, computed styles, ordered relocations and rejection reasons, final location, marker/viewport rectangles, every assertion outcome, and classification;
- screenshots before styling and after final redisplay with enough text to identify nested paragraph 56;
- on error, phase, stack, last completed operation/events, diagnostics, and explicit flags for page load, probe start, and `view.open()` completion.

Screenshots support but do not replace semantic range assertions.

## 10. Stop and expansion rules

Stop immediately on failed qualification, changed pinned input, weakened invariant, failed behavioral assertion, or focused pass. Do not continue into unrelated gates.

A focused pass authorizes only a separately reviewed expansion to the remaining mandatory Spike A gates. It does not select Foliate, establish the final reader façade, authorize an adoption ADR, prove complete containment, or authorize production implementation.

A behavioral failure means Foliate is failed/not selected for this focused contract. Combined with epub.js failure, stop lightweight validation and return to architecture review for a Readium-specific topology/cost estimate.

Another `NON_EXECUTION` ends this authorized attempt and requires escalation to choose between exhausting the lightweight-renderer timebox or authorizing a separate environment-remediation activity. An invalid run authorizes no inferred result or implicit additional execution.

## 11. Out of scope

This spike does not test or implement epub.js, Readium, a bake-off, production UI, continuous mode, mode switching, persistence/restore, composite fallback, TOC progress, chapter-boundary pagination, selection/translation UI, input/context menu/Narrator behavior, hostile containment, unsupported publications, performance/memory, archive/XML boundaries, production resource delivery, storage/secrets/networking/packaging, dependency upgrades, a Foliate fork, or any product change.

## 12. Independent review

After execution, the evidence reviewer must verify environment qualification; canonical href usage; actual probe execution; semantic target identity before/after styles; computed values; target-intersecting relocation and final visibility; absence of fallback navigation; unchanged security settings; and consistency between classification and raw artifacts.

Only that review may recommend expansion, escalation, or closure.

## 13. Execution and independent review outcome

The authorized workflow executed two evidence attempts under the pinned, hardened Windows/Electron topology.

The first attempt qualified Electron and entered the Foliate probe, but its error path discarded the renderer-side relocation and phase evidence needed to distinguish a navigation failure from a harness timeout. Independent review classified it `INVALID_RUN`. The architect authorized one final instrumentation-only remediation without changing inputs, operations, timeouts, security settings, or acceptance criteria.

The final attempt established all of the following at runtime:

- Windows 11 x64 and Electron `38.7.2` started with normal GPU configuration and no diagnostic switches.
- The hardened host page loaded, preload readiness completed, and the renderer probe executed.
- The pinned fixture opened.
- Foliate derived `OEBPS/shared.xhtml#two-mid`, resolved destination index `0`, and returned that destination from the initial `goTo()`.
- Five public `foliate-view` relocation events were retained; four carried CFIs in section `[two]`.

The harness nevertheless rejected all five events because it required `event.detail.index`. Independent source review found that Foliate's inner paginator event contains `index`, but `foliate-view` transforms that event and re-emits `lastLocation` without an index field. The public event's missing index was therefore expected API shape, not evidence of an incorrect spine item. Because the invalid index guard ran before the semantic predicate, the experiment never validly evaluated `#two-mid` intersection, stable CFI behavior, appearance preservation, or final visibility.

The final independent classification is **`INVALID_RUN`**, not `BEHAVIORAL_FAIL`. Foliate-js remains **NOT DEMONSTRATED**: it neither passed nor behaviorally failed this contract.

Under `Workflow_1.md` and the architect's final-attempt ruling, no further automatic rerun is authorized. The lightweight-renderer timebox is exhausted. SPIKE-001 is terminally escalated without a renderer selection. The next authorized action is a Readium-specific architecture and cost assessment; that assessment does not itself authorize a Readium spike or implementation.
