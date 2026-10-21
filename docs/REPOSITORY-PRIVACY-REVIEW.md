# Repository privacy review

Reviewed: 2026-10-21.

## Findings and changes

- The original ignore file excluded `.env` but not `.env.local`, `.env.production`, or other environment variants. These variants are now ignored at every directory level. Explicit `.env.example` and `.env.*.example` templates remain eligible for commits and must contain placeholders only. No root `.env*` files were present during this review.
- Generated release reports and spike evidence were eligible for commits. Several contain local user paths; release outputs also include network diagnostics, logs, process metadata, screenshots, and a downloaded runtime archive. The release-artifact and spike-evidence directories are now ignored. Keep these files locally; publish only separately reviewed, sanitized evidence.
- The local `list.zip` archive contains a generated EPUB fixture and is now ignored.
- Added exclusions for common private-key/certificate files, logs, heap snapshots, process IDs, and local SQLite databases and sidecars.
- The examined source, tests, scripts, project configuration, and documentation produced no obvious API-token, private-key, credential-URL, or quoted credential-assignment findings in the pattern scan. The remaining email-pattern matches were dependency/package identifiers, not personal contact details. The project npm configuration contains a dependency-layout setting, not an authentication token. The submodule URL uses a public HTTPS repository URL without embedded credentials.

## Review scope and limits

The review enumerated the current index and untracked files eligible for addition, scanned text for common credentials and personal paths, inspected configuration files, and inventoried binary candidates. It did not certify arbitrary binary contents, the upstream vendor repository, ignored local files, or all historical Git objects as free of secrets. Ignoring generated binary/evidence outputs keeps them out of ordinary future additions; it does not erase previous copies.

Git also contains tool-managed checkpoint refs in addition to the normal branch. This review does not certify those snapshots for publication. Publish reviewed branches explicitly; do not mirror all local refs or distribute the `.git` directory as a public source archive.

Ignore rules do not protect files already tracked or added with `git add --force`. At review time, the current index had no environment, key, runtime database, or generated-evidence files; its existing staged submodule changes were left intact.

## Commit practice

Make small, frequent commits after each coherent change and its relevant verification. Stage explicit paths and review the staged diff and file list for credentials, environment values, local paths, user documents, and generated diagnostics. Avoid blanket staging while the initial application baseline remains uncommitted. Never put actual secret values into audit output or commit messages.

This review does not create the application baseline commit or publish the repository.
