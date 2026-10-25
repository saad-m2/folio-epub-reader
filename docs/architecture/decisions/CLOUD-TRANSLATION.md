# Optional cloud translation decision

Status: accepted and implemented in development, updated 2026-10-25. Real-account and packaged qualification remain outstanding. Applies to [E07](../../product/epics/E07-optional-cloud-translation.md) and the [requirements](../../product/CLOUD-TRANSLATION-REQUIREMENTS.md). The [local decision](LOCAL-TRANSLATION.md) continues to govern Ollama; the cloud fallback authorization below is its explicit exception for cloud requests.

## Problem and choice

Support user-owned Microsoft Translator and DeepL accounts for German-to-English selected-text translation. Keep normal reading local and independent of accounts. Use one main-process coordinator with independent cloud adapters and the existing local gateway. Keep cloud readiness separate from Ollama's model status and explicit Load/Unload.

Store credentials through Windows-protected Electron `safeStorage` encryption in SQLite's existing encrypted-secret storage. The renderer supplies newly entered credentials through a named, validated write-only intent; it receives only provider configuration flags and safe status. An unavailable/decryption-failed protected store is an error, never permission to store plaintext. Removal deletes app-owned credentials and account allowance metadata without touching books.

## Routing and lifecycle

The saved current provider is the starting provider. After confirmed exhaustion, switch to the first configured, eligible, unattempted provider in the fixed order Microsoft, then DeepL. Persist the switch before the next attempt and stay there until a manual switch or further exhaustion. There is no preferred provider, automatic return, or automatic local fallback.

One explicit Translate authorizes at most one attempt per cloud provider for that selection. Authentication failures, throttling, network failures, timeouts, and ambiguous vendor failures stop the chain. SDK/transport retries must not silently resubmit text. Selecting/configuring a provider never translates or loads Ollama. A manual local-to-cloud switch automatically unloads the local translation model before committing the provider; see the [local lifecycle and failure rules](LOCAL-TRANSLATION.md#switching-from-local-to-cloud).

Bind work to the registered selection, session, and request epoch. Before every attempt, state commit, and result publication, verify that the request is current and the selection/session is still valid. Manual provider changes, changed selection, closed books/sessions, credential updates/removal, renderer loss, and shutdown invalidate affected work. Use configuration/check revisions so a late availability check cannot change a replacement account. Cancellation prevents later work/results; it cannot retract text already sent.

Keep finite timeouts, bounded response bodies and normalized output, trusted provider endpoints without redirects, and main-process networking. Publication frames retain their sandbox, disabled scripts, absent bridge, and blocked network. Do not loosen renderer networking/CSP for this feature. Never log or persist source/result text or raw provider responses.

## Exhaustion and recovery

Use provider-specific documented evidence, not HTTP status guesses. Microsoft `403001` and DeepL `456` identify exhaustion. Neither account authentication nor ambiguous service errors prove exhausted allowance.

Persist exhaustion across restart. Do not assume monthly renewal or clear a one-time allowance after a timer. Explicit Check availability uses the DeepL usage API. For Microsoft the user approved a short fixed German translation probe, only on that manual action, with UI copy explaining its small allowance use. It never uses book text. This supersedes the initial planning assumption that all availability checks must avoid translation requests. Unknown checks preserve prior exhaustion. Recovery restores eligibility without changing the current provider or resubmitting a previous selection.

## Reader controls and retired-provider migration

The general **Reader settings** panel contains appearance preferences and a Translation section with service selection, status, and local Load/Unload. There are no separate top-right translation controls. Main Settings owns cloud credential forms, removal, setup guidance, and explicit availability checks. Switching service preserves the reading passage and invalidates the old selection/result; it never loads a model or submits text.

The owner removed Amazon Translate on 2026-10-25 because the investigated free signup path cannot use it within the agreed spending boundary. Migration on the first translation-provider state read deletes app-owned saved AWS credentials and allowance metadata. If AWS was current, clear the current-provider choice and require explicit selection of Microsoft, DeepL, or Ollama; never silently select/load local translation. The metadata migration upgrades version 1 to version 2, preserves supported credentials/allowances/current selection, and drops the retired ciphertext without decrypting it. It runs lazily so damaged cloud metadata cannot block ordinary app startup. Preserve reading data. The earlier AWS diagnostic is [historical evidence](../../release/QUALIFICATION.md#e07-cloud-translation), not a supported-provider qualification gate.

## Extending providers

The narrow main-process `CloudTranslationAdapter` interface provides `translate` and `checkAvailability`; the shared coordinator owns current-provider persistence, exhaustion-only fallback, cancellation, and stale-result protection. This isolates vendor networking and error mapping, but adding a provider is not entirely plug-and-play. A future approved integration must:

1. Establish provider-enforced free-cutoff eligibility and reliable exhaustion/recovery signals from official documentation; do not classify throttling or access denial as exhausted allowance.
2. Add an explicit provider ID/registry entry, validated write-only credential schema, and safe labels/status metadata in shared translation types. Stored provider metadata derives its keys from the supported-provider schema; review stored-state migration and fixed fallback order when changing that schema.
3. Implement the adapter behind the existing trusted-destination, bounded, cancellable main transport; retain sanitized failures and prohibit hidden translation retries.
4. Add account fields and setup/privacy guidance in main Settings; ensure Reader settings selects the registered configured provider without duplicating vendor logic.
5. Add adapter, storage/configuration, coordinator/fallback, bridge/security, and UI regressions, then perform isolated real-account qualification.

See [shared translation types](../../../src/shared/translation.ts), [adapter contract](../../../src/main/cloud-translation-types.ts), [coordinator](../../../src/main/translation-coordinator.ts), [adapters](../../../src/main/cloud-adapters.ts), and [account forms](../../../src/renderer/translation-settings.tsx). This extension path approves no additional provider.

## Tradeoffs and verification

Failing closed on ambiguous exhaustion can require manual recovery, but avoids sending the same text to additional companies after unrelated failures. Microsoft needs a tiny quota-consuming probe; DeepL exposes a text-free usage check. These provider differences stay inside adapters and setup guidance. Users remain responsible for retaining provider-enforced free cutoffs; paid credentials may incur charges.

Use controlled provider responses for routing/error/cancellation tests, real protected storage through isolated Electron qualification, and owned text for explicit real-provider checks. Simulated exhaustion is not evidence that an actual account exhausted. See the [qualification guide](../../release/QUALIFICATION.md) for outstanding checks and [development guide](../../workflow/AGENT-GUIDELINES.md#setup-and-commands) for commands.
