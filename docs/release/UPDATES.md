# Windows releases and updates

## Product name and upgrade compatibility

The app is named **Leaf** (formerly Folio). The frontend, window title, About screen, Windows product metadata, and installer display title use Leaf. The internal npm/package name, executable and Squirrel IDs, `WindowsEpubReaderSetup.exe` filename, existing data directory, and configured `saad-m2/folio-epub-reader` release repository remain stable so existing installs retain their library and upgrade path. The GitHub repository has not been renamed. Historical documentation retains the names used when it was written.

## Install version 0.3.0

Close Leaf (or the older Folio/Windows EPUB Reader build) and run `WindowsEpubReaderSetup.exe`. This is a per-user Squirrel upgrade from earlier versions, including 0.2.3; it keeps the installer identity and the data directory `%LOCALAPPDATA%\Windows EPUB Reader\Data`. Books remain in their original locations. Reading positions, preferences, and downloaded fonts live outside the versioned application directory.

The installer is unsigned. A local build is not a published GitHub release.

## In-app updates

The release repository is [saad-m2/folio-epub-reader](https://github.com/saad-m2/folio-epub-reader). Versions 0.2.0 and later are configured for that repository.

In 0.2.1 and later, **Settings → App updates** shows the actual running version and update status; 0.2.0 has these controls under **Settings → About**. Checking is explicit: no startup check, scheduled check, or background network request runs until the user chooses **Check for updates**. A newer release downloads through Electron's built-in Windows Squirrel updater. The panel shows checking/downloading status and prevents duplicate actions. Once ready, **Restart and install** requests confirmation and releases publications and the translation model before restarting. A downloaded update can also apply on a later normal app restart.

The updater is enabled only for an installed Windows x64 build with a trusted build-time `package.json` field:

```json
"updateRepository": "YOUR_GITHUB_OWNER/YOUR_PUBLIC_REPOSITORY"
```

An empty value leaves online updates unconfigured and displays manual upgrade instructions. The renderer cannot choose a feed or installer URL. The feed is derived from this repository and the running version using `https://update.electronjs.org/OWNER/REPO/win32-x64/VERSION`. The first few seconds after Squirrel installation are reserved for setup to release its lock.

The repository must be public and have published, non-prerelease GitHub Releases. No access token is shipped in the app. A private repository needs a different update service. See [Electron's update service documentation](https://www.electronjs.org/docs/latest/tutorial/updates#using-updateelectronjsorg).

## Developer release procedure

For integration, versioning, packaging, publication, and installed-update verification, follow the [release workflow](../workflow/RELEASE-WORKFLOW.md).

## 0.3.0 changes and qualification

Cloud translation adds user-owned Microsoft Translator and DeepL accounts alongside local Ollama. Translation service selection, status, and local model controls share Reader settings with appearance controls. Switching from Ollama to cloud releases the local translation model; returning to local requires an explicit Load. Confirmed cloud allowance exhaustion can switch to another configured cloud provider and stay there. Amazon Translate is not supported; retired app-owned credentials are removed by migration.

On 2026-10-25, version 0.3.0 passed type checking, all 276 tests across 23 files, and the full Windows release pipeline: license checks, zero-advisory dependency audit, Squirrel installer creation, packaged dependency verification, all 12 isolated packaged runtime fixtures, and final installer verification. The staged source and packaged app were checked to exclude account data and runtime databases.

See [account setup](../product/CLOUD-TRANSLATION-SETUP.md) and [qualification scope](QUALIFICATION.md#e07-cloud-translation). Credentials remain in Windows-protected local app storage and are not part of the installer or repository. Real-provider allowance/quality checks, physical GPU-memory release, hosted older-version download/restart, Narrator, and physical display-scaling checks remain unrun for this candidate.

## 0.2.3 verification

On 2026-10-24, type checking, all 163 unit/regression tests, and `pnpm package:release` passed on Windows x64. The release build produced the 0.2.3 installer and Squirrel update package, passed license and packaged-dependency checks, and passed all 12 packaged runtime fixtures with an isolated profile. The completed dependency audit reported zero advisories after updating Zod to 4.6.6 and pinning patched Undici and fast-uri versions. A regression test verifies that oversized selection rectangle arrays are rejected before their contents are validated.

The background color wheel now preserves its spectrum when the shared button hover style applies. In the packaged app with an isolated profile, hover, dragging, pointer and keyboard selection, visible keyboard focus, applying a color, and settings persistence passed. Reintroducing the previous hover rule reproduced the missing spectrum. The real older-installed-version hosted download/restart flow, Narrator, and physical-DPI qualification remain unrun for this release.

## 0.2.2 verification

On 2026-10-23, type checking and all 162 unit/regression tests passed on Windows x64. The release build produced the 0.2.2 installer and Squirrel update package, passed license and packaged-dependency checks, and passed all 12 packaged runtime fixtures with an isolated profile. The final installer/dependency verification passed on retry after the audit service initially returned an invalid response; the completed audit reported zero advisories. Electron was patched to 42.11.18 and the build-only `ip-address` dependency to 10.7.4 to resolve the advisories found during release preparation.

The owner approved the single-page/two-page behavior after testing the worktree app. The real older-installed-version hosted download/restart flow, Narrator, and physical-DPI qualification remain unrun for this release.

## 0.2.1 verification

On 2026-10-22, `pnpm check`, all 159 unit/regression tests, and `pnpm package:release` passed on Windows x64. The release pipeline built the installer, checked dependencies/licenses and packaged contents, and passed all 12 packaged runtime fixtures with an isolated test profile. The App updates tab was also inspected through simulated download/ready states in a browser with a mocked desktop API. The real older-installed-version hosted download/restart flow and Narrator/physical-DPI checks remain unrun for this candidate.

No dependencies or renderer network permissions were added for this feature. Update checks/downloads occur in the main process through Electron/Squirrel.
