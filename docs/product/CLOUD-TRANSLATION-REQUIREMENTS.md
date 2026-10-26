# Optional cloud translation requirements

Status: agreed product requirements, updated 2026-10-25. Implemented in the development tree with automated coverage; real-provider and release qualification remain outstanding. This document records the extension to the existing [local translation behavior](../architecture/decisions/LOCAL-TRANSLATION.md), not a replacement for it.

Delivery is tracked in [E07 — Optional cloud translation](epics/E07-optional-cloud-translation.md), with implementation stories and acceptance criteria. The initial implementation supported Microsoft Translator and DeepL. The owner approved adding ZPK, Lara Translate, and Traduck on 2026-10-26, for German-to-English translation only. Real-account qualification of these additions remains outstanding.

## Provider setup and selection

- Users connect providers with their own accounts and API credentials. Leaf supplies no shared accounts, credentials, or hosted translation service.
- Users must configure accounts with provider-enforced free cutoffs. They are responsible for choosing and retaining those plans. Leaf does not enforce account tiers or guarantee zero charges when paid credentials are supplied.
- Setup guidance must identify the appropriate free plan and distinguish a provider-enforced cutoff from a free allowance that automatically incurs paid overages.
- Settings and the in-book **Reader settings / Translation** section allow users to select the active provider at any time without closing the book. Only configured cloud providers can be selected; local Ollama remains a separate selectable option. Credential setup and removal remain in the main Settings screen. The general Reader settings panel also holds translation status and local Load/Unload controls alongside appearance; separate top-right translation controls are removed.
- The active provider is the current provider, not a preferred provider. Save it across restarts. Automatic fallback changes this saved current provider; it stays selected until the user changes it or its allowance also runs out. Recovering another provider never automatically switches back to it.
- Selecting a provider never submits book text. Translation starts only after the user selects text and explicitly presses **Translate**.
- Manually switching providers cancels or invalidates an in-progress translation and prevents its result from appearing. The new provider is used on the next explicit **Translate** action; manual switching does not resubmit the current selection. Automatic exhaustion fallback follows the separate authorization below.

## Automatic cloud fallback

- Every configured cloud provider is automatically eligible for fallback. There is no separate fallback opt-in and no user-managed provider priority order.
- Start with the user's active cloud provider. When it reports that its allowance is exhausted, automatically retry the same selected text with another configured, eligible cloud provider, without asking for another confirmation.
- Use a fixed built-in fallback order, skipping unconfigured, exhausted, and already attempted providers: **Microsoft Translator → ZPK → Lara → Traduck → DeepL**. The current provider is always tried first. There is no separate preferred-provider setting.
- Continue only while the original request and selection remain valid. Do not loop indefinitely or attempt the same provider repeatedly for one request.
- If no eligible cloud provider remains, show that cloud translation is unavailable because the connected allowances are exhausted.
- Distinguish allowance exhaustion from temporary rate limits, authentication failures, network errors, and timeouts. Those errors must not be treated as evidence of exhausted allowance.
- For explicit non-exhaustion errors, stop and show the error; the user may explicitly retry or manually switch providers. Do not automatically retry or move to another provider. Owner-approved exception: an unclear ZPK/Lara translation service failure authorizes one fixed `Guten Tag.` diagnostic, subject to selection/session/cancellation checks. If that also fails unclearly, assume exhaustion, persist it, and fall back. This inference is not confirmed quota evidence. Explicit auth/throttle/network/timeout/invalid-request/output/cancellation failures stop even during the diagnostic. A successful diagnostic never replaces the original result or resubmits selected text.
- Expose the provider that produced the result so automatic switching is understandable.
- Track exhausted providers and their eligibility to resume according to the provider's actual allowance rules. Do not assume all allowances renew monthly.
- If no reliable reset time is available, offer an explicit **Check availability** action that sends no book text. DeepL uses its usage API; Microsoft, ZPK, Lara, and Traduck send a short fixed test phrase. Explain allowance use, including one whole request for Traduck. Never run availability checks in the background. ZPK/Lara unclear failed checks are treated as exhausted under the approved assumption; explicit errors and unknown checks do not clear exhaustion. Do not silently clear exhaustion after a cooldown. Recovery only restores fallback eligibility; it does not change the current provider or resume a previous translation.

This explicitly extends the current local decision's rule against automatic resubmission: one explicit **Translate** action may authorize the same selection to be attempted across configured cloud providers following confirmed allowance exhaustion. Selection alone still sends nothing.

## Ollama remains independent

- Preserve the existing supported model, explicit Load/Unload actions, status checks, and selected-text translation behavior.
- Ollama is used only when the user selects the local option. It is never an automatic fallback from a cloud provider.
- Selecting Ollama does not load the model. The user must explicitly load it before translating, as today.
- Exhausting cloud allowances must not load Ollama or send text to it.

## Security and data boundaries

- Keep credentials, provider requests, and routing in main. Use named, validated preload intents with sender and active-session checks; publication frames receive no bridge or general network access.
- Store saved credentials using Windows-protected encryption. Never expose saved secrets to publication content or include them in logs or user-facing errors.
- Send only the bounded selected text and necessary translation parameters. Preserve cancellation and stale-result protection when selections, books, sessions, or providers change.
- Keep results bounded and render them as plain text. Do not persist or log selected text, translated text, or raw provider responses.
- Explain during setup that cloud translation sends selected text to connected providers, including automatic fallback. Local translation retains its on-device behavior.

## Implementation direction

Use a main-process translation coordinator with one adapter per cloud provider and an independent adapter for the existing local gateway. Normalize provider responses into shared success and failure states so the reader UI does not depend on vendor response formats. Keep local model lifecycle operations separate from cloud readiness.

Each company requires its own adapter. Provider-specific endpoint, authentication, feature, and quota differences stay inside the adapter. Adding a provider also requires an explicit supported-provider registry/configuration schema, account form/setup guidance, and tests; adapters are not automatically discovered. No additional provider is approved by this extension mechanism.

Relevant areas: [translation gateway](../../src/main/translation.ts), [main IPC](../../src/main/index.ts), [contracts](../../src/shared/contracts.ts), [preload](../../src/preload/index.ts), [reader](../../src/renderer/reader.tsx), and [settings](../../src/renderer/settings.tsx).

## Approved providers and implementation research

The first release includes both cloud providers below. The plan descriptions remain a dated research reference:

| Provider / plan | Planning basis as of 2026-10-24 |
| --- | --- |
| Microsoft Translator F0 | Recurring 2 million characters per subscription month, with requests stopped at the free limit. See [official FAQ](https://www.microsoft.com/en-us/translator/business/faq/). |
| DeepL API Developer | One-time 1 million characters; further translation requires upgrading. Existing legacy API Free accounts have 500,000 characters per month, but that plan is closed to new signups. See [official plans](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans). |

Provider offers can change. Recheck official setup and API documentation during implementation; the table is a dated planning reference, not a guarantee of current eligibility or pricing.

Scope decision, 2026-10-25: the owner removed Amazon Translate because the investigated free signup path cannot use it within the agreed spending boundary. AWS is no longer a supported provider, fallback target, or required qualification item. Migration on the first translation-provider state read removes saved app-owned AWS credentials and allowance metadata; if AWS was current, require an explicit selection of Microsoft, DeepL, or local Ollama without automatically loading a model. Preserve other provider configuration and reading data. See the [dropped C05 story](epics/E07-optional-cloud-translation/stories/C05-amazon-translate.md) and [historical diagnostic evidence](../release/QUALIFICATION.md#e07-cloud-translation).

Current scope: German to English; Microsoft, ZPK, Lara, Traduck, and DeepL plus independent local Ollama; fixed internal fallback ordering; persistent current-provider switching; quota-consuming manual availability checks except DeepL; the explicit ZPK/Lara unclear-error inference above; and user-driven recovery for explicit non-exhaustion errors. See the [setup guide](CLOUD-TRANSLATION-SETUP.md) for new-provider credentials and current free allowances. The earlier two-provider planning table remains dated historical research, not the full supported registry.

Provider stories must establish current authentication/setup requirements, reliable exhaustion signals, allowance renewal rules, and whether a text-free availability check is supported. Authentication success alone does not prove remaining allowance. Record limitations rather than inventing reset times or treating ambiguous errors as exhaustion. Any provider that cannot meet the agreed behavior needs an explicit scope decision before the epic can be declared complete.

The [product definition](PRODUCT.md), [architecture decision](../architecture/decisions/CLOUD-TRANSLATION.md), [setup guidance](CLOUD-TRANSLATION-SETUP.md), and UI copy describe the development implementation. Automated checks cover routing, provider switching, cancellation, allowance handling, unavailable providers, credential handling, and existing gateway regressions. See [E07 status](epics/E07-optional-cloud-translation.md) and [qualification](../release/QUALIFICATION.md#e07-cloud-translation) for actual evidence and outstanding real-account checks.
