# Development and verification

Follow the [documentation policy](DOCUMENTATION-POLICY.md) when a task changes behavior, scope, architecture, commands, or release procedures.

Use Windows x64, Node.js 24, and pnpm 12.5.1, matching the root project and CI. Production work does not require the historical Foliate submodule. Exact dependencies and overrides belong to `package.json`, `pnpm-lock.yaml`, and the `patches/` directory.

## Common commands

Run from the repository root:

| Purpose | Command | Notes |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | Uses committed versions |
| Launch development app | `pnpm start` | Generates proof fixtures, builds, starts Electron; uses normal app data unless explicitly isolated |
| Type checking | `pnpm check` | Renderer/shared and main/preload TypeScript |
| Unit/regression suite | `pnpm test` | Vitest; inspect actual output instead of relying on an old documented test count |
| Production build | `pnpm build` | TypeScript plus Vite |
| Trusted-publication Electron proof | `pnpm proof` | Builds and executes the real runtime proof; not merely static assertions |
| Development runtime corpus | `pnpm generate:release-corpus`, then `node scripts/run-release-tests.cjs --development` | Uses isolated temporary data and writes local evidence; this is not packaged qualification |
| Candidate installer | `pnpm package:candidate` | Generates corpus, builds, and runs Forge |
| Packaged runtime corpus | `pnpm test:packaged` | Requires the packaged executable; runner creates an isolated temporary profile |
| Full release build and evidence | `pnpm package:release` | Builds installer, inventories licenses/dependencies, verifies package, and runs packaged corpus checks |

## Choose checks for the change

Documentation-only changes need link/path validation and diff review. For application changes, run type checking and relevant regression tests; run the broader suite/build when shared contracts or integration warrant it. Reader, publication, lifecycle, Electron, and epub.js changes also need the real proof/corpus checks appropriate to the boundary. UI changes need inspection of affected screens and keyboard/focus behavior. Use [release instructions](../release/UPDATES.md) for installer/update changes.

`tests/` contains contracts/security, library/regressions/view, reader-adapter/location/lifecycle, publication validation, font, translation, offline, and update tests. `scripts/` contains fixture generation, proof/corpus runners, supply-chain tools, and opt-in real Ollama checks. Runtime qualification also uses `src/main/release-tests.ts` and `src/renderer/release-tests.ts`.

## Profiles, evidence, and privacy

Normal app data is `%LOCALAPPDATA%/Windows EPUB Reader/Data` with separate `Session` data. For UI qualification use an isolated absolute `E06_TEST_ROOT` together with `E06_UI_TEST=1`; the packaged/development corpus runner sets its own test root and `E06_RELEASE_TEST=1`. See `src/main/paths.ts` before composing a manual launch. Do not run destructive fixtures or qualification against the user's real library.

Generated reports under `release-artifacts/`, spike evidence, EPUB fixtures, outputs under `out/` and `dist/`, databases, local environment values, and diagnostic dumps are ignored intentionally. Some old documents link to local evidence that is unavailable in a clone. Review and sanitize evidence before publishing; do not include local paths or book/selection/translation text. Keep font licenses beside the assets.

The [qualification guide](../release/QUALIFICATION.md) distinguishes owner-approved personal-use scope, deferred checks, and future distribution testing. A successful unit run, development corpus, or installer build does not establish every installed-app gate.
