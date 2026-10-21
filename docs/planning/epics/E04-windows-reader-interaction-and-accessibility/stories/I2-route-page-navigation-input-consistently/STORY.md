# I2 — Route page navigation input consistently


**Capability.** In paginated mode, map the required keyboard, wheel, and edge-click inputs to previous/next operations while preserving the central control zone.

**Why here.** This story implements the complete physical navigation contract on top of paginated mode.

**Acceptance criteria**

- Left/Right and Page Up/Page Down move backward/forward as expected.
- Space moves one page forward.
- Mouse-wheel input navigates pages deterministically without also scrolling app chrome.
- Far-left and far-right reading zones move backward and forward; the central zone only toggles controls.
- Inputs are ignored or adapted appropriately when an overlay owns focus and do not cause duplicate navigation.
- Packaged Windows tests exercise physical input routing, not only direct adapter method calls.

**Constraints/dependencies.** Depends on R4 and I1. App-owned routing must not expose a callable bridge to publication content.
