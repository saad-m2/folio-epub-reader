# Set up optional cloud translation

This guide describes the E07 development implementation, not a claim that a published installer contains it or that real-account qualification is complete. See the [delivery status](epics/E07-optional-cloud-translation.md).

Reading does not need an account or an internet connection. Cloud translation needs your own provider account and sends the selected German text to that provider for English translation. All connected cloud providers can be used automatically after confirmed allowance exhaustion. Leaf supplies no credentials and cannot guarantee zero charges if you connect paid credentials. Choose and retain a provider-enforced free cutoff, not a paid plan that merely includes a free allowance.

## Connect and select

Open **Settings → Translation**, enter the provider's credentials, and save. Saved credentials are encrypted using Windows-protected storage and never displayed again. To replace them, enter new credentials. Removing a provider removes its saved credentials and allowance state on this device.

Connecting an account does not select it. Choose the provider you want to use now, then select German text in a book and press **Translate**. Local Ollama is the default and remains available independently. Selecting Ollama does not load it; use its separate Load control.

While reading, open the general **Reader settings** panel (formerly the appearance panel), then its **Translation** section. It contains the service picker, status, and local Load/Unload alongside appearance preferences. Use **Translation service** there to switch between local Ollama and connected Microsoft, ZPK, Lara, Traduck, or DeepL accounts; separate top-right translation controls are removed. The book stays open at the same passage. Switching cancels pending translation and clears the old selection/result; select text again and press Translate. Switching from Ollama to cloud automatically unloads the local translation model. If unloading fails, Leaf keeps the previous service and asks you to retry; stopped or uninstalled Ollama does not block cloud selection. Selecting Ollama still requires a separate Load action. See the [model lifecycle rules](../architecture/decisions/LOCAL-TRANSLATION.md#switching-from-local-to-cloud) for failure behavior and shared-runtime limits. Connect new accounts or replace credentials in Settings.

The current provider is saved across restarts and is tried first. After exhaustion, Leaf switches to another configured provider in its built-in order **Microsoft → ZPK → Lara → Traduck → DeepL**, saves that provider, and stays there. Recovered providers never automatically take over. Explicit temporary rate limits, authentication errors, timeouts, and network failures stop with guidance; retry or switch manually. If all connected allowances are exhausted, Leaf does not load or switch to Ollama.

For an unclear ZPK/Lara translation failure, Leaf tries the fixed sentence **Guten Tag.** once. If that also fails without a recognized explicit cause, Leaf assumes the free allowance is exhausted and falls back. This owner-approved assumption can also classify an unclear service outage as exhausted; use **Check availability** to recover. A successful test does not replace the requested translation or automatically resend your selected text. These tests consume a small amount of allowance and never send additional book text.

## Microsoft Translator

Create a Translator resource using the provider-enforced F0 free tier. Copy its key and, when the resource requires it, its region into Settings. Use the resource's region identifier, not a URL. The documented F0 limit is tied to the subscription month, so Leaf does not invent a calendar-month reset date. Check the [Microsoft FAQ](https://www.microsoft.com/en-us/translator/business/faq/) and [authentication instructions](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/authentication) for current availability/setup.

**Check availability sends a short fixed German test phrase to Microsoft and consumes a small amount of allowance.** It sends no book text. This happens only when you explicitly press the check action, never on launch, account save, provider selection, or a background timer. A successful check makes the provider eligible again without changing your current provider.

## ZPK

Create a [ZPK account](https://zpk.systems/en/docs/api/zpk-translate), validate it, and create an application in its dashboard. Enter the application's **Application ID** and **API key**. ZPK documents 600,000 free characters/month and no-card signup, then use of account credit. Keep the account unfunded to retain a provider-enforced spending boundary; added credit can be consumed after the free quota. See the [API documentation](https://zpk.systems/en/api-docs/view/zpk-translate.phtml).

Check availability sends only **Guten Tag.** and consumes a small amount of allowance. An unclear failed check is treated as exhausted under the approved assumption. Successful checks restore eligibility without selecting the provider or resubmitting book text.

## Lara Translate

Choose the **Free plan / Lara Standard** and generate an **Access key ID** and **Access key secret** in the account's API credentials section. Enter both in Settings. The [developer pricing](https://developers.laratranslate.com/docs/pricing-page) documents 10,000 characters/month shared with language identification. The [500,000-character offer](https://laratranslate.com/adaptive-translation-api) is a separate one-time sales offer, not the automatic signup allowance. Retain Free rather than upgrading to usage-billed service.

Check availability sends only **Guten Tag.** and consumes a small amount of allowance; unclear failures are treated as exhausted. Leaf uses plain-text faithful translation with reasoning/cache disabled and the provider's no-trace request header. Provider policies still apply.

## Traduck

Create a [Free account](https://traduck.com/pricing), then generate a key under **Account → API Keys** and enter it in Settings. The documented free API allowance is **200 requests/month**, shared with website use. It stops at quota until renewal or an explicit plan upgrade. A word and a longer selection each use one request; Leaf keeps its existing 5,000-character selection limit. See [API documentation](https://traduck.com/api-docs).

Check availability sends **Guten Tag.** and consumes **one request**. It runs only on your explicit action. A successful check restores eligibility; neither checks nor calendar changes automatically select a recovered provider.

## DeepL

Create a DeepL API account, rather than a subscription that only covers DeepL's website/app, and enter its API key. Leaf chooses between DeepL's fixed free and standard API hosts from the key; arbitrary endpoint URLs are not accepted. Consult the [current API plans](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans) before connecting: the recorded Developer allowance is one-time, while legacy API Free accounts have different renewal behavior. Leaf does not assume every allowance renews monthly.

Check availability calls DeepL's usage API without translation text. Account and reported key-specific limits both matter, and provider usage reporting may lag. A successful check does not switch the current provider or submit an old selection.

## Retired Amazon Translate accounts

Amazon Translate was removed by the owner on 2026-10-25 because the investigated free signup path cannot use it within the agreed spending boundary. It is no longer offered for setup, selection, checks, or fallback. When translation-provider state is first read, Leaf removes its saved app-owned credentials and allowance metadata. If AWS was current, choose Microsoft, DeepL, or local Ollama explicitly; no local model is loaded automatically. Your other provider accounts and reading data are retained. The earlier AWS trial is recorded only as [historical qualification evidence](../release/QUALIFICATION.md#e07-cloud-translation).

## Privacy and recovery

Only the bounded selection and necessary translation parameters are sent for translation. Leaf does not add book title, author, surrounding passage, or device identity as translation context. Results remain temporary plain text; Leaf does not save or log selected/translated text or raw provider responses. The providers' own account/data policies still apply.

Changing selection, closing a book, changing provider, or replacing/removing credentials invalidates pending work and prevents stale results or further fallback attempts. Cancellation cannot recall text already sent to a provider. Availability recovery never automatically resumes an old selection. Select text and explicitly press Translate when ready.

Credential-storage errors require reconnecting or fixing Windows-protected storage; Leaf never falls back to plaintext. Unknown availability means Leaf could not establish recovery. Check the provider account or configuration rather than assuming a reset or free balance.
