# F2 — Define normalized contracts and narrow application intents


**Capability.** Establish data-only shared domain types, schemas, safe error categories, and named preload APIs for the planned Library, Reader, Settings, font, link, and translation operations.

**Why here.** All cross-process work needs a secure, stable vocabulary before features build upon it.

**Acceptance criteria**

- Shared contracts contain no Electron, DOM, React, epub.js, or SQLite row types.
- Every exposed intent has runtime schema validation, payload limits, normalized results, and a defined safe error shape.
- Main validates sender frame/origin and session ownership for session-scoped calls.
- The preload does not expose `ipcRenderer`, generic `send`/`invoke`, a generic operation field, raw paths, URLs, SQL, archive handles, or secret material.
- The trusted-book session contract has only named open/close operations; open returns a bounded transient archive buffer, random session ID, and normalized metadata hint, never a path or generic file capability.
- Contract tests reject malformed, oversized, cross-session, wrong-origin, and unknown requests.

**Constraints/dependencies.** Depends on F1. Public contracts must remain renderer-engine-neutral; epub.js types stay inside `ReaderAdapter` infrastructure.
