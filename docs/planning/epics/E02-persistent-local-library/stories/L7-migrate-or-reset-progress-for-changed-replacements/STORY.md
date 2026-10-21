# L7 — Migrate or reset progress for changed replacements


**Capability.** Validate a changed replacement and automatically preserve progress only when the saved logical locator resolves reliably.

**Why here.** This completes the product's replacement promise and keeps unsafe guesses out of reader restoration.

**Acceptance criteria**

- The replacement is fully validated before the existing entry is changed.
- Resolution attempts the specified composite fallback order: CFI, quote/context near href, nav-range progression, then nav-range/resource start.
- A reliably resolved locator is persisted against the replacement and restores to the expected semantic passage in fixture tests.
- An unreliable locator clears/resets progress and explains that outcome clearly; the UI does not ask the user to choose a migration policy.
- A validation or transaction failure leaves the original library entry and progress intact.
- Tests cover unchanged bytes, changed content with a reliable marker, changed content with no reliable marker, and package-ID collision.

**Constraints/dependencies.** Depends on L6 and the normalized ReaderLocation/resolver contract from F2. The implementation must be reused by Epic 3 restoration rather than creating a library-only locator algorithm.

**Epic exit condition.** The offline library vertical slice passes original-file integrity, persistence, identity, missing, remove, replacement-migrate, and replacement-reset tests.
