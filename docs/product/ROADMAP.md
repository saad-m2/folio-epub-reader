# Pending work and recorded requests

Status reconciled on 2026-10-22 against current source and the [original reader-improvements note](../historical/planning/READER-IMPROVEMENTS-01.md). These are recorded requests, not a claim that every item is selected for the next release.

## Additional formats: scope needed

Import and publication opening currently support EPUB only. The user requested more formats but has not selected the actual formats or their order. PDF, TXT, FB2, MOBI, and AZW3 were discussion examples, not an approved support list.

Before implementation, agree on a supported-format matrix and each format's limitations. Acceptance should cover import/validation, library add/open/close/reopen, position restoration, navigation, appearance, selection, friendly failures, and existing EPUB regression coverage. Expanding the file-picker filter alone is insufficient.

Inspect `src/main/index.ts`, `src/main/publications.ts`, `src/main/library.ts`, shared contracts, renderer validation, and reader adapters.

## Single-page pagination: pending

The user requested an undivided single-page view with page turns, retaining two-page reading as a separate choice. The adapter currently uses `spread: "always"` for paginated mode; persisted preferences distinguish continuous from paginated mode but have no separate page-layout choice.

Acceptance carried forward from the request:

- Offer and persist a global single-page/two-page choice for paginated reading.
- Keep previous/next, keyboard, wheel, and edge-click navigation working in both layouts.
- Preserve semantic position when changing layout or mode. Test resize and appearance changes against the existing reflow rule; agree explicitly if this feature should change that rule.
- Verify chapter boundaries, narrow/wide windows, appearance changes, restart, and reopening.

Inspect `src/shared/contracts.ts`, `src/main/library.ts`, `src/renderer/reader-adapter.ts`, `reader.tsx`, `settings.tsx`, and relevant adapter/location tests.

## Frontend redesign: implemented

The old request to choose and implement a visual direction is superseded by approved Design A, now integrated in the live renderer. Use the [design guide](../design/README.md) for new UI work and the [integration record](../historical/reviews/FRONTEND-IMPLEMENTATION.md) for recorded verification. The old three-alternative worktree instructions are history, not the current task setup.

## Qualification follow-up

Keep deferred distribution/accessibility checks and hosted update verification in [release qualification](../release/QUALIFICATION.md) and [updates](../release/UPDATES.md). Do not interpret archiving the initial epic plans as completing every original release gate.

Other postponed capabilities, such as bookmarks, annotations, search, and sync, are listed in [product boundaries](PRODUCT.md#12-mvp-boundaries). They are not automatically active roadmap items. Update this document when a request is selected, clarified, implemented, or dropped.
