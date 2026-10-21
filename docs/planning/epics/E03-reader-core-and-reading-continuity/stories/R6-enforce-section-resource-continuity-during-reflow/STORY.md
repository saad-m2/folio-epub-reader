# R6 — Enforce section/resource continuity during reflow


**Capability.** Apply the product's distinct appearance/window reflow rule: return to the active TOC-section start, or current spine-resource start when navigation is unavailable.

**Why here.** Reflow semantics differ intentionally from reopen and mode-switch restoration and must not be conflated with them.

**Acceptance criteria**

- Before an appearance or window-size layout mutation, the reader captures the active deepest navId or current resource fallback.
- After reflow, a book with usable navigation lands at that active navigable section's start.
- Without usable navigation, it lands at the current spine resource's start.
- The behavior works in continuous and paginated modes and does not promise exact offset/page retention.
- Automated fixtures distinguish and verify mode-switch semantic passage retention, reopen approximate section position, and reflow section/resource-start behavior.
- Rapid resize/appearance changes cancel superseded work and end in one deterministic rendition state.

**Constraints/dependencies.** Depends on R2, R4, and R5.

**Epic exit condition.** Semantic-marker, manager-flow, TOC/range, reopen fallback, mode-switch, reflow, chapter-boundary, and repeated-cleanup tests pass through the production boundary.
