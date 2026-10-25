# Release workflow

Use this procedure to integrate an approved feature and publish its update. General working and verification rules are in the [agent guidelines](AGENT-GUIDELINES.md); update affected documentation under the [documentation policy](DOCUMENTATION-POLICY.md). User installation/update instructions and dated release history remain in [Windows releases and updates](../release/UPDATES.md).

For small features, first finish the [small-feature workflow](SMALL-FEATURE-WORKFLOW.md), including owner testing. Approval of that preview authorizes merge, push, and publication; do not repeat the permission request unless scope or behavior materially changes. Documentation-only maintenance does not itself require an application release.

## Integrate and publish

1. Fetch again and incorporate any newer `main` changes into the feature branch. Resolve conflicts, inspect the combined diff, and rerun verification on the integrated result. If integration materially changes the approved behavior, provide a fresh preview and obtain approval of that result.
2. Prepare the next unused version under [version and packaging rules](#version-and-packaging-rules), normally a patch increment for a small compatible improvement. Update `package.json` and any lockfile metadata affected by the version change, plus relevant release notes/docs. Preserve installer/update identity. Run `pnpm check`, `pnpm test`, and `pnpm package:release` on the final candidate and record the actual qualification scope. Do not bypass a failing release check.
3. Commit the final result and fast-forward `main` to the tested feature commit where possible, using a clean checkout without disturbing unrelated work. If `main` advances again, integrate and verify again. Push `main` normally; do not force-push. Tag the tested release commit with its matching `vVERSION` and push that tag.
4. Monitor CI through completion. The current [release workflow](../../.github/workflows/ci-release.yml) creates a draft. Review its version, commit, checks, notes, and required installer/Squirrel/evidence files, then publish it as a normal, non-prerelease release so the updater can discover it. Creating or pushing a tag alone does not complete the release.
5. Report the released version, commit, release link, checks, and any unrun qualification. Where feasible, verify the real installed older-version update flow; distinguish publication from a verified download/restart. Keep the existing [qualification scope](../release/QUALIFICATION.md) explicit.

If credentials, CI, or another external condition blocks completion, report the exact remaining step and preserve the worktree/artifacts. Do not claim a draft or local installer is a published update. Remove the feature worktree/branch only after release completion and when no uncommitted work or needed preview remains; never remove the owner's source books or normal app data.

## Version and packaging rules

- Set the real `updateRepository` in [package.json](../../package.json) before building; keep it consistent in future releases. Preserve the existing Forge package/executable/Squirrel names and data directory so upgrades retain library/settings. See [upgrade compatibility](../release/UPDATES.md#product-name-and-upgrade-compatibility).
- Select a version newer than the published release and unused among local/remote release tags. The tag must match `package.json` on the tested commit. Do not reuse a published version or move a published tag.
- `pnpm package:release` generates the corpus, builds, inventories dependencies/licenses, verifies dependencies, makes the Squirrel package, verifies packaged contents, runs packaged runtime tests, and verifies installer dependencies. The authoritative command is in `package.json`; a successful installer build alone is insufficient.
- The current CI triggers on `main`, pull requests, manual dispatch, and `v*` tags. Only a version-tag run creates a draft release. Required update files are `WindowsEpubReaderSetup.exe`, `RELEASES`, and the `*-full.nupkg`, plus generated supply-chain reports. Installer output is in `out/make/squirrel.windows/x64/`.
- A locally verified release can alternatively be created as a draft with `gh release create vVERSION --draft --target TESTED_COMMIT` and the exact artifacts from the tested release build. Upload and review all required files before publishing as latest. Do not create a duplicate release if CI has already made its draft.
- Use the [qualification guide](../release/QUALIFICATION.md) and [evidence template](../release/templates/RELEASE-EVIDENCE.md) for exact-candidate results and existing personal-use deferrals. Sanitize evidence before sharing; generated license reports should use repository-relative paths.

## Verify the installed update

A published normal release in the configured public repository is required for the existing update service. Release access and a genuinely older installed build are needed to test hosted download/restart. Local controller tests cannot establish that the service works.

From version 0.2.1 onward, use **Settings → App updates → Check for updates**, then **Restart and install**. Version 0.2.0 has these controls under **Settings → About**. Confirm the new running version and retained library, reading positions, preferences, and fonts. Run qualification with isolated profiles as appropriate; do not alter the owner's normal library for testing. Record the hosted flow as unrun unless this actual two-version test completes.
