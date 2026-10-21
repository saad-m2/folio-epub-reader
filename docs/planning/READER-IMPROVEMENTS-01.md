# Reader improvements

Recorded: 2026-10-21. Status: documented for planning; implementation has not started.

These three work items capture feedback on the current app. They extend the existing EPUB-focused product definition; they do not claim that additional formats already work.

## 1. Improve the frontend

**Reported problem:** The current frontend looks poor and needs a visual redesign.

**Desired result:** A polished, coherent interface across Library, Reader, and Settings, with clear hierarchy, consistent spacing and typography, and comfortable reading controls.

**Scope:** Review the existing screens and states, agree on a visual direction, and implement it consistently. Cover the empty library, book cards, reader toolbar, settings, dialogs, and loading/error states. The specific visual direction is still to be chosen; this report does not establish individual visual defects through a UI audit.

**Acceptance criteria:**

- Library, Reader, and Settings follow a consistent visual system.
- Controls and text remain usable at supported window sizes and Windows scaling levels.
- Themes, keyboard focus, contrast, and existing reading interactions remain usable.
- Before/after screenshots show the main screens and representative empty/error states for review.

**Likely implementation areas:** `src/renderer/src.tsx`, `src/renderer/style.css`, and related UI components.

## 2. Expand supported file types

**Reported problem:** The app does not support all the book/document file types the user wants to read.

**Current implementation:** The import picker only offers `.epub` files (`src/main/index.ts`), and publication opening explicitly rejects other extensions (`src/main/publications.ts`). The current validation and renderer are EPUB-specific. Some EPUB profiles are also deliberately unsupported, including fixed-layout and encrypted publications.

**Desired result:** Users can import and read an explicitly agreed set of additional formats, with clear guidance for unsupported inputs.

**Scope decision still needed:** Identify the actual formats and their priority. PDF, TXT, FB2, MOBI, and AZW3 are examples to discuss, not an agreed support list. Supporting every file type is not a bounded implementation requirement. Decide separately whether any currently excluded EPUB profiles should be supported.

**Acceptance criteria:**

- Document a supported-format matrix and the limitations of each format.
- Each agreed format can be selected, validated, added to the library, opened, closed, and reopened.
- Define and verify reading-position restoration, navigation, appearance controls, and text-selection behavior for each format where applicable.
- Invalid and unsupported files produce helpful messages without leaving broken library entries.
- Existing EPUB behavior continues to work; verify new formats with representative fixtures.

**Likely implementation areas:** `src/main/index.ts`, `src/main/publications.ts`, library records and shared contracts, publication validation, and reader adapters. Expanding the file-picker filter alone is insufficient.

## 3. Allow page-by-page reading with one page on screen

**Reported problem:** Page-by-page navigation currently requires the reading surface to be split into two halves. Users cannot choose an undivided single-page view while retaining page turns.

**Current implementation:** `src/renderer/reader-adapter.ts` sets `spread: "always"` for paginated mode. The settings only distinguish continuous and paginated reading; page layout is not an independent preference.

**Desired result:** Users can read one page at a time across an undivided reading surface and navigate forward/backward. Two-page reading remains available as a separate layout choice.

**Acceptance criteria:**

- Expose a clear choice between single-page and two-page layout for page-by-page reading.
- Single-page layout uses one reading page without a second column or forced spread.
- Previous/next controls and existing keyboard, wheel, and edge-click navigation work in both layouts.
- Persist the layout choice across restart and apply it consistently across books.
- Preserve the semantic reading position when switching layout, changing reading mode, or resizing; exact generated page numbers need not remain identical after reflow.
- Verify chapter boundaries, narrow/wide windows, appearance changes, and reopening a book in both layouts.

**Likely implementation areas:** Reader settings/contracts and persistence, `src/renderer/reader-adapter.ts`, settings UI, and relevant navigation/adapter tests.

## Suggested parallel work with Git worktrees

**Current decision:** First compare three independent frontend designs using the worktrees described in [FRONTEND-DESIGN-WORKTREES.md](FRONTEND-DESIGN-WORKTREES.md). The frontend/formats/pagination split below is an earlier proposal for subsequent implementation, not the current worktree setup.

First create a reviewed baseline commit containing the current application. At the time of this note, most project files are untracked; a new worktree receives committed files, not the untracked working copy. Review staged changes and exclude generated output, local data, and secrets before committing.

Use one branch and worktree per work item:

| Branch | Suggested sibling directory | Main responsibility |
| --- | --- | --- |
| `improve/frontend` | `../epub-reader-frontend` | Visual system and screen styling |
| `improve/formats` | `../epub-reader-formats` | Format matrix, import pipeline, format-specific readers |
| `improve/single-page` | `../epub-reader-single-page` | Independent page-layout preference and pagination |

After the baseline commit, create them from the same starting point:

```powershell
git worktree add -b improve/frontend ../epub-reader-frontend HEAD
git worktree add -b improve/formats ../epub-reader-formats HEAD
git worktree add -b improve/single-page ../epub-reader-single-page HEAD
```

Each worktree is a separate checkout with its own files, branch, staging area, and working changes. They share the repository's commit history and Git objects. Editing or committing in one worktree does not update the files in the others. A branch normally can be checked out in only one worktree at a time.

Install dependencies and run checks in each checkout as needed. Keep runtime profiles, generated outputs, and app instances isolated where they otherwise use shared external state; worktrees isolate repository files, not every resource on the computer.

The work is only partly independent: frontend and pagination both touch the settings UI; formats and pagination may both touch reader contracts and adapters. Agree on settings/adapter interfaces first, keep UI wiring changes small, and coordinate edits to shared files. A practical integration order is single-page support, format support, then the final frontend integration and visual review.

Commit changes on each feature branch, then merge them one at a time into the integration branch. Resolve conflicts and verify the combined app after each merge. Use `pnpm check`, relevant tests, and a final build plus manual reader/UI checks appropriate to the merged changes.

Use `git worktree list` to inspect checkouts. Once a branch is integrated and its worktree is clean, remove that checkout with `git worktree remove <path>`; the branch and its commits remain until separately deleted.

No worktrees or baseline commit were created as part of documenting these issues.
