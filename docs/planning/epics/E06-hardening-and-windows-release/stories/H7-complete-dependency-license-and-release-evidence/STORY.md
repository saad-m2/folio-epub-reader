# H7 — Complete dependency, license, and release evidence


**Capability.** Inventory the shipped/build supply chain and collect the evidence required to approve an MVP release.

**Why here.** Open-source/no-fee dependency compliance and reproducible security evidence are explicit product and architecture requirements.

**Acceptance criteria**

- Every direct/transitive shipped and build dependency and every font is inventoried with version, license, provenance, and applicable artifact hash.
- The release includes a generated SBOM and no dependency/font that requires a licensing fee or paid proprietary runtime/SDK/component.
- Dependency/security scans have no unresolved release-blocking finding.
- Exact Electron/epub.js pins and the trusted-local binary-handoff selection match the accepted architecture evidence.
- Release records link the corpus, application-boundary/resilience, offline, visual/accessibility, performance, cleanup, and installer results for the shipped build.
- Known residual risks and any owner-approved exceptions are explicit; no unresolved gate is described as validated.

**Constraints/dependencies.** Starts during F1 dependency selection but is accepted only after H6 verifies the shipped artifact.

**Epic exit condition.** All documented release gates pass in the packaged Windows build, supply-chain evidence is complete, and a verified direct-download `Setup.exe` is available.
