# Confirmed Epic 1/2 Gaps And Remediation

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


**Status:** Implementation record; renderer-crash runtime coverage remains outstanding

## Confirmed Problems

The following findings were confirmed against the current implementation and the non-spike product and planning documents.

1. **Unsupported publication profiles were not deliberately rejected.** `TrustedPublicationSessions` checked authorization, extension, existence, and source size only. The renderer waited for epub.js readiness, but did not inspect EPUB package declarations for encryption/DRM, fixed layout, scripting-required content, or media overlays. This does not meet PRODUCT.md section 7.9, E02/L3, or the Technical Proposal's supported-publication boundary.
2. **A renderer-side proof failure did not revoke its active main-process session.** `PublicationProof` reported a render failure without closing its session, and the BrowserWindow did not handle `render-process-gone`. Main does not retain the archive buffer after handoff, but it retained the active-session record. This fails E01/F3, F4, and F5 cleanup requirements.
3. **The E01 runtime regression covered only part of F5.** It checked the continuous proof path, deep marker, CSS/image blobs, and disabled scripts. It did not assert paginated flow, font resolution, file/network blocking, close cleanup, timeout behavior, or renderer-failure recovery.
4. **Replacement resolution was renderer-local rather than reusable.** The fallback algorithm was an unexported function in `src/renderer/src.tsx`, typed with `any`, and had no direct tests. L7 and R3 require one reusable normalized resolver contract.
5. **L7 did not test the required outcomes.** Repository tests checked direct persistence/reset behavior but did not exercise resolver behavior for a reliable marker, no marker, or a package-ID collision.
6. **A preload-local invalid request returned an invalid safe-error shape.** A non-object payload produced `INVALID_REQUEST` without the required UUID correlation ID, contrary to E01/F2.
7. **Source revalidation used error-message classification.** Generic `Error("missing")` and `Error("changed")` values were interpreted in IPC. A read failure other than missing was incorrectly reported as `NOT_FOUND`, and future edits could silently change that mapping.

One reported concern was not a defect: the `persist:app` partition uses Electron's configured `sessionData` path. `configurePaths` sets that path to `%LOCALAPPDATA%/Windows EPUB Reader/Session` before Electron initialization, so persistent Chromium partition data is not rooted in `Data`.

## Remediation Plan

1. Add a renderer-side, bounded package-inspection module that reads the EPUB container and OPF before epub.js opens it. It will reject malformed packages and declared DRM/encryption, fixed-layout, required scripting, and media-overlay profiles with `UNSUPPORTED_EPUB`; it will not reject ordinary publications that merely contain inert script markup, because publication scripts remain blocked by the frame policy.
2. Add one renderer-session release path for normal close, rendering failure, and component teardown. Add main-process cleanup when the renderer process exits, while retaining the existing shutdown and replacement cleanup.
3. Make the proof fixture and runtime proof assert both continuous and paginated epub.js flows, CSS/image/font blob resource resolution, blocked script/form/file/network behavior, timeout, explicit close cleanup, and a renderer-process failure cleanup path.
4. Extract the composite ReaderLocation algorithm into a typed renderer adapter module, export it for direct tests, and use it during import. The module becomes the implementation shared with Epic 3 restoration.
5. Add unit regressions for resolver fallback and repository replacement reset/preservation, including changed content without a marker and a package-ID collision.
6. Centralize preload-created safe errors so every local validation response includes a correlation ID.
7. Replace string-signalled source validation outcomes with typed source-validation errors and map only known error codes in IPC.

## Verification

The implementation is complete only after TypeScript checks, Vitest coverage, and the Electron runtime proof pass. The runtime proof remains a compatibility gate: failure must not be bypassed by relaxing sandboxing, enabling publication scripts, exposing paths, or expanding IPC.

**Completed verification:** `pnpm check`, `pnpm test` (24 tests), and `pnpm proof` pass. The runtime proof covers continuous and paginated opens, deep marker, CSS/image/font blob resources, script/frame sandboxing, blocked network and `file:` fetches, and an explicit close/stale-session cleanup check. Timeout behavior and renderer-session release are covered by focused automated tests. The production `render-process-gone` handler releases all pending/import sessions, but the runtime proof does not yet deliberately terminate the renderer to assert that recovery path.
