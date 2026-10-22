# E4 — Windows reader interaction and accessibility

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../README.md). Original findings and outcomes are preserved.


## Purpose

Complete the reader's calm control model and make keyboard, pointer, selection, context-menu, focus, scaling, and assistive-technology behavior feel native on Windows.

## Included

- Hidden/revealed reader toolbar and overlay dismissal rules.
- Keyboard, wheel, and pointer page navigation.
- Standard selection, keyboard shortcuts, and right-click behavior.
- External HTTPS-link confirmation and system-browser handoff.
- Narrator, focus, keyboard-only, and high-DPI remediation.
- Stable selection geometry for the later translation surface.

## Dependencies

Depends on Epic 3's adapter events and navigation operations. Epic 5 translation depends on this epic's selection and anchor behavior.

## Stories

- [I1 — Implement distraction-free reader controls and escape behavior](E04-windows-reader-interaction-and-accessibility/stories/I1-implement-distraction-free-reader-controls-and-escape-behavior/STORY.md)
- [I2 — Route page navigation input consistently](E04-windows-reader-interaction-and-accessibility/stories/I2-route-page-navigation-input-consistently/STORY.md)
- [I3 — Preserve standard Windows text selection and context actions](E04-windows-reader-interaction-and-accessibility/stories/I3-preserve-standard-windows-text-selection-and-context-actions/STORY.md)
- [I4 — Provide stable selection anchoring across the reader UI](E04-windows-reader-interaction-and-accessibility/stories/I4-provide-stable-selection-anchoring-across-the-reader-ui/STORY.md)
- [I5 — Confirm and open explicit external HTTPS links safely](E04-windows-reader-interaction-and-accessibility/stories/I5-confirm-and-open-explicit-external-https-links-safely/STORY.md)
- [I6 — Meet the Windows accessibility and scaling baseline](E04-windows-reader-interaction-and-accessibility/stories/I6-meet-the-windows-accessibility-and-scaling-baseline/STORY.md)

## Exit condition

Physical Windows input, selection/context menu, overlay focus, external-link, Narrator, keyboard-only, and high-DPI smoke tests pass.

Implementation and current verification status are recorded in the [Epic 04 implementation review](../../reviews/EPIC-04-IMPLEMENTATION-REVIEW.md).
