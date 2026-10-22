# E6 — Hardening and Windows release

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../README.md). Original findings and outcomes are preserved.


## Purpose

Turn the completed feature set into a releasable Windows 11 x64 MVP by exercising the documented compatibility, containment, offline, performance, lifecycle, licensing, and installer gates in a packaged build.

## Included

- Representative valid/unsupported/malicious EPUB corpus.
- Full boundary, offline, visual, accessibility, performance, and cleanup regression runs.
- SBOM, license inventory, dependency provenance, and version-regression checks.
- Direct-download Electron Forge `Setup.exe` and install/upgrade/uninstall verification.

## Dependencies

Depends on all previous epics. It does not replace their story-level tests; it promotes them into packaged release gates and resolves issues found under production conditions.

## Stories

- [H1 — Qualify the supported and unsupported EPUB corpus](E06-hardening-and-windows-release/stories/H1-qualify-the-supported-and-unsupported-epub-corpus/STORY.md)
- [H2 — Run trusted-publication resilience and application-boundary tests](E06-hardening-and-windows-release/stories/H2-run-hostile-publication-and-application-boundary-tests/STORY.md)
- [H3 — Prove offline-first and network isolation behavior](E06-hardening-and-windows-release/stories/H3-prove-offline-first-and-network-isolation-behavior/STORY.md)
- [H4 — Meet reader performance and lifecycle targets](E06-hardening-and-windows-release/stories/H4-meet-reader-performance-and-lifecycle-targets/STORY.md)
- [H5 — Complete the visual, accessibility, and recovery matrix](E06-hardening-and-windows-release/stories/H5-complete-the-visual-accessibility-and-recovery-matrix/STORY.md)
- [H6 — Produce and verify the Windows 11 x64 installer](E06-hardening-and-windows-release/stories/H6-produce-and-verify-the-windows-11-x64-installer/STORY.md)
- [H7 — Complete dependency, license, and release evidence](E06-hardening-and-windows-release/stories/H7-complete-dependency-license-and-release-evidence/STORY.md)

## Exit condition

All documented release gates pass in the packaged Windows build, supply-chain evidence is complete, and a verified direct-download `Setup.exe` is available.

## Qualification status — 2026-10-02

Requested memory/offline qualification is complete: 122 regression tests and all 12 packaged corpus entries passed, including twenty ordinary and twenty stress lifecycle cycles. Retained DOM nodes and event listeners return to baseline; peak memory and residual growth pass the owner's reasonable-memory guards. Packaged and installed UI reading/translation, real Ollama/GPU release, host installation and shortcut smoke checks passed. The owner waived clean-machine/VM tests for personal use; they are not described as passed. The user changed Windows policy, and the agent did not alter security settings.

Epic 6 is accepted for personal use under the owner's 2026-10-02 scope revision: spoken Narrator testing is owner follow-up, and the owner subsequently directed that all remaining tests be deferred. Physical Windows display-scaling and upgrade/uninstall/reinstall remain unexecuted, not passed. This acceptance does not claim complete public-distribution qualification.

See [the measured release evidence and remaining checks](../../../../release-artifacts/E06-RELEASE-EVIDENCE.md). A generated installer alone does not satisfy this epic's exit condition.
