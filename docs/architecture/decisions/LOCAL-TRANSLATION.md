# Local translation decision

**Status:** Accepted and implemented; retained as a current architecture decision. Status reconciled 2026-10-22.  
**Date:** 2026-09-27  
**Applies to:** [Product behavior](../../product/PRODUCT.md), [current architecture](../OVERVIEW.md), and translation qualification. This supersedes the OpenAI key/Responses design in historical proposal and review records.

**E07 extension, 2026-10-24:** This decision continues to describe the local option. The [cloud translation decision](CLOUD-TRANSLATION.md) adds provider selection and exhaustion-only cloud fallback as an explicit exception to the no-automatic-resubmission rule below. Ollama is never a cloud fallback; its fixed model, explicit Load/Unload, and on-device behavior remain intact.

Epic 5 replaced the translation placeholders with fixed local status, Load, Unload, and selected-text Translate intents. The [Epic 5 review](../../historical/reviews/EPIC-05-IMPLEMENTATION-REVIEW.md) records that initial implementation. Later [E06 qualification status](../../historical/planning/epics/E06-hardening-and-windows-release.md) and [frontend integration](../../historical/reviews/FRONTEND-IMPLEMENTATION.md) record real runtime/model journeys. Those later records supersede the initial blanket statement that no physical validation had run; they do not establish comprehensive literary-quality acceptance or qualify every new build. See the [qualification guide](../../release/QUALIFICATION.md).

## Decision

The initial supported path is German-to-English translation of selected EPUB text using a separately installed Ollama runtime and Tencent `hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M`. The app neither bundles the model nor installs Ollama. It uses a fixed main-process adapter to `http://127.0.0.1:11434` and that fixed model identifier; the renderer cannot choose a URL, model, prompt, command, or headers. No API key, cloud account, or per-request service is involved. Other language directions and models require a later product decision and quality check.

This model was chosen as a translation-specific option that fits the owner's 8 GB laptop GPU in Q4 form. A local smoke test showed full GPU loading, about 5.3 GB resident, roughly 0.7–1.1 seconds for short warm requests, and about 7 seconds for a later reload. The first run took about 58 seconds. These small tests do not establish literary translation quality or performance for several paragraphs; both remain release validation work.

## User flow

1. The general **Reader settings / Translation** section shows local model controls and actual status: Ollama unavailable, model missing, unloaded, loading, loaded, unloading, or error. Missing setup provides instructions. This status check must not load the model.
2. The user presses **Load translation model**. Main verifies the installed model and asks Ollama to load it with an empty request and `keep_alive: -1`. Loading is asynchronous; reading remains available. The UI reports progress as a state, without promising a percentage.
3. Once loaded, the user selects German text and presses the separate near-selection **Translate** action. Selection alone sends nothing. The app sends only the bounded selected text and fixed translation instructions to the local model. The result stays temporary and is shown as escaped plain text in the existing anchored/expanded result design.
4. The user can press **Unload translation model** while remaining in the book. Main cancels or invalidates in-flight translation, asks Ollama to unload with `keep_alive: 0`, and checks actual status. Switching books never implicitly loads or unloads the model.
5. If Translate is pressed while unloaded or unavailable, no model load and no translation request occur. The UI explains how to load or install it. Loading never automatically submits an old selection; the user reselects and presses Translate again.

Opening the app, opening a book, changing appearance, visiting Settings, and selecting text never warm the model. The model controls share the general Reader settings panel with appearance preferences and translation-service selection; setup guidance remains in main Settings. E07 adds a service picker for local Ollama and configured Microsoft/DeepL accounts, not an arbitrary local model picker. No separate top-right translation controls remain.

## Ownership and lifecycle

Ollama is a separate, shared local service. `keep_alive: -1` on both Load and each Translate request keeps the model resident until it is explicitly unloaded, Leaf switches from local to cloud translation, Ollama stops, or another client/resource constraint changes its state. The app checks Ollama's actual loaded-model state rather than treating a successful prior Load as permanent truth. It rechecks immediately before translation and after Load/Unload. It serializes its own Load, Unload, and Translate operations so an app-initiated unload cannot race with a new translation.

Ollama's status check and generation are not atomic across clients. If another client unloads the model between them, Ollama may automatically reload it for the pending Translate request. The app must not promise absolute prevention of that external race. It checks the response's load duration; an unexpected reload invalidates the result, triggers a bounded unload attempt, and asks the reader to press Load again. The normal path never intentionally loads from Translate.

If this app initiated a load, closing the application makes a best-effort unload request. Failure to reach Ollama on exit must not hang shutdown; the shared runtime may still have the model loaded, and another client's use may also be affected by an explicit Unload. The UI should make the GPU-memory effect clear. The model used about 5.3 GB of 8 GB GPU memory in one local test; this is illustrative, not a universal requirement or latency target.

## Switching from local to cloud

Updated 2026-10-25. Selecting a configured cloud provider automatically releases the fixed local translation model to avoid retaining its GPU/RAM allocation while using cloud translation. The main-process [coordinator](../../../src/main/translation-coordinator.ts) cancels pending translation, validates the destination account, and awaits the [local gateway](../../../src/main/translation.ts)'s serialized Unload before saving the new provider. Unload uses an empty prompt and `keep_alive: 0`, never book text. A pending Load finishes before the queued Unload; a superseded switch cannot later overwrite the current provider.

A missing model or stopped/uninstalled Ollama does not block cloud selection. When Ollama cannot be reached, memory release cannot be verified. Other unload failures, including timeout or a model still reported loaded, leave the previous provider selected and show a retryable error. Switching between cloud providers does not contact Ollama. Switching back to local never loads the model: press Load before translating again. This action affects the fixed translation model in the shared Ollama runtime, including another client's use of that model; it does not stop Ollama or unload unrelated models.

Regression coverage lives in [coordinator tests](../../../tests/translation-coordinator.test.ts) and [gateway tests](../../../tests/translation-gateway.test.ts). Real-device GPU-memory release remains a runtime qualification check; simulated Ollama responses do not establish it.

## Boundary and failure behavior

- Main exposes only named, schema-validated `getTranslationModelStatus`, `loadTranslationModel`, `unloadTranslationModel`, and `translateSelection` intents. The existing OpenAI `testTranslationConnection` stub is replaced by local status; no credentials or shell execution are needed.
- The renderer and publication frames never call Ollama directly. Main connects only to the fixed loopback address, without following redirects or accepting caller-supplied destinations. Read-only status checks may contact loopback but never load a model or send book text. Publication requests to loopback remain blocked.
- Validate active reader session, sender, selected-text length (initially about 5,000 characters), and result length. Use separate finite load and translation timeouts and cancellation. Book close, changed selection, and Unload invalidate pending results. No automatic retry submits text without a fresh user action.
- Report missing Ollama, missing model, unloaded model, load failure or GPU out-of-memory, timeout, service interruption, invalid/oversized output, and cancellation as bounded user-facing states. A local model may mistranslate; do not promise correctness from a successful request.
- Do not persist or log selection text, translated text, or raw model responses. Treat model output as untrusted text: no HTML, Markdown, links, or executable content. No book title, author, chapter, surrounding text, or device identifier is sent as context by default.
- Local translation works without internet after the separate runtime/model installation. Font downloads and confirmed external links retain their own explicit network boundaries.

## Validation before release

Test missing and stopped Ollama, missing model, slow/cancelled load, repeated Load/Unload, switching books, app exit, GPU-memory release, model state changed by another local client, and offline translation. Test German words, sentences, and several-paragraph literary selections for adequacy and latency on the documented supported hardware; the short local measurements are evidence for feasibility, not acceptance thresholds. Keep the older OpenAI planning documents as historical records. Use the later qualification records linked above to distinguish checks recorded for earlier builds from deferred checks and literary-quality work; repeat relevant checks for a new candidate when changes warrant it.

## Reference behavior

- [Ollama model loading and `keep_alive` documentation](https://docs.ollama.com/faq#how-do-i-keep-a-model-loaded-in-memory-or-make-it-unload-immediately)
- [Ollama preload and GPU status documentation](https://docs.ollama.com/faq#how-can-i-preload-a-model-into-ollama-to-get-faster-response-times)
- [Tencent's official model files and Ollama command](https://huggingface.co/tencent/Hy-MT2-7B-GGUF)
