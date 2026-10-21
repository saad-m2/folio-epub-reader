# Epic 04 implementation review

**Reviewed:** 2026-09-28  
**Scope:** I1–I6, Windows reader interaction and accessibility.  
**Status:** Implementation is in place. The epic exit condition remains open for the final packaged Windows smoke matrix.

## Implemented

- **I1:** Reader controls hide during reading, reveal from the top edge or a central click, and support Back, TOC, appearance, and Escape dismissal. TOC and appearance are host-owned modal surfaces with focus return.
- **I2:** The adapter forwards keyboard, wheel, and click-zone input from publication frames. The reader routes these inputs to page operations in paginated mode and suppresses them while an overlay is open.
- **I3–I4:** Selection remains native within the sandboxed EPUB frame. The adapter emits bounded normalized text, optional CFI, and host-relative rectangles, and invalidates stale anchors on deselection, navigation, reflow, frame removal, and close. Selected text has a native Copy/Select All context menu.
- **I5:** Explicit primary activation of an HTTPS book link reaches a session-bound main-process intent. The native confirmation shows the hostname and full destination; Cancel leaves the app in place. HTTP and other schemes stay blocked.
- **I6:** Reader controls and overlays have keyboard names, focus styles, modal focus containment, and live section/progress status. Library and Settings headings receive focus on route changes. The Remove dialog has a title and proper dismissal handling.

## Verification

- `pnpm check`: passed.
- `pnpm test`: passed, 58 tests in 8 files. This includes positive/negative HTTPS contract cases, adapter selection bounds/geometry and input events, and session ownership.
- `pnpm proof`: passed, including the retained trusted-publication and mode-switch runtime proof.
- `pnpm exec electron-forge package`: passed for Windows x64.
- On an earlier runnable package, physical Windows UI checks passed for toolbar reveal, TOC/Escape/focus return, multi-paragraph selection, native Copy/Select All, ArrowLeft/ArrowRight, and wheel page turns. A separate generated `interaction-smoke.epub` provides long passages and explicit HTTPS/HTTP links for this check.

## Open exit checks

- The packaged run found two issues: valid HTTPS URLs were rejected by the contract, and a far-left page click did not turn backward. Both were fixed and covered by focused tests after that run, but the rebuilt package could not be relaunched: Windows reported **“An Application Control policy has blocked this file.”** Do not bypass that policy. Recheck HTTPS Confirm/Cancel/system-browser handoff and left/right click zones on a machine where the rebuilt app is permitted.
- Run the remaining packaged matrix: Page Up/Page Down/Space, HTTP rejection, copy shortcut, selection/anchor behavior after resize and scroll, keyboard-only navigation through Library/Settings/overlays, Narrator announcements, and the supported Windows display-scale settings.
- `pnpm make` packages the app but its Squirrel installer step fails in this environment when Squirrel tries to start a missing child process. Installer production and release validation remain part of Epic 6.

The Epic 4 exit condition should be marked complete only after those packaged Windows checks pass.
