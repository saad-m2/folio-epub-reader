# Small-feature workflow

Use this workflow for small application changes, such as a new reader color, a small setting, or a focused UI improvement. The AI owns implementation, verification, preview preparation, and release completion. The owner tests the preview and approves the result before integration and publication. Documentation-only tasks do not require an app preview or release.

## 1. Start in a separate worktree

- Read the [documentation map](../README.md), relevant guides, and current implementation. Define the intended behavior and a few concrete acceptance checks; a small change does not need a separate planning document.
- Inspect Git status and fetch the latest remote state. Create a dedicated feature branch and a new sibling Git worktree from current `main` (normally `origin/main`). Keep the original checkout and any unrelated edits intact. Install dependencies in the worktree using the [agent guidelines](AGENT-GUIDELINES.md#setup-and-commands).
- Keep implementation, related documentation, and release preparation on the feature branch. Do not implement the feature directly on `main`.

## 2. Implement and verify

- Preserve the boundaries in [AGENTS.md](../../AGENTS.md), update the affected guides, and keep roadmap status accurate under the [documentation policy](DOCUMENTATION-POLICY.md).
- Run `pnpm check`, `pnpm test`, and `pnpm build`. Inspect the actual results, fix failures, and report any remaining gaps. Add meaningful regression coverage where behavior warrants it; a simple static color addition does not need a test that merely repeats the color constant.
- Run additional proof/runtime checks according to the [agent guidelines](AGENT-GUIDELINES.md#setup-and-commands). Inspect changed UI in the running app, including relevant keyboard, focus, narrow-window, persistence, and reader behavior. Passing automated tests alone does not establish that everything works.

## 3. Give the owner a working preview

Prepare the preview before asking for approval. The default for a small visual feature is the real development app from the worktree, using a dedicated temporary profile. Provide a local double-click launcher, its absolute path, the branch/commit being tested, and a short checklist with expected results. Keep generated launchers and profiles outside tracked source. Do not require the owner to assemble commands or install over their normal app.

The launcher must set both `E06_UI_TEST=1` and an absolute `E06_TEST_ROOT`, and launch from the correct worktree. [Path configuration](../../src/main/paths.ts) only enables isolation when both are present. Scope these variables to the launched process; do not change the user's persistent environment. Keep the same preview profile for restart/persistence checks. Do not copy the owner's real library database or source EPUBs into the preview profile. Use generated fixtures or let the owner explicitly select an original EPUB, which remains referenced in place.

Choose the preview format according to the change:

| Preview | When to use it |
| --- | --- |
| Development app with an isolated profile, launched through `pnpm start` | Default for colors, controls, and other small UI changes; requires the worktree and installed development dependencies |
| Packaged executable with an isolated profile | Prefer for packaging-sensitive behavior or an experience closer to the release; build with `pnpm package:candidate`, then launch `out/windows-epub-reader-win32-x64/WindowsEpubReader.exe` directly with the isolation variables |
| Candidate installer | Only when installation or upgrade behavior itself needs testing; follow [qualification guidance](../release/QUALIFICATION.md) and explain the installation target before testing |

Screenshots can supplement the preview but do not replace hands-on testing. A browser mock does not replace testing the real Electron feature.

For a new reader color, the checklist could be: select the color, read and turn pages, use the control with the keyboard, switch books, then close and reopen the preview to check persistence. Include nearby behavior that could regress. Explain that the preview has a separate library/settings profile.

Wait for explicit owner approval of the tested result. Silence and automated success are not approval. If changes are requested, implement them in the same worktree, rerun affected checks, and provide an updated preview. Do not merge, push to `main`, tag, or publish while this acceptance step is pending.

## 4. Integrate and release after approval

Owner approval of the preview authorizes completing the merge, push, and release for that feature; do not request the same permission again unless scope or behavior materially changes. Follow the [release workflow](RELEASE-WORKFLOW.md) through publication and report the outcome. If blocked, preserve the worktree and artifacts and state the remaining step.
