# C02 — Coordinate translation safely in main

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (2026-10-24). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C01.

## User story

As a reader, I want translation requests to follow my current selection and provider so that cancelled or outdated requests cannot display results or send further text.

## Acceptance criteria

- Introduce a main-process coordinator with normalized provider success, confirmed exhaustion, rate-limit, authentication, network, timeout, cancellation, and invalid-output states. Unknown errors are not exhaustion.
- Keep the existing local gateway independent; cloud readiness does not imply a loaded Ollama model and local Load/Unload does not configure or select a cloud account.
- Expose only named, schema-validated intents for configuration/status, selection, availability checks, request-scoped progress, and translation. Validate sender authorization and active publication/session ownership where applicable. Saved credentials and vendor payloads stay in main.
- Translate resolves the registered selection in main; reject stale IDs, empty/oversized selections, and unauthorized sessions before networking. Preserve the existing 5,000-character selection limit and enforce a finite output/body limit.
- Provider requests use bounded timeouts, cancellation, and trusted provider destinations with no arbitrary redirects. Do not send book metadata, surrounding context, or device identifiers as translation input.
- Selection changes, book close/replacement, session loss, manual provider changes, relevant credential changes, and shutdown cancel/invalidate the request. Check validity before further attempts, state commits, and result publication. Cancellation cannot retract text already sent to a provider.
- Keep source/result text temporary and output plain text. Disable transport/SDK automatic translation retries so the coordinator's exhaustion-only retry rule remains authoritative.

## Verification

Use controlled adapters to test safe error normalization, limits, timeouts, unauthorized calls, and late responses after each invalidation event. Include a delayed response racing with a manual provider switch and verify that neither the result nor saved provider is overwritten. Run relevant contracts/security and existing local translation regressions.
