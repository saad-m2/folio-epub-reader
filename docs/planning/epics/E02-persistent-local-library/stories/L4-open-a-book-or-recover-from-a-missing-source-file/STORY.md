# L4 — Open a book or recover from a missing source file


**Capability.** Open a stored entry through a new publication session, or present the required File not found state if the original has moved, been renamed, or been deleted.

**Why here.** A reference-only library must clearly handle both the useful and broken-reference paths.

**Acceptance criteria**

- Double-clicking an available entry authorizes its stored record, revalidates changed size/mtime evidence as required, opens one active session, and updates most-recently-opened order.
- The raw path is not sent to the renderer, and only one book session is active at a time.
- A missing source remains visible in the library and produces a clear **File not found** state.
- That state offers **Remove from library** and Cancel; Cancel changes neither entry nor progress.
- A bounded handoff/open failure returns to or keeps the user in Library with a safe friendly message and releases the attempted session/archive bytes.

**Constraints/dependencies.** Depends on L3 and the session broker contract. Full readable rendering lands in Epic 3; this story can initially terminate at an authenticated reader-session handoff.
