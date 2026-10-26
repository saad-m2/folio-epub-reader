import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FluentProvider,
  webDarkTheme,
  Dialog,
  DialogBody,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components";
import type { LibraryBook, ReaderLocation } from "../shared/contracts";
import {
  PublicationValidationError,
  validateAndExtractCover,
} from "./publication-validation";
import { ReaderAdapter } from "./reader-adapter";
import { Reader, type Settings, type BookSession } from "./reader";
import { SettingsView, type FontEntry } from "./settings";
import { LibraryView } from "./library-view";
import { BookCover, Button, Icon } from "./ui";

type Route = "library" | "reader" | "settings";
type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: string } };
const defaults: Settings = {
  mode: "continuous",
  pageLayout: "single",
  appearance: {
    theme: "system",
    fontSize: 18,
    margin: 48,
    lineHeight: 1.55,
    paragraphSpacing: 0.75,
    fontFamily: "Liberation Sans Reader",
  },
};
const appTheme = {
  ...webDarkTheme,
  colorNeutralBackground1: "#181b1a",
  colorNeutralForeground1: "#edf0e9",
  colorNeutralBackground2: "#1f2321",
  colorNeutralStroke1: "#414b3d",
  colorBrandBackground: "#bfd3ab",
  colorBrandForeground1: "#bfd3ab",
};

export function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>("library");
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<BookSession>();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [fonts, setFonts] = useState<FontEntry[]>([]);
  const [fontNotice, setFontNotice] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [removeTarget, setRemoveTarget] = useState<LibraryBook | null>(null);
  const [missingTarget, setMissingTarget] = useState<LibraryBook | null>(null);
  const flushReader = useRef<() => Promise<void>>();
  const libraryHeading = useRef<HTMLHeadingElement>(null);
  const settingsHeading = useRef<HTMLHeadingElement>(null);
  const proof = new URLSearchParams(window.location.search).has("proof");
  const fontFaces = useRef(new Map<string, FontFace>());

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = (await window.readerApi.listLibrary()) as Result<
        LibraryBook[]
      >;
      if (!result.ok) throw new Error();
      setBooks(result.value);
    } catch {
      setStatus(
        "Your library could not be loaded. Restart the app to try again.",
      );
    } finally {
      setReady(true);
    }
  }, []);
  const refreshFonts = useCallback(async (): Promise<void> => {
    try {
      const result = (await window.readerApi.listFonts()) as Result<
        FontEntry[]
      >;
      if (result.ok) setFonts(result.value);
      else
        setFontNotice(
          "The font catalog could not be loaded. Restart the app to try again.",
        );
    } catch {
      setFontNotice(
        "The font catalog could not be loaded. Restart the app to try again.",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
    void refreshFonts();
    void window.readerApi
      .getSettings()
      .then((raw) => {
        const result = raw as Result<Settings>;
        if (result.ok) setSettings(result.value);
        else
          setStatus(
            "Your preferences could not be loaded. The default reading settings are available.",
          );
      })
      .catch(() =>
        setStatus(
          "Your preferences could not be loaded. The default reading settings are available.",
        ),
      );
  }, [refresh, refreshFonts]);
  useEffect(() => {
    if (route === "library" && ready) libraryHeading.current?.focus();
    if (route === "settings") settingsHeading.current?.focus();
  }, [route, ready]);
  useEffect(() => {
    let active = true;
    for (const font of fonts.filter((entry) => entry.installed)) {
      if (fontFaces.current.has(font.id)) continue;
      void window.readerApi
        .getFontData(font.id)
        .then(async (raw) => {
          const result = raw as Result<{
            family: string;
            mime: string;
            data: string;
          }>;
          if (
            !result.ok ||
            result.value.family !== font.family ||
            result.value.mime !== "font/ttf" ||
            !/^[A-Za-z0-9+/=]+$/.test(result.value.data)
          )
            return;
          const face = await new FontFace(
            font.family,
            `url(data:font/ttf;base64,${result.value.data})`,
          ).load();
          if (active && !fontFaces.current.has(font.id)) {
            document.fonts.add(face);
            fontFaces.current.set(font.id, face);
          }
        })
        .catch(() => {
          /* Reader and settings can still use their system-font fallback. */
        });
    }
    return () => {
      active = false;
    };
  }, [fonts]);
  useEffect(
    () => () => {
      for (const face of fontFaces.current.values())
        document.fonts.delete(face);
    },
    [],
  );
  useEffect(() => {
    if (!proof) return;
    void window.readerApi
      .openProofFixture()
      .then((raw) => {
        const result = raw as Result<Omit<BookSession, "bookId">>;
        if (result.ok) {
          setSession({ ...result.value, bookId: "proof" });
          setRoute("reader");
        } else setStatus("The trusted publication proof could not be opened.");
      })
      .catch(() =>
        setStatus("The trusted publication proof could not be opened."),
      );
  }, [proof]);

  async function persist(change: Partial<Settings>): Promise<void> {
    const next = {
      ...settings,
      ...change,
      appearance: change.appearance ?? settings.appearance,
    };
    const result = (await window.readerApi.saveSettings(
      next,
    )) as Result<Settings>;
    if (!result.ok) throw new Error("Preferences could not be saved.");
    setSettings(result.value);
  }
  async function downloadFont(fontId: string): Promise<void> {
    setFontNotice("Downloading font…");
    try {
      const result = (await window.readerApi.downloadFont(
        fontId,
      )) as Result<unknown>;
      setFontNotice(
        result.ok
          ? "Font installed for offline reading. Choose Use font to select it."
          : "The font could not be downloaded. Check your connection and try again.",
      );
      await refreshFonts();
    } catch {
      setFontNotice(
        "The font could not be downloaded. Check your connection and try again.",
      );
    }
  }
  async function addBooks(): Promise<void> {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setStatus("");
    let importSession: string | undefined;
    try {
      const chosen = (await window.readerApi.chooseBooks()) as Result<{
        cancelled: boolean;
        sessionId?: string;
        archiveBytes?: ArrayBuffer;
      }>;
      if (!chosen.ok) {
        setStatus(
          chosen.error.code === "QUOTA_EXCEEDED"
            ? "This EPUB exceeds the 128 MiB size limit. Choose a smaller book."
            : "This EPUB could not be read. Check that the file is available and try again.",
        );
        return;
      }
      if (
        chosen.value.cancelled ||
        !chosen.value.sessionId ||
        !chosen.value.archiveBytes
      )
        return;
      importSession = chosen.value.sessionId;
      setStatus("Checking your EPUB and its cover…");
      const cover = await validateAndExtractCover(chosen.value.archiveBytes);
      const metadata = await ReaderAdapter.inspect(chosen.value.archiveBytes);
      let resolvedLocation: ReaderLocation | undefined;
      if (metadata.packageId) {
        const previous = (await window.readerApi.getReplacementLocation(
          metadata.packageId,
        )) as Result<ReaderLocation | undefined>;
        if (previous.ok && previous.value)
          resolvedLocation = await ReaderAdapter.resolveReplacement(
            chosen.value.archiveBytes,
            previous.value,
          );
      }
      const committed = (await window.readerApi.commitImport(
        importSession,
        metadata.title,
        metadata.author,
        metadata.packageId,
        cover,
        resolvedLocation,
      )) as Result<{ outcome: string }>;
      if (!committed.ok) throw new Error();
      importSession = undefined;
      await refresh();
      const messages: Record<string, string> = {
        added: "Book added to your library.",
        replaced: "Library reference replaced. Your reading progress was kept.",
        "replaced-migrated": "Book replaced. Your saved passage was restored.",
        "replaced-reset":
          "Book replaced. Your old reading place could not be restored, so this copy will open at the beginning.",
        cancelled: "",
      };
      setStatus(messages[committed.value.outcome] ?? "Library updated.");
    } catch (error) {
      setStatus(
        error instanceof PublicationValidationError
          ? "That EPUB uses features this reader does not support. Try a reflowable EPUB without DRM."
          : "That file is not a supported EPUB.",
      );
    } finally {
      if (importSession)
        await window.readerApi
          .closeSession(importSession)
          .catch(() => undefined);
      operation.current = false;
      setBusy(false);
    }
  }
  async function openBook(book: LibraryBook): Promise<void> {
    if (operation.current) return;
    if (book.missing) {
      setMissingTarget(book);
      return;
    }
    operation.current = true;
    setBusy(true);
    setStatus("Opening your book…");
    try {
      const result = (await window.readerApi.openSession(book.id)) as Result<
        Omit<BookSession, "bookId">
      >;
      if (!result.ok) {
        if (result.error.code === "NOT_FOUND") {
          setMissingTarget(book);
          await refresh();
        }
        setStatus(
          result.error.code === "NOT_FOUND"
            ? "File not found."
            : result.error.code === "SOURCE_CHANGED"
              ? "This EPUB has changed. Add it again to update its library reference."
              : "This book could not be opened. Check the original file and try again.",
        );
        return;
      }
      setSession({ ...result.value, bookId: book.id });
      setStatus("");
      setRoute("reader");
    } catch {
      setStatus("This book could not be opened. Try again.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function leave(): Promise<void> {
    if (operation.current) return;
    operation.current = true;
    try {
      if (session) {
        await flushReader.current?.();
        const result = (await window.readerApi.closeSession(
          session.sessionId,
        )) as Result<unknown>;
        if (!result.ok) throw new Error();
      }
      setSession(undefined);
      setRoute("library");
      await refresh();
    } catch {
      setStatus(
        "Your reading place could not be saved. Please try returning to the library again.",
      );
    } finally {
      operation.current = false;
    }
  }
  async function confirmRemove(): Promise<void> {
    if (!removeTarget || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      const result = (await window.readerApi.removeBook(
        removeTarget.id,
      )) as Result<unknown>;
      if (!result.ok) throw new Error();
      const title = removeTarget.title;
      setRemoveTarget(null);
      await refresh();
      setStatus(
        `${title} removed from your library. The original EPUB is unchanged.`,
      );
    } catch {
      setStatus("The book could not be removed. Please try again.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const library = (): void => {
    if (!busy) void leave();
  };
  return (
    <FluentProvider
      theme={appTheme}
      className={`app-shell ${route === "reader" ? "app-reading" : ""}`}
    >
      {route === "reader" && session ? (
        <Reader
          session={session}
          settings={settings}
          fonts={fonts}
          saveSettings={persist}
          leave={() => void leave()}
          registerFlush={(flush) => {
            flushReader.current = flush;
          }}
          proof={proof}
        />
      ) : (
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <Icon name="book" size={28} />
              Leaf
            </div>
            <div className="side-label">YOUR SPACE</div>
            <nav className="side-nav" aria-label="Application">
              <button
                type="button"
                aria-label="Library"
                aria-current={route === "library" ? "page" : undefined}
                className={route === "library" ? "active" : ""}
                disabled={busy}
                onClick={library}
              >
                <Icon name="grid" />
                <span className="nav-name">My library</span>
                <span className="count">{books.length}</span>
              </button>
            </nav>
            <div className="side-bottom">
              <nav className="side-nav" aria-label="Preferences">
                <button
                  type="button"
                  aria-current={route === "settings" ? "page" : undefined}
                  aria-label="Settings"
                  className={route === "settings" ? "active" : ""}
                  disabled={busy}
                  onClick={() => {
                    setStatus("");
                    setRoute("settings");
                  }}
                >
                  <Icon name="settings" />
                  <span className="nav-name">Settings</span>
                </button>
              </nav>
            </div>
          </aside>
          <div className="workspace">
            <header className="appbar">
              <div className="breadcrumb">
                Your reading space<span>/</span>
                <strong>
                  {route === "library" ? "My library" : "Settings"}
                </strong>
              </div>
              <span className="small muted">
                <span className="dot" />
                Local library · No account needed
              </span>
            </header>
            {route === "library" ? (
              <LibraryView
                books={books}
                headingRef={libraryHeading}
                ready={ready}
                busy={busy}
                addBooks={() => void addBooks()}
                openBook={(book) => void openBook(book)}
                removeBook={setRemoveTarget}
              />
            ) : (
              <SettingsView
                settings={settings}
                fonts={fonts}
                persist={persist}
                downloadFont={downloadFont}
                fontNotice={fontNotice}
                headingRef={settingsHeading}
              />
            )}
          </div>
        </div>
      )}
      {status && (
        <div
          className={`app-notice ${route === "reader" ? "reader-notice" : ""}`}
          role="status"
          aria-live="polite"
        >
          {busy && <span className="spinner" />}
          <span>{status}</span>
          <Button
            appearance="subtle"
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setStatus("")}
          >
            <Icon name="close" />
          </Button>
        </div>
      )}
      <Dialog
        open={!!missingTarget}
        onOpenChange={(_, data) => {
          if (!data.open) setMissingTarget(null);
        }}
      >
        <DialogSurface className="app-dialog">
          <DialogBody>
            <div className="modal-icon warning">
              <Icon name="warning" />
            </div>
            <DialogTitle>We can’t find this book.</DialogTitle>
            <p>
              The original EPUB may have been moved, renamed, or deleted. The
              book stays on your shelf until you decide what to do.
            </p>
            {missingTarget && (
              <div className="modal-book">
                <BookCover book={missingTarget} />
                <div>
                  <h3>{missingTarget.title}</h3>
                  <p>{missingTarget.author}</p>
                </div>
              </div>
            )}
            <div className="dialog-actions">
              <Button onClick={() => setMissingTarget(null)}>
                Keep in library
              </Button>
              <Button
                onClick={() => {
                  setRemoveTarget(missingTarget);
                  setMissingTarget(null);
                }}
              >
                Remove from library
              </Button>
            </div>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog
        open={!!removeTarget}
        onOpenChange={(_, data) => {
          if (!data.open && !busy) setRemoveTarget(null);
        }}
      >
        <DialogSurface className="app-dialog">
          <DialogBody>
            <div className="modal-icon warning">
              <Icon name="warning" />
            </div>
            <DialogTitle>Remove from your library?</DialogTitle>
            <p>
              This removes the book and its saved reading progress from Leaf.
            </p>
            {removeTarget && (
              <div className="modal-book">
                <BookCover book={removeTarget} />
                <div>
                  <h3>{removeTarget.title}</h3>
                  <p>{removeTarget.author}</p>
                </div>
              </div>
            )}
            <div className="notice">
              Your original EPUB file stays exactly where it is.
            </div>
            <div className="dialog-actions">
              <Button disabled={busy} onClick={() => setRemoveTarget(null)}>
                Keep book
              </Button>
              <Button
                className="danger"
                disabled={busy}
                onClick={() => void confirmRemove()}
              >
                {busy ? "Removing…" : "Remove book"}
              </Button>
            </div>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </FluentProvider>
  );
}
