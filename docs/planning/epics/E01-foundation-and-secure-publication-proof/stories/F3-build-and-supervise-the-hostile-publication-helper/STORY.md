# F3 — Build the bounded trusted-local handoff

**Capability.** Main authorizes a user-selected or stored EPUB path, checks its size, reads one complete trusted archive, and transfers transient bytes only to the sandboxed renderer through a named session intent.

**Acceptance criteria**

- Main accepts a source path only from the native picker or an existing library record; the renderer cannot nominate a path.
- The source file is checked against the documented trusted-archive size cap before allocation; only one archive session is active.
- The renderer receives a transient `ArrayBuffer`, random session ID, and bounded metadata hint, never a path, filesystem handle, generic IPC object, or secret.
- Main does not persist or modify the archive and drops its byte reference after the handoff; the renderer drops its reference on close, error, replacement, renderer crash, and app shutdown.
- Missing, unreadable, oversized, or failed reads return a typed friendly result while main remains responsive.
- The design records that EPUB ZIP/XML parsing occurs in the sandboxed renderer because the user intentionally trusts selected books; malformed content may fail the renderer but must not gain app privileges.

**Constraints/dependencies.** Depends on F2. Keep Electron hardening, publication scripts disabled, remote and `file://` resources blocked, and no publication preload.
