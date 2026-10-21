# E2 — Persistent local library

## Purpose

Deliver the first complete user-facing vertical slice: a durable, offline visual library of references to original EPUB files, with safe import, identity, missing-file, replacement, and removal behavior.

## Included

- SQLite migrations and main-process repositories.
- Empty first-run state and cover-led recent-first library grid.
- Native file-picker import and trusted-local renderer validation.
- Opening, missing-file handling, removal, duplicate detection, and safe replacement.
- Friendly invalid/unsupported states without exposing technical diagnostics.

## Dependencies

Depends on Epic 1's shell, contracts, and accepted trusted-local handoff. Replacement migration uses the composite locator contract defined in Epic 1 and must be exercised with the same resolver semantics later used by Epic 3.

## Stories

- [L1 — Persist the library and global state schema](E02-persistent-local-library/stories/L1-persist-the-library-and-global-state-schema/STORY.md)
- [L2 — Present first-run and persistent library states](E02-persistent-local-library/stories/L2-present-first-run-and-persistent-library-states/STORY.md)
- [L3 — Add and validate a local EPUB](E02-persistent-local-library/stories/L3-add-and-validate-a-local-epub/STORY.md)
- [L4 — Open a book or recover from a missing source file](E02-persistent-local-library/stories/L4-open-a-book-or-recover-from-a-missing-source-file/STORY.md)
- [L5 — Remove a book without touching its EPUB](E02-persistent-local-library/stories/L5-remove-a-book-without-touching-its-epub/STORY.md)
- [L6 — Detect exact duplicates and replace library references safely](E02-persistent-local-library/stories/L6-detect-exact-duplicates-and-replace-library-references-safely/STORY.md)
- [L7 — Migrate or reset progress for changed replacements](E02-persistent-local-library/stories/L7-migrate-or-reset-progress-for-changed-replacements/STORY.md)

## Exit condition

The offline library vertical slice passes original-file integrity, persistence, identity, missing, remove, replacement-migrate, and replacement-reset tests.
