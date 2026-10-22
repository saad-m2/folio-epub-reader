# SPIKE-002 - Publication helper and `book://` decision

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../README.md). Original findings and outcomes are preserved.


> Historical experiment. The trusted-local binary-handoff architecture supersedes this helper/`book://` proposal; this record explains why that topology was not adopted.

## Current result - not accepted

Branch B is the only candidate for Electron 38.7.2 and epub.js 0.3.93: epub.js opens an OPF/navigation hierarchy from resource URLs and does not accept the helper's normalized descriptor as a substitute. The sandboxed renderer may therefore parse only the helper-validated, size-bounded OPF/navigation representation served through a live `book://` capability.

The automated production-candidate run currently serves `OEBPS/package.opf` and `OEBPS/toc.ncx` through the opaque session but times out before epub.js requests or renders the spine XHTML. The proof is **not accepted**. Do not begin Epic 3 from this branch. This is an architecture escalation, not permission to relax CSP, cross-origin isolation, iframe sandboxing, helper validation, or capability revocation.

The production candidate is a supervised Node child process using `yauzl` 2.10.0 for lazy ZIP access and `fast-xml-parser` 5.2.5 with entity processing disabled. The child receives one main-authorized source path at launch. It exposes only `inspect`, `readEntry`, `cancel`, and `close`; it has no preload, Electron UI, database, secret, shell, or network interface.

## Enforced limits

| Limit | Value |
| --- | ---: |
| Archive entries | 2,000 |
| Compressed archive bytes | 64 MiB |
| Expanded archive bytes | 128 MiB |
| Individual compressed/expanded entry | 8 MiB |
| Compression ratio | 100:1 |
| XML or response bytes | 2 MiB / 8 MiB |
| Archive path length | 240 characters |
| Operation timeout | 10 seconds |

The helper rejects DTDs, entities, traversal, absolute/drive/UNC paths, NULs, duplicate normalized paths, malformed ZIP/XML, and declared scripted or fixed-layout books. Main only creates and revokes capabilities, transfers bounded bytes, and supervises timeout/crash cleanup.

## Superseded evidence

The helper tests, `book://` route, and secure-publication proof described by this experiment were removed with the trusted-local decision. Current proof and regression evidence is recorded in `TRUSTED-LOCAL-EPUB-DECISION.md`.
