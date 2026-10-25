# C10 — Qualify the integrated feature and publish accurate guidance

Status: partially verified in development; real-account, real Ollama/offline, and packaged qualification remain outstanding (updated 2026-10-25). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C01–C04, C06–C09. C05 is dropped.

## User story

As a reader, I want cloud setup instructions and a verified translation experience so that I understand the privacy, allowance, and recovery behavior before using my accounts.

## Acceptance criteria

- Run `pnpm check`, `pnpm test`, and `pnpm build` using the project versions. Run relevant Electron proof/corpus checks for IPC, lifecycle, and network boundaries, plus affected Settings/reader UI and keyboard inspection in isolated profiles.
- Integrated coverage includes Microsoft, DeepL, and independent local Ollama; retired-AWS migration and general Reader settings layout; exhaustion chains, non-exhaustion stops, saved-current-provider persistence, allowance recovery without automatic return, provider/selection/session changes, credential replacement/removal, and inconclusive availability checks.
- Verify publication frames cannot access credentials, app translation intents, provider endpoints, or general network access. Confirm diagnostics contain no credentials, source/result text, or raw responses.
- Record real Microsoft/DeepL German-to-English checks for words, sentences, and several-paragraph owned passages with adequacy and latency observations. Keep test content and secrets out of committed evidence; identify simulated exhaustion and other mocked failures explicitly.
- Requalify existing local model status, separate Load/Translate/Unload actions, cancellation, no cloud-to-Ollama fallback, offline reading, and installed local translation offline. Cloud failures never block ordinary reading.
- Update the product definition, translation architecture decision, architecture overview, user setup guidance, relevant UI copy, roadmap, and qualification records. Explain the two cloud providers plus independent local Ollama, general Reader settings controls and retired-AWS cleanup, free-cutoff setup, cloud text sharing, fixed fallback behavior, persistent current provider, manual checks, and error recovery.
- Keep the dated provider-plan research distinct from verified current instructions. Record limitations, unrun real-provider/packaged checks, and required-provider gaps explicitly; do not mark the epic complete with required acceptance unverified.

AWS was removed from scope on 2026-10-25. Its diagnostic evidence remains historical; no successful AWS translation or further AWS qualification is required. Required remaining real-account checks apply to Microsoft/DeepL, alongside real Ollama/offline and release qualification.

## Verification and evidence

Follow the [development guide](../../../../workflow/AGENT-GUIDELINES.md#setup-and-commands), [qualification scope](../../../../release/QUALIFICATION.md), and [documentation policy](../../../../workflow/DOCUMENTATION-POLICY.md). Save sanitized runtime evidence in the designated ignored locations. Validate documentation links and review the final diff. Packaging/distribution checks are selected according to the actual release scope, not inferred from a successful development build.
