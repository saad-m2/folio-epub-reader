# I4 — Provide stable selection anchoring across the reader UI

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Convert publication-frame selection rectangles into host coordinates and maintain or invalidate the anchor correctly as controls, overlays, pages, and sessions change.

**Why here.** Anchoring is a reader interaction primitive required before a trustworthy translation bubble can be built.

**Acceptance criteria**

- A selection produces bounded host-relative rectangles suitable for placing a small surface above or below it.
- Geometry remains correct at supported Windows scale factors, window sizes, scroll positions, and paginated pages.
- Navigation, deselection, book close, frame replacement, or invalid session clears the stale anchor.
- Opening an app overlay does not leak selection text into durable state or diagnostics.
- The original selection can remain visibly highlighted while a host-owned overlay is displayed.

**Constraints/dependencies.** Depends on I3. App chrome and all translation surfaces remain outside publication frames.
