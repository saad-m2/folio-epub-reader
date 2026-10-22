# Windows EPUB Reader — Release Evidence Pack

Reusable template for the Windows 11 x64 release evidence pack. Copy and fill it for a specific candidate in the local `release-artifacts/` evidence directory; placeholders below are not verification results. Read the [qualification scope](../QUALIFICATION.md) and [publishing instructions](../UPDATES.md). Review and sanitize generated evidence before sharing.

## Artifacts

| File | Description |
|------|-------------|
| `WindowsEpubReaderSetup.exe` | Direct-download installer (unsigned) |
| `sbom.cdx.json` | CycloneDX 1.6 SBOM (all dependencies) |
| `sbom-summary.json` | Human-readable SBOM summary (production deps only) |
| `font-inventory.json` | Font provenance, hashes, licenses (3 fonts) |
| `license-report.json` | License compliance report (deps + fonts) |
| `dependency-verification.json` | Pinned dependency verification + integrity hashes + audit |
| `packaged-dependencies.json` | Actual app.asar manifests, licenses, provenance and hashes |
| `packaged-runtime.json` | Real packaged corpus, boundary, cleanup and performance results |

## Verification

### Installer SHA256
```
<SHA256_PLACEHOLDER>
```

Verify after download:
```powershell
Get-FileHash -Algorithm SHA256 WindowsEpubReaderSetup.exe
```

### Reproduce qualification
```powershell
pnpm run sbom
pnpm license-check
pnpm verify-deps
pnpm package:candidate
pnpm verify-package
pnpm test:packaged
node scripts/verify-dependencies.cjs --installer
```

The packaged test command fails when a measured gate fails. A successful candidate build alone is not a release pass. Complete the additional checks in `docs/release/QUALIFICATION.md`.

### License Policy
- **Allowed**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC0-1.0, Unlicense, Zlib, BlueOak-1.0.0, Python-2.0, MPL-2.0, LGPL-2.1/3.0, OFL-1.1
- **Blocked**: GPL-2.0/3.0, AGPL-3.0, SSPL-1.0, Proprietary, Commercial
- **Exceptions**: Documented in `license-report.json` policy section
- **Review/Unknown licenses**: Treated as BLOCKING - release fails

### Architecture Pins (Verified)
- Electron: `42.11.6` (E06 security-maintenance pin)
- epubjs: `0.3.93` (trusted local binary handoff)
- All other deps: Exact versions per `dependency-verification.json`

### Font Inventory
- **Liberation Sans** (bundled, shipped): SHA256 verified locally
- **Atkinson Hyperlegible** (optional-download, cataloged): Catalog pin only - hash verified at runtime install
- **Source Serif 4** (optional-download, cataloged): Catalog pin only - hash verified at runtime install

## Known Residual Risks

1. **Unsigned installer** — No paid code signing certificate; users must verify SHA256
2. **Update feed qualification** — Record the configured GitHub repository and installed two-version download/restart result. Without a configured feed, use a newer installer for manual upgrades. See `docs/release/UPDATES.md`.
3. **Windows 11 x64 only** — No ARM64, 32-bit, or macOS/Linux builds
4. **Qualification scope** — Record memory/performance, real Ollama/GPU, offline UI and accessibility results for this exact candidate. The owner waived clean-machine/VM installer tests for personal use on 2026-10-02; label that matrix as waived rather than passed. Other missing required evidence blocks acceptance.

## Release Gates (H6/H7) — REQUIRES MANUAL VERIFICATION

- [ ] H6: Windows 11 x64 `Setup.exe` produced and verified (CI artifact + hash match)
- [ ] H7: SBOM, license inventory, dependency provenance, hash evidence complete (CI artifacts)
- [ ] All E01–E05 test suites pass in packaged build (CI unit tests alone are insufficient)
- [ ] No unresolved blocking vulnerabilities (CI verify-deps post-build)
- [ ] No fee-required dependencies or proprietary runtimes (CI license-check)

**NOTE**: Gates are NOT pre-checked. CI produces candidate artifacts only; verify the installed application and document results before publishing a draft release.

---
Generated: `<TIMESTAMP_PLACEHOLDER>`
Build: `<GITHUB_SHA_PLACEHOLDER>`
