# Cloud provider API implementation notes

Current Microsoft/DeepL implementation notes updated 2026-10-25. Applies to the [cloud requirements](../../product/CLOUD-TRANSLATION-REQUIREMENTS.md) and [E07](../../product/epics/E07-optional-cloud-translation.md). The adapters and controlled tests described here do not establish real-account qualification, translation quality, or account eligibility.

## Shared transport and safety

The [cloud adapters](../../../src/main/cloud-adapters.ts) use one main-process fetch attempt per operation, trusted HTTPS destinations, rejected redirects, finite timeout/cancellation, a 256 KiB streamed response cap, and a 20,000-character normalized plain-text output cap. Output normalizes line endings and strips control characters consistently with the local gateway, retaining tabs and newlines. They enforce the existing 5,000-character selection cap, send only the selection with fixed German-to-English parameters, and return bounded failure codes without vendor messages or credentials. No SDK performs hidden translation retries. Allowance checks do not automatically run in the background.

The initial adapters do not emit an allowance `resetAt`: provider/plan differences and incomplete reset evidence make manual checks the supported recovery path. A plan expiration date is an exhaustion boundary, not a future allowance renewal. No timer silently restores these providers or changes the current provider.

## Microsoft Translator

Use the global `api.cognitive.microsofttranslator.com` endpoint, API version 3.0, fixed `from=de`, `to=en`, and `textType=plain`. Authentication uses a subscription-key header with an optional validated region header; regional resource keys require the matching region. See [Microsoft authentication](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/authentication).

Only an HTTP 403 response containing numeric `error.code: 403001` is confirmed free-quota exhaustion. Other 403 responses remain authorization errors; 429 is throttling. See [response codes](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/status-response-codes). The [official FAQ](https://www.microsoft.com/en-us/translator/business/faq/) says the F0 service stops at its free subscription-month allowance and resumes the next subscription month. The adapter does not guess the account's reset date.

The user approved a manual **Check availability** exception: it submits only the fixed phrase `Guten Tag.`, never the registered book selection. This consumes a small amount of allowance and may be billable with paid credentials. A well-formed successful English translation establishes current availability; confirmed 403001 establishes exhaustion; other failures retain their normal error category. There is no automatic probe or sample retry. This replaces a text-free-only check for Microsoft because no suitable subscription-key-only usage endpoint was established during research. The [Azure management usage API](https://learn.microsoft.com/en-us/rest/api/microsoftfoundry/accountmanagement/accounts/list-usages?view=rest-microsoftfoundry-accountmanagement-2025-06-01) requires separate management-plane authentication and resource identifiers; it is outside the initial setup.

## DeepL

Use `POST /v2/translate`, header authentication with `DeepL-Auth-Key`, one selected text, `source_lang: DE`, `target_lang: EN`, and `preserve_formatting: true`. Keys ending in `:fx` use `api-free.deepl.com`; other keys use `api.deepl.com`. No caller-provided destination is accepted. See [authentication](https://developers.deepl.com/docs/getting-started/auth) and [translation parameters](https://developers.deepl.com/api-reference/translate/request-translation).

HTTP 456 means exhausted character quota; 429/529 mean throttling, and 403 means authentication failure. The adapter does not follow vendor retry suggestions automatically. See [DeepL error messages](https://support.deepl.com/hc/en-us/articles/9773964275868-DeepL-API-error-messages).

The text-free `GET /v2/usage` check compares account character usage with its limit and, when returned, API-key usage with its separate limit. The current reference specifies `1000000000000` for an unconfigured account/key limit; this finite sentinel is accepted. It does not document `-1` as an unlimited limit, so a negative value remains unknown rather than assuming availability. Missing or malformed quota fields cannot establish availability. Usage can lag by minutes, so a positive check does not guarantee that the next translation succeeds. See [usage response fields](https://developers.deepl.com/api-reference/usage-and-quota/check-usage-and-limits).

The [plan guide](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans) describes the Developer allowance as one-time, while legacy API Free renews monthly and is closed to new purchases. The adapter never clears exhaustion solely because a calendar month elapsed. Setup must use the current account's API key and explain its actual provider-enforced cutoff; Leaf does not validate billing tier.

## Retired AWS trial (historical)

The owner removed Amazon Translate on 2026-10-25 because the investigated free signup path could not use it within the agreed spending boundary. The trial adapter, account preflight, and signer are no longer supported capabilities. Do not use their earlier setup or qualification requirements as current instructions. Migration on the first translation-provider state read deletes app-owned saved AWS credentials/allowance metadata and clears AWS as current, requiring an explicit supported-provider choice without loading Ollama.

The trial diagnostic authenticated to the read-only account-plan API and received available allowance, while a fixed synthetic TranslateText request was explicitly denied by an SCP. This established that account allowance and service permission are independent; it did not qualify successful AWS translation. See the retained [diagnostic evidence](../../release/QUALIFICATION.md#e07-cloud-translation) and [dropped C05 story](../../product/epics/E07-optional-cloud-translation/stories/C05-amazon-translate.md).

## Qualification and future integration

[Adapter tests](../../../tests/cloud-adapters.test.ts) simulate Microsoft/DeepL successes, precise exhaustion signals, throttling, authentication, cancellation/timeouts, malformed/oversized responses, and availability checks. Real Microsoft/DeepL accounts, provider-enforced free setup, allowance reporting, and literary German-to-English quality remain qualification work. Real Ollama/offline and release checks are tracked separately.

For the maintained provider-extension workflow, see [Extending providers](CLOUD-TRANSLATION.md#extending-providers). No additional provider is approved merely because the adapter interface can support one.
