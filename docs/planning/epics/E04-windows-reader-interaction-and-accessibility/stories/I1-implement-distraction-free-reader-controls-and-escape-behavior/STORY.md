# I1 — Implement distraction-free reader controls and escape behavior


**Capability.** Hide reader controls during reading and reveal them from the central reading area or their screen-edge region, with predictable Back and Escape behavior.

**Why here.** This is the primary interaction shell around the reading surface.

**Acceptance criteria**

- The toolbar is normally hidden and contains only Back, TOC, current section/progress, mode switch, and appearance controls.
- Pointer entry into the controls' region reveals the controls.
- Clicking the central reading area reveals/hides controls without navigating a page.
- Back immediately closes the reader session and returns to Library.
- `Esc` closes the topmost open TOC/settings/translation surface first; when none is open, it closes the reader and returns to Library.
- Focus remains predictable when controls appear/disappear or an overlay closes.

**Constraints/dependencies.** Depends on R1–R2. Detailed dimensions, transitions, and final wording remain open design details.
