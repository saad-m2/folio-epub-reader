# L3 — Add and validate a local EPUB

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Let the user choose trusted EPUB files with the standard Windows picker, validate them through the bounded renderer handoff, and add valid references while remaining on Library.

**Why here.** Import is the primary way the library gains useful content.

**Acceptance criteria**

- **Add books** opens the native Windows picker restricted appropriately to EPUB selection.
- Main authorizes the selected path and performs the size/existence check; the renderer never receives or submits the raw source path.
- A valid ordinary reflowable EPUB 2/3 produces a persisted library entry and cached derived cover/metadata while the source EPUB remains byte-for-byte unchanged at its original location.
- Import does not copy the EPUB into application-managed storage and works without internet access.
- Invalid, DRM-protected, fixed-layout, script-dependent, media-overlay, or otherwise unsupported input is not added and leaves the user on Library with concise non-technical guidance.
- Technical detail is available only to redacted local diagnostics, not as the primary user error.

**Constraints/dependencies.** Depends on L1 and accepted F3/F5 trusted-local behavior. Drag/drop and Windows file association are out of scope.
