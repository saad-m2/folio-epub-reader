# F1 — Bootstrap the hardened application shell

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Create the pinned Electron Forge application with a single `BrowserWindow`, React routes for Library, Reader, and Settings, and early app-specific Data and Session path configuration.

**Why here.** It creates the runtime and composition roots on which every vertical slice depends.

**Acceptance criteria**

- The application starts on Windows 11 x64 and always lands on Library on a normal launch.
- Electron is pinned to 38.7.2 and epub.js to 0.3.93; other selected dependencies are pinned in the lockfile.
- The window runs with sandboxing and context isolation enabled, Node integration disabled, web security enabled, and a restrictive app CSP.
- Top-level navigation is limited to packaged `app://` content; permissions, unexpected windows, and downloads are denied.
- Mutable data is rooted under `%LOCALAPPDATA%/<App>/Data` and disposable runtime data under `%LOCALAPPDATA%/<App>/Session`, with paths set before Electron initialization.
- The renderer has no direct Node, filesystem, database, or arbitrary network access.

**Constraints/dependencies.** Follow the module boundaries in the architecture. Do not introduce a second window, production `file://` book loading, publication scripts, or a generic renderer bridge.
