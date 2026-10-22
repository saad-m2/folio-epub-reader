# F4 — Prove bounded binary delivery through epub.js

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.


**Capability.** Run the retained deep-marker fixture through the authorized `ArrayBuffer` handoff, epub.js binary/archive path, and script-off publication frame.

**Acceptance criteria**

- Package/OPF, navigation, deep `#two-mid` target, XHTML, CSS, image, and declared font load from epub.js's ephemeral `blob:` resources.
- No source path, `file://` URL, remote request, app preload, Node/Electron API, `readerApi`, or generic IPC reaches a publication frame.
- Publication scripts, event handlers, forms, top-level navigation, popups, downloads, permissions, service workers, and persistent storage are blocked; only an explicitly confirmed HTTPS link may leave the app later in Epic 4.
- The adapter emits only bounded normalized selection text/geometry and reader events to its host.
- Oversized, failed, stale, and closed sessions fail safely; renderer failure does not make main unresponsive or expose paths/bytes/secrets.
- Traces identify the main size check, binary handoff, adapter open/display timeout, publication frame sandbox state, and deterministic cleanup.

**Constraints/dependencies.** Depends on F3. This proves trusted-local compatibility, not hostile-publication isolation.
