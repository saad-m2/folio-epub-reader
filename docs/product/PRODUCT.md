# Leaf — Product Definition

**Status:** Authoritative product definition  
**Purpose:** Define what the product is and how it behaves, without prescribing how it is implemented.

Documentation review: 2026-10-22. This definition includes the implemented explicit update flow added in 0.2.0. See the [roadmap](ROADMAP.md) for pending requests, the [design guide](../design/README.md) for the approved interface, and [qualification](../release/QUALIFICATION.md) for the limits of recorded validation.

## 1. Product summary

The product is a polished Windows desktop application for casual book readers who want a clean, minimal way to read local EPUB books.

The application provides a visual book library, remembers reading progress, supports both continuous and page-by-page reading, and offers global controls for the reading appearance. It is local-first and remains fully usable for ordinary reading without an internet connection.

German-to-English translation is optional. Use a separately installed local model with explicit Load/Translate, or configure your own cloud provider and explicitly request translation of selected book text. See section 10 and the [cloud setup guide](CLOUD-TRANSLATION-SETUP.md); E07 real-account qualification is recorded separately from implementation.

## 2. Product principles

### 2.1 Reading comes first

The reading surface should feel calm, uncluttered, and focused on the book. Controls remain out of the way until the user asks for them.

### 2.2 Familiar Windows behavior

The application should feel at home on Windows. Standard keyboard shortcuts, text selection, right-click behavior, file picking, and window interactions should behave as Windows users expect.

### 2.3 Local-first ownership

Users read EPUB files that they already own and store locally. The application does not require an account or cloud service and does not copy imported EPUB files into an application-managed collection.

### 2.4 AI is optional and explicit

Reading never depends on AI setup. Selecting text does not load a model or start translation. The product must not imply that translation is ready when the local service or model is missing or unloaded.

For local translation the user installs and runs the runtime and model separately. The local option requires no API key or per-request payment and keeps selected text on the user's machine. Optional cloud translation uses user-owned credentials and sends selected text to connected providers after explicit Translate, including exhaustion fallback.

### 2.5 Open-source and no-fee dependencies

Software shipped with or required to build and distribute the application must be open source and available under licenses that do not require licensing fees. The product must not depend on paid proprietary SDKs, runtimes, libraries, components, fonts, or other software licenses.

## 3. Intended audience

The initial product is designed for casual book readers rather than a specialist academic, research, or annotation workflow.

The experience should be approachable without requiring the user to understand EPUB internals. Optional translation setup should explain the separate local runtime and model in plain language.

## 4. Initial product scope

The initial product includes:

- Reading local, non-DRM EPUB files.
- Opening EPUBs that the user intentionally selected and trusts; the MVP is not a hostile-document inspection tool.
- A persistent local library of book references.
- Reading-position restoration.
- Table-of-contents navigation.
- Continuous and page-by-page reading modes.
- Global reading appearance controls.
- Optional AI translation of selected book text.
- Friendly handling of invalid, missing, and unavailable books.

The MVP supports Windows 11 on x64 hardware and is distributed through no-cost channels as a direct-download `Setup.exe`. The product will not use distribution channels, code-signing certificates, certifications, or other release services that require payment. If trusted code signing is not available at no cost, the installer is distributed unsigned. Microsoft Store, ARM64, and 32-bit Windows distribution are not part of the MVP.

## 5. Application structure

The product has three primary user-facing areas:

1. **Library:** Add, view, open, and remove books.
2. **Reader:** Read and navigate the active book.
3. **Settings:** Manage global reader preferences and downloadable fonts, and view local translation setup guidance.

## 6. First-run experience

On first launch, an empty library shows only:

- A brief welcome message.
- A prominent **Add books** button.

The initial product does not require a multi-step tutorial or onboarding sequence.

## 7. Library

### 7.1 Startup behavior

The application opens to the library on every normal launch. It does not automatically reopen the last book.

### 7.2 Adding books

- The library provides an **Add books** button.
- Activating the button opens the standard Windows file picker for selecting EPUB files.
- After a valid EPUB is selected, it is added to the library while the user remains on the library screen.
- Drag-and-drop import and opening through Windows file association are not required for the initial product.

### 7.3 Original-file behavior

- Adding a book records a reference to its original file location.
- The application does not copy the EPUB into its own library folder.
- A book therefore depends on the original file remaining at the recorded location.
- Removing a book from the library must never delete or alter the original EPUB file.

### 7.4 Library presentation

- Books appear in a visual grid dominated by their covers.
- Each entry shows the book title, author, and reading progress.
- “Last read” time is not displayed.
- The grid is ordered by most recently opened first.
- Alternative sorting controls are not required for the initial product.
- A book opens when its library entry is double-clicked.

### 7.5 Duplicate books

If the application identifies a selected EPUB as a book already present in the library, it asks whether the user wants to replace the existing library entry. Replacement must not modify the original EPUB file.

Reading progress is preserved automatically when it can be migrated safely:

- If the EPUB bytes are unchanged, existing progress is preserved normally.
- If the EPUB changed or is being replaced, the new EPUB is validated before replacing the library entry.
- The application attempts to resolve the saved logical locator against the validated replacement.
- If the locator resolves reliably, progress is preserved.
- If it does not resolve reliably, progress is cleared/reset and the application explains this clearly.

The MVP does not ask the user to choose a progress-migration policy.

### 7.6 Removing books

- Users can remove a book from the library.
- Removal clears the application's library information for that book, including its remembered progress.
- Removal requires confirmation.
- Removal does not delete, move, or modify the EPUB itself.

### 7.7 Missing files

If a library entry points to a file that has been moved, renamed, or deleted:

- The entry remains in the library until the user acts on it.
- Attempting to open it produces a clear **File not found** state.
- The user is offered **Remove from library** and can cancel without changing the entry.
- The application does not silently remove the entry.

### 7.8 Invalid or unsupported files

If an EPUB cannot be opened:

- The user remains in the library.
- The failed book is not added.
- A concise, non-technical message explains that the EPUB could not be opened.
- Technical diagnostic text is not shown as the primary error message.

### 7.9 Supported EPUB profile

The MVP targets ordinary reflowable EPUB 2 and EPUB 3 publications.

It may explicitly report these as unsupported:

- Fixed-layout EPUBs.
- EPUBs that require scripting.
- Media-overlay/read-aloud features.
- DRM-protected EPUBs.
- Other unusual EPUB features the selected renderer cannot safely support.

The MVP does not add special rendering or security complexity solely to support these cases.

## 8. Reader

### 8.1 Reading modes

The reader supports two modes:

1. **Continuous mode**, which is the default.
2. **Page-by-page mode**.

The selected mode is a global preference and therefore applies across books.

Switching modes keeps the user at the same passage as closely as possible.

### 8.2 Reading flow and pagination model

- Book content is reflowed based on the current window and reading settings.
- In continuous mode, the book uses conventional vertically scrolling reflowable EPUB content. Chapters may have appropriate visual separation, but they do not need to be represented as separately generated page surfaces.
- In page-by-page mode, the book uses conventional EPUB pagination, such as column-based generated pages. A new chapter begins on a fresh generated page.
- Page-by-page mode defaults to an undivided **Single page** layout. A separate **Two pages** choice displays a side-by-side spread on wide windows, falling back to one page on narrow windows. This global preference persists across books, mode changes, and restarts. Settings and the in-reader appearance panel show the layout choice when page-by-page mode is selected.
- Switching page layouts keeps the same logical passage as closely as possible, like switching reading modes.
- Changing the window size or reading appearance may change pagination and the amount of content visible in the continuous flow.
- After a window-size or reading-appearance reflow, the reader returns to the start of the currently active navigable table-of-contents section when one is available. It does not promise to retain an exact page or offset through that reflow. If that navigation structure is unavailable, it returns within the same current spine resource.
- Switching between continuous and page-by-page modes keeps the user at the same logical passage as closely as reasonably possible.

### 8.3 Reading progress and restoration

- The reader shows the current chapter name and progress within that chapter.
- The application remembers a reader's position for each book.
- Reopening a book returns to the same approximate percentage within the chapter.
- Appearance and window reflow retain section/resource continuity as specified above; they do not preserve an exact reading offset. Reading-mode changes and reopening continue to use a meaningful logical position rather than a generated page number.
- Page numbers are not treated as a stable reading-position reference because pages reflow.
- The deepest currently active navigable table-of-contents entry supplies the current chapter/section label and chapter-level progress.
- If no usable table of contents or navigation structure exists, the reader shows the publication title and overall book progress instead.

### 8.4 Reader controls

Reader controls are normally hidden to preserve a distraction-free reading surface.

They appear when:

- The user clicks the central reading area.
- The pointer enters the screen region where the controls live.

The initial reader toolbar contains:

- Back to library.
- Table of contents.
- Current chapter and chapter progress.
- Reading-mode switch.
- General **Reader settings**, containing appearance preferences and translation controls.

The Back control returns to the library immediately. When no overlay or translation bubble is open, `Esc` also returns to the library.

### 8.5 Table of contents

- A compact reader control opens the table of contents.
- It appears as a closable overlay from the left side of the reader.
- It supports the hierarchy supplied by the book.
- It indicates the current chapter.
- Choosing an entry navigates directly to that location and closes the overlay.
- For nested navigation, the deepest active navigable entry is treated as the current chapter/section.

### 8.6 Page-by-page navigation

Page-by-page mode supports:

- Left and right arrow keys.
- `Page Up` and `Page Down`.
- Space to move one page forward.
- Mouse-wheel navigation.
- Clicking the far-left area to move backward.
- Clicking the far-right area to move forward.

Clicking the central reading area reveals or hides reader controls rather than turning the page.

### 8.7 Standard text interaction

- Users can select text in the book.
- Standard Windows keyboard shortcuts should work where applicable.
- Right-clicking selected text exposes the normal Windows text-selection actions.
- AI-specific actions do not replace the standard right-click behavior.

### 8.8 External links

- EPUB content must not silently fetch remote resources.
- When the user explicitly activates an HTTPS link in a book, the application shows a confirmation containing enough destination information for the user to understand where it goes.
- If confirmed, the link opens in the user's normal system browser.
- The EPUB reader itself never navigates to the external website.
- Non-HTTPS external destinations are not opened by the MVP.

## 9. Reading appearance

### 9.1 Scope of preferences

Reading appearance preferences are global. A change made in one book applies to every book.

### 9.2 Application and reader themes

- The library, Settings, and other application surfaces outside the book reader use a fixed dark appearance.
- Reading pages have their own global theme setting.
- Reader theme choices include System, Light, Dark, Sepia, and a custom background color.
- Settings and the in-reader appearance controls offer a hue/saturation color wheel, brightness slider, exact six-digit hex input, and a preview. Users choose **Apply custom color** to save and apply their selection.
- The wheel supports pointer dragging and keyboard input (Left/Right for hue, Up/Down for saturation, Shift for larger steps). Brightness and hex input are also keyboard accessible.
- Applied custom colors persist on this device across restarts and apply to every book in both reading modes. Switching to a preset preserves the last custom color for reuse.
- Custom backgrounds automatically use black or white reading text and underlined links, selecting the higher-contrast foreground for readability.
- Changing the reader theme does not change the fixed-dark library and Settings surfaces.

### 9.3 Adjustable properties

Users can adjust:

- Font family, when additional fonts are available.
- Font size.
- Page margins.
- Line spacing.
- Paragraph spacing.

Font size, margins, line spacing, and paragraph spacing use simple minus/plus controls and update the reading view immediately.

### 9.4 Fonts

- The application includes one carefully chosen default reading font.
- The default font is available offline from first launch.
- Settings offers an in-app catalog of additional fonts that users can choose to download.
- Once downloaded, an additional font can be selected as the global reading font.
- Downloaded fonts remain usable for offline reading.

The exact catalog contents are not defined by this document.

### 9.5 Text alignment

- The reader respects alignment specified by the book.
- If the book does not specify alignment, text is left-aligned.
- A user-facing alignment override is not required for the initial product.

## 10. AI translation

### 10.1 Availability

- AI translation is optional.
- The initial translation direction is German to English.
- The user installs Ollama and the supported local model separately; the app neither bundles nor downloads them.
- Local translation requires no API key, cloud account, or per-request charge. Once installed, it works without internet access.
- The supported local model is Tencent Hy-MT2-7B Q4_K_M. Settings offers local Ollama and configured Microsoft Translator and DeepL accounts. There is no arbitrary model, endpoint, or prompt picker.
- Ordinary reading works without Ollama or the model.

### 10.2 AI Settings

Settings explains how to install the supported local runtime and model and how to diagnose a missing installation. No API key or target-language setting is needed for the initial German-to-English direction. The app does not start Ollama, download a model, or load it into GPU memory on launch.

For cloud translation, Settings configures protected credentials, selects the saved current provider, and offers removal and explicit availability checks. Connecting an account or selecting a provider submits no text. The [cloud requirements](CLOUD-TRANSLATION-REQUIREMENTS.md) and [setup guide](CLOUD-TRANSLATION-SETUP.md) define fallback, free-cutoff setup, and provider-specific checks.

The general **Reader settings / Translation** section provides service selection for local Ollama and configured cloud providers, status, and local Load/Unload alongside appearance preferences, without leaving the book or changing the reading position. There are no separate top-right translation controls. A manual switch cancels pending translation and clears the old selection/result; the new service applies to the next explicit Translate. Switching from local Ollama to a configured cloud service automatically unloads the local translation model. An unload failure keeps the previous service selected and reports an error; a stopped or uninstalled Ollama does not block cloud selection. Selecting local Ollama never loads it automatically. Credential setup remains in Settings.

### 10.3 Manual model controls

- **Reader settings / Translation** includes **Load translation model**, **Unload translation model**, and a clear status for local Ollama.
- Opening the app or a book, selecting text, and visiting Settings never load the model.
- **Load** explicitly warms the local model; **Unload** explicitly releases it while the reader remains open. Switching books does not silently change its state.
- Status distinguishes missing Ollama, missing model, unloaded, loading, loaded, unloading, and recoverable failure. It reflects the local runtime's actual state, which another local Ollama client may change.
- Loading can take several seconds and occupies substantial GPU memory. The reader remains usable while it loads. If the app loaded the model, it makes a best-effort release on app exit; it does not assume exclusive ownership of Ollama.
- A request to unload during an active translation cancels that translation and does not show a stale result.

### 10.4 Selecting and requesting a translation

1. The user selects a word, phrase, sentence, or longer passage in the book.
2. A small **Translate** action appears near the selection.
3. Selection alone does not submit any text.
4. On **Translate**, the selected text goes to the current provider: the local model must already be loaded; a cloud account must be configured. Confirmed cloud exhaustion may retry that same selection across configured eligible cloud providers, with each attempted at most once.

The translation action contains only **Translate**. Copying and other ordinary text actions remain in the normal Windows selection workflow.

### 10.5 When translation is unavailable

If the user clicks **Translate** while the model is unloaded or unavailable:

- No translation request is attempted.
- The application explains whether to use **Load**, install Ollama, or download the supported model.
- Loading the model never automatically translates an earlier selection. The user selects text and clicks **Translate** again after loading.

The experience must not present translation as ready when the model is not loaded.

These model-readiness rules apply to the local option. Cloud errors distinguish exhaustion, authentication, temporary rate limits, network failures, timeout, and invalid output. Only confirmed exhaustion causes automatic fallback; other failures need explicit retry or a manual switch. No cloud failure selects or loads Ollama.

### 10.6 Translation size limit

- Translation supports anything from a single word through several paragraphs.
- The initial maximum selection is approximately 5,000 characters.
- If the selection is too long, the user receives a clear message asking for a shorter selection.
- The exact limit may be adjusted after usability and local-performance testing without changing the intended experience.

### 10.7 Translation result

- The result initially appears in a small bubble associated with the selected text.
- The bubble is placed above or below the selection, depending on available screen space.
- The original selection remains visible and highlighted.
- Clicking elsewhere dismisses the result.
- Only the current temporary translation needs to be shown; translations are not saved to the book or library.

The result provides:

- The translated text.
- The provider that produced it.
- **Copy**.
- **Expand** when a larger view is useful.

### 10.8 Long results and limited space

If the complete translation cannot fit comfortably near the selection:

- The anchored bubble shows a compact preview that fits the available space.
- The user can expand it into a larger centered overlay above the reader.
- The selected source passage remains highlighted behind the overlay.
- The expanded view provides **Copy** and **Close**.

### 10.9 Loading and errors

The anchored translation surface appears promptly and communicates that the request is in progress.

Failures are shown in plain language inside the translation surface:

- Missing runtime or model explains the local setup step.
- A model that was unloaded by another client prompts the user to load it again.
- Timeout, out-of-memory, local-service, and invalid-result failures show friendly guidance and **Retry** when appropriate.

Raw technical errors are not shown by default.

### 10.10 Cloud fallback and allowance recovery

The current provider is saved across restarts without a separate preferred provider. Following confirmed exhaustion, Leaf picks the first configured, eligible, unattempted provider from Microsoft, then DeepL, saves that provider as current before its attempt, and stays there until manually changed or exhausted again. Recovery of another provider never automatically changes the current provider.

Exhaustion survives restart. Manual Check availability uses the DeepL usage API. Microsoft sends a short fixed test phrase only on the explicit check action and explains its small allowance use. Checks never send book text, automatically restore a preferred provider, or translate an old selection. Unknown checks retain exhaustion; Leaf does not assume all allowances reset monthly. Removing the current cloud account requires a new explicit provider choice. Amazon Translate was removed by the owner on 2026-10-25; migration deletes its app-owned saved credentials/allowance state and clears an AWS current-provider choice, requiring explicit selection of a supported option without loading Ollama.

## 11. Offline and network behavior

- Adding, opening, reading, navigating, and restoring books work offline.
- The bundled default font works offline.
- Previously downloaded fonts work offline.
- Optional cloud translation and explicit cloud availability checks, font downloads, explicit app update checks/downloads, and confirmed external HTTPS links use internet access. Update checks run only when requested in Settings; ordinary launch and reading do not check for updates. Installing Ollama or downloading the model is a separate user action outside the app; local translation itself needs no internet connection.
- Failure of an online action must not prevent ordinary offline reading.

### 11.1 App updates

Settings → App updates shows the installed version and provides an explicit **Check for updates** action when updates are configured for the installed Windows x64 app (version 0.2.0 placed these controls under About). There is no scheduled or startup check. A newer version downloads after the requested check; the panel shows checking/downloading status and prevents duplicate actions. Once ready, **Restart and install** asks for confirmation and closes active reading/model resources before restarting. A downloaded update can also apply on a later normal restart. Builds without a configured update source explain how to upgrade manually. Updates preserve the user's library, reading positions, preferences, and downloaded fonts. See [update and release instructions](../release/UPDATES.md) for configuration and qualification.

## 12. MVP boundaries

The following are deliberately postponed and are not initial-version requirements:

- Bookmarks.
- Highlights.
- Annotations or notes.
- Book or library search.
- A general **Ask AI** action with a user-written prompt.
- Leaf-hosted cloud accounts (user-owned translation-provider accounts are covered by section 10).
- Cloud synchronization.
- Mobile applications.
- PDF support.
- DRM-protected books.
- Drag-and-drop book import.
- Opening EPUB files through Windows file association.
- Alternative library sorting modes.
- Per-book reading appearance or reading-mode settings.

These capabilities must not be presented as available until they are intentionally added to the product.

## 13. Open product details

The initial discovery left the following details open. The implementation and approved design now supply some concrete choices; distinguish those choices from remaining product decisions:

- Metadata fallbacks are implemented, including deterministic illustrated covers in the approved frontend; consult the current validation/UI code before revising their wording or appearance.
- Whether reaching the end creates a distinct **Finished** state.
- The initial font catalog is implemented with bundled Liberation Sans and optional Atkinson Hyperlegible and Source Serif 4. Future catalog additions require license/provenance and integrity review.
- The current translation selection limit is 5,000 characters; any adjustment remains subject to usability and local-performance validation.
- The approved Quiet bookshelf design is implemented. Future visual refinements should use the [design guide](../design/README.md).

The separate Finished state remains undecided. Pending format expansion is tracked in the roadmap. Product details must not be treated as permission to introduce unrelated architectural or technology choices into this document.

## 14. Product acceptance summary

The initial product succeeds when a casual reader can:

1. Launch the application into a clear visual library.
2. Add a local EPUB without the application copying or modifying it.
3. Open the book and read comfortably in either continuous or page-by-page mode.
4. Navigate by table of contents, mouse, and keyboard.
5. Close and later resume at the same passage.
6. Apply global reading preferences across books.
7. Read normally without an account, local model, or internet connection.
8. Optionally load the installed local model, explicitly translate selected German text, unload it while reading, and view the result without leaving the reading context.
9. Understand and recover from missing books, invalid EPUBs, and translation failures through clear, non-technical guidance.

This document primarily defines product behavior. Technical architecture, frameworks, programming languages, data storage, EPUB rendering components, networking design, key-storage mechanisms, and application structure remain outside its scope except where explicit owner decisions above constrain them.
