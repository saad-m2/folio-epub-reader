# C07 — Switch cloud providers after allowance exhaustion

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (updated 2026-10-25). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C03, C04, C06.

## User story

As a reader, I want Leaf to continue my requested translation with another connected cloud provider when the current provider runs out, then stay on that provider.

## Acceptance criteria

- Begin with the current cloud provider. Confirmed allowance exhaustion or the owner-approved ZPK/Lara diagnostic inference authorizes automatic switching and resubmission of the same selected text. The [current architecture decision](../../../../architecture/decisions/CLOUD-TRANSLATION.md#exhaustion-and-recovery) records the 2026-10-26 exception and its limits.
- Choose the next eligible unattempted provider from Microsoft Translator, ZPK, Lara, Traduck, then DeepL. Skip unconfigured, known exhausted, and already attempted providers. Never include Ollama.
- Try each provider at most once per explicit Translate action. If the current provider is already known exhausted, skip its network attempt and choose another eligible provider for that explicit action.
- When valid fallback selects a provider, persist it as current before the attempt. Stay there after success or a non-exhaustion error; further confirmed exhaustion may switch again. Do not restore an earlier provider when it recovers.
- Stop immediately on explicit authentication errors, temporary rate limits, network failures, timeouts, invalid requests/output, or cancellation. For an unclear ZPK/Lara service failure only, send one fixed `Guten Tag.` diagnostic after validating the selection/session. A second unclear failure is assumed exhausted and persists; an explicit diagnostic failure stops, and diagnostic success never substitutes for or resubmits selected text. Other ambiguous provider errors stop.
- Recheck request/selection/session/configuration validity before every attempt and state commit. Manual switching, changed selections, or book/session closure stop the chain; late responses cannot send more text or overwrite the current provider.
- When no eligible configured provider remains, show that connected cloud allowances are exhausted/unavailable without loading Ollama or looping. Preserve the last current provider; do not invent an eligible replacement.
- Expose routing progress and the provider responsible for success or failure through normalized state for C09.

## Verification

Cover every starting provider, partial configuration, all-exhausted state, repeated exhaustion, bounded attempt counts, fallback followed by non-exhaustion failure, cancellation between attempts, and restart persistence. Include DeepL exhausted → Microsoft selected → DeepL recovered → Microsoft remains current, and Microsoft exhausted → DeepL exhausted → no cloud provider eligible. Retired AWS state must never reintroduce an AWS attempt. Assert request contents, destinations, and absence of Ollama calls.
