# Agent guidelines

General working rules for Leaf development. Start from the root [AGENTS.md](../../AGENTS.md) for project boundaries and the [documentation map](../README.md) for task context.

## Workflow hierarchy

- These guidelines apply throughout development, including setup, delegation, and verification.
- The [small-feature workflow](SMALL-FEATURE-WORKFLOW.md) orders implementation, automated checks, and owner preview/approval.
- The [documentation policy](DOCUMENTATION-POLICY.md) applies alongside the work; the [release workflow](RELEASE-WORKFLOW.md) covers integration and publication after approval.
- Explicit owner instructions govern the task. Specialized architecture-recovery and spike-validation workflows under `.codex/skills/` apply only when deliberately invoked.

## Working Style

Own the task end-to-end. Understand the relevant existing code and requirements before making substantial changes.

For non-trivial work, briefly determine an implementation approach and identify independent workstreams before editing.

Prefer simple solutions that fit the existing architecture. Do not introduce abstractions, dependencies, or architectural changes unless they are justified by the task.

## Delegation and Subagents

Use subagents when they materially improve the quality or speed of the work.

Decide dynamically which subagents are useful for the current task. Do not assume a fixed set of roles must be used.

Create/delegate roles based on the actual work required, for example investigation, implementation of an isolated component, test analysis, documentation research, or review.

When delegating:

* Give each subagent a narrow and explicit objective.
* Give it the relevant context, constraints, files, and expected output.
* Prefer independent workstreams that can safely run in parallel.
* Avoid having multiple agents modify the same files or tightly coupled code simultaneously.
* Use read-only/investigation subagents freely when useful.
* Do not delegate trivial work merely for the sake of using subagents.

The main agent remains responsible for architectural decisions, interfaces between workstreams, integration, resolving conflicting recommendations, and the final result.

Do not blindly accept subagent output. Review it before integrating it.

## Implementation

Follow existing project conventions and patterns unless there is a concrete reason not to.

Keep changes scoped to the requested task. Avoid unrelated refactors.

Fix root causes rather than adding workarounds where reasonably possible.

Before changing an interface used by multiple parts of the system, inspect its callers and understand the consequences.

## Verification

After implementation, verify the integrated result rather than considering individual subagent tasks sufficient.

Run the relevant tests, type checking, and build commands for the affected area. Use the current package scripts below; there is no separate lint script at present.

Review the final diff for:

* correctness
* regressions
* incomplete integration
* unnecessary complexity
* missing error handling
* violations of project conventions

If verification reveals a problem, fix it before considering the task complete.

## Project Context

Before substantial implementation work, read the relevant project documentation and existing implementation.

Use repository documentation as the source of truth for product requirements, architecture, and implementation decisions where applicable.

## Model and delegation policy

Use currently available free OpenCode models for routine implementation, exploration, testing, and documentation. Choose workers according to the task rather than maintaining fixed specialist roles.

Reserve an additional Codex instance, using the configured mid-tier model with medium reasoning, for difficult or high-impact work: subtle correctness problems, risky changes, difficult debugging after focused free-model attempts have failed, or complex integration. Split large tasks into manageable OpenCode work first; size alone does not require Codex escalation.

Choose workers dynamically using the available runtime controls; this repository does not pin worker models in a project OpenCode configuration. Keep exact model identifiers in runtime configuration rather than in these guidelines. Check availability before delegation. If a free model is unavailable, try another suitable free model; do not silently switch routine work to paid usage. If no suitable free worker is accessible, report that limitation rather than claiming delegated work ran. The policy does not itself provide model-selection controls, automatic model discovery, or fallback, and a configured model is not proof that it is available in the current session.

The coordinating agent reviews delegated work and verifies the integrated result. Use delegation when it adds value; do not spawn workers solely to satisfy a role list.

## Setup and commands

Use Windows x64, Node.js 24, and pnpm 12.5.1, matching project CI. The current `package.json` engine range is broader; Node 24 is the project development baseline. Exact dependencies and overrides belong to [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml), and `patches/`. Production work does not require the historical Foliate submodule.

Run from the repository root:

| Purpose | Command | Notes |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | Uses committed versions |
| Launch development app | `pnpm start` | Generates proof fixtures, builds, starts Electron; uses normal app data unless explicitly isolated |
| Type checking | `pnpm check` | Renderer/shared and main/preload TypeScript |
| Unit/regression suite | `pnpm test` | Vitest; inspect actual output instead of relying on an old documented test count |
| Production build | `pnpm build` | TypeScript plus Vite |
| Trusted-publication Electron proof | `pnpm proof` | Builds and executes the real runtime proof; set an isolated profile first as described below |
| Development runtime corpus | `pnpm generate:release-corpus`, then `pnpm build`, then `node scripts/run-release-tests.cjs --development` | Runner does not rebuild; uses isolated temporary data and writes local evidence; this is not packaged qualification |
| Candidate installer | `pnpm package:candidate` | Generates corpus, builds, and runs Forge |
| Packaged runtime corpus | `pnpm test:packaged` | Requires the packaged executable; runner creates an isolated temporary profile |
| Full release build and evidence | `pnpm package:release` | Builds installer, inventories licenses/dependencies, verifies package, and runs packaged corpus checks |

## Choose checks for the change

Documentation-only changes need link/path validation and diff review. For application changes, run type checking and relevant regression tests; run the broader suite/build when shared contracts or integration warrant it. Reader, publication, lifecycle, Electron, and epub.js changes also need the real proof/corpus checks appropriate to the boundary. UI changes need inspection of affected screens and keyboard/focus behavior. Use [release workflow](RELEASE-WORKFLOW.md) for installer/update changes.

`tests/` contains contracts/security, library/regressions/view, reader-adapter/location/lifecycle, publication validation, font, translation, offline, and update tests. `scripts/` contains fixture generation, proof/corpus runners, supply-chain tools, and opt-in real Ollama checks. Runtime qualification also uses `src/main/release-tests.ts` and `src/renderer/release-tests.ts`.

## Profiles, evidence, and privacy

Normal app data is `%LOCALAPPDATA%/Windows EPUB Reader/Data` with separate `Session` data. For UI qualification use an isolated absolute `E06_TEST_ROOT` together with `E06_UI_TEST=1`; the packaged/development corpus runner sets its own test root and `E06_RELEASE_TEST=1`. See [path configuration](../../src/main/paths.ts) before composing a manual launch. Unlike the corpus runner, `scripts/run-proof.cjs` does not create its own isolated profile: set `E06_UI_TEST=1` and an absolute temporary `E06_TEST_ROOT` before running `pnpm proof`. The separate `pnpm proof:runtime` command starts the ordinary app unless its proof flag is set; it is not a substitute for `pnpm proof`. Scope test variables to the launched process. Do not run destructive fixtures or qualification against the user's real library.

Generated reports under `release-artifacts/`, spike evidence, EPUB fixtures, outputs under `out/` and `dist/`, databases, local environment values, and diagnostic dumps are ignored intentionally. Some old documents link to local evidence that is unavailable in a clone. Review and sanitize evidence before publishing; do not include local paths or book/selection/translation text. Keep font licenses beside the assets.

The [qualification guide](../release/QUALIFICATION.md) distinguishes owner-approved personal-use scope, deferred checks, and future distribution testing. A successful unit run, development corpus, or installer build does not establish every installed-app gate.
