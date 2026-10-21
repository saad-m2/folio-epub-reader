# Windows releases and updates

## Install version 0.2.0

Close Windows EPUB Reader/Folio and run `WindowsEpubReaderSetup.exe`. This is a per-user Squirrel upgrade from 0.1.0; it keeps the installer identity and the data directory `%LOCALAPPDATA%\Windows EPUB Reader\Data`. Books remain in their original locations. Reading positions, preferences, and downloaded fonts live outside the versioned application directory.

The installer is unsigned. A local build is not a published GitHub release.

## In-app updates

The release repository is [saad-m2/folio-epub-reader](https://github.com/saad-m2/folio-epub-reader). Version 0.2.0 is configured for that repository.

Settings → About shows the actual running version and update status. Checking is explicit: no startup check, scheduled check, or background network request runs until the user chooses **Check for updates**. A newer release downloads through Electron's built-in Windows Squirrel updater. Once ready, **Restart and install** requests confirmation and releases publications and the translation model before restarting. A downloaded update can also apply on a later normal app restart.

The updater is enabled only for an installed Windows x64 build with a trusted build-time `package.json` field:

```json
"updateRepository": "YOUR_GITHUB_OWNER/YOUR_PUBLIC_REPOSITORY"
```

An empty value leaves online updates unconfigured and displays manual upgrade instructions. The renderer cannot choose a feed or installer URL. The feed is derived from this repository and the running version using `https://update.electronjs.org/OWNER/REPO/win32-x64/VERSION`. The first few seconds after Squirrel installation are reserved for setup to release its lock.

The repository must be public and have published, non-prerelease GitHub Releases. No access token is shipped in the app. A private repository needs a different update service. See [Electron's update service documentation](https://www.electronjs.org/docs/latest/tutorial/updates#using-updateelectronjsorg).

## Publish the next version

1. Set the real `updateRepository` before building the installer that should receive updates. Keep it consistent in subsequent releases.
2. Increase `package.json` version (for example, 0.2.0 → 0.2.1). Keep the Forge package/executable/Squirrel names and data directory unchanged.
3. Run `pnpm check`, `pnpm test`, and `pnpm package:release` on Windows.
4. Tag that tested commit with the matching version, for example `v0.2.1`, and push it to the configured GitHub repository when ready to publish.
5. The existing CI workflow builds and verifies the installer, then creates a **draft** release containing `WindowsEpubReaderSetup.exe`, `RELEASES`, the `*-full.nupkg` package, and supply-chain evidence. Review and publish that draft as a normal release. All three Squirrel files are required; Setup.exe alone cannot serve the updater.
6. From an older installed version, use Settings → About → Check for updates, then Restart and install. Confirm the new version and preserved library/settings.

Release access and a published newer version are required to qualify the real hosted download/restart flow. Local controller tests cannot establish that the release service is working. Do not describe it as verified until that two-version installed test has run.

No dependencies or renderer network permissions were added for this feature. Update checks/downloads occur in the main process through Electron/Squirrel.
