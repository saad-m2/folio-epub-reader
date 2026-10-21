import { describe, expect, it, vi } from "vitest";
import { resolveReplacementLocation, captureQuoteContext, type QuoteContext, type ReplacementBook } from "../src/renderer/reader-location";

describe("captureQuoteContext", () => {
  it("captures bounded quote with prefix and suffix", () => {
    const text = "prefix marker suffix";
    const result = captureQuoteContext(text, "marker", "prefix ", " suffix");
    expect(result).toEqual({ prefix: "prefix ", quote: "marker", suffix: " suffix" });
  });

  it("returns undefined when quote not found", () => {
    const result = captureQuoteContext("different text", "marker");
    expect(result).toBeUndefined();
  });

  it("bounds prefix to MAX_CONTEXT", () => {
    const text = "a".repeat(300) + "marker" + "b".repeat(300);
    const result = captureQuoteContext(text, "marker");
    expect(result!.prefix.length).toBeLessThanOrEqual(200);
    expect(result!.suffix.length).toBeLessThanOrEqual(200);
    expect(result!.quote.length).toBeLessThanOrEqual(1000);
  });

  it("uses prefixHint when prefix ends with it", () => {
    const text = "long prefix hintmarker suffix";
    const result = captureQuoteContext(text, "marker", "hint", "suffix");
    expect(result?.prefix).toBe("hint");
  });

  it("uses suffixHint when suffix starts with it", () => {
    const text = "prefix markerhint long suffix";
    const result = captureQuoteContext(text, "marker", "prefix", "hint");
    expect(result?.suffix).toBe("hint");
  });
});

describe("replacement location resolution", () => {
  const createMockBook = (overrides: Partial<ReplacementBook> = {}): ReplacementBook => ({
    getRange: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    navigation: { toc: [] },
    spine: { get: vi.fn().mockReturnValue(undefined) },
    ...overrides
  });

  it("preserves a locator when its quote and context resolve", async () => {
    const location = { href: "chapter.xhtml", cfi: "epubcfi(/6/4)", quote: "marker", quotePrefix: "a ", quoteSuffix: " passage", resourceProgress: 0.4 };
    const book = createMockBook({
      load: vi.fn().mockResolvedValue({ body: { textContent: "a marker passage" } })
    });
    const result = await resolveReplacementLocation(book, location);
    expect(result).toEqual({ href: "chapter.xhtml", quote: "marker", quotePrefix: "a ", quoteSuffix: " passage", resourceProgress: 0.4 });
  });

  it("resets when no composite fallback is reliable", async () => {
    const book = createMockBook({
      load: vi.fn().mockResolvedValue({ body: { textContent: "different content" } }),
      navigation: { toc: [] },
      spine: { get: () => undefined }
    });
    const result = await resolveReplacementLocation(book, { href: "missing.xhtml", quote: "marker" });
    expect(result).toBeUndefined();
  });

  it("falls back to the saved navigation range before the resource start", async () => {
    const book = createMockBook({
      navigation: { toc: [{ id: "chapter-two", href: "chapter.xhtml#two" }] },
      spine: { get: () => undefined }
    });
    const result = await resolveReplacementLocation(book, { href: "old.xhtml", navId: "chapter-two", navProgress: 0.5 });
    expect(result).toEqual({ href: "chapter.xhtml#two", navId: "chapter-two", navProgress: 0.5 });
  });

  it("falls back to resource href when spine has it", async () => {
    const book = createMockBook({
      navigation: { toc: [] },
      spine: { get: (href: string) => href === "chapter.xhtml" ? {} : undefined }
    });
    const result = await resolveReplacementLocation(book, { href: "chapter.xhtml", resourceProgress: 0.3 });
    expect(result).toEqual({ href: "chapter.xhtml", resourceProgress: 0.3 });
  });

  it("returns undefined when all fallbacks fail", async () => {
    const book = createMockBook({
      navigation: { toc: [] },
      spine: { get: () => undefined }
    });
    const result = await resolveReplacementLocation(book, { href: "unknown.xhtml" });
    expect(result).toBeUndefined();
  });

  it("returns location when cfi range resolves", async () => {
    const location = { href: "chapter.xhtml", cfi: "epubcfi(/6/4)", resourceProgress: 0.4 };
    const book = createMockBook({ getRange: vi.fn().mockResolvedValue({}) });
    const result = await resolveReplacementLocation(book, location);
    expect(result).toEqual(location);
  });

  it("does not keep a stale CFI when its saved quote moved", async () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.textContent = `changed passage ${"x".repeat(300)} reliable marker`;
    const range = doc.createRange();
    range.setStart(doc.body.firstChild!, 1);
    range.collapse(true);
    const book = createMockBook({
      getRange: vi.fn().mockResolvedValue(range),
      load: vi.fn().mockResolvedValue({ body: doc.body, cfiAtTextOffset: () => "new-cfi" })
    });
    const resolved = await resolveReplacementLocation(book, { href: "chapter.xhtml", cfi: "old-cfi", quote: "reliable marker" });
    expect(resolved?.cfi).toBe("new-cfi");
  });

  it("captures quote context with bounded prefix/suffix from load", async () => {
    const location = { href: "chapter.xhtml", quote: "marker", quotePrefix: "a ", quoteSuffix: " passage", resourceProgress: 0.4 };
    const book = createMockBook({ load: vi.fn().mockResolvedValue({ body: { textContent: "a marker passage" } }) });
    const result = await resolveReplacementLocation(book, location);
    expect(result).toEqual({ href: "chapter.xhtml", quote: "marker", quotePrefix: "a ", quoteSuffix: " passage", resourceProgress: 0.4 });
  });
});
