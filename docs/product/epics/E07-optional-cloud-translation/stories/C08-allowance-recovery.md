# C08 — Recover exhausted providers without sending book text

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (updated 2026-10-25). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C07.

## User story

As a reader, I want to check whether an exhausted account is usable again without sending book text or changing my current provider. Microsoft may send a short fixed test phrase, as explicitly approved by the user; its UI must explain the allowance use.

## Acceptance criteria

- Persist bounded exhaustion metadata per configured account, including only reliable reset information. Do not assume a monthly renewal for every provider or lose exhaustion state on restart.
- Restore eligibility according to verified provider-specific renewal rules. One-time or expired allowances stay exhausted until supported evidence establishes recovery or the account configuration changes.
- Where reset timing is unknown, expose an explicit Check availability action. DeepL uses its supported usage API. Microsoft sends a short fixed test phrase only after the manual action, with UI copy explaining the small allowance use. Checks never send book text or load Ollama; never run the Microsoft probe in the background.
- Represent available, still exhausted, and unknown/inconclusive separately. Authentication success alone is not evidence of remaining allowance; a failed/unsupported check leaves exhaustion in place with an explanation and appropriate account/setup guidance.
- Do not clear exhaustion after an arbitrary cooldown. Do not repeatedly poll unknown availability in the background.
- A successful check restores eligibility only. It never changes the current provider, translates a prior selection, or automatically returns to a recovered provider.
- Checks use finite timeout, cancellation, validated main-process operations, and sanitized errors. Removed/replaced credentials invalidate late check results for the old account.

## Verification

Use controlled clocks and provider responses to cover known renewals, one-time allowances, unknown reset times, positive/negative/inconclusive checks, check failure, restart, and credential replacement races. Assert that only Microsoft's explicit manual check calls a translation endpoint, always with the fixed phrase; no check sends selected text, switches provider, or loads a model.
