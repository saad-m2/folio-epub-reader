# R1 — Open and close a book in continuous reading mode

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Implement the production ReaderAdapter and render a selected book with epub.js's supported continuous/scrolled manager flow.

**Why here.** Continuous mode is the default and establishes the minimum useful reader vertical slice.

**Acceptance criteria**

- Opening from Library creates an authorized session and renders the transient archive buffer without exposing the source path or a filesystem capability.
- Only `ReaderAdapter` imports epub.js or exposes CFI/rendition/frame-specific behavior internally.
- Continuous mode uses the supported continuous/scrolled manager; tests observe the manager flow container rather than only an iframe.
- Ordinary EPUB XHTML, CSS, images, and declared fonts render through epub.js's `blob:` resources with publication scripts, remote resources, and `file://` blocked.
- Adapter operations are serialized with operation IDs, superseded work is cancelled, and readiness has a bounded timeout.
- Back/close, load failure, renderer failure, and opening another book deterministically destroy rendition/frames, invalidate the session, and release archive-byte references.

**Constraints/dependencies.** Hard-depends on F5 and uses L4. No custom stack of generated page surfaces, scripts, or generic bridge.
