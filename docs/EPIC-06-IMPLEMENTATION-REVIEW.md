# Epic 06 — release readiness review

**Status:** In progress. No packaged runtime or installed-build gate has been validated. Desktop interaction was deferred at the owner's request.

## Automated groundwork

- `tests/offline-lifecycle.test.ts` exercises isolated loopback status/load/translate behavior, unavailable service/model responses, font cache behavior, reader teardown/reflow cycles, and location persistence. These are mock-backed unit regressions, not offline network captures or performance measurements.
- Existing `tests/publication-validation.test.ts`, `tests/trusted-publications.test.ts`, `tests/reader-adapter.test.ts`, and `scripts/run-proof.cjs` cover selected profile and boundary scenarios. `scripts/generate-proof-fixture.cjs` creates two EPUB 2 fixtures (deep marker and interaction smoke). They are not a complete EPUB 2/3 qualification corpus.
- `scripts/generate-sbom.cjs`, `scripts/check-licenses.cjs`, and `scripts/verify-dependencies.cjs` create candidate supply-chain reports. The verifier checks exact application pins, bundled-font bytes, production audit results, and optionally the presence/hash/size of the x64 installer. An absent or invalid audit result fails closed. Optional font hashes are catalog pins and are verified when downloaded, not as shipped bytes.
- The Windows CI workflow produces candidate artifacts and a **draft** release only after its automated gates pass. A draft is not approval for public distribution.

## Open release gates (H1–H7)

| Gate | Evidence needed before approval |
| --- | --- |
| H1 corpus | Maintain actual EPUB 2/3 supported, unsupported, and stress books with provenance; test import, reading modes, nested TOC, fragments, styling, closing and offline restore in the packaged app. Re-run on Electron/epubjs changes. |
| H2 containment | Run hostile ZIP/XML/resource/IPC/navigation cases and the binary-handoff recovery proof against the packaged build; inspect redacted diagnostics and handle cleanup. |
| H3 offline | Disable internet access and inspect traffic while importing/reading/restarting; check optional font failures, fixed Ollama loopback status, explicit Load/Translate and confirmed HTTPS handoff. |
| H4 performance | Record machine/build/fixture, 2s/5s first read, 100ms input, 1s/2s reflow, 500MiB working set, 75MiB growth after 20 cycles, archive/frame/handler cleanup, Ollama/GPU and cold/warm translation timings. Unit-test mock timings are not evidence. |
| H5 visual/accessibility | At supported window sizes and DPI settings, inspect Library, Reader, Settings, overlays, loading/errors, four themes, keyboard/Narrator journeys and focus recovery after resize/crash. |
| H6 installer | On clean Windows 11 x64, build and hash `WindowsEpubReaderSetup.exe`, test first launch, upgrade, uninstall and reinstall; inspect native modules/migrations and data retention. Agree on uninstall data policy with owner. |
| H7 supply chain | Review full dependency/font provenance, license texts, SBOM, production audit, and artifact hashes for the exact candidate build; link each H1–H6 result before publishing. |

**Security blocker:** `pnpm audit --prod --json` currently reports 15 production advisories in `@xmldom/xmldom@0.7.13` via `epubjs@0.3.93` (13 high, 2 moderate). The release verifier fails on these. Do not represent them as resolved or owner-approved. Remediation or an explicit owner decision with accompanying containment evidence is required.

**Installer policy decision:** The roadmap does not specify whether uninstall retains local data. Document the chosen policy and test upgrade/uninstall/reinstall against it before release.

## Deferred hands-on checklist

When desktop use is available, record results by build hash, Windows version, machine/DPI, EPUB fixture IDs, and screenshots/measurements without including book text or local paths in published logs. Keep failed/unrun checks marked open; only publish the draft after every required gate has evidence.
