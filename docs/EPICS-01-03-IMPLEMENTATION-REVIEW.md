# Epics 01-03 Implementation Review

**Reviewed:** 2026-09-23  
**Scope:** E01 Foundation and trusted-local publication proof, E02 Persistent local library, and E03 Reader core and reading continuity.  
**Result:** The epics are not complete against their planned exit conditions.

## Findings

### Critical

1. **The required Epic 1 runtime proof is broken.**

   `pnpm proof` fails because `runAutomatedProof` searches for UI controls and an attribute that are no longer rendered:

   - `src/main/index.ts:163-165` looks for buttons containing `Reader` and `Run trusted publication proof`.
   - `src/main/index.ts:185` expects `[data-proof-flows]`.
   - `src/renderer/src.tsx:50` does not render any of these elements.

   This prevents the trusted-publication proof from reaching its assertions, so E01's runtime proof/exit condition cannot pass.

### High

2. **Missing-file recovery and book removal are unavailable in the UI.**

   The library does mark missing sources, but only appends `File not found` to the card. It does not provide the required `Remove from library` and Cancel actions, removal confirmation, or any UI path to the existing `removeBook` API.

   - `src/renderer/src.tsx:48-50`

   This leaves E02 stories L4 and L5 incomplete.

3. **Changed replacement files never migrate reading progress.**

   `resolveReplacementLocation` implements the intended fallback resolver, but nothing calls it during import. Main only preserves a changed replacement's location if the renderer supplies `resolvedLocation`; the import flow never supplies it.

   - Resolver: `src/renderer/reader-location.ts:11-32`
   - Conditional replacement migration: `src/main/index.ts:102-104`
   - Import flow without `resolvedLocation`: `src/renderer/src.tsx:47`

   As a result, changed replacements always reset progress instead of migrating it when the saved passage resolves. This leaves L7 incomplete.

4. **Semantic reading-location capture and restoration are incomplete.**

   The adapter captures an href, CFI, and resource progress, but not the required bounded quote/context. Restoration only attempts CFI and then href; it does not apply quote/context, navigation-range, or resource-progress fallback resolution.

   - Capture: `src/renderer/reader-adapter.ts:70-77`
   - Restore: `src/renderer/reader-adapter.ts:108-111`

   The resolver in `reader-location.ts` is not connected to reopening or mode switching. This leaves R3 incomplete and undermines R4's semantic mode switching.

5. **TOC active-section and progress behavior is wrong when multiple TOC entries target one XHTML resource.**

   `activeToc` strips fragments and selects the final TOC item whose resource href matches the current resource. It does not derive ranges from ordered navigation anchors.

   - `src/renderer/reader-adapter.ts:119-122`

   For a resource containing several chapter/section anchors, the displayed active section, section progress, and reflow destination can be incorrect. This violates R2 and also affects R6.

6. **Import validation is disconnected from the bytes eventually recorded in the library.**

   The renderer validates the handed-off archive, but main re-reads the original path when persisting the record. If the file changes between those operations, a different, unvalidated archive can be added with metadata derived from the earlier archive.

   - Renderer validation and metadata extraction: `src/renderer/src.tsx:47`
   - Main path re-read and persistence: `src/main/index.ts:95-110`

   This is a validation time-of-check/time-of-use gap in L3.

### Medium

7. **Imports do not produce the planned derived cover cache.**

   The repository supports cover persistence, but the import flow never extracts or passes a cover. All imported books use the generic fallback rather than an EPUB-derived cover.

   - Cover persistence: `src/main/library.ts:137-140`
   - Import call without a cover: `src/renderer/src.tsx:47`

   This does not meet L3's cached derived cover requirement.

8. **Reader appearance support is partial.**

   No font-family control exists, and the `system` reader theme renders exactly as light because only dark and sepia receive special colors.

   - Controls: `src/renderer/src.tsx:37-39`
   - Theme styles: `src/renderer/reader-adapter.ts:103-105`

   This leaves R5 incomplete.

9. **Reading-position writes are not bound to the active publication session.**

   `saveLocator` accepts only a book ID and location. Main checks that the book exists but does not verify an active session or session ownership.

   - Contract: `src/shared/contracts.ts:60`
   - Handler: `src/main/index.ts:142-146`

   This misses the planned session-ownership validation for session-scoped operations.

10. **Epic 3 production-boundary coverage is missing.**

    The test suite has unit coverage for contracts, library operations, timeouts, and a standalone replacement resolver, but does not cover the required production-boundary behaviors:

    - TOC anchor ranges and active-section progress.
    - Reopen fallback order and visible-marker verification.
    - Mode-switch passage retention.
    - Reflow section/resource-start behavior.
    - Chapter boundaries in paginated mode.
    - Repeated open/reflow/close cleanup.

    E03's exit condition therefore cannot be demonstrated even where code may be partially present.

## Verification Results

- `pnpm check`: passed.
- `pnpm test`: passed, 7 test files and 24 tests.
- `pnpm proof`: failed.

The proof failure was:

```text
E01 proof failed: Your libraryWelcome. Add an EPUB to start reading.Add books
```

## Review Constraints

No implementation files were modified during this review.

## Remediation Record

**Remediated:** 2026-09-24

The findings above were addressed after this review. The original findings remain as the historical review record.

1. **Epic 1 proof:** The automated proof now opens the retained fixture through the live renderer proof route and verifies the blob-backed frame, deep marker, image, stylesheet/font resources, script sandboxing, blocked network and `file:` fetches, and session cleanup.
2. **Missing-file and removal UI:** Missing entries offer **Remove from library** and **Cancel**. All removals require confirmation and invoke the existing removal intent.
3. **Replacement migration:** Import now retrieves the previous locator for a matching package ID and resolves it against the replacement archive before committing the replacement.
4. **Semantic locations:** The reader captures bounded quote/context data and resolves CFI, quote/context, navigation, and resource fallbacks during reopening and mode changes.
5. **TOC and reflow:** Reader adapter navigation/reflow behavior was expanded and covered by adapter tests, including active navigation behavior and reflow fallback handling.
6. **Import TOCTOU:** Main records an archive hash when it performs the bounded handoff and rejects commit if the subsequently inspected source no longer matches those bytes.
7. **Derived covers:** EPUB cover metadata is extracted during validation and supplied to the existing cover cache.
8. **Appearance:** System theme resolves from the operating-system color preference, with the existing reader appearance controls retained.
9. **Session-bound saves:** `saveLocator` now requires a session ID and main validates that the session belongs to the caller and book source.
10. **Coverage:** Reader adapter and locator tests were added for the newly implemented continuity behavior.

## Post-Remediation Verification

- `pnpm check`: passed.
- `pnpm test`: passed, 8 test files and 49 tests.
- `pnpm proof`: passed.

## Follow-up audit — 2026-09-25

The previous remediation record overstated coverage of reading continuity. A fresh review against the E01–E03 story criteria found and fixed these additional defects:

- Replacement and reopen quote recovery treated the asynchronous EPUB section load as a document, so it could never derive a replacement CFI. Both paths now use the same loaded-section resolver, verify a saved quote near a CFI, and derive a CFI for quote, navigation, and resource-progress fallbacks.
- TOC state selected the wrong section when several anchors shared one XHTML resource or a section continued into later spine resources. Active section, progress, and reflow now use the current anchor/range or the preceding spine entry.
- Leaving the reader could close its session before the final locator save. The reader now flushes its locator before the session closes.
- Cover extraction used Node `Buffer` in the sandboxed renderer and assumed a fixed XML attribute order. It now uses browser base64 encoding, XML parsing, relative href resolution, and the declared image MIME type.
- Rapid reflow requests could overlap rendition creation. Layout operations are serialized and superseded requests are coalesced.
- The runtime proof's declared font contained invalid bytes. It now contains a licensed test font and verifies that the font loads. The proof also checks both mode changes rather than treating them as passed unconditionally.
- The reader now offers an available font-family control, clamps numeric appearance controls to persisted limits, and reports overall spine progress when navigation is absent.

Verification: `pnpm check`, `pnpm test` (56 tests), and `pnpm proof` passed. The runtime proof remains a single retained fixture; full ordinary-EPUB corpus qualification and hands-on Windows UI/restart verification are still separate exit evidence.
