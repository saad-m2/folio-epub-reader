import ePub from "epubjs";
import Book from "epubjs/types/book";
import Rendition from "epubjs/types/rendition";
import type { NavItem } from "epubjs/types/navigation";
import Section from "epubjs/types/section";
import type { Appearance, ReaderLocation, ReaderMode } from "../shared/contracts";
import { withTimeout } from "./operation-timeout";
import { captureQuoteAtOffset, resolveReplacementLocation, type ReplacementBook } from "./reader-location";

export type TocItem = { id: string; label: string; href: string; children: TocItem[] };
export type ReaderSnapshot = { title: string; toc: TocItem[]; location: ReaderLocation; label: string; progress: number; hasNavigation: boolean };
export type ReaderRect = { x: number; y: number; width: number; height: number };
export type ReaderSelection = { text: string; cfi?: string; rects: ReaderRect[] };
export type ReaderInteraction =
  | { kind: "reader-click"; zone: "left" | "center" | "right" }
  | { kind: "key"; key: string; shiftKey: boolean }
  | { kind: "wheel"; deltaY: number };
type Listener = (snapshot: ReaderSnapshot) => void;
type FrameContents = { document: Document; window?: Window; cfiFromRange?: (range: Range) => string };

const MAX_SELECTION_LENGTH = 5000;
const MAX_SELECTION_RECTS = 40;
const MAX_SELECTION_CFI_LENGTH = 4000;

const timeout = <T>(promise: Promise<T>, stage = "readiness"): Promise<T> => withTimeout(promise, `Reader ${stage} timed out`);
const withoutFragment = (href: string): string => href.split("#")[0] ?? href;
const bodyOf = (document: Document): Element | null => document.body ?? document.querySelector("body");
export function ensurePublicationHead(document: Document): void {
  if (document.getElementsByTagName("head").length) return;
  const root = document.documentElement;
  if (root?.localName !== "html") return;
  root.insertBefore(document.createElementNS(root.namespaceURI, "head"), root.firstChild);
}
function destroyPublication(book: { destroy(): void } | undefined): void {
  if (!book) return;
  // epub.js 0.3.93 revokes archive cache keys (entry paths) instead of their
  // blob URL values, and drops CSS replacement URLs without revoking them.
  const resources = book as { archive?: { urlCache?: Record<string, string> }; resources?: { replacementUrls?: string[] } };
  const urls = new Set([...Object.values(resources.archive?.urlCache ?? {}), ...(resources.resources?.replacementUrls ?? [])]);
  for (const url of urls) if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  book.destroy();
}
const anchorOf = (document: Document, fragment: string): Element | null => {
  try {
    const id = decodeURIComponent(fragment);
    return document.getElementById(id) ?? Array.from(document.querySelectorAll("[id]")).find(element => element.getAttribute("id") === id) ?? null;
  } catch { return null; }
};

function getSystemTheme(): "light" | "dark" {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch { return "light"; }
}

function resolveTheme(theme: Appearance["theme"]): "light" | "dark" | "sepia" {
  if (theme === "system") return getSystemTheme();
  return theme;
}

const PAGINATED_CHAPTER_BREAK = `
  @media (prefers-reduced-motion: no-preference) {
    .epubjs-chapter { break-before: page; }
  }
  .epubjs-chapter { page-break-before: always; }
`;

function replacementBook(book: Book): ReplacementBook {
  return {
    getRange: cfi => book.getRange(cfi),
    load: async href => {
      const section = book.spine.get(withoutFragment(href));
      if (!section) return undefined;
      await section.load(book.load.bind(book));
      const document = section.document;
      const body = document && bodyOf(document);
      if (!body) return undefined;
      return {
        body,
        textOffsetForFragment: (fragment: string): number | undefined => {
          const element = anchorOf(document, fragment);
          if (!element) return undefined;
          const before = document.createRange();
          before.setStart(body, 0);
          before.setEndBefore(element);
          return before.toString().length;
        },
        cfiAtTextOffset: (offset: number, length: number): string | undefined => {
          const walker = document.createTreeWalker(body, 4);
          let node: Node | null;
          let passed = 0;
          while ((node = walker.nextNode())) {
            const size = node.textContent?.length ?? 0;
            if (passed + size > offset) {
              const range = document.createRange();
              range.setStart(node, offset - passed);
              range.setEnd(node, Math.min(size, offset - passed + length));
              try { return section.cfiFromRange(range); } catch { return undefined; }
            }
            passed += size;
          }
          return undefined;
        }
      };
    },
    navigation: { toc: book.navigation?.toc },
    spine: { get: href => book.spine.get(withoutFragment(href)) }
  };
}

/** The only epub.js boundary. Engine objects and frame details do not leave this module. */
export class ReaderAdapter {
  private static fontCss = new Map<string, string>();
  private book: Book | undefined;
  private rendition: Rendition | undefined;
  private renditionSpineHooks: Function[] = [];
  private archiveBytes: ArrayBuffer | undefined;
  private operation = 0;
  private listeners = new Set<Listener>();
  private snapshot: ReaderSnapshot | undefined;
  private mode: ReaderMode = "continuous";
  private currentAppearance: Appearance | undefined;
  private currentStylesheet = "";
  private layoutQueue: Promise<unknown> = Promise.resolve();
  private requestedLayout = 0;
  private selection: ReaderSelection | undefined;
  private selectionDocument: Document | undefined;
  private selectionListeners = new Set<(selection: ReaderSelection | undefined) => void>();
  private selectionIssueListeners = new Set<() => void>();
  private interactionListeners = new Set<(interaction: ReaderInteraction) => void>();
  private externalLinkListeners = new Set<(url: string) => void>();
  private frameCleanups = new Map<Document, () => void>();

  constructor(private readonly host: HTMLElement) {}

  static async inspect(archiveBytes: ArrayBuffer): Promise<{ title: string; author: string; packageId?: string }> {
    const book = ePub(archiveBytes, { encoding: "binary", replacements: "blobUrl" });
    try {
      await timeout(book.opened ?? book.ready);
      await timeout(book.ready);
      const metadata = book.packaging?.metadata ?? {};
      return { title: typeof metadata.title === "string" && metadata.title ? metadata.title : "Untitled book", author: typeof metadata.creator === "string" && metadata.creator ? metadata.creator : "Unknown author", ...(typeof metadata.identifier === "string" && metadata.identifier ? { packageId: metadata.identifier } : {}) };
    } finally { destroyPublication(book); }
  }

  static async resolveReplacement(archiveBytes: ArrayBuffer, location: ReaderLocation): Promise<ReaderLocation | undefined> {
    const book = ePub(archiveBytes, { encoding: "binary", replacements: "blobUrl" }) as unknown as Book;
    try {
      await timeout(book.opened ?? book.ready);
      await timeout(book.ready);
      return await resolveReplacementLocation(replacementBook(book), location);
    } finally { destroyPublication(book); }
  }

  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  subscribeSelection(listener: (selection: ReaderSelection | undefined) => void): () => void { this.selectionListeners.add(listener); return () => this.selectionListeners.delete(listener); }
  subscribeSelectionTooLong(listener: () => void): () => void { this.selectionIssueListeners.add(listener); return () => this.selectionIssueListeners.delete(listener); }
  subscribeInteraction(listener: (interaction: ReaderInteraction) => void): () => void { this.interactionListeners.add(listener); return () => this.interactionListeners.delete(listener); }
  subscribeExternalLink(listener: (url: string) => void): () => void { this.externalLinkListeners.add(listener); return () => this.externalLinkListeners.delete(listener); }
  getSelection(): ReaderSelection | undefined { return this.selection; }
  clearSelection(): void {
    if (!this.selection) return;
    this.selection = undefined;
    this.selectionDocument = undefined;
    for (const listener of this.selectionListeners) listener(undefined);
  }

  async open(input: { archiveBytes: ArrayBuffer; mode: ReaderMode; appearance: Appearance; initialLocation?: ReaderLocation }): Promise<ReaderSnapshot> {
    await this.close();
    const operation = ++this.operation;
    this.archiveBytes = input.archiveBytes;
    let openedBook: Book | undefined;
    try {
      openedBook = ePub(input.archiveBytes, { encoding: "binary", replacements: "blobUrl" }) as unknown as Book;
      this.book = openedBook;
      await timeout(openedBook.opened ?? openedBook.ready, "archive open");
      await timeout(openedBook.ready, "metadata load");
      if (operation !== this.operation) throw new Error("Reader operation superseded");
      // Some tolerated publications omit head. Vendor metadata hooks otherwise
      // throw errors whose console stack retains the entire chapter document.
      openedBook.spine.hooks?.content.list().unshift(ensurePublicationHead);
      const renderOperation = await this.createRendition(input.mode, input.appearance);
      if (renderOperation !== this.operation) throw new Error("Reader operation superseded");
      await this.restore(input.initialLocation);
      return this.updateSnapshot();
    } catch (error) {
      if (operation === this.operation) await this.close();
      else destroyPublication(openedBook);
      throw error;
    }
  }

  async goTo(location: ReaderLocation): Promise<ReaderSnapshot> {
    this.clearSelection();
    return this.queueLayout(async () => { await this.display(location.cfi ?? location.href); return this.updateSnapshot(); });
  }

  async setMode(mode: ReaderMode, appearance: Appearance): Promise<ReaderSnapshot> {
    this.clearSelection();
    return this.queueLayout(async () => {
      const marker = this.captureLocation();
      await this.createRendition(mode, appearance);
      const resolved = await this.resolveLocation(marker);
      await this.restore(resolved);
      return this.updateSnapshot();
    });
  }

  async applyAppearance(appearance: Appearance): Promise<ReaderSnapshot> {
    this.clearSelection();
    return this.queueLayout(async () => {
      const fallback = this.reflowFallback();
      this.currentAppearance = appearance;
      this.currentStylesheet = await this.style(appearance);
      for (const frame of this.host.querySelectorAll("iframe")) {
        if (frame.contentDocument) this.styleFrame(frame.contentDocument);
      }
      this.rendition?.resize?.(this.host.clientWidth, this.host.clientHeight);
      await this.display(fallback.href);
      return this.updateSnapshot();
    });
  }

  async reflow(appearance: Appearance): Promise<ReaderSnapshot> { return this.applyAppearance(appearance); }
  // epub.js reports the new location through relocated after navigation. Reading
  // currentLocation here would duplicate its DOM mapping before that event.
  async next(): Promise<void> { this.clearSelection(); await this.queueLayout(async () => { await this.rendition?.next(); return this.snapshot!; }); }
  async previous(): Promise<void> { this.clearSelection(); await this.queueLayout(async () => { await this.rendition?.prev(); return this.snapshot!; }); }

  private queueLayout(task: () => Promise<ReaderSnapshot>): Promise<ReaderSnapshot> {
    const requested = ++this.requestedLayout;
    const operation = this.operation;
    const scheduled = this.layoutQueue.catch(() => undefined).then(async () => {
      if (operation !== this.operation) throw new Error("Reader operation superseded");
      if (!this.book) throw new Error("Reader is closed");
      if (requested !== this.requestedLayout && this.snapshot) return this.snapshot;
      return task();
    });
    this.layoutQueue = scheduled;
    return scheduled;
  }

  captureLocation(): ReaderLocation {
    const rendition = this.rendition;
    let current: any;
    try { current = rendition && typeof rendition.currentLocation === "function" ? rendition.currentLocation() : undefined; } catch { current = undefined; }
    return this.locationFromRendition(current);
  }

  private locationFromRendition(current: any): ReaderLocation {
    const start = Array.isArray(current) ? current[0]?.start : current?.start ?? current;
    const href = typeof start?.href === "string" ? start.href : this.hrefFor(start?.cfi) ?? this.snapshot?.location.href ?? this.book?.spine?.first()?.href ?? "";
    const resourceProgress = typeof start?.percentage === "number" ? start.percentage : this.snapshot?.location.resourceProgress ?? 0;
    const active = this.activeToc(href, typeof start?.cfi === "string" ? start.cfi : undefined, resourceProgress);
    const previous = this.snapshot?.location;
    const samePassage = previous?.href === withoutFragment(href) && previous.cfi && previous.cfi === start?.cfi;
    return { href: withoutFragment(href), ...(typeof start?.cfi === "string" ? { cfi: start.cfi } : {}), ...(samePassage && previous.quote ? { quote: previous.quote, quotePrefix: previous.quotePrefix, quoteSuffix: previous.quoteSuffix } : {}), ...(active ? { navId: active.item.id, navProgress: active.progress } : {}), resourceProgress };
  }

  async close(): Promise<void> {
    ++this.operation;
    ++this.requestedLayout;
    this.clearSelection();
    this.cleanupFrames();
    this.destroyRendition();
    destroyPublication(this.book);
    this.rendition = undefined;
    this.book = undefined;
    this.archiveBytes = undefined;
    this.currentAppearance = undefined;
    this.currentStylesheet = "";
    this.snapshot = undefined;
    this.layoutQueue = Promise.resolve();
    this.host.replaceChildren();
    this.host.style.removeProperty("background-color");
  }

  private cleanupFrames(): void {
    for (const cleanup of this.frameCleanups.values()) cleanup();
    this.frameCleanups.clear();
  }

  private emitInteraction(interaction: ReaderInteraction): void {
    for (const listener of this.interactionListeners) listener(interaction);
  }

  private setSelection(selection: ReaderSelection, document: Document): void {
    this.selection = selection;
    this.selectionDocument = document;
    for (const listener of this.selectionListeners) listener(selection);
  }

  private captureSelection(contents: FrameContents): void {
    const document = contents.document;
    const selection = contents.window?.getSelection() ?? document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      if (this.selectionDocument === document) this.clearSelection();
      return;
    }
    const text = selection.toString().replace(/\r\n?/g, "\n").split("\n").map(line => line.replace(/[\t\f\v ]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text || text.length > MAX_SELECTION_LENGTH) {
      this.clearSelection();
      if (text.length > MAX_SELECTION_LENGTH) for (const listener of this.selectionIssueListeners) listener();
      return;
    }
    const frame = document.defaultView?.frameElement as HTMLElement | null;
    if (!frame || !this.host.contains(frame)) { this.clearSelection(); return; }
    const hostRect = this.host.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scaleX = frame.clientWidth ? frameRect.width / frame.clientWidth : 1;
    const scaleY = frame.clientHeight ? frameRect.height / frame.clientHeight : 1;
    const range = selection.getRangeAt(0);
    const sourceRects = Array.from(range.getClientRects()).slice(0, MAX_SELECTION_RECTS);
    if (!sourceRects.length) sourceRects.push(range.getBoundingClientRect());
    const rects = sourceRects.map(rect => ({
      x: frameRect.left - hostRect.left + rect.left * scaleX,
      y: frameRect.top - hostRect.top + rect.top * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY
    })).filter(rect => Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0);
    if (!rects.length) { this.clearSelection(); return; }
    let cfi: string | undefined;
    try { cfi = contents.cfiFromRange?.(range); } catch { /* Text and geometry remain usable. */ }
    this.setSelection({ text, ...(cfi && cfi.length <= MAX_SELECTION_CFI_LENGTH ? { cfi } : {}), rects }, document);
  }

  private attachFrame(contents: FrameContents, operation: number): void {
    const document = contents.document;
    if (!document || operation !== this.operation) return;
    this.frameCleanups.get(document)?.();
    const onSelectionChange = (): void => {
      if (operation === this.operation) this.captureSelection(contents);
    };
    const onClick = (event: MouseEvent): void => {
      if (operation !== this.operation) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]");
      if (anchor) {
        const href = anchor.getAttribute("href")?.trim() ?? "";
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.button === 0 && /^https:\/\//i.test(href)) {
            try {
              const url = new URL(href);
              if (url.protocol === "https:") for (const listener of this.externalLinkListeners) listener(url.href);
            } catch { /* Malformed external destinations stay blocked. */ }
          }
          return;
        }
        return;
      }
      const frame = document.defaultView?.frameElement as HTMLElement | null;
      if (event.button !== 0 || !frame || !this.host.contains(frame)) return;
      const selection = contents.window?.getSelection() ?? document.getSelection();
      if (selection && !selection.isCollapsed) return;
      const frameRect = frame.getBoundingClientRect();
      const hostRect = this.host.getBoundingClientRect();
      const scaleX = frame.clientWidth ? frameRect.width / frame.clientWidth : 1;
      const ratio = (frameRect.left + event.clientX * scaleX - hostRect.left) / (hostRect.width || 1);
      this.emitInteraction({ kind: "reader-click", zone: ratio < 0.2 ? "left" : ratio > 0.8 ? "right" : "center" });
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (operation !== this.operation || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.emitInteraction({ kind: "key", key: event.key, shiftKey: event.shiftKey });
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) return;
      if (!["ArrowLeft", "ArrowRight", "PageUp", "PageDown", " ", "Spacebar"].includes(event.key)) return;
      if (this.mode === "paginated") event.preventDefault();
      this.emitInteraction({ kind: "key", key: event.key, shiftKey: event.shiftKey });
    };
    const onWheel = (event: WheelEvent): void => {
      if (operation !== this.operation || this.mode !== "paginated" || event.ctrlKey) return;
      event.preventDefault();
      this.emitInteraction({ kind: "wheel", deltaY: event.deltaY });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("wheel", onWheel, { passive: false });
    const refreshSelection = (): void => {
      if (operation === this.operation && this.selection) this.captureSelection(contents);
    };
    this.host.addEventListener("scroll", refreshSelection, true);
    contents.window?.addEventListener("scroll", refreshSelection);
    contents.window?.addEventListener("resize", refreshSelection);
    this.frameCleanups.set(document, () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("wheel", onWheel);
      this.host.removeEventListener("scroll", refreshSelection, true);
      contents.window?.removeEventListener("scroll", refreshSelection);
      contents.window?.removeEventListener("resize", refreshSelection);
    });
  }

  private async createRendition(mode: ReaderMode, appearance: Appearance): Promise<number> {
    const operation = ++this.operation;
    this.clearSelection();
    this.cleanupFrames();
    this.destroyRendition();
    this.host.replaceChildren();
    this.mode = mode;
    this.currentAppearance = appearance;

    const contentHooks = this.book!.spine.hooks?.content;
    const previousHooks = new Set(contentHooks?.list() ?? []);
    this.rendition = this.book!.renderTo(this.host, {
      width: "100%",
      height: "100%",
      allowScriptedContent: false,
      manager: mode === "continuous" ? "continuous" : "default",
      flow: mode === "continuous" ? "scrolled-doc" : "paginated",
      spread: mode === "paginated" ? "always" : "none"
    });
    this.renditionSpineHooks = (contentHooks?.list() ?? []).filter(hook => !previousHooks.has(hook));

    // epub.js owns publication frames. Hook each new frame without exposing its DOM
    // or an application bridge to publication content.
    const themeStylesheet = await this.style(appearance);
    if (operation !== this.operation) throw new Error("Reader operation superseded");
    // epub.js themes.register(name, string) treats the string as a URL, not CSS.
    // Apply both appearance and chapter breaks to every frame before layout.
    this.currentStylesheet = themeStylesheet;
    this.rendition.hooks?.content?.register((contents: FrameContents) => {
      this.styleFrame(contents.document);
      this.attachFrame(contents, operation);
    });

    this.rendition.on("relocated", (location: unknown) => {
      if (operation !== this.operation) return;
      this.clearSelection();
      // The event already contains the measured location. Recomputing it walks
      // the publication DOM again and delays navigation in long chapters.
      this.updateSnapshot(location);
    });
    this.rendition.on("removed", (_section: unknown, view: { contents?: FrameContents }) => {
      const document = view?.contents?.document;
      if (!document) return;
      this.frameCleanups.get(document)?.();
      this.frameCleanups.delete(document);
      if (this.selectionDocument === document) this.clearSelection();
    });
    await timeout(this.rendition.display(), "initial display");
    if (operation !== this.operation) throw new Error("Reader operation superseded");
    return operation;
  }

  private destroyRendition(): void {
    // epub.js binds metadata hooks to each rendition but leaves them on the
    // book's spine after destroy, where they retain and call obsolete renderers.
    for (const hook of this.renditionSpineHooks) this.book?.spine.hooks?.content.deregister(hook);
    this.renditionSpineHooks = [];
    const stage = (this.rendition as unknown as { manager?: { stage?: { orientationChangeFunc?: EventListener } } } | undefined)?.manager?.stage;
    // The pinned engine removes "orientationChange" although it registered
    // lowercase "orientationchange", retaining a closed stage on window.
    if (stage?.orientationChangeFunc) window.removeEventListener("orientationchange", stage.orientationChangeFunc);
    this.rendition?.destroy();
    this.rendition = undefined;
  }

  private styleFrame(document: Document): void {
    let style = document.getElementById("reader-user-v1");
    if (!style) {
      style = document.createElement("style");
      style.id = "reader-user-v1";
      document.head.append(style);
    }
    style.textContent = this.currentStylesheet + (this.mode === "paginated" ? PAGINATED_CHAPTER_BREAK : "");
  }

  private async style(appearance: Appearance): Promise<string> {
    const resolved = resolveTheme(appearance.theme);
    const colors = resolved === "dark" ? ["#d4d9cb", "#20251f"] : resolved === "sepia" ? ["#3b4035", "#eee7d8"] : ["#30372e", "#fafaf5"];
    this.host.style.backgroundColor = colors[1]!;
    const linkColors = resolved === "dark" ? ["#9ccbff", "#cab2ff"] : resolved === "sepia" ? ["#254f82", "#684281"] : ["#0645ad", "#663399"];
    const family = /^[A-Za-z0-9 ]+$/.test(appearance.fontFamily) ? appearance.fontFamily : "Liberation Sans Reader";
    let fontFace = ReaderAdapter.fontCss.get(family);
    if (fontFace === undefined) {
      fontFace = "";
      try {
        if (window.readerApi) {
          const list = await window.readerApi.listFonts() as { ok: boolean; value?: Array<{ id: string; family: string; installed: boolean }> };
          const font = list.ok ? list.value?.find(item => item.installed && item.family === family) : undefined;
          if (font) {
            const data = await window.readerApi.getFontData(font.id) as { ok: boolean; value?: { family: string; mime: string; data: string } };
            if (data.ok && data.value?.family === family && data.value.mime === "font/ttf" && /^[A-Za-z0-9+/=]+$/.test(data.value.data)) {
              fontFace = `@font-face { font-family: '${family}'; src: url(data:font/ttf;base64,${data.value.data}) format('truetype'); font-display: swap; }`;
            }
          }
        }
      } catch { /* A missing font falls back to the system font without blocking reading. */ }
      ReaderAdapter.fontCss.set(family, fontFace);
    }
    return `${fontFace} html, body { color: ${colors[0]} !important; background: ${colors[1]} !important; } body { font-family: '${family}', sans-serif !important; font-size: ${appearance.fontSize}px !important; line-height: ${appearance.lineHeight} !important; margin-left: ${appearance.margin}px !important; margin-right: ${appearance.margin}px !important; } p { margin-block: ${appearance.paragraphSpacing}em !important; } a { color: ${linkColors[0]} !important; } a:visited { color: ${linkColors[1]} !important; }`;
  }

  private async restore(location?: ReaderLocation): Promise<void> {
    if (!location) return;
    const resolved = await this.resolveLocation(location);
    try { await this.display(resolved.cfi ?? resolved.href); } catch { await this.display(resolved.href); }
  }

  private async display(target: string): Promise<void> { await timeout(this.rendition!.display(target)); }

  private hrefFor(cfi?: string): string | undefined { try { return cfi ? this.book!.spine.get(this.book!.locations?.locationFromCfi?.(cfi) as unknown as number ?? 0)?.href : undefined; } catch { return undefined; } }

  private toc(): TocItem[] {
    const normalize = (items: NavItem[]): TocItem[] => items.filter(item => typeof item.href === "string" && item.href).map(item => ({ id: item.id, label: item.label, href: item.href, children: normalize(item.subitems ?? []) }));
    return normalize(this.book?.navigation?.toc ?? []);
  }

  private activeToc(href: string, cfi?: string, resourceProgress = 0): { item: TocItem; progress: number } | undefined {
    const baseHref = withoutFragment(href);
    const all = (items: TocItem[]): TocItem[] => items.flatMap(item => [item, ...all(item.children)]);
    const entries = all(this.toc());
    const matches = entries.filter(item => withoutFragment(item.href) === baseHref);
    if (!matches.length) {
      const currentIndex = this.book?.spine.get(baseHref)?.index;
      if (currentIndex === undefined) return undefined;
      const prior = entries.map(item => ({ item, index: this.book?.spine.get(withoutFragment(item.href))?.index }))
        .filter((entry): entry is { item: TocItem; index: number } => entry.index !== undefined && entry.index <= currentIndex);
      const active = prior.at(-1);
      if (!active) return undefined;
      const later = entries.map(item => this.book?.spine.get(withoutFragment(item.href))?.index)
        .find(index => index !== undefined && index > currentIndex);
      const end = later ?? this.book?.packaging?.spine?.length ?? currentIndex + 1;
      const progress = (currentIndex + resourceProgress - active.index) / Math.max(1, end - active.index);
      return { item: active.item, progress: Math.max(0, Math.min(1, progress)) };
    }
    let range: Range | undefined;
    try { range = cfi ? this.rendition?.getRange(cfi) : undefined; } catch { /* Use the resource fallback. */ }
    const document = range?.startContainer.ownerDocument;
    const body = document && bodyOf(document);
    if (!range || !document || !body) return { item: matches[0]!, progress: resourceProgress };
    const anchors = matches.map(item => {
      const fragment = item.href.split("#")[1];
      let element: Element | null = null;
      element = fragment ? anchorOf(document, fragment) : body;
      return { item, element };
    }).filter((entry): entry is { item: TocItem; element: Element } => !!entry.element);
    if (!anchors.length) return { item: matches[0]!, progress: resourceProgress };
    const before = (element: Element): boolean => {
      if (element === range.startContainer || element.contains(range.startContainer)) return true;
      return Boolean(element.compareDocumentPosition(range.startContainer) & 4);
    };
    let activeIndex = 0;
    anchors.forEach((entry, index) => { if (before(entry.element)) activeIndex = index; });
    const active = anchors[activeIndex]!;
    const next = anchors[activeIndex + 1];
    try {
      const traversed = document.createRange();
      traversed.setStartBefore(active.element);
      traversed.setEnd(range.startContainer, range.startOffset);
      const whole = document.createRange();
      whole.setStartBefore(active.element);
      if (next) whole.setEndBefore(next.element);
      else whole.setEnd(body, body.childNodes.length);
      const total = whole.toString().length;
      return { item: active.item, progress: total ? Math.max(0, Math.min(1, traversed.toString().length / total)) : 0 };
    } catch { return { item: active.item, progress: resourceProgress }; }
  }

  private async resolveLocation(location: ReaderLocation): Promise<ReaderLocation> {
    const resolved = await resolveReplacementLocation(replacementBook(this.book!), location);
    return resolved ?? location;
  }

  private async getRangeFromRendition(cfi: string): Promise<Range | undefined> {
    try {
      if (!this.rendition) return undefined;
      const range = this.rendition.getRange(cfi);
      return range ?? undefined;
    } catch { return undefined; }
  }

  private async enrichQuote(location: ReaderLocation): Promise<void> {
    if (!location.cfi) return;
    const operation = this.operation;
    const range = await this.getRangeFromRendition(location.cfi);
    if (operation !== this.operation) return;
    const document = range?.startContainer.ownerDocument;
    const body = document && bodyOf(document);
    const text = body?.textContent;
    if (!range || !document || !body || !text) return;
    let offset: number;
    try {
      const before = document.createRange();
      before.setStart(body, 0);
      before.setEnd(range.startContainer, range.startOffset);
      offset = before.toString().length;
    } catch { return; }
    const context = captureQuoteAtOffset(text, offset);
    if (!context || this.snapshot?.location.cfi !== location.cfi) return;
    const enriched = { ...this.snapshot.location, quote: context.quote, quotePrefix: context.prefix, quoteSuffix: context.suffix };
    this.snapshot = { ...this.snapshot, location: enriched };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private reflowFallback(): ReaderLocation {
    const location = this.captureLocation();
    const active = this.activeToc(location.href, location.cfi, location.resourceProgress);
    return active ? { href: active.item.href, navId: active.item.id } : { href: location.href };
  }

  private updateSnapshot(current?: unknown): ReaderSnapshot {
    const location = current === undefined ? this.captureLocation() : this.locationFromRendition(current);
    const toc = this.toc();
    const active = this.activeToc(location.href, location.cfi, location.resourceProgress);
    const spineIndex = this.book?.spine.get(location.href)?.index ?? 0;
    const spineCount = this.book?.packaging?.spine?.length ?? 0;
    const overallProgress = spineCount > 0 ? (spineIndex + (location.resourceProgress ?? 0)) / spineCount : location.resourceProgress ?? 0;
    this.snapshot = {
      title: String(this.book?.packaging?.metadata?.title ?? "Untitled book"),
      toc,
      location,
      label: active?.item.label ?? String(this.book?.packaging?.metadata?.title ?? "Untitled book"),
      progress: active ? location.navProgress ?? 0 : Math.max(0, Math.min(1, overallProgress)),
      hasNavigation: toc.length > 0
    };
    for (const listener of this.listeners) listener(this.snapshot);
    void this.enrichQuote(location);
    return this.snapshot;
  }
}
