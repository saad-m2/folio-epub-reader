# Pending work and recorded requests

Status reconciled on 2026-10-22 against current source and the [original reader-improvements note](../historical/planning/READER-IMPROVEMENTS-01.md). These are recorded requests, not a claim that every item is selected for the next release.

## Optional cloud translation: development implementation, qualification outstanding

2026-10-26 provider expansion: add ZPK, Lara Translate, and Traduck to the existing Microsoft/DeepL implementation, in fixed fallback order **Microsoft → ZPK → Lara → Traduck → DeepL**, with the saved current provider tried first. The owner approved one fixed-sentence diagnostic for unclear ZPK/Lara translation errors and treating a repeated unclear failure as persistent assumed exhaustion. Explicit authentication/throttling/network/timeout/validation failures stop. All three additions use quota-consuming manual availability probes. See [setup](CLOUD-TRANSLATION-SETUP.md) and the [architecture decision](../architecture/decisions/CLOUD-TRANSLATION.md). Owner preview approval and the 0.3.1 packaged release checks are complete; real-account qualification remains outstanding. Earlier evidence below applies to the two-provider build.

The [cloud translation requirements](CLOUD-TRANSLATION-REQUIREMENTS.md) record the agreed extension: user-owned provider accounts, an active provider selectable in Settings, automatic cloud fallback after allowance exhaustion without user-managed ordering, and provider-enforced free cutoffs configured by users. Ollama remains a manually selected option with its existing Load/Unload behavior and is excluded from automatic fallback.

The [E07 delivery plan and stories](epics/E07-optional-cloud-translation.md) cover Microsoft Translator and DeepL, initially German to English. Fallback uses a fixed built-in order and saves the new current provider; recovered providers never automatically take over. Manual availability checks send no book text; Microsoft's explicit check uses a short fixed test phrase and a small amount of allowance. Non-exhaustion errors require an explicit retry or manual switch.

The development implementation includes both supported cloud adapters, Windows-protected credentials, validated IPC, persistent exhaustion-only fallback, explicit checks, and reader/Settings integration. Automated provider cases use controlled responses; real-provider credentials, allowance behavior, and literary quality have not been qualified. See [E07 evidence/status](epics/E07-optional-cloud-translation.md#development-evidence-and-remaining-qualification) and [qualification](../release/QUALIFICATION.md#e07-cloud-translation). The epic remains incomplete until its required qualification is satisfied.

The general **Reader settings** panel now combines appearance, translation-service selection/status, and local model Load/Unload without leaving the book. There are no separate top-right translation controls; cloud credential forms remain in main Settings. Switching preserves the passage, invalidates old selections/results, and applies to the next explicit Translate; it never loads Ollama or sends text by itself.

Scope update, 2026-10-25: the owner removed Amazon Translate after the free-account trial exposed a service restriction. C05 is dropped, not an outstanding provider qualification gate. Migration on the first translation-provider state read removes its saved app-owned credentials and allowance metadata; an AWS current-provider choice becomes an explicit choose-provider state. The 0.3.0 release candidate passed the full Windows release pipeline and 12 packaged fixtures. Real Microsoft/DeepL account, Ollama, and hosted-update checks remain outstanding; prior AWS diagnostics are historical evidence only.

## Additional formats: scope needed

Import and publication opening currently support EPUB only. The user requested more formats but has not selected the actual formats or their order. PDF, TXT, FB2, MOBI, and AZW3 were discussion examples, not an approved support list.

Before implementation, agree on a supported-format matrix and each format's limitations. Acceptance should cover import/validation, library add/open/close/reopen, position restoration, navigation, appearance, selection, friendly failures, and existing EPUB regression coverage. Expanding the file-picker filter alone is insufficient.

Inspect `src/main/index.ts`, `src/main/publications.ts`, `src/main/library.ts`, shared contracts, renderer validation, and reader adapters.

## Single-page pagination: implemented

Page-by-page mode now defaults to an undivided **Single page** layout. Settings and the in-reader appearance panel offer **Single page / Two pages** separately from the reading-mode switch. The global layout preference persists across books and restarts; scrolling retains the saved layout for the next switch back to pagination. Two-page reading falls back to one page in narrow windows.

Layout and mode changes use semantic passage restoration. Appearance and window-size changes retain the existing section-start reflow rule. Previous/next, keyboard, wheel, and edge-click navigation share the same paginated interaction path in both layouts.

Verification on 2026-10-22: type checking, all 162 unit/regression tests, production build, and the isolated development Electron corpus passed. The corpus measures single-page/spread column widths and exercises page turns in both layouts across the supported fixtures. Persistence regressions cover defaults, mode changes, and database restart. Settings and in-reader controls were inspected with a mocked desktop API; the reader switched between full-width single-page and two-column layouts at 1280px and fell back to one page at 700px. This is development verification, not packaged Windows or Narrator qualification.

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
