# Trusted-Local EPUB Decision

## Accepted architecture

**Status:** Accepted and implemented; retained as a current architecture decision. Reviewed against source on 2026-10-22. See the [current architecture overview](../OVERVIEW.md) for code ownership and later additions. The [original implementation plan](../../historical/planning/ARCHITECTURE-IMPLEMENTATION-PLAN-01.md) remains historical rationale.

Main authorizes a native-picker or library source path, rejects a source over 128 MiB, reads one archive, and returns its transient `ArrayBuffer` through a named session intent. epub.js 0.3.93 opens that buffer in the sandboxed renderer using its native archive/JSZip path and serves internal publication resources as ephemeral `blob:` URLs.

No production publication helper, `book://` protocol, app-owned loopback publication server, extraction directory, renderer source-path access, or parser-placement branch is used. Main's optional Ollama gateway is a separate local-service capability.

## Retained safeguards

- Electron sandbox, context isolation, disabled Node integration, and web security remain enabled.
- The renderer exposes only named preload intents; publication frames receive no preload or Electron/Node API.
- epub.js runs with `allowScriptedContent: false`; publication frames omit `allow-scripts`.
- The app session blocks HTTP(S) and `file:` requests, permissions, downloads, unexpected windows, and top-level navigation away from `app://`.
- One active archive session is allowed. Close, failure, replacement, renderer crash, and shutdown release session and archive-byte references.

## Accepted risk

The user intentionally opens EPUBs they trust. EPUB parsing occurs in the sandboxed renderer, so malformed archives may cause renderer failure or memory pressure within the source-size cap. This is an accepted compatibility/resilience risk, not hostile-document containment. It must never yield application filesystem, database, secret, shell, generic IPC, or network access.

## Evidence

`pnpm proof` generates the deep-marker fixture, builds the app, and launches Electron with `E01_AUTOMATED_PROOF=1` through `scripts/run-proof.cjs`. It runs the real binary-handoff proof, including marker/resources, flow switching, publication restrictions, and cleanup assertions. `pnpm test` supplies the contract and bounded-handoff unit regressions. The similarly named `pnpm proof:runtime` builds and launches the ordinary app unless the proof environment flag is set separately. See [development](../../development/README.md) for corpus commands and [qualification](../../release/QUALIFICATION.md) for the limits of recorded release evidence.
