# Remaining E06 qualification

**Status:** Current qualification guidance, carrying forward the owner's recorded personal-use scope decisions. Reconciled 2026-10-22; no checks were rerun during this documentation cleanup. Historical [E06 status](../historical/planning/epics/E06-hardening-and-windows-release.md) records later packaged/installed results that supersede the earlier blanket "no packaged runtime validated" review. The [frontend integration record](../historical/reviews/FRONTEND-IMPLEMENTATION.md) records subsequent development/runtime journeys, not a new installer qualification. Use evidence for the exact candidate being evaluated.

For 0.2.0 and later, also follow the [update qualification instructions](UPDATES.md): a real hosted two-version installed download/restart check is a separate gate and is not established by local updater tests. Use the [release evidence template](templates/RELEASE-EVIDENCE.md) to record passed, failed, deferred, and waived checks distinctly. Generated `release-artifacts/` evidence is local and ignored; it may be unavailable in a fresh clone.

The owner directed on 2026-10-02 that all remaining tests be deferred for personal use. The candidate is accepted within that revised scope; unexecuted checks are not reported as passed. The procedures below remain future qualification for wider distribution. Run them against the exact candidate identified in `release-artifacts/E06-RELEASE-EVIDENCE.md` and record versions, hardware, timings, screenshots and outcomes before claiming full qualification.

## Installer lifecycle (H6)

The owner waived clean-machine/VM testing on 2026-10-02 because this is primarily for personal use. The matrix below is optional future distribution qualification. Host installer smoke testing and artifact/hash checks still provide useful evidence. Windows policy changes are performed by the user, not the agent.

1. Verify Setup.exe SHA-256, install as a standard user, and check Start Menu/desktop shortcuts and application launch.
2. Import supported corpus books, change appearance, save reading locations and add a font. Exit and relaunch; verify persistence.
3. Install a genuinely newer candidate over this installation; verify shortcuts, launch and retained books/settings/locations/fonts.
4. Uninstall and verify application binaries and shortcuts are removed. Verify the documented retained data under `%LOCALAPPDATA%/Windows EPUB Reader/Data` remains available.
5. Reinstall and verify retained library, locations, settings and fonts load correctly. Record uninstall/reinstall behavior rather than assuming Squirrel events prove it.

## Offline and Ollama (H3/H4)

Install Ollama and the documented Hy-MT2 model separately. Record their versions, model identifier, CPU/GPU and memory. A VM is not required for the owner's personal release. Run with an isolated `E06_TEST_ROOT`, `E06_UI_TEST=1` and `E06_OFFLINE_TEST=1` to inject public-network failure while retaining fixed-origin loopback. This does not claim physical network disconnection; that remains a stronger optional follow-up. Preserve `offline-network.json` before starting another offline run.

Verify launch/import/read/navigation/appearance/close/reopen, bundled and previously downloaded fonts, and location restoration. Exercise explicit model Load, selection translation, Unload, book switching, repeated Load/Unload and app exit. Measure cold load, warm translation and model/GPU memory release. Verify opening/selecting a book does not submit text or load a model; inspect request logs. Stop Ollama; reading must remain usable. Do not remove the owner's installed model for a test: exercise missing-model responses with the gateway tests or a separately controlled service. Exercise failed font download and confirmed HTTPS link activation/cancellation. Recorded packaged UI checks are in `release-artifacts/offline-ui.json`.

## Visual/accessibility (H5)

On 2026-10-02 the owner removed spoken Narrator testing from the personal-use release gate and chose to handle it independently, then deferred all remaining tests. Narrator and physical Windows display-scaling checks below are unverified future follow-up.

Exercise Library, Reader, TOC, Appearance, Settings, translation overlay and error states at 100%, 125%, 150% and 200% Windows display scaling, plus a narrow window. Check all themes, long titles, absent cover/TOC, missing sources, selection and translated text. Check focus visibility/order, keyboard-only operation, Escape dismissal, Narrator labels/state announcements and continued use after renderer recovery. Record results and screenshots for each matrix cell.

## Performance (H4)

Run `pnpm test:packaged` on the recorded candidate/hardware. Retain measurements and investigate retention. The owner approved reasonable memory above the previous 500 MiB target: current conservative guards are 768 MiB ordinary and 1,024 MiB stress, with residual growth below 75 MiB after 20 cycles. The report records pre/post diagnostic-collection memory and heap data; forced collection is not a production fix.
