import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryView } from "../src/renderer/library-view";

describe("compact library interaction", () => {
  let root: Root;
  let container: HTMLDivElement;
  const openBook = vi.fn();
  const book = {
    id: "test-book",
    title: "A local book",
    author: "A reader",
    missing: false,
    progress: 0.3,
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("innerWidth", 900);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    openBook.mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        React.createElement(LibraryView, {
          books: [book],
          headingRef: createRef<HTMLHeadingElement>(),
          busy: false,
          ready: true,
          addBooks: vi.fn(),
          openBook,
          removeBook: vi.fn(),
        }),
      ),
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens a book on double-click before a compact inspector can intercept it", async () => {
    const card = container.querySelector<HTMLButtonElement>(".book-select")!;
    await act(async () => {
      card.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      card.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
      card.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, detail: 2 }),
      );
      vi.advanceTimersByTime(600);
    });
    expect(openBook).toHaveBeenCalledExactlyOnceWith(book);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens directly with Enter without leaving a delayed inspector behind", async () => {
    const card = container.querySelector<HTMLButtonElement>(".book-select")!;
    await act(async () => {
      card.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      card.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
      vi.advanceTimersByTime(600);
    });
    expect(openBook).toHaveBeenCalledExactlyOnceWith(book);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
