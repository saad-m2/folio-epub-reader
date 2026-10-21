# E3 — Reader core and reading continuity

## Purpose

Deliver secure, comfortable reading in both modes, with TOC-aware progress and semantically correct behavior across reopening, mode changes, appearance changes, and window reflow.

## Included

- Production `ReaderAdapter` as the sole epub.js integration.
- Continuous and conventional column-based paginated modes.
- Hierarchical TOC, active section, and progress.
- Composite location capture, persistence, resolution, and cleanup.
- Global reader appearance, theme, and documented reflow behavior.

## Dependencies

Depends on all of Epic 1's proof gates and Epic 2's library/session/persistence path. Epic 4 and translation in Epic 5 depend on stable reader events, frame lifecycle, and selection geometry from this epic.

## Stories

- [R1 — Open and close a book in continuous reading mode](E03-reader-core-and-reading-continuity/stories/R1-open-and-close-a-book-in-continuous-reading-mode/STORY.md)
- [R2 — Navigate a hierarchical table of contents](E03-reader-core-and-reading-continuity/stories/R2-navigate-a-hierarchical-table-of-contents/STORY.md)
- [R3 — Persist and restore a semantic reading location](E03-reader-core-and-reading-continuity/stories/R3-persist-and-restore-a-semantic-reading-location/STORY.md)
- [R4 — Add page-by-page mode and semantic mode switching](E03-reader-core-and-reading-continuity/stories/R4-add-page-by-page-mode-and-semantic-mode-switching/STORY.md)
- [R5 — Apply global reading appearance and reader themes](E03-reader-core-and-reading-continuity/stories/R5-apply-global-reading-appearance-and-reader-themes/STORY.md)
- [R6 — Enforce section/resource continuity during reflow](E03-reader-core-and-reading-continuity/stories/R6-enforce-section-resource-continuity-during-reflow/STORY.md)

## Exit condition

Semantic-marker, manager-flow, TOC/range, reopen fallback, mode-switch, reflow, chapter-boundary, and repeated-cleanup tests pass through the production boundary.
