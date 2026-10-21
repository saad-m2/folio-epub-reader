# H3 — Prove offline-first and network isolation behavior


**Capability.** Verify ordinary reading and local translation with internet access disabled, and enforce separate loopback, font-download, and external-link boundaries.

**Why here.** Local-first operation is a top-level product promise and cross-feature acceptance gate.

**Acceptance criteria**

- With network disabled, the packaged app launches, imports, opens, reads, navigates, restyles, closes, and restores books.
- The bundled default and previously downloaded fonts work offline.
- No book content silently reaches the internet or Ollama. No account or API key is required for local translation.
- Read-only status checks may reach the fixed Ollama loopback endpoint; only explicit Load and Translate intents load a model or submit book text. App/book open and selection do neither.
- Translation works with internet disabled after Ollama and the model are separately installed. Missing/stopped Ollama or missing model is isolated and does not impair reading.
- Font download failures are isolated and friendly.
- Only a confirmed user-activated HTTPS book link is handed to the system browser.

**Constraints/dependencies.** Depends on S2 and S3–S7.
