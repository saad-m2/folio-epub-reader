# Design A — Quiet bookshelf

Open **[index.html](index.html)** directly in a desktop browser. Everything is included in the HTML; no server, installation, internet connection, or app build is needed.

This file preserves the approved review prototype, separate from the live application. The approved design has now been implemented in the renderer; see [implementation and validation notes](IMPLEMENTATION.md). Folio is the interface identity from the approved design; the application package and data-directory identities are unchanged.

## Design decision

Use a quiet, book-focused Windows interface: charcoal application surfaces, muted sage actions, thin borders, restrained corners, and a warm sepia reading page. Colorful covers provide the main visual interest. Serif display headings add a literary quality while small controls use familiar system type.

Aquile's desktop design informed the cover grid, persistent navigation, selected-book information panel, and reader overlays. The proposal simplifies this structure around the project's three primary areas: Library, Reader, and Settings.

References reviewed on 2026-10-21:

- [Aquile's official site](https://www.aquilereader.in/)
- [Official Windows library screenshot](https://www.aquilereader.in/images/feature1.png): cover grid, sidebar, adjacent selected-book details.
- [Official reader screenshot](https://www.aquilereader.in/images/feature2.png): a separate reading surface and contextual reader controls.

The product scope comes from [PRODUCT.md](../../docs/PRODUCT.md). This proposal does not add Aquile's store, cloud features, bookmarks, annotations, search, statistics, or additional file formats. All eight initial cover illustrations are original inline SVG compositions, rather than copied Aquile assets. The Kafka excerpt is public-domain German text. Other reader passages are illustrative sample copy.

## Review the prototype

The top strip is a **prototype review tool**, not part of the proposed shipping application. Switch between Library, Reader, Settings, and Screen map. The state dropdown and Screen map provide direct access to alternate states.

| Area | Screens and states |
| --- | --- |
| Library | Cover grid, selected-book details, continue reading, first-run welcome, simulated Add books flow |
| Import | Validating, successful sample import, invalid/unsupported EPUB, duplicate replacement, progress reset |
| Recovery | Missing source file, remove confirmation, reader opening, reader open failure |
| Reader | Continuous and two-column page-by-page compositions, chapter/progress footer, show/hide controls |
| Reader overlays | Hierarchical contents, current chapter, appearance adjustments, external HTTPS confirmation |
| Translation | Selection action, model unloaded guidance, loading, result bubble, copy, expanded result, retryable failure, selection too long |
| Appearance | Light, Sepia, Dark, and System page themes; mode; font; text size; margins; line and paragraph spacing; live sample |
| Fonts | Included font, optional catalog, simulated download, available/use state, download failure/retry |
| Local model | Setup instructions, runtime unavailable, model missing, unloaded, loading, loaded, unloading |
| About | Proposed identity and explanation of the concept |

Suggested path:

1. Select a cover to inspect its details. Double-click to open it, or use Continue reading.
2. Try Reader, open Contents, change a chapter, and open the Aa appearance panel.
3. Switch page theme and reading mode. In page-by-page mode, try the footer arrows or keyboard arrows/Page Up/Page Down/Space.
4. Click the opening German passage to preview the Translate selection action. Alternatively, select text yourself. Load the model explicitly, then select text and request translation again.
5. Try the translation result and failure states through the review dropdown.
6. Explore Settings, then Screen map to review the remaining states.

## Interaction and layout rules

- Library and Settings remain dark. Page themes affect the reader only.
- The proposed default font remains Liberation Sans, matching the application. The artifact uses system-font substitutes rather than fetching fonts.
- Controls are shown on entry to the reader for review. Close the toolbar or click the page to preview the quiet state. Show controls at the top restores it. Production should also reveal controls on entering their region with the pointer.
- Escape dismisses a dialog or translation first, then a reader panel, then returns to the library. Dialogs trap keyboard focus, and interactive controls have visible focus outlines.
- Model loading and translation are separate explicit actions. Loading never translates a prior selection. Unloading leaves ordinary reading available.
- Removing a book only changes the sample library; its confirmation explains that the original file is retained.
- The book panel remains visible beside the library on wide screens. At narrower widths, cover selection opens a compact dialog. At phone widths the sidebar becomes an icon rail. This is desktop-first, with responsive behavior for inspection.
- Reader position is communicated through chapter and percentage rather than a promise of stable printed page numbers.

## Prototype limits

Data, model operations, font downloads, imports, pagination, and chapter navigation are simulated in browser memory. Refresh resets the concept. There is no EPUB parser, desktop file picker, model connection, persistent library, or real font installation here. The explicit external-link confirmation can open the public Project Gutenberg page. Copy uses the browser clipboard when available.

The artifact demonstrates representative recoverable translation errors; production should map the existing timeout, memory, interrupted-service, and invalid-output errors into the same compact surface with the appropriate message and Retry behavior. Browser-level selection in this artifact does not reproduce Electron's native Windows context menu.

Single-page pagination and additional formats remain separate product work, consistent with the visual-comparison scope in [FRONTEND-DESIGN-WORKTREES.md](../../docs/planning/FRONTEND-DESIGN-WORKTREES.md).

## Validation

Visually inspected Library, Reader, Settings, and the translation bubble in headless Microsoft Edge. Exercised all 21 review states at widths of 1440, 1280, 1024, 768, and 390 pixels with no JavaScript errors or horizontal overflow. Verified book selection/opening, sample import, removal, model load, selection/translation/expand, appearance changes, font download/use, page navigation, Escape behavior, and visibility of the book panel's primary action. Checked UTF-8 German text and interface symbols after formatting. No application dependency install or app test/build is needed for this isolated HTML proposal; production integration remains pending design selection.
