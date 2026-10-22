# H2 — Run trusted-publication resilience and application-boundary tests

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Verify the complete packaged trust model against malicious archives, XML, resources, frames, protocols, IPC, and session attempts.

**Why here.** Containment is a release property and must be re-proven after all feature integrations.

**Acceptance criteria**

- Troublesome ZIP/XML fixtures exercise oversized source rejection, malformed archives/XML, excessive memory/readiness time, image failures, and renderer crash/recovery.
- Script, event handler, form, object/plugin, remote resource, service worker, storage, popup, download, permission, frame, and navigation escape attempts are blocked.
- Stale/cross-session/malformed/oversized/wrong-origin IPC and closed archive-buffer use fail without paths, secrets, or diagnostic leakage.
- Main remains responsive and all capabilities/handles are cleaned after failure.
- The exact F4/F5 binary-handoff regression passes in the packaged build, including post-close archive-byte release and renderer recovery.
- No diagnostics contain source paths, book/selection/translation text, or raw model output.

**Constraints/dependencies.** Depends on F5 plus all features that touch the boundary.
