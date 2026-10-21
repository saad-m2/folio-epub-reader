import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components";
import type { LibraryBook } from "../shared/contracts";
import { BookCover, Button, Icon } from "./ui";

type Props = {
  books: LibraryBook[];
  headingRef: React.RefObject<HTMLHeadingElement>;
  busy: boolean;
  ready: boolean;
  addBooks: () => void;
  openBook: (book: LibraryBook) => void;
  removeBook: (book: LibraryBook) => void;
};

export function LibraryView({
  books,
  headingRef,
  busy,
  ready,
  addBooks,
  openBook,
  removeBook,
}: Props): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string>();
  const [detailsOpen, setDetailsOpen] = useState(window.innerWidth > 1000);
  const [compact, setCompact] = useState(window.innerWidth <= 1000);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const selectionTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(selectionTimer.current), []);
  const book = books.find((item) => item.id === selectedId) ?? books[0];
  const latest = books.find((item) => !item.missing && item.progress > 0);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1000px)");
    const changed = (): void => {
      setCompact(query.matches);
      setDetailsOpen(!query.matches);
    };
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  const close = (): void => {
    window.clearTimeout(selectionTimer.current);
    setDetailsOpen(false);
    selectedButton.current?.focus();
  };
  const detail = book ? (
    <>
      <div className="details-body">
        <div className="detail-head">
          BOOK DETAILS
          <Button
            appearance="subtle"
            className="icon-btn"
            aria-label="Close book details"
            onClick={close}
          >
            <Icon name="close" />
          </Button>
        </div>
        <BookCover book={book} />
        <h2>{book.title}</h2>
        <p className="author">{book.author}</p>
        <div className="detail-progress">
          <span className="detail-label">YOUR PROGRESS</span>
          <span>{Math.round(book.progress * 100)}%</span>
        </div>
        <div className="track" aria-hidden="true">
          <i style={{ width: `${book.progress * 100}%` }} />
        </div>
        <p className="detail-chapter">
          {book.progress
            ? "Your place is waiting for you."
            : "A new story, waiting to begin."}
        </p>
        <div className="metadata">
          <div>
            <span>Format</span>EPUB
          </div>
          <div>
            <span>Stored</span>On your device
          </div>
        </div>
        <div className={`file-note ${book.missing ? "is-warning" : ""}`}>
          <Icon name={book.missing ? "warning" : "file"} />
          <p>
            {book.missing
              ? "The original file is missing. It may have been moved or renamed."
              : "Linked to your original EPUB. Keep the file in its current location."}
          </p>
        </div>
      </div>
      <div className="detail-actions">
        <Button
          appearance="primary"
          aria-label="Open book"
          disabled={busy}
          onClick={() => {
            if (compact) setDetailsOpen(false);
            openBook(book);
          }}
        >
          {book.missing
            ? "File not found"
            : book.progress
              ? "Continue reading"
              : "Start reading"}
          <Icon name="arrow" />
        </Button>
        <Button
          appearance="subtle"
          disabled={busy}
          onClick={() => {
            setDetailsOpen(false);
            removeBook(book);
          }}
        >
          Remove from library
        </Button>
      </div>
    </>
  ) : null;

  if (!ready)
    return (
      <main className="library-main">
        <div className="empty" role="status">
          <span className="spinner" />
          <h1 ref={headingRef} tabIndex={-1}>
            Opening your library…
          </h1>
        </div>
      </main>
    );
  if (!books.length)
    return (
      <main className="library-main">
        <div className="empty">
          <div className="empty-art">
            <Icon name="book" size={46} />
          </div>
          <div className="eyebrow">A little space for your stories</div>
          <h1 ref={headingRef} tabIndex={-1}>
            Your next chapter starts here.
          </h1>
          <p>
            Welcome to Folio. Add your first EPUB
            <br />
            and make yourself at home.
          </p>
          <Button appearance="primary" disabled={busy} onClick={addBooks}>
            <Icon name="plus" />
            Add books
          </Button>
        </div>
      </main>
    );
  return (
    <div className="main-layout">
      <main className="library-main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">Your own little world</div>
            <h1 ref={headingRef} tabIndex={-1}>
              My library <span className="heading-count">{books.length}</span>
            </h1>
            <p>Good books. Right where you left them.</p>
          </div>
          <Button appearance="primary" disabled={busy} onClick={addBooks}>
            <Icon name="plus" />
            Add books
          </Button>
        </div>
        {latest && (
          <section className="resume" aria-label="Continue your latest book">
            <BookCover book={latest} />
            <div className="resume-copy">
              <div className="eyebrow">Pick up the story</div>
              <h2>{latest.title}</h2>
              <p>
                {latest.author}
                <span className="resume-divider">/</span>
                {Math.round(latest.progress * 100)}% read
              </p>
            </div>
            <Button disabled={busy} onClick={() => openBook(latest)}>
              Continue reading
              <Icon name="arrow" />
            </Button>
          </section>
        )}
        <div className="section-heading">
          <h2>On your bookshelf</h2>
          <span>Most recently opened first</span>
        </div>
        <section className="library-grid book-grid" aria-label="Your books">
          {books.map((item) => (
            <article
              className={`book-card book ${detailsOpen && book?.id === item.id ? "selected" : ""}`}
              key={item.id}
            >
              <button
                className="book-select"
                disabled={busy}
                aria-label={`Select ${item.title}`}
                aria-pressed={detailsOpen && book?.id === item.id}
                onClick={(event) => {
                  selectedButton.current = event.currentTarget;
                  setSelectedId(item.id);
                  window.clearTimeout(selectionTimer.current);
                  // Keep the cover available for the second click before a
                  // compact modal can intercept the normal double-click.
                  if (compact && event.detail > 0) {
                    selectionTimer.current = window.setTimeout(
                      () => setDetailsOpen(true),
                      500,
                    );
                  } else setDetailsOpen(true);
                }}
                onDoubleClick={() => {
                  window.clearTimeout(selectionTimer.current);
                  if (compact) setDetailsOpen(false);
                  openBook(item);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    window.clearTimeout(selectionTimer.current);
                    if (compact) setDetailsOpen(false);
                    openBook(item);
                  }
                }}
              >
                <div className="cover-wrap">
                  <BookCover book={item} />
                  {item.missing && (
                    <span className="missing-badge">File not found</span>
                  )}
                </div>
                <div className="book-info">
                  <span className="book-title">{item.title}</span>
                  <span className="book-author">{item.author}</span>
                  <div className="progress-row">
                    <div className="track" aria-hidden="true">
                      <i style={{ width: `${item.progress * 100}%` }} />
                    </div>
                    <span>
                      {item.progress
                        ? `${Math.round(item.progress * 100)}%`
                        : "Not started"}
                    </span>
                  </div>
                </div>
              </button>
            </article>
          ))}
        </section>
        <div className="library-footer">
          <Icon name="info" size={14} />
          Double-click a cover or press Enter to read. Your place is saved
          automatically.
        </div>
      </main>
      {book && detailsOpen && !compact && (
        <aside className="details" aria-label="Book details">
          {detail}
        </aside>
      )}
      {book && compact && (
        <Dialog
          open={detailsOpen}
          onOpenChange={(_, data) => {
            if (!data.open) close();
          }}
        >
          <DialogSurface className="book-detail-dialog">
            <DialogBody>
              <DialogTitle className="sr-only">Book details</DialogTitle>
              <div className="details compact-details">{detail}</div>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
