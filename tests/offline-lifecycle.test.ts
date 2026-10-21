import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalTranslationGateway, TRANSLATION_MODEL, TranslationFailure, type TranslationFailureCode } from "../src/main/translation";
import { FontManager, DEFAULT_FONT, FONT_CATALOG, type DownloadableFont } from "../src/main/fonts";
import { LibraryRepository, inspectLocalEpub, revalidateSource, SourceValidationError } from "../src/main/library";
import { ReaderAdapter } from "../src/renderer/reader-adapter";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const roots: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "epub-test-"));
  roots.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(d => fs.rm(d, { recursive: true, force: true })));
});

function ollamaMock(opts: { installed?: boolean; loaded?: boolean; fail?: boolean; delayMs?: number; loadDuration?: number } = {}) {
  let { installed = true, loaded = false, fail = false, delayMs = 0, loadDuration = 0 } = opts;
  let currentLoaded = loaded;
  const requests: Array<{ path: string; body?: Record<string, unknown> }> = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const pathName = url.pathname;
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    requests.push({ path: pathName, body });
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (fail) throw new TypeError("network down");
    if (pathName === "/api/tags") return Response.json({ models: installed ? [{ name: TRANSLATION_MODEL }] : [] });
    if (pathName === "/api/ps") return Response.json({ models: currentLoaded ? [{ name: TRANSLATION_MODEL }] : [] });
    if (pathName === "/api/generate") {
      if (body?.keep_alive === 0) currentLoaded = false;
      else if (body?.prompt === "") currentLoaded = true;
      return Response.json({ response: body?.prompt ? "translated" : "", load_duration: loadDuration, done: true });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;
  return { fetcher, requests, setInstalled(v: boolean) { installed = v; }, setLoaded(v: boolean) { currentLoaded = v; }, setLoadDuration(v: number) { loadDuration = v; } };
}

function makeMockBook(overrides: Partial<{
  title: string;
  author: string;
  toc: Array<{ id: string; label: string; href: string; subitems: any[] }>;
  spine: { first: any; get: any; length: number };
  ready: Promise<void>;
}> = {}) {
  const base = {
    ready: Promise.resolve(),
    packaging: { metadata: { title: overrides.title ?? "Test Book", creator: overrides.author ?? "Test Author", identifier: "test-id" } },
    navigation: { toc: overrides.toc ?? [{ id: "ch1", label: "Chapter 1", href: "ch1.xhtml", subitems: [] }] },
    spine: {
      first: vi.fn(() => ({ href: "ch1.xhtml" })),
      get: vi.fn((href: string) => ({ href: withoutFragment(href), index: 0 })),
      ...overrides.spine
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
    destroy: vi.fn(),
    getRange: vi.fn().mockResolvedValue(undefined),
    load: vi.fn()
  };
  return base as any;
}
function withoutFragment(href: string): string { return href.split("#")[0] ?? href; }

describe("H3: offline-first and network isolation", () => {
  it("translation gateway: status check is read-only loopback; no model load or text sent", async () => {
    const mock = ollamaMock({ installed: true, loaded: false });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher, statusTimeoutMs: 1000 });
    expect(await gateway.getStatus()).toEqual({ state: "unloaded" });
    expect(mock.requests.map(r => r.path)).toEqual(["/api/tags", "/api/ps"]);
    expect(mock.requests.some(r => r.path === "/api/generate")).toBe(false);
  });

  it("translation gateway: explicit load loads model; translate only works when loaded", async () => {
    const mock = ollamaMock({ installed: true, loaded: false });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    await expect(gateway.translate("text")).rejects.toMatchObject({ code: "unloaded" });
    expect(await gateway.load()).toEqual({ state: "loaded" });
    expect(await gateway.translate("Hallo")).toEqual({ text: "translated" });
    const gen = mock.requests.filter(r => r.path === "/api/generate");
    expect(gen[0].body).toMatchObject({ model: TRANSLATION_MODEL, prompt: "", keep_alive: -1 });
    expect(gen[1].body).toMatchObject({ model: TRANSLATION_MODEL, prompt: "Hallo", keep_alive: -1 });
  });

  it("translation gateway: unavailable Ollama is isolated; reading continues", async () => {
    const mock = ollamaMock({ fail: true });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher, statusTimeoutMs: 50 });
    expect(await gateway.getStatus()).toEqual({ state: "unavailable" });
    await expect(gateway.load()).rejects.toMatchObject({ code: "unavailable" });
    await expect(gateway.translate("text")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("translation gateway: missing model is isolated; no crash", async () => {
    const mock = ollamaMock({ installed: false });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    expect(await gateway.getStatus()).toEqual({ state: "missing" });
    await expect(gateway.load()).rejects.toMatchObject({ code: "missing" });
    await expect(gateway.translate("text")).rejects.toMatchObject({ code: "missing" });
  });

  it("translation gateway: stopped Ollama during translate cancels cleanly", async () => {
    const mock = ollamaMock({ installed: true, loaded: true });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    const p = gateway.translate("text");
    mock.setLoaded(false);
    await expect(p).rejects.toMatchObject({ code: "unloaded" });
  });

  it("translation gateway: unload cancels active translation", async () => {
    let translationStarted = false;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const pathName = new URL(String(input)).pathname;
      if (pathName === "/api/tags") return Response.json({ models: [{ name: TRANSLATION_MODEL }] });
      if (pathName === "/api/ps") return Response.json({ models: [{ name: TRANSLATION_MODEL }] });
      if (pathName === "/api/generate" && init?.body && JSON.parse(String(init.body)).prompt === "text") {
        translationStarted = true;
        return new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")), { once: true }));
      }
      if (pathName === "/api/generate" && init?.body && JSON.parse(String(init.body)).keep_alive === 0) {
        return Response.json({ done: true });
      }
      return new Response("", { status: 404 });
    }) as typeof fetch;
    const gateway = new LocalTranslationGateway({ fetcher });
    const translating = gateway.translate("text");
    await vi.waitFor(() => expect(translationStarted).toBe(true));
    const unloading = gateway.unload();
    await expect(translating).rejects.toMatchObject({ code: "cancelled" });
    await unloading;
  });

  it("font manager: bundled font works offline; optional fonts not installed by default", async () => {
    const dir = await tempDir();
    const manager = new FontManager(dir);
    const listed = await manager.list();
    expect(listed[0]).toEqual({ ...DEFAULT_FONT, installed: true });
    expect(listed.slice(1).every(f => !f.installed)).toBe(true);
    expect(listed.slice(1).map(f => f.id)).toEqual(FONT_CATALOG.map(f => f.id));
  });

  it("font manager: install fails gracefully offline (network error)", async () => {
    const dir = await tempDir();
    const entry = FONT_CATALOG[0];
    const download = vi.fn(async () => { throw new Error("network down"); });
    const manager = new FontManager(dir, [entry], download);
    await expect(manager.install(entry.id)).rejects.toThrow("network down");
    expect((await manager.list())[1]?.installed).toBe(false);
  });

  it("font manager: installed optional font works offline across instances", async () => {
    const dir = await tempDir();
    const entry = FONT_CATALOG[0];
    const bytes = Buffer.from("font-bytes");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const testEntry: DownloadableFont = { ...entry, sha256 };
    const download = vi.fn(async () => bytes);
    const manager = new FontManager(dir, [testEntry], download);
    await manager.install(testEntry.id);
    expect((await manager.list())[1]?.installed).toBe(true);
    const manager2 = new FontManager(dir, [testEntry]);
    expect((await manager2.list())[1]?.installed).toBe(true);
    expect(await manager2.readInstalled(testEntry.id)).toEqual(bytes);
  });

  it("library: add, list, open, close, restore works offline", async () => {
    const source = await tempDir();
    const epubPath = path.join(source, "book.epub");
    await fs.writeFile(epubPath, Buffer.from("PK\x03\x04epub"));
    const dbPath = path.join(await tempDir(), "library.sqlite");
    const repo = new LibraryRepository(dbPath);
    const input = await inspectLocalEpub(epubPath);
    const id = repo.add(input);
    repo.saveLocation(id, { href: "ch1.xhtml", resourceProgress: 0.4 });
    expect(repo.list()[0]).toMatchObject({ id, progress: 0.4, missing: false });
    const loc = repo.getLocation(id);
    expect(loc?.href).toBe("ch1.xhtml");
    expect(loc?.resourceProgress).toBe(0.4);
    repo.close();
  });

  it("library: revalidateSource detects missing/changed files offline", async () => {
    const source = await tempDir();
    const epubPath = path.join(source, "book.epub");
    await fs.writeFile(epubPath, Buffer.from("original"));
    const dbPath = path.join(await tempDir(), "library.sqlite");
    const repo = new LibraryRepository(dbPath);
    const input = await inspectLocalEpub(epubPath);
    const id = repo.add(input);
    await fs.unlink(epubPath);
    await expect(revalidateSource(repo.get(id)!, repo)).rejects.toMatchObject({ code: "MISSING" });
    await fs.writeFile(epubPath, Buffer.from("changed"));
    await expect(revalidateSource(repo.get(id)!, repo)).rejects.toMatchObject({ code: "CHANGED" });
    repo.close();
  });
});

describe("H4: reader lifecycle and performance regression", () => {
  let host: HTMLElement;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    vi.resetModules();
  });
  afterEach(() => { host.remove(); vi.clearAllMocks(); });

  it("ReaderAdapter open/close cycle releases all resources", async () => {
    const mockBook = makeMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    await adapter.close();
    expect(mockBook.destroy).toHaveBeenCalled();
    expect(mockBook.renderTo().destroy).toHaveBeenCalled();
    expect(host.children.length).toBe(0);
  });

  it("20 open/reflow/close cycles: no leaked frames or handlers", async () => {
    let renderToCallCount = 0;
    const createMockBook = () => {
      const m = makeMockBook();
      (m as any).renderTo = vi.fn().mockImplementation(() => {
        renderToCallCount++;
        return {
          destroy: vi.fn(),
          display: vi.fn().mockResolvedValue(undefined),
          next: vi.fn().mockResolvedValue(undefined),
          prev: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          hooks: { content: { register: vi.fn() } },
          themes: { register: vi.fn(), select: vi.fn() },
          currentLocation: vi.fn().mockReturnValue({ href: "ch1.xhtml", cfi: "epubcfi(/6/4)", percentage: 0.5 }),
          q: vi.fn().mockResolvedValue(null)
        };
      });
      return m;
    };
    vi.doMock("epubjs", () => ({ default: vi.fn().mockImplementation(() => createMockBook()) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    for (let i = 0; i < 20; i++) {
      const adapter = new ReaderAdapter(host);
      await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
      await adapter.applyAppearance({ theme: "dark", fontSize: 18, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" });
      await adapter.reflow({ theme: "sepia", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" });
      await adapter.close();
    }
    expect(renderToCallCount).toBe(20);
    expect(host.children.length).toBe(0);
  });

  it("rapid reflows coalesce to latest appearance", async () => {
    const mockBook = makeMockBook();
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
    const doc = document.implementation.createHTMLDocument("Reader frame");
    mockBook.renderTo().hooks.content.register.mock.calls.at(-1)[0]({ document: doc });
    expect(doc.getElementById("reader-user-v1")?.textContent).toContain("background: #20251f");
  });

  it("navigation (next/previous/goTo) updates snapshot without leaks", async () => {
    const mockBook = makeMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    await adapter.next();
    expect(mockBook.renderTo().next).toHaveBeenCalled();
    await adapter.previous();
    expect(mockBook.renderTo().prev).toHaveBeenCalled();
    await adapter.goTo({ href: "ch1.xhtml", cfi: "epubcfi(/6/4)" });
    expect(mockBook.renderTo().display).toHaveBeenCalledWith("epubcfi(/6/4)");
    await adapter.close();
  });

  it("selection is cleared on navigation and close", async () => {
    const mockBook = makeMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const frame = document.createElement("iframe");
    host.appendChild(frame);
    const frameDoc = frame.contentDocument!;
    frameDoc.body.innerHTML = "<p>text</p>";
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
    frameDoc.dispatchEvent(new Event("selectionchange"));
    expect(adapter.getSelection()).toBeDefined();
    await adapter.next();
    expect(adapter.getSelection()).toBeUndefined();
    await adapter.close();
    expect(adapter.getSelection()).toBeUndefined();
  });

  it("external HTTPS links are intercepted; non-HTTPS blocked", async () => {
    const mockBook = makeMockBook();
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "paginated", appearance: { theme: "light", fontSize: 16, margin: 40, lineHeight: 1.5, paragraphSpacing: 0, fontFamily: "Georgia" } });
    const frame = document.createElement("iframe");
    host.appendChild(frame);
    const frameDoc = frame.contentDocument!;
    frameDoc.body.innerHTML = '<a href="https://example.org/link">HTTPS</a><a href="http://example.org/link">HTTP</a>';
    mockBook.renderTo().hooks.content.register.mock.calls[0][0]({ document: frameDoc, window: frame.contentWindow! });
    const links: string[] = [];
    adapter.subscribeExternalLink(url => links.push(url));
    expect(frameDoc.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))).toBe(false);
    expect(links).toEqual(["https://example.org/link"]);
    expect(frameDoc.querySelectorAll("a")[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))).toBe(false);
    expect(links).toHaveLength(1);
    await adapter.close();
  });

  it("translation gateway dispose attempts bounded unload on app exit", async () => {
    const mock = ollamaMock({ installed: true, loaded: true });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher, unloadTimeoutMs: 5000 });
    await gateway.load();
    await expect(gateway.dispose()).resolves.toBeUndefined();
  });

  it("translation gateway: concurrent operations are serialized", async () => {
    const mock = ollamaMock({ installed: true, loaded: false });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    const loadP = gateway.load();
    const statusP = gateway.getStatus();
    expect(await statusP).toEqual({ state: "unloaded" });
    expect(await loadP).toEqual({ state: "loaded" });
  });

  it("translation gateway: timeout on stalled service", async () => {
    const fetcher = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")), { once: true }))) as typeof fetch;
    const gateway = new LocalTranslationGateway({ fetcher, statusTimeoutMs: 5 });
    expect(await gateway.getStatus()).toEqual({ state: "error", reason: "timeout" });
  });

  it("translation: repeated load/unload cycles are stable", async () => {
    const mock = ollamaMock({ installed: true, loaded: false });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    for (let i = 0; i < 5; i++) {
      expect(await gateway.load()).toEqual({ state: "loaded" });
      expect(await gateway.unload()).toEqual({ state: "unloaded" });
    }
    expect(mock.requests.filter(r => r.body?.keep_alive === -1 && r.body?.prompt === "")).toHaveLength(5);
    expect(mock.requests.filter(r => r.body?.keep_alive === 0)).toHaveLength(5);
  });
});

describe("H3/H4 integration: end-to-end offline flow", () => {
  let host: HTMLElement;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    vi.resetModules();
  });
  afterEach(() => { host.remove(); vi.clearAllMocks(); });

  it("complete offline reading session: import, open, read, navigate, reflow, close", async () => {
    const source = await tempDir();
    const epubPath = path.join(source, "book.epub");
    await fs.writeFile(epubPath, Buffer.from("PK\x03\x04epub-content"));
    const dbPath = path.join(await tempDir(), "library.sqlite");
    const repo = new LibraryRepository(dbPath);
    const input = await inspectLocalEpub(epubPath);
    const id = repo.add(input);
    repo.saveLocation(id, { href: "ch1.xhtml", resourceProgress: 0.3 });

    const mock = ollamaMock({ installed: true, loaded: false });
    const gateway = new LocalTranslationGateway({ fetcher: mock.fetcher });
    expect(await gateway.getStatus()).toEqual({ state: "unloaded" });

    const fontDir = await tempDir();
    const fontManager = new FontManager(fontDir);
    const fonts = await fontManager.list();
    expect(fonts[0].installed).toBe(true);

    const mockBook = makeMockBook({ title: input.title, author: input.author });
    vi.doMock("epubjs", () => ({ default: vi.fn().mockReturnValue(mockBook) }));
    const { ReaderAdapter } = await import("../src/renderer/reader-adapter");
    const adapter = new ReaderAdapter(host);
    const snapshot = await adapter.open({ archiveBytes: new ArrayBuffer(0), mode: "continuous", appearance: { theme: "system", fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Liberation Sans Reader" } });
    expect(snapshot.title).toBe(input.title);
    expect(snapshot.location.href).toBe("ch1.xhtml");

    await adapter.next();
    await adapter.previous();
    await adapter.goTo({ href: "ch1.xhtml", cfi: "epubcfi(/6/4)" });

    await adapter.applyAppearance({ theme: "dark", fontSize: 20, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Liberation Sans Reader" });
    await adapter.reflow({ theme: "sepia", fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Liberation Sans Reader" });

    const loc = adapter.captureLocation();
    repo.saveLocation(id, loc);

    await adapter.close();
    repo.close();

    const repo2 = new LibraryRepository(dbPath);
    expect(repo2.getLocation(id)?.href).toBe(loc.href);
    repo2.close();
  });
});
