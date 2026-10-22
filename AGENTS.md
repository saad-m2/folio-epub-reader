# Leaf project guidance

Leaf is a local-first Windows 11 x64 EPUB reader built with Electron, TypeScript, React, and epub.js. It references original books and offers optional local German-to-English translation through Ollama.

## Find context for a task

Start with [docs/README.md](docs/README.md), then read only the documents and code relevant to the task. Do not load the whole documentation tree by default.

- Product behavior and scope: [product definition](docs/product/PRODUCT.md).
- Architecture and source-file map: [architecture overview](docs/architecture/OVERVIEW.md).
- Pending feature requests: [roadmap](docs/product/ROADMAP.md).
- UI work: [design guide](docs/design/README.md).
- Commands and verification: [development guide](docs/development/README.md).
- Packaging and updates: [release instructions](docs/release/UPDATES.md) and [qualification scope](docs/release/QUALIFICATION.md).

`docs/historical/` preserves old plans, stories, spikes, and reviews. Consult it for a specific decision or investigation; its original stop rules, version pins, open findings, and completion claims describe their time, not the current task. Check current source and current docs before carrying them forward. The old spike harnesses under `spikes/` are separate from production.

## Preserve these boundaries

- Never modify, move, delete, or copy original EPUBs into an app-managed collection as part of library operations.
- Keep paths, SQLite, native dialogs, fonts, updates, and Ollama access in main. Expose only named, validated preload intents with sender/session checks.
- Keep Electron sandboxing, context isolation, and web security enabled; Node integration and publication scripts stay disabled. Publication frames receive no app bridge or general network access.
- Keep epub.js lifecycle and DOM/CFI integration in `src/renderer/reader-adapter.ts`. Preserve semantic restoration and the separate section-start rule for appearance/window reflow.
- Model Load and selected-text Translate remain separate explicit actions. Selection alone never submits text. Render results as bounded plain text; do not persist or log translation text.
- Use isolated temporary profiles for app qualification, not the user's real library. Do not claim unrun, waived, or deferred checks passed.

## Work and verification

Use Node.js 24 and pnpm 12.5.1; `package.json` and the lockfile own dependency versions. Common commands are `pnpm check`, `pnpm test`, and `pnpm build`. Choose additional runtime/packaged checks from the development guide according to the change. Documentation-only edits need link/path and diff checks, not a new installer.

Follow the [documentation policy](docs/development/DOCUMENTATION-POLICY.md) during future work: update affected guides alongside meaningful changes, maintain accurate roadmap/verification status, and check links before completion. Small internal fixes need no new document unless they add lasting context. Keep this file short; archive superseded records with their current replacement linked.
