# Optional cloud translation requirements

Status: agreed product requirements, recorded 2026-10-24. Planning only; cloud translation is not implemented or qualified. This document records the requested extension to the existing [local translation behavior](../architecture/decisions/LOCAL-TRANSLATION.md), not a replacement for it.

## Provider setup and selection

- Users connect providers with their own accounts and API credentials. Leaf supplies no shared accounts, credentials, or hosted translation service.
- Users must configure accounts with provider-enforced free cutoffs. They are responsible for choosing and retaining those plans. Leaf does not verify account tiers or guarantee zero charges when paid credentials are supplied.
- Setup guidance must identify the appropriate free plan and distinguish a provider-enforced cutoff from a free allowance that automatically incurs paid overages.
- Settings allows users to select the active provider at any time. Only configured cloud providers can be selected; local Ollama remains a separate selectable option.
- Selecting a provider never submits book text. Translation starts only after the user selects text and explicitly presses **Translate**.
- Switching providers cancels or invalidates an in-progress translation and prevents its result from appearing. The new provider is used on the next explicit **Translate** action; switching does not resubmit the current selection.

## Automatic cloud fallback

- Every configured cloud provider is automatically eligible for fallback. There is no separate fallback opt-in and no user-managed provider priority order.
- Start with the user's active cloud provider. When it reports that its allowance is exhausted, automatically retry the same selected text with another configured, eligible cloud provider, without asking for another confirmation.
- Continue only while the original request and selection remain valid. Do not loop indefinitely or attempt the same provider repeatedly for one request.
- If no eligible cloud provider remains, show that cloud translation is unavailable because the connected allowances are exhausted.
- Distinguish allowance exhaustion from temporary rate limits, authentication failures, network errors, and timeouts. Those errors must not be treated as evidence of exhausted allowance.
- Expose the provider that produced the result so automatic switching is understandable.
- Track exhausted providers and their eligibility to resume according to the provider's actual allowance rules. Do not assume all allowances renew monthly.

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

Each company requires its own adapter. Basic text-translation operations generally work across that company's account tiers, with provider-specific endpoint, authentication, feature, and quota differences handled inside the adapter. No billing-plan verification is required by this feature.

Relevant areas: [translation gateway](../../src/main/translation.ts), [main IPC](../../src/main/index.ts), [contracts](../../src/shared/contracts.ts), [preload](../../src/preload/index.ts), [reader](../../src/renderer/reader.tsx), and [settings](../../src/renderer/settings.tsx).

## Provider candidates and remaining decisions

The initial provider list has not been finalized. Candidates discussed are:

| Provider / plan | Planning basis as of 2026-10-24 |
| --- | --- |
| Microsoft Translator F0 | Recurring 2 million characters per subscription month, with requests stopped at the free limit. See [official FAQ](https://www.microsoft.com/en-us/translator/business/faq/). |
| DeepL API Developer | One-time 1 million characters; further translation requires upgrading. Existing legacy API Free accounts have 500,000 characters per month, but that plan is closed to new signups. See [official plans](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans). |
| AWS Free account plan | Temporary Free-plan access stops when credits run out or the plan expires. A paid AWS account with a free usage allowance does not provide the same spending boundary. See [Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/). |

Provider offers can change. Recheck official setup and API documentation during implementation; the table is a dated planning reference, not a guarantee of current eligibility or pricing.

Still to decide before implementation:

- Final initial provider list and language scope. Current production translation remains German to English; broader language support has not been approved.
- The internal choice of the next eligible cloud provider, without adding user-managed ordering.
- Whether automatic fallback changes the saved active provider, and whether a preferred provider is automatically restored after its allowance renews.
- Behavior for errors other than confirmed allowance exhaustion, and provider-specific reset detection when no reliable reset time is available.

Implementation must update the [product definition](PRODUCT.md), architecture decision, setup guidance, and relevant UI copy. Verify routing, provider switching, cancellation, exhaustion/reset handling, unavailable providers, credential handling, and existing Ollama behavior before claiming the feature complete. No cloud runtime checks have been performed for this planning document.
