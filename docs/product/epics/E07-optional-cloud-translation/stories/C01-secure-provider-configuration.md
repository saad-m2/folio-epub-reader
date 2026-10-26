# C01 — Configure cloud accounts securely

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (updated 2026-10-25). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: none.

## User story

As a reader, I want to connect, update, and remove my own cloud translation accounts so that I can use them without exposing my credentials.

## Acceptance criteria

- Settings supports Microsoft Translator, ZPK, Lara Translate, Traduck, and DeepL with validated provider-specific credentials (including ZPK application ID, Lara access-key ID/secret, and Microsoft region where required). The 2026-10-26 provider expansion follows the current [setup guide](../../../CLOUD-TRANSLATION-SETUP.md). Arbitrary request URLs, headers, or commands cannot be configured through the bridge.
- Save credentials only through main using Windows-protected encryption. Saved secrets are never returned to the renderer; Settings receives configured/missing/error metadata. Newly entered secrets are cleared from form state after use.
- If protected storage is unavailable or decryption fails, report a safe recovery state; never fall back to plaintext storage or silently destroy the saved value.
- Updating/removing credentials invalidates affected in-flight operations and prevents late results. Removal deletes app-owned saved credentials and allowance metadata for that account.
- Connecting or editing an account neither submits book text nor changes the current provider. All configured cloud providers are eligible for fallback subject to their allowance state; there is no fallback opt-in.
- Setup explains user-owned accounts, text sharing including fallback, provider-enforced free cutoffs, and the absence of a Leaf billing-plan check or guarantee against charges from paid credentials.
- On the first translation-provider state read, migrate retired AWS state before validating the supported-provider schema: remove app-owned AWS credentials and allowance metadata, clear AWS as current to require an explicit supported choice, preserve other providers/reading data, and never load Ollama. Removal does not require decrypting the retired secret; migration is idempotent.
- No secret, selected/translated text, or raw response appears in logs, diagnostics, errors, or persisted form state.

## Verification

Revised migration criteria added 2026-10-25; verify AWS-current, other-provider-current, missing/corrupt retired-secret, and repeated-read cases. Test credential round trips through protected storage, restart, replacement/removal, encryption/decryption failure, unauthorized/invalid IPC, and sanitized errors. Inspect Settings validation, keyboard access, and form clearing in an isolated profile. Provider-specific setup instructions are completed in C03 and C04 and consolidated in C10.
