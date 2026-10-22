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

## Custom reading background: implemented

Settings and in-book appearance controls now offer a color wheel, brightness slider, hex input, and preview. Applying a color saves it globally across restarts and both reading modes, with automatically contrasting text and underlined links. Presets retain the last custom color. See [reading appearance](PRODUCT.md#92-application-and-reader-themes) for behavior and the root [usage guide](../../README.md#choose-a-reading-background) for controls.

Verification on 2026-10-22: type checking, all 157 unit/regression tests, and the production build passed. Settings was inspected in a browser with a mocked desktop API; this does not establish packaged Windows or Narrator qualification.

## In-app update discovery: implemented

Version 0.2.1 exposes **Settings → App updates** with the running version, explicit **Check for updates**, checking/download status, retry, and **Restart and install** after download. The existing main-process Squirrel updater handles downloads; opening Settings does not check the network automatically. Version 0.2.0's update controls remain under About. See [updates](../release/UPDATES.md) for publishing and hosted-flow qualification.

## Qualification follow-up

Keep deferred distribution/accessibility checks and hosted update verification in [release qualification](../release/QUALIFICATION.md) and [updates](../release/UPDATES.md). Do not interpret archiving the initial epic plans as completing every original release gate.

Other postponed capabilities, such as bookmarks, annotations, search, and sync, are listed in [product boundaries](PRODUCT.md#12-mvp-boundaries). They are not automatically active roadmap items. Update this document when a request is selected, clarified, implemented, or dropped.
