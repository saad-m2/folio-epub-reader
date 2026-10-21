# I3 — Preserve standard Windows text selection and context actions


**Capability.** Allow text selection and normal keyboard/context-menu actions inside sandboxed publication frames without replacing them with AI UI.

**Why here.** Familiar selection behavior is a product principle and provides the safe input source for translation.

**Acceptance criteria**

- Users can select words through multi-paragraph passages in representative EPUB 2/3 content.
- Applicable standard copy/select keyboard shortcuts behave normally.
- Right-clicking selected text exposes normal Windows text-selection actions.
- The future Translate action is separate and does not replace or suppress ordinary context behavior.
- Selection changes emit only bounded normalized text, optional range CFI, and geometry through ReaderAdapter.
- Selection remains within the book frame and does not grant publication content access to app preload or IPC.

**Constraints/dependencies.** Depends on R1 and the selection route proven in F4.
