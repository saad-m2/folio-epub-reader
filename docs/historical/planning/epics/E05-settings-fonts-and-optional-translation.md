# E5 — Settings, fonts, and optional translation

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../README.md). Original findings and outcomes are preserved.


## Purpose

Complete persistent global configuration, optional font downloads, and manual local translation without making ordinary reading depend on Ollama or a model.

## Included

- Global Settings surfaces and preference persistence.
- Bundled default font and vetted static downloadable font catalog.
- Setup guidance and non-loading status checks for separately installed Ollama and the fixed local model.
- Manual Load/Unload controls in the reader toolbar, including while a book remains open.
- Explicit German-to-English selected-text translation with the fixed local model and prompt.
- Anchored and expanded results, copy/dismiss, retry, and unloaded/missing-model guidance.

## Dependencies

Depends on Epic 3's preference/application behavior and Epic 4's selection/anchor/accessibility primitives. Font licensing and origins/hashes must be settled before those assets can be released. Translation follows [the local translation decision](../../../architecture/decisions/LOCAL-TRANSLATION.md).

## Stories

- [S1 — Complete global Settings and reader-preference surfaces](E05-settings-fonts-and-optional-translation/stories/S1-complete-global-settings-and-reader-preference-surfaces/STORY.md)
- [S2 — Bundle the default font and manage optional font downloads](E05-settings-fonts-and-optional-translation/stories/S2-bundle-the-default-font-and-manage-optional-font-downloads/STORY.md)
- [S3 — Detect local translation setup](E05-settings-fonts-and-optional-translation/stories/S3-detect-local-translation-setup/STORY.md)
- [S4 — Manually load and unload the translation model](E05-settings-fonts-and-optional-translation/stories/S4-manually-load-and-unload-the-translation-model/STORY.md)
- [S5 — Offer explicit Translate and handle unloaded state](E05-settings-fonts-and-optional-translation/stories/S5-offer-explicit-translate-and-handle-unloaded-state/STORY.md)
- [S6 — Execute a bounded translation request safely](E05-settings-fonts-and-optional-translation/stories/S6-execute-a-bounded-translation-request-safely/STORY.md)
- [S7 — Present, expand, copy, dismiss, and retry translation results](E05-settings-fonts-and-optional-translation/stories/S7-present-expand-copy-dismiss-and-retry-translation-results/STORY.md)

## Exit condition

Global preferences and installed fonts persist; ordinary reading and optional local translation work offline; manual Load/Unload, missing dependencies, cancellation, plain-text output, and error flows pass.
