# R2 — Navigate a hierarchical table of contents

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Show the book's normalized TOC in a closable left overlay, indicate the deepest active navigable entry, and navigate to selections.

**Why here.** TOC ranges define both user navigation and the product's chapter/progress semantics.

**Acceptance criteria**

- The overlay preserves the hierarchy supplied by EPUB nav/NCX and indicates the current deepest active entry.
- Selecting an entry navigates to its href/fragment and closes the overlay.
- Navigation ranges are derived from ordered anchors and do not assume one spine item equals one chapter.
- The toolbar snapshot exposes current section label and progress within that navigation range.
- With absent or unusable navigation, the reader shows publication title and overall progress and remains readable.
- Internal navigation cannot escape the live book session.

**Constraints/dependencies.** Depends on R1 and adapter-normalized navigation from the trusted-local F3 handoff.
