# E07 — Optional cloud translation

Status: implemented in the development tree, with qualification in progress; scope updated 2026-10-25. Real-provider and packaged qualification remain outstanding; the epic is not complete. This is the active delivery plan for the [agreed requirements](../CLOUD-TRANSLATION-REQUIREMENTS.md); archived E01–E06 plans remain historical.

## Outcome and scope

Readers can translate selected German text into English using their own Microsoft Translator, ZPK, Lara Translate, Traduck, or DeepL account. The owner approved the three additions on 2026-10-26, together with the [ZPK/Lara unclear-error diagnostic inference](../../architecture/decisions/CLOUD-TRANSLATION.md#exhaustion-and-recovery); real-account qualification remains outstanding. Ordinary reading remains local and independent of translation setup. Existing Ollama translation remains a separate, manually selected option with explicit Load/Unload.

All five supported cloud adapters require qualification. C03/C04 below describe the initial two adapters; the 2026-10-26 expansion is governed by the current requirements and API notes. C05 (Amazon Translate) was dropped by the owner on 2026-10-25 after the free-account trial; AWS is not a remaining implementation or qualification requirement. Broader language selection, hosted/shared credentials, billing-plan verification, app-enforced spending guarantees, user-managed fallback ordering, translation history, and automatic fallback to Ollama are outside this epic.

## Agreed routing behavior

- The saved active provider is simply the current provider. There is no preferred provider and no automatic return to an earlier provider.
- Start with the current provider. After confirmed or approved inferred exhaustion, choose the first eligible, unattempted configured provider from **Microsoft Translator → ZPK → Lara → Traduck → DeepL**. This order is a delivery default, not a quality or cost ranking.
- When fallback selects the next provider, save that provider as current before its attempt. It remains current even if that attempt encounters a non-exhaustion error. Do not change provider state from a cancelled or superseded request.
- One explicit Translate authorizes the bounded fallback chain for that selection. Each provider is attempted at most once; check selection/session/provider validity before every attempt and result publication.
- Explicit network/authentication/timeout/temporary-rate-limit/invalid-request/output failures stop the request. Only unclear ZPK/Lara service failures authorize one fixed `Guten Tag.` diagnostic; a second unclear failure is assumed exhausted and persists. This is a product heuristic, not verified quota evidence. Diagnostic success leaves the original translation failed without resubmission. Retrying or manually changing provider otherwise requires user action.
- Exhaustion state survives restarts. Renewal recovery uses manual Check availability, not an invented monthly timer. DeepL reads usage; Microsoft, ZPK, Lara, and Traduck use a fixed sentence with allowance-use copy. No background availability checks run. Inconclusive checks preserve exhaustion; unclear ZPK/Lara checks are classified under the approved inference. Recovery neither changes the current provider nor resubmits book text.
- If the current provider is already known exhausted, an explicit Translate can start fallback without resending text to that provider. If none remain, explain that no connected allowance is available. Selecting a provider never translates text. Manual Microsoft/ZPK/Lara/Traduck availability checks send a fixed sentence and consume allowance; DeepL reads usage. No background recovery timer runs. The ZPK/Lara diagnostic is the only automatic fixed-sentence exception.
- New installations retain the local option by default. Connecting a cloud account alone does not select it. If the current cloud account is removed, require an explicit provider choice before the next translation; do not silently select or load Ollama.

## Stories and dependencies

C01–C04 and C06–C09 have development implementations; C05 is dropped. The 2026-10-25 AWS-removal migration and general Reader settings arrangement have automated regression coverage; revised isolated real Electron UI/proof/corpus checks pass. C10 is partially verified; required real-provider/real-model and release checks remain outstanding. Each linked story records its status and acceptance criteria; C10 owns integrated qualification.

| Story | Deliverable | Depends on |
| --- | --- | --- |
| [C01](E07-optional-cloud-translation/stories/C01-secure-provider-configuration.md) | Secure provider configuration | None |
| [C02](E07-optional-cloud-translation/stories/C02-translation-coordinator.md) | Main-process coordinator and validated contracts | C01 |
| [C03](E07-optional-cloud-translation/stories/C03-microsoft-translator.md) | Microsoft Translator integration | C02 |
| [C04](E07-optional-cloud-translation/stories/C04-deepl.md) | DeepL integration | C02 |
| [C05](E07-optional-cloud-translation/stories/C05-amazon-translate.md) | Dropped: Amazon Translate (owner decision 2026-10-25) | No longer required |
| [C06](E07-optional-cloud-translation/stories/C06-current-provider-selection.md) | Persistent current-provider selection | C01, C02 |
| [C07](E07-optional-cloud-translation/stories/C07-exhaustion-fallback.md) | Exhaustion-only fallback | C03, C04, C06 |
| [C08](E07-optional-cloud-translation/stories/C08-allowance-recovery.md) | Allowance recovery and Check availability | C07 |
| [C09](E07-optional-cloud-translation/stories/C09-reader-experience.md) | Reader status, results, and recovery UI | C06–C08 |
| [C10](E07-optional-cloud-translation/stories/C10-qualification-and-guidance.md) | Integrated qualification and maintained guidance | C01–C04, C06–C09 |

C03 and C04 are independently reviewable after the shared contract exists. C05 remains linked only to explain the removed scope. Provider research can begin before implementation of C02. C06 can be built alongside adapters; C07 and C08 can be developed with controlled adapters before real-provider qualification.

## Reader settings and retired-account migration

Service selection, translation status, and local model Load/Unload belong in the general **Reader settings** panel alongside appearance. Remove separate top-right translation controls; cloud credential forms remain in main Settings. Switching preserves the book/passage and invalidates old work without submitting text or loading Ollama.

Migration on the first translation-provider state read removes saved app-owned AWS credentials and allowance metadata. If AWS was current, require an explicit supported-provider selection. Preserve Microsoft/DeepL configuration and reading data. The version-1-to-version-2 metadata migration is lazy and idempotent; it must not require decrypting the retired secret merely to delete it or make ordinary app startup depend on valid cloud metadata.

## Architecture and implementation areas

Keep networking, credentials, persistence, routing, and allowance state in main. Add one adapter per cloud provider behind a shared coordinator and retain the independent [local gateway](../../../src/main/translation.ts). Use named, validated [contracts](../../../src/shared/contracts.ts) and [preload intents](../../../src/preload/index.ts), with sender checks and active-session checks for translation. Keep publication frames isolated and network-blocked.

Integrate through [main IPC](../../../src/main/index.ts), [Settings](../../../src/renderer/settings.tsx), and the [reader](../../../src/renderer/reader.tsx). EPUB DOM/CFI lifecycle stays in the reader adapter. Source text, translated text, and raw provider responses remain temporary and excluded from storage/logs. Persist only protected credentials and bounded configuration/allowance metadata needed for the feature.

## Completion criteria

- All nine active stories meet their revised acceptance criteria; C05 is excluded. Required Microsoft/DeepL real-account checks remain explicit qualification gates. An unresolved required-provider gap means the epic remains incomplete.
- Unit/contract/security regressions cover routing, cancellation, credential boundaries, exhausted-state persistence, provider switching, resets, and non-exhaustion failures.
- Relevant Electron proof/corpus and UI/keyboard checks pass in isolated profiles. Existing local Load/Unload, explicit Translate, offline reading, and local translation regressions pass.
- Real-provider German-to-English checks cover words, sentences, and several paragraphs. Simulated quota/error cases are identified as simulations; do not consume allowances just to manufacture exhaustion.
- Product definition, architecture decision, setup instructions, UI copy, roadmap, and qualification status accurately describe the delivered behavior and evidence. Follow the [development guide](../../workflow/AGENT-GUIDELINES.md#setup-and-commands) and [documentation policy](../../workflow/DOCUMENTATION-POLICY.md).

## Development evidence and remaining qualification

The implementation includes protected SQLite credential storage, validated bridge intents, independent local/cloud routing, both supported bounded cloud adapters, persistent exhaustion-only fallback, manual availability checks, and Settings/reader UI. Provider response/error and fallback cases are simulated in automated tests; no actual cloud account or book text was submitted during that initial development verification. The later AWS diagnostic is historical evidence for the removed trial only.

Revised-scope verification on 2026-10-25: type checking, all 269 tests across 23 files, and production build passed, including removed-provider migration, routing, and Reader settings regressions. The isolated real Electron Reader settings check, trusted-publication proof, and 12-fixture development corpus also passed. The subsequent 0.3.0 release candidate passed 276 tests and the full Windows release pipeline, including all 12 packaged runtime fixtures. Real-provider/model and hosted-update qualification remains outstanding; see the qualification guide for the exact evidence and limits.

An earlier isolated Electron UI check exercised real Windows-protected credential save/select/removal, metadata redaction, reload persistence, keyboard tab navigation and save-focus restoration, and a 700px layout without horizontal overflow. Screenshots and the local report are ignored artifacts under `release-artifacts/e07-*`. See the [qualification guide](../../release/QUALIFICATION.md#e07-cloud-translation) for final command outcomes and remaining checks. A recovered provider never automatically replaces the saved current provider; no reset calendar is guessed.
