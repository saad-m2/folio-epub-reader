# L5 — Remove a book without touching its EPUB


**Capability.** Confirm and remove a library entry and all app-owned state associated with it.

**Why here.** Removal is core library lifecycle behavior and reinforces local-file ownership.

**Acceptance criteria**

- Removal always requires confirmation.
- Confirming deletes the book record, reading position, and derived app caches in one transaction.
- The original EPUB is never deleted, moved, renamed, opened for write, or otherwise modified.
- Cancel leaves all app and source state unchanged.
- Removal of the current/attempted entry closes and revokes any session before deleting app records.
- Restart does not restore the removed entry or progress.

**Constraints/dependencies.** Depends on L1 and L2; uses the Epic 1 cleanup/revocation behavior.
