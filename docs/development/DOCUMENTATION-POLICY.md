# Documentation policy

Keep enough durable context for the next task without requiring a full repository read. This policy applies to future work on Leaf.

## During each task

1. **Read selectively.** Use the [documentation map](../README.md), then inspect the relevant guides and implementation. Resolve discrepancies against current code and explicit user decisions; identify intended behavior separately from implemented behavior.
2. **Update alongside the change.** Before calling work complete, update affected docs when behavior, scope, architecture, setup, commands, release procedures, or known limitations change. Small internal fixes need no documentation edit unless they reveal a lasting constraint or useful non-obvious decision.
3. **Leave accurate status.** Update roadmap items when implemented, deferred, or dropped. For unfinished work, record only the concrete remaining scope, blocker, or decision needed to resume. Distinguish planned behavior from shipped behavior and passed checks from failed, unrun, deferred, or waived checks.
4. **Verify the result.** Check changed documentation against the final implementation, validate local links and moved paths, and review the diff. State what was verified and any material gaps in the task's completion summary. Documentation-only work does not require application tests or packaging unless it changes executable examples or tooling.

## Where and how to write

- Update the existing topic guide first; keep one maintained explanation of each subject. Use the [map](../README.md) to choose product, architecture, design, development, or release folders.
- Create a new document only for a distinct subject that needs lasting explanation. Use a clear descriptive filename, relative links, and a short opening statement of purpose. Link it from the relevant guide or map so it is discoverable.
- Record consequential architecture decisions in `docs/architecture/decisions/`: date/status, problem, chosen approach, reason/tradeoffs, and affected code. Routine implementation choices do not need a decision record.
- Prefer concise explanations of behavior, constraints, and why a choice matters. Link to code/configuration for exact APIs, versions, and commands rather than copying lists that will drift. Date evidence and review snapshots; do not imply an old result verifies a new build.
- Keep `AGENTS.md` as a short entry point and durable project rules. Do not add session transcripts, routine progress logs, or a new report for every fix. Keep generated evidence in its designated ignored location and exclude secrets, private paths, and book/translation text from shared docs.

## When information becomes outdated

Correct a current guide in place when its subject remains current. Archive a document in `docs/historical/` when its plan, approach, or review stage has been superseded and the original record is worth keeping. Add a historical notice with the archive date and a link to its current replacement; preserve original findings and outcomes. Repair incoming links, update the historical index, and carry unfinished requests into the current roadmap before archiving. Historical instructions do not become requirements for new work merely because they were preserved.
