# R4 — Add page-by-page mode and semantic mode switching

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Render conventional column-based generated pages, begin new spine chapters on fresh generated pages, and switch modes while retaining the logical passage.

**Why here.** This completes the two global reading modes after location capture is reliable.

**Acceptance criteria**

- Page-by-page mode uses epub.js's supported paginated/column flow rather than a custom paginator.
- A new spine chapter starts on a fresh generated page using engine-supported boundaries/styles.
- The global mode preference defaults to continuous, persists across restart, and applies to every book.
- Switching captures the semantic visible locator, recreates/configures flow, resolves CFI then quote/context then nav progression, and verifies the intended marker/quote is visible.
- Repeated switching does not accumulate abandoned frames, handlers, sessions, or material memory growth.
- Generated page numbers are not used as durable location or progress identity.

**Constraints/dependencies.** Depends on R3. Any requirement for deep epub.js forking or custom pagination triggers the architecture escalation rule.
