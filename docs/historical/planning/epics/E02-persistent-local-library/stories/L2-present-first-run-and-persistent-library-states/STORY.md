# L2 — Present first-run and persistent library states

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Show the fixed-dark Library screen with the specified empty state and a visual, cover-dominated grid for imported books.

**Why here.** This is the user's home screen and the visible representation of the persisted library.

**Acceptance criteria**

- An empty first launch shows only a brief welcome message and prominent **Add books** action, with no tutorial flow.
- Each populated entry shows cover, title, author, and reading progress; it does not show “Last read.”
- Entries are ordered by most recently opened first and no alternative sorting control is offered.
- Restart reconstructs the same library from local persistence, and normal launch still opens Library rather than the last book.
- A double-click initiates opening; a single click does not open the book.
- Missing metadata/cover uses an explicit interim fallback that is isolated for later product decision rather than being treated as final product wording/design.

**Constraints/dependencies.** Depends on L1. Exact metadata and cover fallbacks remain an open product detail.
