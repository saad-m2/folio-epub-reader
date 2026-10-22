# S1 — Complete global Settings and reader-preference surfaces

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Provide fixed-dark Settings UI for global reading preferences, font management, and local translation setup guidance, while retaining quick appearance access from the reader.

**Why here.** This is the product's configuration area. Model Load/Unload belongs in the reader controls.

**Acceptance criteria**

- Settings exposes the already supported global mode, reader theme, font family, size, margins, line spacing, and paragraph spacing without creating per-book variants.
- Changes persist and apply across books; supported appearance controls update the open reader immediately.
- Settings remains fixed dark regardless of reader theme.
- Translation guidance explains the separate Ollama and model installation and that local translation needs no API key.
- Visiting Settings does not load the model; optional font downloads remain clearly distinguished from offline actions.

**Constraints/dependencies.** Depends on R4–R6. Do not add provider/model/endpoint selection, prompt editing, or appearance controls not listed in PRODUCT.md.
