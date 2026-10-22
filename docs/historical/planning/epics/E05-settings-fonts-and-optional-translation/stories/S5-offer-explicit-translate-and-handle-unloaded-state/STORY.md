# S5 — Offer explicit Translate and handle unloaded state

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.


**Capability.** Show a Translate action near valid selected German text and submit text only after the user activates it while the local model is loaded.

**Acceptance criteria**

- Selection alone makes no model or network request; ordinary Copy and text selection remain available.
- Clicking Translate validates sender, active reader session, still-valid selection, loaded model, and the approximately 5,000-character selection limit in main.
- If Ollama is missing, the model is absent, or it is unloaded, no translation is attempted. The UI offers the relevant setup or Load action.
- Loading after such a failure never automatically translates an old selection; the user explicitly selects and requests translation again.
- The initial supported direction is German to English. No source-language, target-language, provider, model, endpoint, or prompt picker is exposed.

**Constraints/dependencies.** Depends on I3–I4 and S3–S4. Keep the exact size limit and fixed prompt internal until validated for local literary text.
