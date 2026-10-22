# S4 — Manually load and unload the translation model

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.


**Capability.** Let the reader warm and release the local model on demand, including while a book remains open.

**Acceptance criteria**

- The reader toolbar provides Load and Unload controls and accessible status for unavailable, missing, unloaded, loading, loaded, unloading, and failure states.
- Neither app/book open, Settings, nor text selection loads the model. Load is the sole app action intended to warm it; S6 handles the shared-service race in which Ollama may reload during Translate.
- Main sends a fixed empty Ollama load request with `keep_alive: -1` and an explicit unload request with `keep_alive: 0`; both use finite timeouts and recheck actual status.
- Controls remain responsive while loading; repeated clicks and races are serialized. Unload invalidates active translation and releases GPU memory without closing the book.
- Switching books does not implicitly load or unload. If the app initiated the load, app exit makes a bounded best-effort unload attempt.
- Missing service/model, timeout, and GPU-memory failure receive actionable messages without affecting reading.

**Constraints/dependencies.** Depends on S3 and the fixed main-process Ollama gateway. Ollama is shared with other local clients, so status can change independently of this app.
