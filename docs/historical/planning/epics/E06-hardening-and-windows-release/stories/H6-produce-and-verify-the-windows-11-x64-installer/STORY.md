# H6 — Produce and verify the Windows 11 x64 installer

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.


**Owner scope addition (2026-10-21).** Version 0.2.0 adds explicit in-app update checks using GitHub Releases and Electron's Windows Squirrel updater. Online updates require a configured public repository and published release artifacts. See [the update and publishing instructions](../../../../../../release/UPDATES.md). The original MVP exclusions below describe the earlier scope.

**Owner scope revision (2026-10-02).** Clean-machine/VM installer tests are waived for this personal-use release. The clean installation/upgrade/uninstall/reinstall matrix remains optional future distribution work. Artifact verification and host installation/launch smoke evidence remain applicable.


**Capability.** Build the direct-download Electron Forge `Setup.exe` and verify its complete lifecycle on clean Windows 11 x64 environments.

**Why here.** The installed application—not a development build—is the MVP deliverable.

**Acceptance criteria**

- CI/release tooling produces a Windows 11 x64 `Setup.exe`; it does not produce Store/MSIX, ARM64, 32-bit, or auto-update deliverables.
- Clean install, first launch, normal launch, upgrade, uninstall, and reinstall are tested.
- Upgrade preserves intended library, positions, preferences, downloaded fonts, and protected key data; uninstall behavior for retained user data is documented and tested against the agreed installer policy.
- Native `better-sqlite3` or selected equivalent is rebuilt/packaged correctly and migrations run in the installed build.
- The packaged application-boundary, trusted-publication resilience, reader, offline, accessibility, and performance suites pass.
- The installer is signed only if trusted signing is available without a required fee; otherwise it is intentionally released unsigned as PRODUCT.md permits.

**Constraints/dependencies.** Depends on H1–H5. Do not introduce a paid distribution, certification, runtime, SDK, or signing requirement.
