# H1 — Qualify the supported and unsupported EPUB corpus

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Run the packaged application against a maintained corpus of ordinary reflowable EPUB 2/3 books and explicitly unsupported profiles.

**Why here.** Release confidence requires broader compatibility evidence than individual feature fixtures.

**Acceptance criteria**

- The corpus covers EPUB 2/3 navigation variants, nested TOCs, multi-spine books, CSS/images/embedded fonts, missing navigation, internal fragments, varied metadata, and representative long/stress content.
- Supported fixtures can be added, opened, read in both modes, navigated, restyled, closed, and restored offline.
- Fixed-layout, scripting-required, media-overlay/read-aloud, DRM, and unsafe/unusual unsupported fixtures fail clearly without being added or weakening containment.
- Failures remain concise and non-technical in the UI while redacted diagnostics retain actionable categories.
- Electron or epub.js version changes cannot merge/release until the same corpus, security, visual, and location suite passes.

**Constraints/dependencies.** Depends on Epics 2–5. Do not add special rendering/security exceptions for excluded profiles.
