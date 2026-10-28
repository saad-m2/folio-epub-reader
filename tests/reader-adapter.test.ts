import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ReaderAdapter, ensurePublicationHead } from "../src/renderer/reader-adapter";

const createMockHost = () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
};

function renderedStyles(rendition: any): string {
  const doc = document.implementation.createHTMLDocument("Reader frame");
  rendition.hooks.content.register.mock.calls.at(-1)[0]({ document: doc });
  return doc.getElementById("reader-user-v1")?.textContent ?? "";
}

const createMockBook = () => ({
  ready: Promise.resolve(),
  packaging: { metadata: { title: "Test Book", creator: "Test Author", identifier: "test-id" } },
  navigation: { toc: [{ id: "ch1", label: "Chapter 1", href: "ch1.xhtml", subitems: [] }] },
  spine: {
    first: vi.fn(() => ({ href: "ch1.xhtml" })),
    get: vi.fn((href: string) => href === "ch1.xhtml" ? { href: "ch1.xhtml" } : undefined)
  },
  locations: { locationFromCfi: vi.fn(() => 0) },
  renderTo: vi.fn().mockReturnValue({
    destroy: vi.fn(),
    display: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    prev: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    hooks: { content: { register: vi.fn() } },
    themes: { register: vi.fn(), select: vi.fn() },
    currentLocation: vi.fn().mockReturnValue({ href: "ch1.xhtml", cfi: "epubcfi(/6/4)", percentage: 0.5 }),
    q: vi.fn().mockResolvedValue(null)
  }),
  destroy: vi.fn()
});

describe("ReaderAdapter", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = createMockHost();
    vi.resetModules();
  });

  afterEach(() => {
    host.remove();
    vi.clearAllMocks();
  });

  it("applies custom backgrounds and readable underlined links in both reading modes", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const appearance = { theme: "custom" as const, backgroundColor: "#123456", fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Georgia" };
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance });
    expect(host.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(renderedStyles(mockBook.renderTo())).toContain("background: #123456 !important");
    expect(renderedStyles(mockBook.renderTo())).toContain("a { color: #ffffff !important; text-decoration: underline !important;");
    await adapter.setMode("paginated", { ...appearance, backgroundColor: "#ffdd99" });
    expect(renderedStyles(mockBook.renderTo())).toContain("background: #ffdd99 !important");
    expect(renderedStyles(mockBook.renderTo())).toContain("color: #000000 !important");
    await adapter.applyAppearance({ ...appearance, fontColor: "#e1d5b8" });
    expect(renderedStyles(mockBook.renderTo())).toContain("color: #e1d5b8 !important");
    expect(renderedStyles(mockBook.renderTo())).toContain("body * { color: #e1d5b8 !important; }");
    expect(renderedStyles(mockBook.renderTo())).toContain("a { color: #e1d5b8 !important; text-decoration: underline !important;");
    await adapter.setMode("continuous", { ...appearance, fontColor: "#e1d5b8" });
    expect(renderedStyles(mockBook.renderTo())).toContain("color: #e1d5b8 !important");
    await adapter.close();
  });

  it("defaults pagination to one page and restores the passage when choosing a spread", async () => {
    const mockBook = createMockBook();
    Object.assign(mockBook, { getRange: vi.fn().mockResolvedValue({}) });
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const appearance = { theme: "light" as const, fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Georgia" };
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "paginated", appearance });
    expect(mockBook.renderTo).toHaveBeenLastCalledWith(host, expect.objectContaining({ flow: "paginated", spread: "none" }));
    const marker = adapter.captureLocation();
    const rendition = mockBook.renderTo.mock.results.at(-1)!.value;
    await adapter.setPageLayout("double", appearance);
    expect(mockBook.renderTo).toHaveBeenLastCalledWith(host, expect.objectContaining({ flow: "paginated", spread: "always" }));
    expect(rendition.display).toHaveBeenLastCalledWith(marker.cfi);
    await adapter.next();
    await adapter.previous();
    expect(rendition.next).toHaveBeenCalledOnce();
    expect(rendition.prev).toHaveBeenCalledOnce();
    await adapter.setMode("continuous", appearance);
    expect(mockBook.renderTo).toHaveBeenLastCalledWith(host, expect.objectContaining({ flow: "scrolled-doc", spread: "none" }));
    await adapter.setMode("paginated", appearance);
    expect(mockBook.renderTo).toHaveBeenLastCalledWith(host, expect.objectContaining({ spread: "always" }));
    await adapter.setPageLayout("single", appearance);
    expect(rendition.display).toHaveBeenLastCalledWith(marker.cfi);
    await adapter.reflow(appearance);
    expect(rendition.display).toHaveBeenLastCalledWith("ch1.xhtml");
    await adapter.close();
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "paginated", pageLayout: "double", appearance });
    expect(mockBook.renderTo).toHaveBeenLastCalledWith(host, expect.objectContaining({ spread: "always" }));
    await adapter.close();
  });

  it("normalizes a missing XHTML head and preserves an existing head", () => {
    const doc = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Text</p></body></html>', 'application/xhtml+xml');
    ensurePublicationHead(doc);
    expect(doc.documentElement.firstElementChild?.localName).toBe('head');
    expect(doc.getElementsByTagName('head')[0].namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    const head = doc.getElementsByTagName('head')[0];
    ensurePublicationHead(doc);
    expect(doc.getElementsByTagName('head')).toHaveLength(1);
    expect(doc.getElementsByTagName('head')[0]).toBe(head);
    expect(doc.getElementsByTagName('p')[0].textContent).toBe('Text');
  });

  it("removes the engine's lowercase orientationchange callback on close", async () => {
    const mockBook = createMockBook(), callback = vi.fn();
    Object.assign(mockBook.renderTo(), { manager: { stage: { orientationChangeFunc: callback } } });
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    window.addEventListener('orientationchange', callback);
    window.dispatchEvent(new Event('orientationchange'));
    expect(callback).toHaveBeenCalledOnce();
    await adapter.close();
    window.dispatchEvent(new Event('orientationchange'));
    expect(callback).toHaveBeenCalledOnce();
  });

  it("removes rendition-owned spine hooks when switching modes and closing", async () => {
    const mockBook = createMockBook();
    const hooks: Function[] = [], removed: Function[] = [];
    Object.assign(mockBook.spine, { hooks: { content: { list: () => hooks, deregister: (hook: Function) => { removed.push(hook); hooks.splice(hooks.indexOf(hook), 1); } } } });
    const rendition = mockBook.renderTo();
    mockBook.renderTo.mockImplementation(() => { hooks.push(() => undefined); return rendition; });
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const appearance = { theme: "light" as const, fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" };
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance });
    const first = hooks[1];
    await adapter.setMode('paginated', appearance);
    expect(removed).toContain(first);
    expect(hooks).toHaveLength(2);
    await adapter.close();
    expect(removed).toHaveLength(2);
    expect(hooks).toHaveLength(1);
  });

  it("uses relocated event data without measuring the publication DOM twice", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const rendition = mockBook.renderTo.mock.results[0].value;
    const relocated = rendition.on.mock.calls.find(([event]: [string]) => event === "relocated")[1];
    const listener = vi.fn();
    adapter.subscribe(listener);
    rendition.currentLocation.mockClear();
    relocated({ start: { href: "ch1.xhtml", cfi: "epubcfi(/6/4!/4/2:7)", percentage: .75 } });
    expect(rendition.currentLocation).not.toHaveBeenCalled();
    expect(listener.mock.calls[0][0].location).toMatchObject({ href: "ch1.xhtml", cfi: "epubcfi(/6/4!/4/2:7)", resourceProgress: .75 });
    await adapter.close();
  });

  it("opens and returns snapshot with title, toc, location", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    const snapshot = await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    expect(snapshot.title).toBe("Test Book");
    expect(snapshot.toc.length).toBe(1);
    expect(snapshot.toc[0].id).toBe("ch1");
    expect(snapshot.location.href).toBe("ch1.xhtml");
    expect(snapshot.hasNavigation).toBe(true);
  });

  it("captures location with navId and navProgress when TOC matches", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    const location = adapter.captureLocation();
    expect(location.navId).toBe("ch1");
    expect(location.navProgress).toBe(0.5);
    expect(location.resourceProgress).toBe(0.5);
  });

  it("keeps captured quote context when flushing the same passage on exit", async () => {
    const mockBook = createMockBook();
    const doc = document.implementation.createHTMLDocument();
    doc.body.textContent = "Before the saved passage and after";
    const range = doc.createRange();
    range.setStart(doc.body.firstChild!, 11);
    range.collapse(true);
    mockBook.renderTo().getRange = vi.fn().mockReturnValue(range);
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    await vi.waitFor(() => expect(adapter.captureLocation().quote).toContain("saved passage"));
    const captured = adapter.captureLocation();
    expect(captured.quotePrefix).toBeDefined();
    expect(captured.quoteSuffix).toBeDefined();
    mockBook.renderTo().currentLocation = vi.fn().mockReturnValue({ href: "ch1.xhtml", cfi: "epubcfi(/6/6)", percentage: 0.6 });
    expect(adapter.captureLocation().quote).toBeUndefined();
  });

  it("shows overall spine progress when a book has no usable TOC", async () => {
    const mockBook = createMockBook();
    mockBook.navigation.toc = [];
    (mockBook.packaging as any).spine = [{}, {}, {}, {}];
    mockBook.spine.get = vi.fn().mockReturnValue({ href: "ch1.xhtml", index: 2 });
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const snapshot = await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    expect(snapshot.hasNavigation).toBe(false);
    expect(snapshot.progress).toBe(0.625);
  });

  it("keeps a TOC section active across later spine resources", async () => {
    const mockBook = createMockBook();
    mockBook.navigation.toc = [
      { id: "part-one", label: "Part One", href: "ch1.xhtml#start", subitems: [] },
      { id: "part-two", label: "Part Two", href: "ch3.xhtml#start", subitems: [] }
    ];
    (mockBook.packaging as any).spine = [{}, {}, {}, {}];
    mockBook.spine.get = vi.fn((href: string) => ({ "ch1.xhtml": { href: "ch1.xhtml", index: 0 }, "ch2.xhtml": { href: "ch2.xhtml", index: 1 }, "ch3.xhtml": { href: "ch3.xhtml", index: 2 } } as Record<string, { href: string; index: number }>)[href]);
    mockBook.renderTo().currentLocation = vi.fn().mockReturnValue({ href: "ch2.xhtml", percentage: 0.5 });
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const appearance = { theme: "light" as const, fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" };
    const snapshot = await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance });
    expect(snapshot.label).toBe("Part One");
    expect(snapshot.location.navId).toBe("part-one");
    expect(snapshot.progress).toBe(0.75);
    await adapter.reflow(appearance);
    expect(mockBook.renderTo().display).toHaveBeenLastCalledWith("ch1.xhtml#start");
  });

  it("uses the current anchor range when several TOC entries share one resource", async () => {
    const mockBook = createMockBook();
    mockBook.navigation.toc = [
      { id: "one", label: "One", href: "ch1.xhtml#one", subitems: [] },
      { id: "two", label: "Two", href: "ch1.xhtml#two", subitems: [] }
    ];
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = '<h2 id="one">One</h2><p>Earlier passage</p><h2 id="two">Two</h2><p>Current passage</p>';
    const text = doc.body.lastElementChild!.firstChild!;
    const range = doc.createRange();
    range.setStart(text, 4);
    range.collapse(true);
    const rendition = mockBook.renderTo();
    rendition.getRange = vi.fn().mockReturnValue(range);
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const snapshot = adapter.captureLocation();
    expect(snapshot.navId).toBe("two");
    expect(snapshot.navProgress).toBeGreaterThan(0);
    expect(snapshot.navProgress).toBeLessThan(1);
    await adapter.applyAppearance({ theme: "dark", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" });
    expect(rendition.display).toHaveBeenLastCalledWith("ch1.xhtml#two");
  });

  it("resolves a changed replacement quote through the loaded EPUB section", async () => {
    const mockBook = createMockBook();
    const doc = document.implementation.createHTMLDocument();
    doc.body.textContent = "Before a reliable marker after";
    const section = {
      document: doc,
      load: vi.fn().mockResolvedValue(doc.documentElement),
      cfiFromRange: vi.fn().mockReturnValue("epubcfi(/6/4!/4/2:9)")
    };
    mockBook.spine.get = vi.fn().mockReturnValue(section);
    (mockBook as any).getRange = vi.fn().mockResolvedValue(undefined);
    (mockBook as any).load = vi.fn();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const resolved = await ReaderAdapter.resolveReplacement(new ArrayBuffer(0), {
      href: "ch1.xhtml", quote: "reliable marker", quotePrefix: "Before a ", quoteSuffix: " after"
    });
    expect(section.load).toHaveBeenCalled();
    expect(section.cfiFromRange).toHaveBeenCalled();
    expect(resolved?.cfi).toBe("epubcfi(/6/4!/4/2:9)");
  });

  it("resolves system theme to light or dark", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "system", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    const rendition = (adapter as any).rendition;
    expect(renderedStyles(rendition)).toContain("background: #fafaf5");
  });

  it("registers chapter break theme for paginated mode", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "paginated",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    const rendition = (adapter as any).rendition;
    const css = renderedStyles(rendition);
    expect(css).toContain("page-break-before: always");
    expect(css).toContain("background: #fafaf5");
  });

  it("setMode recreates rendition and restores location", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    await adapter.setMode("paginated", { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" });

    const rendition = (adapter as any).rendition;
    expect(rendition.destroy).toHaveBeenCalled();
    expect(mockBook.renderTo).toHaveBeenCalledTimes(2);
  });

  it("applies appearance with reflow fallback to active TOC item", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    await adapter.applyAppearance({ theme: "dark", fontSize: 18, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" });

    const rendition = (adapter as any).rendition;
    expect(renderedStyles(rendition)).toContain("background: #20251f");
  });

  it("coalesces rapid reflows and ends with the latest appearance", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const base = { fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } as const;
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { ...base, theme: "light" } });
    await Promise.all([
      adapter.reflow({ ...base, theme: "sepia" }),
      adapter.reflow({ ...base, theme: "dark" })
    ]);
    expect(mockBook.renderTo).toHaveBeenCalledTimes(1);
    expect(renderedStyles(mockBook.renderTo())).toContain("background: #20251f");
  });

  it("delegates page movement without repeating the relocated event's DOM measurement", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    mockBook.renderTo().currentLocation.mockClear();
    await adapter.next();
    expect(mockBook.renderTo().next).toHaveBeenCalled();

    await adapter.previous();
    expect(mockBook.renderTo().prev).toHaveBeenCalled();
    expect(mockBook.renderTo().currentLocation).not.toHaveBeenCalled();
  });

  it("goTo navigates and updates snapshot", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    await adapter.goTo({ href: "ch1.xhtml", cfi: "epubcfi(/6/4)" });
    expect(mockBook.renderTo().display).toHaveBeenCalledWith("epubcfi(/6/4)");
  });

  it("close destroys rendition and book", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    await adapter.close();

    expect(mockBook.renderTo().destroy).toHaveBeenCalled();
    expect(mockBook.destroy).toHaveBeenCalled();
    expect(host.children.length).toBe(0);
  });

  it("a superseded archive open cannot close the replacement publication", async () => {
    let finishFirst!: () => void;
    const first = { ...createMockBook(), opened: new Promise<void>(resolve => { finishFirst = resolve; }) };
    const second = createMockBook();
    const engine = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    vi.doMock("epubjs", () => ({ default: engine }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const input = { archiveBytes: new ArrayBuffer(0), mode: "continuous" as const, appearance: { theme: "light" as const, fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } };
    const pending = adapter.open(input);
    const rejected = expect(pending).rejects.toThrow("superseded");
    await Promise.resolve();
    await adapter.open(input);
    finishFirst();
    await rejected;
    expect(second.destroy).not.toHaveBeenCalled();
    expect((adapter as any).book).toBe(second);
    await adapter.close();
  });

  it("drops queued navigation when its publication closes", async () => {
    const book = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(book) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const rejected = expect(adapter.next()).rejects.toThrow("superseded");
    await adapter.close();
    await rejected;
    expect(book.renderTo().next).not.toHaveBeenCalled();
    expect((adapter as any).snapshot).toBeUndefined();
  });

  it("subscribe notifies on updates", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");

    const adapter = new ReaderAdapter(host);
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);

    await adapter.open({
      archiveBytes: new ArrayBuffer(0),
      mode: "continuous",
      appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" }
    });

    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();
    await adapter.next();
    expect(listener).not.toHaveBeenCalled();
  });

  it("emits bounded host-relative selection and clears it on deselect and navigation", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const frame = document.createElement("iframe");
    host.appendChild(frame);
    const frameDoc = frame.contentDocument!;
    frameDoc.body.innerHTML = "<p>Ein langer deutscher Satz.</p>";
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 10, top: 20 } as DOMRect);
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({ left: 30, top: 50, width: 200, height: 100 } as DOMRect);
    const range = frameDoc.createRange();
    range.selectNodeContents(frameDoc.querySelector("p")!);
    Object.defineProperty(range, "getClientRects", { value: () => [{ left: 5, top: 6, width: 80, height: 14 }] });
    const selection = frame.contentWindow!.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const contents = { document: frameDoc, window: frame.contentWindow!, cfiFromRange: vi.fn().mockReturnValue("epubcfi(/6/4!/4/2)") };
    mockBook.renderTo().hooks.content.register.mock.calls[0][0](contents);
    const listener = vi.fn();
    adapter.subscribeSelection(listener);
    frameDoc.dispatchEvent(new Event("selectionchange"));
    expect(adapter.getSelection()).toMatchObject({ text: "Ein langer deutscher Satz.", cfi: "epubcfi(/6/4!/4/2)", rects: [{ x: 25, y: 36, width: 80, height: 14 }] });
    contents.cfiFromRange.mockReturnValue("x".repeat(4_001));
    frameDoc.dispatchEvent(new Event("selectionchange"));
    expect(adapter.getSelection()?.cfi).toBeUndefined();
    selection.removeAllRanges();
    frameDoc.dispatchEvent(new Event("selectionchange"));
    expect(adapter.getSelection()).toBeUndefined();
    expect(listener).toHaveBeenLastCalledWith(undefined);
    const tooLong = vi.fn();
    adapter.subscribeSelectionTooLong(tooLong);
    frameDoc.querySelector("p")!.textContent = "x".repeat(5_001);
    range.selectNodeContents(frameDoc.querySelector("p")!);
    selection.addRange(range);
    frameDoc.dispatchEvent(new Event("selectionchange"));
    expect(adapter.getSelection()).toBeUndefined();
    expect(tooLong).toHaveBeenCalledOnce();
    await adapter.next();
    expect(adapter.getSelection()).toBeUndefined();
    await adapter.close();
    expect(adapter.getSelection()).toBeUndefined();
  });

  it.each(["paginated", "continuous"] as const)("reserves text clicks for native interactions in %s mode", async (mode) => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode, appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const frame = document.createElement("iframe");
    host.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.body.innerHTML = '<p>Book <em>text</em></p>';
    mockBook.renderTo().hooks.content.register.mock.calls[0][0]({ document: doc, window: frame.contentWindow! });
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000 } as DOMRect);
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000 } as DOMRect);
    const interactions = vi.fn();
    adapter.subscribeInteraction(interactions);
    const text = doc.querySelector("em")!;
    const caret = doc.createRange();
    caret.setStart(text.firstChild!, 1);
    Object.defineProperty(doc, "caretRangeFromPoint", { value: vi.fn(() => caret) });
    let rects: DOMRect[] = [];
    vi.spyOn(doc, "createRange").mockImplementation(() => ({ selectNodeContents: vi.fn(), getClientRects: () => rects }) as unknown as Range);
    for (const [x, zone] of [[50, "left"], [500, "center"], [950, "right"]] as const) {
      rects = [{ left: x - 10, right: x + 10, top: 20, bottom: 40, width: 20, height: 20 } as DOMRect];
      for (const detail of [1, 2, 3]) {
        const click = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: 30, detail });
        expect(text.dispatchEvent(click)).toBe(true);
        expect(click.defaultPrevented).toBe(false);
      }
      expect(interactions).not.toHaveBeenCalled();
      // The caret API also returns nearby text for blank space below a line.
      text.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: 60 }));
      expect(interactions).toHaveBeenCalledExactlyOnceWith({ kind: "reader-click", zone });
      interactions.mockClear();
    }
    for (const type of ["mousedown", "mousemove", "mouseup", "contextmenu", "auxclick"]) {
      expect(text.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 2 }))).toBe(true);
    }
    expect(interactions).not.toHaveBeenCalled();
    await adapter.close();
  });

  it("intercepts external links and emits frame navigation input", async () => {
    const mockBook = createMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "paginated", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const frame = document.createElement("iframe");
    host.appendChild(frame);
    const frameDoc = frame.contentDocument!;
    frameDoc.body.innerHTML = '<a href="https://example.org/essay">External</a><a href="http://example.org">Blocked</a><p>Book text</p>';
    mockBook.renderTo().hooks.content.register.mock.calls[0][0]({ document: frameDoc, window: frame.contentWindow! });
    const links = vi.fn();
    const interactions = vi.fn();
    adapter.subscribeExternalLink(links);
    adapter.subscribeInteraction(interactions);
    const external = frameDoc.querySelector("a")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    expect(external.dispatchEvent(click)).toBe(false);
    expect(links).toHaveBeenCalledWith("https://example.org/essay");
    const blocked = frameDoc.querySelectorAll("a")[1]!;
    expect(blocked.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))).toBe(false);
    expect(links).toHaveBeenCalledTimes(1);
    const key = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    expect(frameDoc.dispatchEvent(key)).toBe(false);
    expect(interactions).toHaveBeenCalledWith({ kind: "key", key: "ArrowRight", shiftKey: false });
    const wheel = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    expect(frameDoc.dispatchEvent(wheel)).toBe(false);
    expect(interactions).toHaveBeenCalledWith({ kind: "wheel", deltaY: 100 });
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ left: 20, width: 1000 } as DOMRect);
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({ left: 100, width: 1000 } as DOMRect);
    frameDoc.querySelector("p")!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 50 }));
    expect(interactions).toHaveBeenCalledWith({ kind: "reader-click", zone: "left" });
  });
});
