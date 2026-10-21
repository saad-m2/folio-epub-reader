# Frontend design worktrees

Decision: 2026-10-21. Prepare three independent frontend alternatives, then choose the preferred result. Setup alone does not authorize starting design work.

All three worktrees start from the same application baseline commit containing this document. Their initial application files are identical. No design direction has been assigned and no design agent has been started.

Paths below are relative to the original `epub-reader` checkout:

| Alternative | Branch | Worktree directory |
| --- | --- | --- |
| A | `design/frontend-a` | `../epub-reader-frontend-a` |
| B | `design/frontend-b` | `../epub-reader-frontend-b` |
| C | `design/frontend-c` | `../epub-reader-frontend-c` |

## Working in separate sessions

Open the chosen worktree directory as the project/working directory for its agent session. Give each active design session its own alternative. Worktrees share Git history, but each has its own branch, working files, and index. A later session can resume an existing alternative by opening that same directory.

Two sessions can access the same worktree, but their edits and staging are shared immediately. Avoid concurrent editing in one worktree; use separate alternatives for independent work. Do not change the original checkout to one of these branches while it is already checked out in its worktree.

When design work is explicitly requested, constrain each agent to its assigned worktree and branch, ask for small frequent commits with staged-content privacy checks, and require relevant validation. Keep file-format expansion and pagination changes out of these visual comparisons unless separately requested.

Dependencies, build outputs, local environment files, generated evidence, and application data are not copied from the original checkout. Before development in a worktree, install its dependencies with `pnpm install --frozen-lockfile`. Production frontend work does not require initializing the historical Foliate spike submodule; if that spike is needed, initialize its submodule separately.

Worktrees do not isolate Electron's external user-data directory, ports, or local services. Initially preview alternatives one at a time. Concurrent app previews require separate runtime profiles and any needed port configuration.

## Comparing and choosing

Keep each alternative on its own branch. Review comparable Library, Reader, and Settings screens under the same window size, theme, and sample content. Check keyboard access and reading behavior as well as appearance. Run `pnpm check`, relevant tests, and `pnpm build` before accepting a design.

When a preferred alternative is selected, merge that branch into `main` from a clean original checkout. Do not merge all three competing designs by default. Other branches can remain available for comparison or for deliberately selecting individual improvements later.

Use `git worktree list` to see the checkouts. Remove an unused clean worktree with `git worktree remove <path>` only after deciding its work is no longer needed; removal does not delete its branch or commits.
