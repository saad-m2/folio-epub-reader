# C04 — Translate with DeepL

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (2026-10-24). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C02; research may start earlier.

## User story

As a reader with my own DeepL API account, I want to translate selected German text into English and understand when its allowance is exhausted.

## Acceptance criteria

- Recheck official API and account documentation during implementation. Record currently available free-cutoff setup, any supported legacy account differences, authentication/endpoint selection, exact exhaustion signals, allowance renewal or one-time limits, and text-free usage APIs with source links and research date.
- Implement a dedicated adapter using main-owned credentials and trusted provider endpoints. Any endpoint variation is a validated provider-specific setting, not an arbitrary caller URL.
- Fix translation direction to German to English; enforce bounded input/output, finite timeout, cancellation, and plain-text results.
- Normalize success, confirmed exhaustion, throttling, invalid credentials, service/network failures, timeout, and invalid output into C02 states. Do not equate all rejected requests with exhaustion.
- Distinguish recurring allowances from one-time allowances. A one-time allowance must not become eligible merely because a month elapsed. Availability checks use supported text-free APIs where possible.
- Do not expose secrets or raw provider responses, or persist/log selected or translated text. Record unsupported requirements explicitly.

## Verification

Test success, quota and rate-limit distinctions, endpoint/account variants, malformed/oversized output, cancellation, timeout, and usage/reset handling with controlled fixtures. Record a separate real-account German-to-English smoke check with owned text and sanitized evidence.
