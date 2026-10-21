# Disposable epub.js renderer spike

This directory is isolated experiment code. It is not the production application and can be removed as a unit.

## Reproduce

From this directory:

```powershell
pnpm install
node scripts/generate-fixtures.cjs
pnpm test
pnpm start
```

The real-world `fixtures/alice-gutenberg.epub` fixture is Project Gutenberg ebook 11 and is intentionally not regenerated. The other three small fixtures are generated deterministically by `scripts/generate-fixtures.cjs`.

To repeat the automated Electron evidence run:

```powershell
$env:SPIKE_AUTOMATED='1'
pnpm start
Remove-Item Env:SPIKE_AUTOMATED
```

Focused fixture probes use `SPIKE_FIXTURE`; optional `SPIKE_MODE=paginated`, `SPIKE_NEXT=1`, and `SPIKE_TOC=1` exercise the corresponding controls. Evidence is written beneath `evidence/`.

## Scope

The harness deliberately contains only a file picker, fixture chooser, TOC, two flow modes, minimal appearance controls, CFI persistence, selection anchoring, and security probes. It has no library, database, translation service, settings application, packaging, or production architecture.
