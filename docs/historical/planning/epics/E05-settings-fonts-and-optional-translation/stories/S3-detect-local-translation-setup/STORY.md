# S3 — Detect local translation setup

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.


**Capability.** Detect the separately installed Ollama service and supported model without loading it, and explain setup in plain language.

**Acceptance criteria**

- A named, schema-validated status intent reaches only the fixed Ollama loopback endpoint from main; the renderer cannot provide a URL or model name.
- Status distinguishes service unavailable, model missing, unloaded, and loaded; checking status does not load the model or send book text.
- Settings provides installation guidance and the reader shows a compact status. No API key or secret storage is required.
- Ordinary reading works without Ollama, its model, or an internet connection. The app does not install, download, or launch either dependency.

**Constraints/dependencies.** Depends on F2 and S1. The initial supported direction is German to English with a fixed internal model identifier.
