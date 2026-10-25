# C09 — Show translation status, attribution, and recovery

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (updated 2026-10-25). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C06–C08.

## User story

As a reader, I want to understand which provider is translating my selection and recover from failures without losing my reading place.

## Acceptance criteria

- The general **Reader settings** panel contains appearance preferences and a Translation section with service selection, status, and local Load/Unload. Remove separate top-right translation controls. Distinguish cloud configuration/readiness from local model status; cloud translation does not require a local model load. Credential forms remain in main Settings.
- Selection alone never translates. An explicit Translate opens the existing anchored pending/result surface promptly; fallback progress identifies the provider being tried and the reason for switching in plain language.
- A successful result names the provider that produced it. Keep bounded plain-text rendering and the existing expanded, copy, dismiss, and explicit retry behavior; provider output never becomes HTML or executable content.
- Failures distinguish exhausted allowances, temporary rate limits, authentication/setup issues, network failures, timeouts, and unknown availability. Offer appropriate manual retry, provider selection, or Check availability guidance without automatic non-exhaustion retries.
- Manual provider changes or stale selection/session invalidation remove or invalidate old results and prevent late updates. Reader navigation, appearance, and reading-position behavior remain intact.
- Settings explains that all connected cloud providers may receive the selected text during exhaustion fallback and that the newly selected provider remains current. Do not imply automatic restoration of a preferred provider.
- Keyboard access, visible focus, accessible names/status announcements, and narrow-window behavior cover the new controls without stealing focus on every fallback update.

## Verification

Inspect main Settings, the general Reader settings panel, and reader pending/success/fallback/error states using controlled adapters. Verify both appearance and translation controls in the shared panel, focus restoration/Escape, and wide/narrow layouts. Exercise keyboard selection/Translate, retry, expanded result/copy/dismiss, manual switching, and navigation while pending. Confirm attribution is correct after fallback and bounded malicious-looking output is displayed only as text.
