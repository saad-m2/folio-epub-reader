# R5 — Apply global reading appearance and reader themes


**Capability.** Provide immediate reader controls for font size, margins, line spacing, paragraph spacing, available font family, and System/Light/Dark/Sepia reader theme.

**Why here.** Appearance is part of the reading engine because applying it changes layout and requires specified navigation behavior.

**Acceptance criteria**

- Numeric appearance properties use simple minus/plus controls and update the open reading view immediately.
- Preferences persist globally and apply when any book is opened; there are no per-book appearance settings.
- Library, Settings, and app chrome stay fixed dark regardless of reader theme.
- Versioned user styles are injected after publication styles and affect only the allowed properties.
- Book-specified text alignment is retained; text with no specified alignment is left-aligned, with no alignment override control.
- Theme/appearance changes trigger the reflow behavior in R6 rather than attempting to retain a generated page number.

**Constraints/dependencies.** Depends on R1 and L1. Downloadable font availability is completed in Epic 5; the bundled default must already work offline.
