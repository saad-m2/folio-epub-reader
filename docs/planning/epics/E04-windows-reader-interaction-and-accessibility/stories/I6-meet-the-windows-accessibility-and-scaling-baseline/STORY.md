# I6 — Meet the Windows accessibility and scaling baseline


**Capability.** Remediate keyboard-only, focus, semantics, Narrator, contrast, and high-DPI issues across Library, Reader, overlays, and Settings shells.

**Why here.** Accessibility must be validated against the actual interaction model rather than retrofitted after packaging.

**Acceptance criteria**

- All app controls and overlays are reachable and operable by keyboard with visible focus.
- Focus enters overlays predictably, is constrained where appropriate, and returns to the invoking control on close.
- Narrator announces actionable control names/states, current section/progress, dialogs, errors, and loading status meaningfully.
- Library and Settings fixed-dark surfaces and all reader themes retain usable contrast.
- Reader controls, hit regions, selection anchors, and dialogs remain usable at the supported Windows high-DPI scale matrix.
- Native menu/context-menu and focus behavior pass packaged Windows smoke tests.

**Constraints/dependencies.** Depends on I1–I5 and the available Settings shell. Final visual tuning continues in Epic 6, but known blocking accessibility failures must be fixed here.

**Epic exit condition.** Physical Windows input, selection/context menu, overlay focus, external-link, Narrator, keyboard-only, and high-DPI smoke tests pass.
