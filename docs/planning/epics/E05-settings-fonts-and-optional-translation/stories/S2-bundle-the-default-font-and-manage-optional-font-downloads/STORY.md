# S2 — Bundle the default font and manage optional font downloads


**Capability.** Ship one offline reading font and let users download, retain, and select additional fonts from an app-owned static catalog.

**Why here.** Fonts are a settings-owned optional network capability that feeds the global reader appearance contract.

**Acceptance criteria**

- A carefully chosen default reading font is packaged and usable without network access from first launch.
- Settings displays only the approved static catalog embedded with the app; it is not remotely mutable.
- Each downloadable asset has an owner-approved redistributable no-fee license, fixed HTTPS origin, version, expected hash, and license metadata.
- Downloads use only allowlisted origins, verify the hash before install, record installed state, and fail with friendly guidance without affecting reading.
- Installed fonts remain available offline after restart and can be selected as the global reading font.
- Missing/corrupt cached fonts fall back safely to the bundled default.

**Constraints/dependencies.** Depends on S1 and R5. Exact catalog contents/organization remain an unresolved product detail and require an explicit decision before this story can be accepted.
