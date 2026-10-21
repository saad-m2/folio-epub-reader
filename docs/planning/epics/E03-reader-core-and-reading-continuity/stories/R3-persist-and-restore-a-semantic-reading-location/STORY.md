# R3 — Persist and restore a semantic reading location


**Capability.** Capture a bounded composite ReaderLocation during reading, save it per book, and restore the approximate position on reopen.

**Why here.** Durable reading continuity is a core product promise and underpins replacement migration and mode changes.

**Acceptance criteria**

- Location updates capture normalized href, valid CFI when available, bounded quote with context, active navId, nav-range progression, and resource progression.
- Updates are safely debounced/serialized and persist per book without storing selected text beyond the bounded locator context.
- Reopening resolves in the documented fallback order and returns to the same approximate percentage within the active section.
- The resolved marker or quote is verified as visible where such a marker exists.
- No generated page number, frame identity, opaque epub.js object, source path, or full passage is persisted.
- Missing/corrupt locator fields degrade to the next safe fallback and never prevent the book from opening.

**Constraints/dependencies.** Depends on R2 and L1. Uses the same resolver contract required by L7.
