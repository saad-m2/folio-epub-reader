# Disposable Foliate-js candidate probe

## Claim under test

With publication scripts disabled by the host CSP and Electron hardening intact, Foliate-js can keep a deep semantic EPUB target (`shared.xhtml#two-mid`) valid and visibly paginated after applying font size, margin, theme, line spacing, and paragraph spacing in one settled transaction.

## Success criteria

1. The loaded Foliate book resolves the semantic target to the nested `#two-mid` element before and after styling.
2. Computed font size, line height, paragraph margin, theme color, and paginator margin reflect the requested settings.
3. One `view.goTo(targetCfi)` relocation reports the shared resource's nested target and the target element intersects the reader viewport.

## Failure criteria

The target cannot be resolved, styling does not apply, a single target display lands outside the nested target, or the target is not visible. A failure is candidate evidence only; it does not prove Foliate-js is universally unusable.

## Scope

This probe performs only the deep-marker paginated appearance contract. It intentionally does not test persistence, TOC progress, interaction, containment, accessibility, performance, or production integration.

## Project-local dependency setup

Foliate-js has no stable release and its upstream README recommends a pinned git submodule. This repository contains that dependency at `vendor/foliate-js`, pinned to commit `78914aef4466eb960965702401634c2cb348e9b1`. From a fresh clone, initialize it and install project-local dependencies from the repository root:

```powershell
git submodule update --init -- spikes/renderer-foliate/vendor/foliate-js
pnpm install --dir spikes/renderer-foliate
```

Run actual Electron evidence with:

```powershell
pnpm --dir spikes/renderer-foliate run test:appearance
```

The later SPIKE-001B workflow reached Foliate but ended `INVALID_RUN`: the harness incorrectly required an `index` field on the public `foliate-view` relocation event, although that wrapper event omits the inner renderer index. Raw output and attempt-specific evidence are retained under `evidence/`. The lightweight-renderer timebox is exhausted; do not run this command again without a new explicit architecture decision. See `docs/historical/spikes/SPIKE-001B-REVIEW.md`.
