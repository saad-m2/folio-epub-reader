# H5 — Complete the visual, accessibility, and recovery matrix


**Capability.** Validate the integrated application across supported window sizes, DPI settings, reader themes, content shapes, error states, and keyboard/Narrator flows.

**Why here.** Cross-feature overlays and production packaging can introduce issues not visible in isolated story testing.

**Acceptance criteria**

Personal-use scope revision, 2026-10-02: the owner waived spoken Narrator testing as a release gate and will handle it independently, then directed that all remaining tests be deferred. Existing keyboard, visual and recovery evidence remains valid; unexecuted Narrator and physical Windows display-scaling outcomes are not claimed as passed.

- Library, Reader, Settings, TOC, appearance controls, dialogs, translation surfaces, and empty/loading/error states pass the agreed visual matrix.
- System/Light/Dark/Sepia reading themes remain legible while app chrome remains fixed dark.
- Keyboard-only and Narrator journeys cover first run, import, open/read/navigate, settings, translation setup guidance, Load/Unload, request, errors, and return to Library.
- Focus and selection anchors recover correctly after resize, DPI change, overlay nesting, provider error, reader close, and renderer failure.
- No UI presents postponed features as available.

**Constraints/dependencies.** Depends on I6 and Epic 5. Final wording/dimensions/transitions require resolution of the open design details below.
