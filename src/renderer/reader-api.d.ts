interface Window {
  readerApi: Readonly<{
    getAppUpdateStatus(): Promise<unknown>;
    checkAppUpdates(): Promise<unknown>;
    installAppUpdate(): Promise<unknown>;
    chooseBooks(): Promise<unknown>;
    listLibrary(): Promise<unknown>;
    openSession(bookId: string): Promise<unknown>;
    closeSession(sessionId: string): Promise<unknown>;
    removeBook(bookId: string): Promise<unknown>;
    commitImport(sessionId: string, title: string, author: string, packageId?: string, cover?: unknown, resolvedLocation?: unknown): Promise<unknown>;
    getReplacementLocation(packageId: string): Promise<unknown>;
    saveLocator(sessionId: string, bookId: string, location: unknown): Promise<unknown>;
    saveSettings(settings: unknown): Promise<unknown>;
    getSettings(): Promise<unknown>;
    registerTranslationSelection(selection: unknown): Promise<unknown>;
    clearTranslationSelection(): Promise<unknown>;
    translateSelection(selection: unknown): Promise<unknown>;
    copyTranslation(sessionId: string, selectionId: string): Promise<unknown>;
    getTranslationModelStatus(): Promise<unknown>;
    loadTranslationModel(): Promise<unknown>;
    unloadTranslationModel(): Promise<unknown>;
    downloadFont(fontId: string): Promise<unknown>;
    listFonts(): Promise<unknown>;
    getFontData(fontId: string): Promise<unknown>;
    openExternalLink(sessionId: string, url: string): Promise<unknown>;
    openProofFixture(): Promise<unknown>;
  }>;
}
