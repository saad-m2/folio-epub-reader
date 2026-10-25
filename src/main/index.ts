import { app, autoUpdater, BrowserWindow, clipboard, dialog, ipcMain, Menu, protocol, safeStorage, session, shell, type IpcMainInvokeEvent, type Session } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { configurePaths } from "./paths";
import { TrustedPublicationSessions } from "./publications";
import { inspectLocalEpub, LibraryRepository, revalidateSource, SourceValidationError } from "./library";
import { requireAppMainFrame, safeError, redactError } from "./security";
import { LocalTranslationGateway, TranslationFailure, type TranslationFailureCode } from "./translation";
import { CloudTranslationFailure, type CloudFailureCode } from "./cloud-translation-types";
import { createCloudAdapters } from "./cloud-adapters";
import { TranslationStore } from "./translation-store";
import { TranslationCoordinator } from "./translation-coordinator";
import { DEFAULT_FONT, FontManager } from "./fonts";
import { CloseSessionSchema, OpenSessionSchema, RemoveBookSchema, RendererIntents, ReaderLocationSchema, type ReaderLocation } from "../shared/contracts";
import { handleSquirrelEvent } from "./squirrel";
import { runReleaseTests } from "./release-tests";
import { configureOfflineQualification } from "./offline-test";
import { UpdateController } from "./updates";

app.setName("Leaf");
configurePaths();
configureOfflineQualification();
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

const publications = new TrustedPublicationSessions();
let window: BrowserWindow | undefined;
let library: LibraryRepository | undefined;
let fontManager: FontManager | undefined;
let updates: UpdateController | undefined;
const pendingImports = new Map<string, { sourcePath: string; owner: Session; archiveHash: string }>();
let translation = new LocalTranslationGateway();
let translationStore: TranslationStore | undefined;
let translationCoordinator: TranslationCoordinator | undefined;
let activeSelection: { id: string; sessionId: string; owner: Session; text: string; expiresAt: number } | undefined;
let currentTranslation: { selectionId: string; text: string } | undefined;

function translationError(code: TranslationFailureCode): ReturnType<typeof safeError> {
  const codes: Record<TranslationFailureCode, Parameters<typeof safeError>[0]> = {
    unavailable: "SERVICE_UNAVAILABLE", missing: "MODEL_MISSING", unloaded: "MODEL_UNLOADED",
    timeout: "MODEL_TIMEOUT", cancelled: "MODEL_CANCELLED", out_of_memory: "MODEL_OUT_OF_MEMORY",
    interrupted: "MODEL_INTERRUPTED", invalid_output: "MODEL_INVALID_OUTPUT",
    load_failed: "MODEL_LOAD_FAILED", service_error: "MODEL_SERVICE_ERROR", unexpected_reload: "MODEL_UNEXPECTED_RELOAD",
  };
  return safeError(codes[code]);
}

async function translationOperation<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof TranslationFailure) throw translationError(error.code);
    if (error instanceof CloudTranslationFailure) {
      const codes: Record<CloudFailureCode, Parameters<typeof safeError>[0]> = {
        exhausted: "CLOUD_EXHAUSTED", rate_limited: "CLOUD_RATE_LIMITED", authentication: "CLOUD_AUTHENTICATION",
        network: "CLOUD_NETWORK", timeout: "CLOUD_TIMEOUT", cancelled: "CLOUD_CANCELLED", invalid_output: "CLOUD_INVALID_OUTPUT",
        service_error: "CLOUD_SERVICE_ERROR", not_configured: "CLOUD_NOT_CONFIGURED", storage: "CLOUD_STORAGE", invalid_request: "CLOUD_INVALID_REQUEST",
      };
      throw safeError(codes[error.code]);
    }
    throw safeError("CLOUD_SERVICE_ERROR");
  }
}

function coordinator(): TranslationCoordinator {
  if (!translationCoordinator) throw new CloudTranslationFailure("not_configured");
  return translationCoordinator;
}

function clearTranslationSelection(): void {
  activeSelection = undefined;
  currentTranslation = undefined;
  translation.cancelActiveTranslation();
  translationCoordinator?.cancel();
}

async function releaseActivePublicationSessions(): Promise<void> {
  clearTranslationSelection();
  pendingImports.clear();
  await publications.closeAll();
}

function isSafeAsset(asset: string): boolean { return !!asset && !asset.includes("..") && !path.isAbsolute(asset); }
function assetMime(asset: string): string {
  const extension = path.extname(asset).toLowerCase();
  return ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" } as Record<string, string>)[extension] ?? "application/octet-stream";
}

async function createWindow(): Promise<void> {
  const appSession = session.fromPartition("persist:app", { cache: false });
  appSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  appSession.setPermissionCheckHandler(() => false);
  appSession.on("will-download", event => event.preventDefault());
  appSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^(https?|file):/i.test(details.url) }));
  // Qualification waits for painted frames, including in hidden/occluded windows.
  // Normal desktop sessions retain Chromium's default background throttling.
  const automated = process.env.E01_AUTOMATED_PROOF === "1" || process.env.E06_RELEASE_TEST === "1" || process.env.E06_UI_TEST === "1";
  window = new BrowserWindow({ width: 1200, height: 800, show: process.env.E01_AUTOMATED_PROOF !== "1", webPreferences: { preload: path.join(__dirname, "..", "preload", "index.js"), partition: "persist:app", backgroundThrottling: !automated, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("context-menu", (_event, params) => {
    if (!params.selectionText && !params.isEditable) return;
    const menu = Menu.buildFromTemplate(params.isEditable ? [
      { role: "undo", enabled: params.editFlags.canUndo },
      { role: "redo", enabled: params.editFlags.canRedo },
      { type: "separator" },
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    ] : [
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    ]);
    menu.popup({ window });
  });
  window.webContents.on("did-fail-load", (_event, code) => console.error(`Renderer load failed (${code})`));
  window.webContents.on("render-process-gone", () => {
    void releaseActivePublicationSessions().then(() => {
      if (window && !window.isDestroyed() && !quittingAfterCleanup) void window.loadURL(rendererUrl());
    });
  });
  // Publication console messages can contain source paths or book text.
  window.webContents.on("console-message", details => { if (details.level === "warning" || details.level === "error") console.error("Renderer warning/error (details redacted)"); });
  window.webContents.on("will-navigate", (event, url) => { if (url !== rendererUrl()) event.preventDefault(); });
  window.on("closed", () => { window = undefined; void releaseActivePublicationSessions(); });
  await window.loadURL(rendererUrl());
}

function rendererUrl(): string {
  return `app://app/index.html${process.env.E06_RELEASE_TEST === "1" ? "?release-test=1" : process.env.E01_AUTOMATED_PROOF === "1" ? "?proof=1" : ""}`;
}

function registerIntent<Name extends keyof typeof RendererIntents>(name: Name, handler: (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown> | unknown): void {
  ipcMain.handle(`reader:${name}`, async (event, rawPayload) => {
    try {
      requireAppMainFrame(event);
      const payload = RendererIntents[name].parse(rawPayload);
      return { ok: true, value: await handler(event, payload) };
    } catch (error) {
      return { ok: false, error: redactError(error) };
    }
  });
}

registerIntent("openProofFixture", async event => {
  if (process.env.E01_AUTOMATED_PROOF !== "1") throw safeError("UNAUTHORIZED");
  const fixture = path.resolve(app.getAppPath(), "tests", "fixtures", "deep-marker.epub");
  publications.authorizeSource(fixture);
  const opened = await publications.open(fixture, event.sender.session);
  return { ...opened, metadata: { title: "Deep marker proof" } };
});
registerIntent("closeSession", async (event, payload) => {
  const sessionId = CloseSessionSchema.parse(payload).sessionId;
  if (activeSelection?.sessionId === sessionId && activeSelection.owner === event.sender.session) clearTranslationSelection();
  pendingImports.delete(sessionId);
  await publications.closeOwned(sessionId, event.sender.session);
  return {};
});
registerIntent("listLibrary", async () => {
  if (!library) throw safeError("NOT_FOUND");
  const books = library.list();
  return Promise.all(books.map(async book => {
    const row = library!.get(book.id)!;
    try { await fs.access(row.source_path); } catch { return { ...book, missing: true }; }
    return book;
  }));
});
registerIntent("chooseBooks", async event => {
  if (!library) throw safeError("NOT_FOUND");
  const selection = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender)!, { properties: ["openFile"], filters: [{ name: "EPUB books", extensions: ["epub"] }] });
  if (selection.canceled || !selection.filePaths[0]) return { cancelled: true };
  const sourcePath = selection.filePaths[0];
  publications.authorizeSource(sourcePath);
  const opened = await publications.open(sourcePath, event.sender.session);
  pendingImports.set(opened.sessionId, { sourcePath, owner: event.sender.session, archiveHash: opened.archiveHash });
  return { cancelled: false, sessionId: opened.sessionId, archiveBytes: opened.archiveBytes };
});
registerIntent("commitImport", async (event, payload) => {
  if (!library) throw safeError("NOT_FOUND");
  const input = RendererIntents.commitImport.parse(payload);
  const pending = pendingImports.get(input.sessionId);
  if (!pending || pending.owner !== event.sender.session) throw safeError("UNAUTHORIZED");
  pendingImports.delete(input.sessionId);
  try {
    const candidate = await inspectLocalEpub(pending.sourcePath);
    // Persist only the exact archive that was handed to and validated by the renderer.
    if (candidate.hash !== pending.archiveHash) throw safeError("SOURCE_CHANGED");
    const duplicate = library.findByHash(candidate.hash);
    if (!duplicate && input.packageId) {
      const possibleReplacement = library.findByPackageId(input.packageId);
      if (possibleReplacement) {
        const response = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender)!, { type: "question", buttons: ["Replace reference", "Add separately", "Cancel"], defaultId: 2, cancelId: 2, message: `This may replace ${possibleReplacement.title}.`, detail: "These files have different bytes. Progress is kept only if the saved passage was found in the replacement. Neither original EPUB will be changed." });
        if (response.response === 0) {
          const preserveProgress = Boolean(input.resolvedLocation);
          library.replace(possibleReplacement.id, { ...candidate, title: input.title, author: input.author, packageId: input.packageId, cover: input.cover, preserveProgress, resolvedLocation: input.resolvedLocation });
          return { outcome: preserveProgress ? "replaced-migrated" : "replaced-reset" };
        }
        if (response.response === 1) { library.add({ ...candidate, title: input.title, author: input.author, packageId: input.packageId, cover: input.cover }); return { outcome: "added" }; }
        return { outcome: "cancelled" };
      }
    }
    if (!duplicate) { library.add({ ...candidate, title: input.title, author: input.author, packageId: input.packageId, cover: input.cover }); return { outcome: "added" }; }
    const response = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender)!, { type: "question", buttons: ["Replace reference", "Cancel"], defaultId: 1, cancelId: 1, message: `This is already in your library as ${duplicate.title}.`, detail: "Replace its saved file reference? Your original files will not be changed." });
    if (response.response !== 0) return { outcome: "cancelled" };
    library.replace(duplicate.id, { ...candidate, title: input.title, author: input.author, packageId: input.packageId, cover: input.cover, preserveProgress: true });
    return { outcome: "replaced" };
  } finally { await publications.closeOwned(input.sessionId, event.sender.session); }
});
registerIntent("getReplacementLocation", async (_event, payload) => {
  if (!library) throw safeError("NOT_FOUND");
  const book = library.findByPackageId(RendererIntents.getReplacementLocation.parse(payload).packageId);
  return book ? library.getLocation(book.id) : undefined;
});
registerIntent("openSession", async (event, payload) => {
  clearTranslationSelection();
  if (!library) throw safeError("NOT_FOUND");
  const book = library.get(OpenSessionSchema.parse(payload).bookId);
  if (!book) throw safeError("NOT_FOUND");
  try { await revalidateSource(book, library); } catch (error) {
    if (error instanceof SourceValidationError) throw safeError(error.code === "CHANGED" ? "SOURCE_CHANGED" : error.code === "MISSING" ? "NOT_FOUND" : "SOURCE_UNREADABLE");
    throw safeError("INVALID_EPUB");
  }
  publications.authorizeSource(book.source_path);
  const opened = await publications.open(book.source_path, event.sender.session);
  if (opened.archiveHash !== book.content_hash) {
    await publications.closeOwned(opened.sessionId, event.sender.session);
    throw safeError("SOURCE_CHANGED");
  }
  library.markOpened(book.id);
  return { ...opened, bookId: book.id, metadata: { title: book.title, author: book.author }, initialLocation: library.getLocation(book.id) };
});
registerIntent("removeBook", async (_event, payload) => {
  const bookId = RemoveBookSchema.parse(payload).bookId;
  if (!library?.get(bookId)) throw safeError("NOT_FOUND");
  clearTranslationSelection();
  await publications.closeAll();
  library.remove(bookId);
  return {};
});
registerIntent("saveLocator", async (event, payload) => {
  const input = RendererIntents.saveLocator.parse(payload);
  if (!library) throw safeError("NOT_FOUND");
  const book = library.get(input.bookId);
  if (!book) throw safeError("NOT_FOUND");
  if (!publications.verifySessionOwnsSource(input.sessionId, book.source_path, event.sender.session)) throw safeError("UNAUTHORIZED");
  library.saveLocation(input.bookId, ReaderLocationSchema.parse(input.location));
  return {};
});
registerIntent("getSettings", async () => {
  if (!library) throw safeError("NOT_FOUND");
  const settings = library.getPreferences();
  const fonts = await fontManager?.list() ?? [];
  if (!fonts.some(font => font.installed && font.family === settings.appearance.fontFamily)) settings.appearance.fontFamily = DEFAULT_FONT.family;
  return settings;
});
registerIntent("saveSettings", async (_event, payload) => {
  if (!library) throw safeError("NOT_FOUND");
  const next = RendererIntents.saveSettings.parse(payload);
  if (next.appearance) {
    const fonts = await fontManager?.list() ?? [];
    if (!fonts.some(font => font.installed && font.family === next.appearance?.fontFamily)) throw safeError("INVALID_REQUEST");
  }
  library.savePreferences(next);
  return library.getPreferences();
});
registerIntent("openExternalLink", async (event, payload) => {
  const { sessionId, url } = RendererIntents.openExternalLink.parse(payload);
  if (!publications.verifySessionOwned(sessionId, event.sender.session)) throw safeError("UNAUTHORIZED");
  const destination = new URL(url);
  if (destination.protocol !== "https:" || !destination.hostname || destination.username || destination.password) throw safeError("INVALID_REQUEST");
  const ownerWindow = BrowserWindow.fromWebContents(event.sender);
  if (!ownerWindow || ownerWindow.isDestroyed()) throw safeError("UNAUTHORIZED");
  const answer = await dialog.showMessageBox(ownerWindow, {
    type: "question",
    buttons: ["Open in browser", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    message: `Open ${destination.hostname} in your browser?`,
    detail: destination.href,
  });
  if (answer.response !== 0) return { outcome: "cancelled" };
  if (ownerWindow.isDestroyed() || !publications.verifySessionOwned(sessionId, event.sender.session)) throw safeError("UNAUTHORIZED");
  try { await shell.openExternal(destination.href); } catch { throw safeError("HELPER_FAILED"); }
  return { outcome: "opened" };
});
registerIntent("registerTranslationSelection", (event, payload) => {
  const selection = RendererIntents.registerTranslationSelection.parse(payload);
  if (!publications.verifySessionOwned(selection.sessionId, event.sender.session)) throw safeError("UNAUTHORIZED");
  clearTranslationSelection();
  const id = randomUUID();
  activeSelection = { id, sessionId: selection.sessionId, owner: event.sender.session, text: selection.text, expiresAt: Date.now() + 120_000 };
  return { selectionId: id };
});
registerIntent("clearTranslationSelection", () => { clearTranslationSelection(); return {}; });
registerIntent("getTranslationModelStatus", () => translationOperation(() => translation.getStatus()));
registerIntent("loadTranslationModel", () => {
  clearTranslationSelection();
  return translationOperation(() => translation.load());
});
registerIntent("unloadTranslationModel", async () => {
  clearTranslationSelection();
  return translationOperation(() => translation.unload());
});
registerIntent("getTranslationProviders", () => translationOperation(async () => coordinator().getProviders()));
registerIntent("saveTranslationProvider", (_event, payload) => translationOperation(async () => {
  clearTranslationSelection();
  return coordinator().saveProvider(RendererIntents.saveTranslationProvider.parse(payload));
}));
registerIntent("removeTranslationProvider", (_event, payload) => translationOperation(async () => {
  clearTranslationSelection();
  return coordinator().removeProvider(RendererIntents.removeTranslationProvider.parse(payload).provider);
}));
registerIntent("setTranslationProvider", (_event, payload) => translationOperation(async () => {
  clearTranslationSelection();
  return coordinator().setProvider(RendererIntents.setTranslationProvider.parse(payload).provider);
}));
registerIntent("checkTranslationProviderAvailability", (_event, payload) => translationOperation(async () =>
  coordinator().checkAvailability(RendererIntents.checkTranslationProviderAvailability.parse(payload).provider)));
registerIntent("getTranslationRequestStatus", (event, payload) => {
  const { sessionId, selectionId } = RendererIntents.getTranslationRequestStatus.parse(payload);
  if (!activeSelection || activeSelection.id !== selectionId || activeSelection.sessionId !== sessionId || activeSelection.owner !== event.sender.session || activeSelection.expiresAt < Date.now() || !publications.verifySessionOwned(sessionId, event.sender.session)) throw safeError("CLOUD_CANCELLED");
  return translationOperation(async () => coordinator().getProgress());
});
registerIntent("translateSelection", async (event, payload) => {
  const { sessionId, selectionId } = RendererIntents.translateSelection.parse(payload);
  const selection = activeSelection;
  if (!selection || selection.id !== selectionId || selection.sessionId !== sessionId || selection.owner !== event.sender.session || selection.expiresAt < Date.now() || !publications.verifySessionOwned(sessionId, event.sender.session)) throw safeError("MODEL_CANCELLED");
  currentTranslation = undefined;
  const valid = (): boolean => activeSelection === selection && selection.expiresAt >= Date.now() && publications.verifySessionOwned(sessionId, event.sender.session);
  // Expiry also aborts an adapter's in-flight request rather than waiting for its return.
  const expiry = setTimeout(() => { if (activeSelection === selection) clearTranslationSelection(); }, Math.max(0, selection.expiresAt - Date.now() + 1));
  let result: Awaited<ReturnType<TranslationCoordinator["translate"]>>;
  try { result = await translationOperation(() => coordinator().translate(selection.text, valid)); }
  finally { clearTimeout(expiry); }
  if (activeSelection !== selection || selection.expiresAt < Date.now() || !publications.verifySessionOwned(sessionId, event.sender.session)) throw safeError("MODEL_CANCELLED");
  currentTranslation = { selectionId, text: result.text };
  return result;
});
registerIntent("copyTranslation", (event, payload) => {
  const { sessionId, selectionId } = RendererIntents.copyTranslation.parse(payload);
  if (!activeSelection || activeSelection.id !== selectionId || activeSelection.sessionId !== sessionId || activeSelection.owner !== event.sender.session || activeSelection.expiresAt < Date.now() || !currentTranslation || currentTranslation.selectionId !== selectionId || !publications.verifySessionOwned(sessionId, event.sender.session)) throw safeError("MODEL_CANCELLED");
  clipboard.writeText(currentTranslation.text);
  return {};
});
registerIntent("listFonts", async () => {
  if (!fontManager) throw safeError("NOT_FOUND");
  return fontManager.list();
});
registerIntent("getAppUpdateStatus", () => {
  if (!updates) throw safeError("NOT_FOUND");
  return updates.getStatus();
});
registerIntent("checkAppUpdates", () => {
  if (!updates) throw safeError("NOT_FOUND");
  return updates.check();
});
registerIntent("installAppUpdate", async event => {
  if (!updates) throw safeError("NOT_FOUND");
  if (updates.getStatus().state !== "ready") return updates.getStatus();
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner) throw safeError("UNAUTHORIZED");
  const confirmation = await dialog.showMessageBox(owner, {
    type: "question", title: "Install app update", message: "Restart Leaf and install the downloaded update?",
    detail: "Your library, reading positions, preferences, and downloaded fonts will be kept.",
    buttons: ["Restart and install", "Later"], defaultId: 1, cancelId: 1, noLink: true,
  });
  return confirmation.response === 0 ? updates.install() : updates.getStatus();
});
registerIntent("downloadFont", async (_event, payload) => {
  if (!fontManager) throw safeError("NOT_FOUND");
  try { return await fontManager.install(RendererIntents.downloadFont.parse(payload).fontId); }
  catch { throw safeError("HELPER_FAILED"); }
});
registerIntent("getFontData", async (_event, payload) => {
  if (!fontManager) throw safeError("NOT_FOUND");
  const fontId = RendererIntents.getFontData.parse(payload).fontId;
  try {
    const font = (await fontManager.list()).find(item => item.id === fontId && item.installed);
    if (!font) throw safeError("NOT_FOUND");
    const bytes = fontId === DEFAULT_FONT.id
      ? await fontManager.readBundled(path.join(app.getAppPath(), "dist", "renderer"))
      : await fontManager.readInstalled(fontId);
    if (!bytes) throw safeError("NOT_FOUND");
    return { id: font.id, family: font.family, mime: "font/ttf", data: bytes.toString("base64") };
  } catch { throw safeError("NOT_FOUND"); }
});

async function runAutomatedProof(): Promise<void> {
  if (!window) return;
  const rendererResult = await window.webContents.executeJavaScript(`(async () => {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const frame = document.querySelector('iframe');
      const documentInFrame = frame?.contentDocument;
      if (!frame || !documentInFrame) continue;
      const marker = documentInFrame.getElementById('two-mid');
      const image = documentInFrame.querySelector('img');
      const sheet = [...(documentInFrame.styleSheets ?? [])].find(s => s.href?.startsWith('blob:'));
      const font = [...(sheet?.cssRules ?? [])].find(rule => rule.type === 5 && rule.style.getPropertyValue('src').includes('blob:'));
      const fontLoaded = font && (await documentInFrame.fonts.load('16px ProofFont')).length > 0;
      const scriptBlocked = documentInFrame.body?.dataset.scriptRan !== 'yes';
      const sandboxed = frame.hasAttribute('sandbox') && !frame.getAttribute('sandbox')?.includes('allow-scripts');
      const blocked = async (url) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 500);
        try { await frame.contentWindow.fetch(url, { signal: controller.signal }); return false; } catch { return true; } finally { clearTimeout(timeout); }
      };
      const networkBlocked = await blocked('https://example.invalid/proof');
      const fileBlocked = await blocked('file:///not-allowed');
      if (marker?.textContent?.includes('trusted local handoff') && image?.currentSrc.startsWith('blob:') && sheet && fontLoaded && scriptBlocked && sandboxed && networkBlocked && fileBlocked) {
        for (let attempt = 0; attempt < 50 && document.querySelector('.reader-toolbar')?.textContent?.includes('Opening book'); attempt += 1) await new Promise(resolve => setTimeout(resolve, 100));
        const initialMode = document.querySelector('[data-reader-mode]')?.getAttribute('data-reader-mode');
        window.dispatchEvent(new Event('reader-proof-switch'));
        for (let attempt = 0; attempt < 250 && document.querySelector('[data-reader-mode]')?.getAttribute('data-reader-mode') === initialMode; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        const switchedMode = document.querySelector('[data-reader-mode]')?.getAttribute('data-reader-mode');
        window.dispatchEvent(new Event('reader-proof-switch'));
        for (let attempt = 0; attempt < 250 && document.querySelector('[data-reader-mode]')?.getAttribute('data-reader-mode') !== initialMode; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        const bothFlows = Boolean(initialMode && switchedMode && switchedMode !== initialMode && document.querySelector('[data-reader-mode]')?.getAttribute('data-reader-mode') === initialMode);
        const sessionId = document.querySelector('[data-proof-session]')?.getAttribute('data-proof-session');
        const closed = sessionId && await window.readerApi.closeSession(sessionId);
        const stale = sessionId && await window.readerApi.closeSession(sessionId);
        const closeCleanup = Boolean(closed?.ok && !stale?.ok);
        return { ok: Boolean(bothFlows && closeCleanup), text: bothFlows && closeCleanup ? 'All checks passed' : 'Missing proof checks: flows=' + bothFlows + ', cleanup=' + closeCleanup + ', reader=' + (document.querySelector('[aria-live]')?.textContent || '') };
      }
      if (document.querySelector('main')?.textContent?.includes('could not')) return { ok: false, text: 'Renderer reported error' };
    }
    return { ok: false, text: 'Proof iframe did not render in time' };
  })()`, true) as { ok: boolean; text: string };

  if (!rendererResult.ok) throw new Error(rendererResult.text);
  console.log(`E01 proof passed: ${rendererResult.text}`);
}

app.whenReady().then(async () => {
  if (await handleSquirrelEvent()) { app.quit(); return; }
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  library = new LibraryRepository(path.join(app.getPath("userData"), "library.sqlite"));
  translationStore = new TranslationStore(library, safeStorage);
  translationCoordinator = new TranslationCoordinator(translationStore, createCloudAdapters(), translation);
  fontManager = new FontManager(path.join(app.getPath("userData"), "fonts"));
  const manifest = JSON.parse(await fs.readFile(path.join(app.getAppPath(), "package.json"), "utf8")) as { updateRepository?: unknown };
  const installed = app.isPackaged && await fs.access(path.resolve(path.dirname(process.execPath), "..", "Update.exe")).then(() => true, () => false);
  updates = new UpdateController(autoUpdater, {
    version: app.getVersion(), repository: manifest.updateRepository, packaged: app.isPackaged, installed,
    platform: process.platform, arch: process.arch, firstRun: process.argv.includes("--squirrel-firstrun"),
    beforeInstall: async () => {
      await releaseActivePublicationSessions();
      await translation.dispose();
      // Keep the running app usable if the platform updater cannot restart it.
      // Normal quit handling can safely dispose this fresh, unloaded gateway.
      translation = new LocalTranslationGateway();
      translationCoordinator = new TranslationCoordinator(translationStore!, createCloudAdapters(), translation);
    },
  });
  const rendererRoot = path.join(app.getAppPath(), "dist", "renderer");
  const appSession = session.fromPartition("persist:app", { cache: false });
  appSession.protocol.handle("app", async request => {
    if (new URL(request.url).hostname !== "app") return new Response("Not found", { status: 404 });
    const asset = new URL(request.url).pathname.replace(/^\//, "") || "index.html";
    if (!isSafeAsset(asset)) return new Response("Not found", { status: 404 });
    try { return new Response(await fs.readFile(path.join(rendererRoot, asset)), { headers: { "content-type": assetMime(asset) } }); } catch { return new Response("Not found", { status: 404 }); }
  });
  await createWindow();
  if (process.env.E06_RELEASE_TEST === "1") {
    let passed = false;
    try { passed = await runReleaseTests(window!, publications, library); }
    finally { await releaseActivePublicationSessions(); library.close(); app.exit(passed ? 0 : 1); }
    return;
  }
  if (process.env.E01_AUTOMATED_PROOF === "1") {
    let passed = true;
    try { await runAutomatedProof(); } catch (error) { console.error(`E01 proof failed: ${error instanceof Error ? error.message : "unknown error"}`); passed = false; }
    finally { await releaseActivePublicationSessions(); app.exit(passed ? 0 : 1); }
  }
});
let quittingAfterCleanup = false;
app.on("before-quit", event => {
  if (quittingAfterCleanup) return;
  event.preventDefault();
  quittingAfterCleanup = true;
  clearTranslationSelection();
  void Promise.allSettled([releaseActivePublicationSessions(), translation.dispose()]).finally(() => app.quit());
});
app.on("will-quit", () => library?.close());
app.on("window-all-closed", () => app.quit());
