# L1 — Persist the library and global state schema


**Capability.** Add ordered SQLite migrations and transactional main-process repositories for books, reading positions, preferences, font assets, and encrypted-secret metadata.

**Why here.** Library behavior and later reader/settings features need a durable source of truth with ownership confined to main.

**Acceptance criteria**

- A new profile creates the documented core records and default global preferences, including continuous reading mode.
- Only main accesses SQLite; no SQL or row representation crosses into preload or renderer contracts.
- Migrations are ordered, repeatable, and transaction-safe, including recovery from a failed migration.
- Book records retain canonical recorded path, normalized metadata, cover-cache reference, identity evidence, and added/opened timestamps without copying the EPUB.
- Reading positions store only normalized composite locator fields, never generated page number, iframe identity, or an opaque epub.js object.
- Repository tests cover restart persistence and transaction rollback.

**Constraints/dependencies.** Depends on F1–F3. Optional local translation introduces no API key or secret preference field.
