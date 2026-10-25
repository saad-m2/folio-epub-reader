# C05 - Amazon Translate (dropped)

Status: dropped by owner decision, 2026-10-25. Parent: [E07](../../E07-optional-cloud-translation.md). No remaining implementation or qualification dependency.

The initial story proposed Amazon Translate within a provider-enforced free boundary. A real-account diagnostic later authenticated to the read-only plan API, but a fixed synthetic translation was rejected by an explicit service-control-policy deny. The investigated new-signup free path did not make Translate available within the agreed spending scope. The owner chose to remove AWS and retain Microsoft Translator, DeepL, and independent local Ollama. See [historical diagnostic evidence](../../../../release/QUALIFICATION.md#e07-cloud-translation).

AWS is no longer supported for configuration, selection, availability checks, or fallback. Successful AWS translation and further AWS qualification are not release gates for the revised epic. This retained story explains the scope change; it is not a pending feature request.

The removal migration is tracked in [C01](C01-secure-provider-configuration.md) and [C06](C06-current-provider-selection.md): remove app-owned saved AWS credentials and allowance state, require an explicit supported-provider choice if AWS was current, retain other configuration/reading data, and never load Ollama automatically.
