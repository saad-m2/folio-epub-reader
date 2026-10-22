# F5 — Record the trusted-local decision and establish the regression fixture

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.


**Capability.** Record the in-memory trusted-local EPUB decision and turn the deep-marker proof into an automated regression suite.

**Acceptance criteria**

- The decision records that epub.js parses the bounded archive in the sandboxed renderer through its native binary path; no helper, `book://`, parser branch, loopback server, or extraction directory is used.
- The record states the trust assumption, archive-size cap, one-book lifecycle, retained Electron/publication restrictions, cleanup behavior, and residual renderer denial-of-service risk.
- Automated tests exercise deep-marker rendering, CSS/image/font loading, continuous and paginated open, script/network/file blocking, close cleanup, oversized-source rejection, timeout, and renderer-failure recovery.
- A failed compatibility proof stops Reader work pending architecture reassessment; it must not be worked around by enabling scripts, weakening Electron hardening, exposing generic IPC, or passing a source path to the renderer.

**Constraints/dependencies.** Depends on F4. The prior SPIKE-002 helper and `book://` records are historical and do not gate this model.
