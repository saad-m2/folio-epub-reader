# Documentation map

Start here when working on Leaf. Read the topic needed for the task, then inspect the linked implementation. This index and the current guides were reconciled with the repository on 2026-10-22; this was a documentation review, not a fresh runtime qualification. The working procedures were consolidated under `workflow/` on 2026-10-24 and their setup/test/release instructions checked against current scripts and configuration; no application qualification was rerun.

## Where to look

| Task | Read first | Implementation to inspect |
| --- | --- | --- |
| Follow development working rules | [Agent guidelines](workflow/AGENT-GUIDELINES.md) | Setup, delegation, commands, and verification |
| Understand the app or change product behavior | [Product definition](product/PRODUCT.md) | [App routes and operations](../src/renderer/app.tsx), [shared contracts](../src/shared/contracts.ts) |
| Pick up a requested future feature | [Roadmap](product/ROADMAP.md) | Follow the areas listed for that request |
| Implement a small feature through owner testing and release | [Small-feature workflow](workflow/SMALL-FEATURE-WORKFLOW.md) | Feature-specific source, [release workflow](../.github/workflows/ci-release.yml) |
| Change architecture, import, or publication security | [Architecture overview](architecture/OVERVIEW.md), [trusted-local decision](architecture/decisions/TRUSTED-LOCAL-EPUB.md) | [Main](../src/main/index.ts), [sessions](../src/main/publications.ts), [validation](../src/renderer/publication-validation.ts), [preload](../src/preload/index.ts) |
| Change library, replacement, or persistence | [Architecture overview](architecture/OVERVIEW.md), product sections 7 and 8.3 | [Library repository](../src/main/library.ts), [library UI](../src/renderer/library-view.tsx), [location resolver](../src/renderer/reader-location.ts) |
| Change pagination, TOC, appearance, or reading positions | Product section 8, [architecture overview](architecture/OVERVIEW.md) | [Reader adapter](../src/renderer/reader-adapter.ts), [reader UI](../src/renderer/reader.tsx), [location resolver](../src/renderer/reader-location.ts) |
| Change visual design, dialogs, or accessibility | [Design guide](design/README.md) | [Shared UI](../src/renderer/ui.tsx), [renderer files](../src/renderer/) |
| Change translation or model lifecycle | [Local translation decision](architecture/decisions/LOCAL-TRANSLATION.md), [cloud decision](architecture/decisions/CLOUD-TRANSLATION.md), [setup](product/CLOUD-TRANSLATION-SETUP.md), product section 10; [cloud requirements](product/CLOUD-TRANSLATION-REQUIREMENTS.md) and [E07 status/stories](product/epics/E07-optional-cloud-translation.md) | [Local gateway](../src/main/translation.ts), [coordinator](../src/main/translation-coordinator.ts), main IPC handlers, reader and settings UI |
| Change font catalog or downloads | Product section 9, [architecture overview](architecture/OVERVIEW.md) | [Font manager](../src/main/fonts.ts), [settings](../src/renderer/settings.tsx) |
| Run, test, or debug the application | [Agent guidelines: setup and checks](workflow/AGENT-GUIDELINES.md#setup-and-commands) | [Scripts](../scripts/), [tests](../tests/), [package.json](../package.json) |
| Build an installer, publish, or change updates | [Release workflow](workflow/RELEASE-WORKFLOW.md), [update behavior/history](release/UPDATES.md), [qualification](release/QUALIFICATION.md), [evidence template](release/templates/RELEASE-EVIDENCE.md) | [Updater](../src/main/updates.ts), [Forge config](../forge.config.cjs), [CI](../.github/workflows/ci-release.yml) |
| Explain an earlier choice or investigate a past finding | [Historical index](historical/README.md) | Read only the relevant plan, review, or spike; verify against current code |

## Directory layout and authority

- `product/`: intended behavior, current scope, and pending requests.
- `architecture/`: current implementation overview and retained architecture decisions.
- `design/`: current visual guidance and the approved standalone frontend prototype.
- `workflow/`: agent working rules, setup/checks, small-feature delivery, documentation policy, and release procedure. The agent guidelines link the procedures; no separate workflow README is needed.
- `release/`: user installation/update information, release history, qualification limits, and reusable evidence template.
- `historical/`: archived architecture proposals, initial epic/story plans, implementation reviews, and renderer experiments.

For intended behavior, use the current product definition and explicit new user instructions. For what is implemented, inspect source, tests, and the current architecture guide. Record a mismatch rather than assuming an old proposal or a passing historical test count establishes present behavior. Dependency versions belong to `package.json` and `pnpm-lock.yaml`. Historical records explain decisions; they do not override current guidance.

## Documentation outside this folder

The root [README](../README.md) is the install/development entry point and [AGENTS.md](../AGENTS.md) is the short agent entry point. The [epub.js harness README](../spikes/renderer/README.md) and [Foliate harness README](../spikes/renderer-foliate/README.md) stay beside their historical experiment code. General agent instructions, including dynamic worker selection and the model policy, live in [workflow/AGENT-GUIDELINES.md](workflow/AGENT-GUIDELINES.md). This repository does not pin models in a project OpenCode configuration. Codex configuration and optional specialized workflows live under [.codex](../.codex/); the architecture-recovery and spike-validation workflows apply when deliberately invoked for that work, not to ordinary feature changes.

Font license texts remain beside the shipped and test font assets. Third-party/vendor docs, installed dependencies, build output, local runtime data, and ignored generated release/spike evidence are not maintained project guides and were not relocated. Evidence paths can be absent from a fresh clone.

## Keeping context useful

Follow the [documentation policy](workflow/DOCUMENTATION-POLICY.md) for when to update, create, verify, or archive documentation during future work. Keep this map focused on routing tasks to the appropriate topic and implementation.
