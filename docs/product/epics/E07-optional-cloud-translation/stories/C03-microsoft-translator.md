# C03 — Translate with Microsoft Translator

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (2026-10-24). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C02; research may start earlier.

## User story

As a reader with my own Microsoft Translator account, I want to translate selected German text into English and receive an accurate explanation when the service is unavailable.

## Acceptance criteria

- Recheck official API and account documentation during implementation. Record the supported resource/region setup, provider-enforced free cutoff instructions, authentication, exact exhaustion signals, renewal rules, and usage/status capabilities and the approved manual fixed-phrase probe with source links and research date.
- Implement a dedicated adapter using main-owned credentials, fixed German-to-English parameters, trusted HTTPS destinations, bounded input/output, timeout, and cancellation.
- Map provider responses into C02 states. Distinguish exhausted allowance from throttling, authentication/configuration errors, and service failures using documented evidence; do not infer exhaustion from HTTP status alone when ambiguous.
- Report reliable reset/availability information when supported and unknown when unavailable. A working key or reachable service does not prove remaining allowance.
- Preserve paragraph content in bounded plain-text results. Do not expose raw vendor errors, credentials, source text, or raw responses in diagnostics.
- State any unsupported requirement explicitly rather than silently relaxing the free-cutoff or fallback rules.

## Verification

Test representative success, exhaustion, rate limit, bad credentials/region, network failure, timeout, cancellation, malformed/oversized responses, and availability/reset parsing using controlled fixtures. Record an explicit real-account German-to-English smoke check separately from simulated errors; use owned test text and exclude credentials/text from evidence.
