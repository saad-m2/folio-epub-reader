import { contextBridge, ipcRenderer } from "electron";

const activeSessions = new Map<string, string>();

function invoke(name: string, payload: unknown): Promise<unknown> {
  if (!payload || typeof payload !== "object") return Promise.resolve({ ok: false, error: { code: "INVALID_REQUEST", correlationId: crypto.randomUUID() } });
  return ipcRenderer.invoke(`reader:${name}`, payload);
}

contextBridge.exposeInMainWorld("readerApi", Object.freeze({
  getAppUpdateStatus: () => invoke("getAppUpdateStatus", {}),
  checkAppUpdates: () => invoke("checkAppUpdates", {}),
  installAppUpdate: () => invoke("installAppUpdate", {}),
  chooseBooks: () => invoke("chooseBooks", {}),
  listLibrary: () => invoke("listLibrary", {}),
  openSession: (bookId: string) => invoke("openSession", { bookId }).then((result: unknown) => {
    const typed = result as { ok: boolean; value?: { sessionId: string; bookId?: string } };
    if (typed.ok && typed.value?.sessionId) activeSessions.set(bookId, typed.value.sessionId);
    return result;
  }),
  closeSession: (sessionId: string) => {
    for (const [bookId, sid] of activeSessions) {
      if (sid === sessionId) activeSessions.delete(bookId);
    }
    return invoke("closeSession", { sessionId });
  },
  removeBook: (bookId: string) => invoke("removeBook", { bookId }),
  commitImport: (sessionId: string, title: string, author: string, packageId?: string, cover?: unknown, resolvedLocation?: unknown) => invoke("commitImport", { sessionId, title, author, ...(packageId ? { packageId } : {}), ...(cover ? { cover } : {}), ...(resolvedLocation ? { resolvedLocation } : {}) }),
  getReplacementLocation: (packageId: string) => invoke("getReplacementLocation", { packageId }),
  saveLocator: (sessionId: string, bookId: string, location: unknown) => {
    const activeSessionId = activeSessions.get(bookId);
    if (!activeSessionId || activeSessionId !== sessionId) return Promise.resolve({ ok: false, error: { code: "UNAUTHORIZED", correlationId: crypto.randomUUID() } });
    return invoke("saveLocator", { sessionId, bookId, location });
  },
  saveSettings: (settings: unknown) => invoke("saveSettings", settings),
  getSettings: () => invoke("getSettings", {}),
  registerTranslationSelection: (selection: unknown) => invoke("registerTranslationSelection", selection),
  clearTranslationSelection: () => invoke("clearTranslationSelection", {}),
  translateSelection: (selection: unknown) => invoke("translateSelection", selection),
  copyTranslation: (sessionId: string, selectionId: string) => invoke("copyTranslation", { sessionId, selectionId }),
  getTranslationModelStatus: () => invoke("getTranslationModelStatus", {}),
  loadTranslationModel: () => invoke("loadTranslationModel", {}),
  unloadTranslationModel: () => invoke("unloadTranslationModel", {}),
  getTranslationProviders: () => invoke("getTranslationProviders", {}),
  saveTranslationProvider: (configuration: unknown) => invoke("saveTranslationProvider", configuration),
  removeTranslationProvider: (provider: string) => invoke("removeTranslationProvider", { provider }),
  setTranslationProvider: (provider: string) => invoke("setTranslationProvider", { provider }),
  checkTranslationProviderAvailability: (provider: string) => invoke("checkTranslationProviderAvailability", { provider }),
  getTranslationRequestStatus: (selection: unknown) => invoke("getTranslationRequestStatus", selection),
  downloadFont: (fontId: string) => invoke("downloadFont", { fontId }),
  listFonts: () => invoke("listFonts", {}),
  getFontData: (fontId: string) => invoke("getFontData", { fontId }),
  openExternalLink: (sessionId: string, url: string) => invoke("openExternalLink", { sessionId, url }),
  openProofFixture: () => invoke("openProofFixture", {}),
}));
