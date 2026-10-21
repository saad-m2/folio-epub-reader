# E1 — Foundation and trusted-local publication proof

## Purpose

Establish the selected Electron/React architecture and prove that epub.js can render a trusted local publication through the bounded in-memory handoff before production reader implementation proceeds.

## Included

- Electron Forge, TypeScript, React, Fluent UI v9, Vite, and exact runtime pins.
- Hardened single-window shell, app routes, local data/session paths, and fixed-dark app chrome baseline.
- Data-only shared contracts and narrowly named preload/main messages.
- Main-authorized, bounded `ArrayBuffer` handoff for one trusted local EPUB at a time.
- Exact Electron 38.7.2 + epub.js 0.3.93 binary/archive proof with script-off publication frames.
- Regression fixture covering rendering, cleanup, no publication network, and no publication privilege.

## Dependencies

This epic has no implementation dependency on another epic. Every later epic depends on its shell and contracts. The binary-handoff proof is a hard gate for production Reader work in Epic 3.

## Stories

- [F1 — Bootstrap the hardened application shell](E01-foundation-and-secure-publication-proof/stories/F1-bootstrap-the-hardened-application-shell/STORY.md)
- [F2 — Define normalized contracts and narrow application intents](E01-foundation-and-secure-publication-proof/stories/F2-define-normalized-contracts-and-narrow-application-intents/STORY.md)
- [F3 — Build the bounded trusted-local handoff](E01-foundation-and-secure-publication-proof/stories/F3-build-and-supervise-the-hostile-publication-helper/STORY.md)
- [F4 — Prove bounded binary delivery through epub.js](E01-foundation-and-secure-publication-proof/stories/F4-prove-opaque-book-delivery-through-epub-js/STORY.md)
- [F5 — Record the trusted-local decision and establish the regression fixture](E01-foundation-and-secure-publication-proof/stories/F5-select-and-record-parser-placement-establish-the-regression-fixture/STORY.md)

## Exit condition

The exact binary handoff renders the deep-marker fixture, baseline publication restrictions hold, and timeout/size/cleanup tests pass.
