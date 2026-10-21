# L6 — Detect exact duplicates and replace library references safely


**Capability.** Use identity evidence to recognize a selected EPUB already represented in the library and ask whether to replace the existing entry.

**Why here.** Duplicate behavior is part of import and must not create ambiguous parallel entries.

**Acceptance criteria**

- Byte-hash equality is treated as exact duplicate evidence; package ID alone is never treated as proof.
- A detected duplicate prompts for replacement rather than silently adding or overwriting an entry.
- Cancel preserves the existing record and all progress.
- Replacing an unchanged-byte EPUB preserves the existing logical reading position.
- Replacement updates only app-owned records/references and does not modify either source file.
- Size/mtime changes trigger revalidation rather than being treated as identity proof.

**Constraints/dependencies.** Depends on L3 and the identity rules from the architecture.
