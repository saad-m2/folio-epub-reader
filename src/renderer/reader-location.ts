import type { ReaderLocation } from "../shared/contracts";

export type ReplacementBook = {
  getRange(cfi: string): Promise<unknown>;
  load(href: string): Promise<{ body?: { textContent?: string | null }; cfiAtTextOffset?: (offset: number, length: number) => string | undefined; textOffsetForFragment?: (fragment: string) => number | undefined } | undefined>;
  navigation?: { toc?: NavigationItem[] };
  spine?: { get(href: string): unknown };
};
type NavigationItem = { id?: string; href?: string; subitems?: NavigationItem[] };

export type QuoteContext = { prefix: string; quote: string; suffix: string };

const MAX_QUOTE = 1000;
const MAX_CONTEXT = 200;

function boundedQuoteContext(text: string, index: number, quote: string, prefixHint?: string, suffixHint?: string): QuoteContext {
  const prefixStart = Math.max(0, index - MAX_CONTEXT);
  const suffixEnd = Math.min(text.length, index + quote.length + MAX_CONTEXT);
  let prefix = text.slice(prefixStart, index);
  let suffix = text.slice(index + quote.length, suffixEnd);
  if (prefixHint && prefix.endsWith(prefixHint)) prefix = prefixHint;
  if (suffixHint && suffix.startsWith(suffixHint)) suffix = suffixHint;
  return { prefix: prefix.slice(-MAX_CONTEXT), quote: quote.slice(0, MAX_QUOTE), suffix: suffix.slice(0, MAX_CONTEXT) };
}

export function findQuoteOffset(text: string, quote: string, prefixHint?: string, suffixHint?: string): number {
  let index = text.indexOf(quote);
  if (index < 0) return -1;
  if (prefixHint || suffixHint) {
    let candidate = index;
    while (candidate >= 0) {
      if ((!prefixHint || text.slice(Math.max(0, candidate - prefixHint.length), candidate) === prefixHint)
        && (!suffixHint || text.slice(candidate + quote.length, candidate + quote.length + suffixHint.length) === suffixHint)) {
        index = candidate;
        break;
      }
      candidate = text.indexOf(quote, candidate + quote.length);
    }
    if (candidate < 0) return -1;
  }
  return index;
}

export function captureQuoteContext(text: string, quote: string, prefixHint?: string, suffixHint?: string): QuoteContext | undefined {
  const index = text.indexOf(quote);
  if (index < 0) return undefined;
  return boundedQuoteContext(text, index, quote, prefixHint, suffixHint);
}

export function captureQuoteAtOffset(text: string, offset: number, length = 80): QuoteContext | undefined {
  const firstText = text.slice(offset).search(/\S/);
  if (firstText < 0) return undefined;
  const index = offset + firstText;
  const quote = text.slice(index, index + length).trimEnd();
  return quote ? boundedQuoteContext(text, index, quote) : undefined;
}

function cfiMatchesQuote(range: unknown, location: ReaderLocation): boolean {
  if (!location.quote) return true;
  if (!range || typeof range !== "object" || !("startContainer" in range) || !("startOffset" in range)) return false;
  try {
    const candidate = range as Range;
    const document = candidate.startContainer.ownerDocument;
    const body = document?.body ?? document?.querySelector("body");
    const text = body?.textContent ?? "";
    if (!document || !body || !text) return false;
    const before = document.createRange();
    before.setStart(body, 0);
    before.setEnd(candidate.startContainer, candidate.startOffset);
    const offset = before.toString().length;
    const quoteOffset = findQuoteOffset(text, location.quote, location.quotePrefix, location.quoteSuffix);
    return quoteOffset >= 0 && Math.abs(quoteOffset - offset) <= 200;
  } catch { return false; }
}

export async function resolveReplacementLocation(book: ReplacementBook, location: ReaderLocation | undefined): Promise<ReaderLocation | undefined> {
  if (!location) return undefined;

  if (location.cfi) {
    try {
      const range = await book.getRange(location.cfi);
      if (range && cfiMatchesQuote(range, location)) return location;
    } catch {
      // Continue with safer fallbacks
    }
  }

  if (location.quote) {
    try {
      const document = await book.load(location.href);
      const text = document?.body?.textContent ?? "";
      const offset = findQuoteOffset(text, location.quote, location.quotePrefix, location.quoteSuffix);
      const captured = offset >= 0 ? boundedQuoteContext(text, offset, location.quote, location.quotePrefix, location.quoteSuffix) : undefined;
      if (captured) {
        const { cfi: _invalidCfi, ...quoteLocation } = location;
        const cfi = document?.cfiAtTextOffset?.(offset, captured.quote.length);
        return { ...quoteLocation, ...(cfi ? { cfi } : {}), quote: captured.quote, quotePrefix: captured.prefix, quoteSuffix: captured.suffix };
      }
    } catch {
      // Continue with navigation fallbacks
    }
  }

  const entries = (items: NavigationItem[]): NavigationItem[] => items.flatMap(item => [item, ...entries(item.subitems ?? [])]);
  const navigation = entries(book.navigation?.toc ?? []).find(item => item.id === location.navId);
  if (navigation?.href) {
    const baseHref = navigation.href.split("#")[0]!;
    const fragment = navigation.href.split("#")[1];
    try {
      const document = await book.load(baseHref);
      const text = document?.body?.textContent ?? "";
      const start = fragment ? document?.textOffsetForFragment?.(fragment) : 0;
      const siblings = entries(book.navigation?.toc ?? []);
      const index = siblings.indexOf(navigation);
      const next = siblings.slice(index + 1).find(item => item.href?.split("#")[0] === baseHref);
      const endFragment = next?.href?.split("#")[1];
      const end = endFragment ? document?.textOffsetForFragment?.(endFragment) : text.length;
      if (start !== undefined && end !== undefined && end >= start && location.navProgress !== undefined) {
        const offset = Math.min(Math.max(start + Math.floor((end - start) * location.navProgress), 0), Math.max(0, text.length - 1));
        const cfi = document?.cfiAtTextOffset?.(offset, 1);
        if (cfi) return { href: baseHref, cfi, navId: location.navId, navProgress: location.navProgress };
      }
    } catch { /* Fall back to the anchor itself. */ }
    return { href: navigation.href, navId: location.navId, ...(location.navProgress !== undefined ? { navProgress: location.navProgress } : {}) };
  }

  if (location.href && book.spine?.get(location.href)) {
    try {
      if (location.resourceProgress !== undefined) {
        const document = await book.load(location.href);
        const text = document?.body?.textContent ?? "";
        const offset = Math.min(Math.floor(text.length * location.resourceProgress), Math.max(0, text.length - 1));
        const cfi = document?.cfiAtTextOffset?.(offset, 1);
        if (cfi) return { href: location.href, cfi, resourceProgress: location.resourceProgress };
      }
    } catch { /* Fall back to the resource start. */ }
    return { href: location.href, ...(location.resourceProgress !== undefined ? { resourceProgress: location.resourceProgress } : {}) };
  }

  return undefined;
}
