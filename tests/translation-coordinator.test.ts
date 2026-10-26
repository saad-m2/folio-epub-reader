import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryRepository } from "../src/main/library";
import { TranslationStore } from "../src/main/translation-store";
import { TranslationCoordinator } from "../src/main/translation-coordinator";
import { LocalTranslationGateway, TRANSLATION_MODEL, TranslationFailure } from "../src/main/translation";
import { CloudTranslationFailure, type CloudAdapters, type CloudTranslationAdapter } from "../src/main/cloud-translation-types";
import { CLOUD_PROVIDERS, type Availability, type CloudProvider } from "../src/shared/translation";
import { createCloudAdapters } from "../src/main/cloud-adapters";

const repositories: LibraryRepository[] = [];
afterEach(() => { for (const repository of repositories.splice(0)) repository.close(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(configured: CloudProvider[] = ["microsoft", "deepl"]) {
  const repository = new LibraryRepository(":memory:");
  repositories.push(repository);
  const store = new TranslationStore(repository, {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from(value).reverse(),
    decryptString: value => Buffer.from(value).reverse().toString(),
  });
  const adapter = (): CloudTranslationAdapter => ({
    translate: vi.fn(async () => ({ text: "English" })),
    checkAvailability: vi.fn(async (): Promise<Availability> => ({ state: "available" })),
  });
  const adapters: CloudAdapters = { microsoft: adapter(), zpk: adapter(), lara: adapter(), traduck: adapter(), deepl: adapter() };
  const local = { translate: vi.fn(async () => ({ text: "Local English" })), cancelActiveTranslation: vi.fn(), unload: vi.fn(async () => ({ state: "unloaded" as const })) };
  const coordinator = new TranslationCoordinator(store, adapters, local);
  for (const provider of configured) coordinator.saveProvider(provider === "zpk" ? { provider, applicationId: "test-app", apiKey: "test-key" } : provider === "lara" ? { provider, accessKeyId: "test-id", accessKeySecret: "test-secret" } : { provider, apiKey: "test-key" });
  if (configured[0]) store.setCurrent(configured[0]);
  return { coordinator, store, adapters, local, repository };
}

describe("translation coordinator", () => {
  it("uses all five providers in order and persists every fallback before its attempt", async () => {
    const { coordinator, store, adapters, local } = setup([...CLOUD_PROVIDERS]);
    const attempted: CloudProvider[] = [];
    for (const provider of CLOUD_PROVIDERS) vi.mocked(adapters[provider].translate).mockImplementation(async () => {
      expect(store.getCurrent()).toBe(provider);
      attempted.push(provider);
      if (provider !== "deepl") throw new CloudTranslationFailure("exhausted");
      return { text: "English" };
    });
    expect(await coordinator.translate("Hallo")).toEqual({ provider: "deepl", text: "English" });
    expect(attempted).toEqual(["microsoft", "zpk", "lara", "traduck", "deepl"]);
    expect(store.getCurrent()).toBe("deepl");
    await coordinator.checkAvailability("microsoft");
    expect(store.getCurrent()).toBe("deepl");
    expect(local.translate).not.toHaveBeenCalled();
  });

  it("starts with the selected new provider and skips exhausted and unconfigured candidates", async () => {
    const { coordinator, store, adapters } = setup(["lara", "traduck", "deepl"]);
    store.setAvailability("traduck", { state: "exhausted" });
    vi.mocked(adapters.lara.translate).mockRejectedValue(new CloudTranslationFailure("exhausted"));
    expect(await coordinator.translate("Hallo")).toMatchObject({ provider: "deepl" });
    for (const provider of ["microsoft", "zpk", "traduck"] as const) expect(adapters[provider].translate).not.toHaveBeenCalled();
    expect(adapters.lara.translate).toHaveBeenCalledOnce();
  });

  it("integrates the real diagnostic with persisted exhaustion and fallback without repeating book text", async () => {
    const { store, local } = setup(["zpk", "traduck"]);
    const replies = [Response.json({ success: false }), Response.json({ success: false }), Response.json({ translation: "English" })];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => replies.shift()!);
    const coordinator = new TranslationCoordinator(store, createCloudAdapters({ fetcher }), local);
    expect(await coordinator.translate("Private selection")).toEqual({ text: "English", provider: "traduck" });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://zpk.systems/api/translate/text", "https://zpk.systems/api/translate/text", "https://traduck.com/api/v1/translate"]);
    expect(fetcher.mock.calls.map(([, init]) => {
      const body = JSON.parse(String(init?.body));
      return body.texts?.[0].text ?? body.text;
    })).toEqual(["Private selection", "Guten Tag.", "Private selection"]);
    expect(store.getAvailability("zpk")).toEqual({ state: "exhausted" });
    expect(store.getCurrent()).toBe("traduck");
  });
  it("queues automatic unload after a pending Load through the real gateway", async () => {
    const { store, adapters } = setup();
    store.setCurrent("ollama");
    let loaded = false;
    const loading = deferred<void>();
    const generated: number[] = [];
    const gateway = new LocalTranslationGateway({ fetcher: vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/tags")) return Response.json({ models: [{ name: TRANSLATION_MODEL }] });
      if (String(url).endsWith("/api/ps")) return Response.json({ models: loaded ? [{ name: TRANSLATION_MODEL }] : [] });
      const body = JSON.parse(String(init?.body));
      expect(body.prompt).toBe("");
      generated.push(body.keep_alive);
      if (body.keep_alive === -1) { await loading.promise; loaded = true; }
      else loaded = false;
      return Response.json({ done: true });
    }) });
    const coordinator = new TranslationCoordinator(store, adapters, gateway);
    const load = gateway.load();
    const switching = coordinator.setProvider("deepl");
    loading.resolve();
    await load;
    await switching;
    expect(generated).toEqual([-1, 0]);
    expect((await gateway.getStatus()).state).toBe("unloaded");
    expect(store.getCurrent()).toBe("deepl");
  });

  it.each(["microsoft", "deepl"] as const)("unloads local before committing a switch to %s", async provider => {
    const { coordinator, store, local, adapters } = setup();
    await coordinator.setProvider("ollama");
    const unloading = deferred<{ state: "unloaded" }>();
    local.unload.mockReturnValue(unloading.promise);
    const switching = coordinator.setProvider(provider);
    expect(local.cancelActiveTranslation).toHaveBeenCalled();
    expect(local.unload).toHaveBeenCalledOnce();
    expect(store.getCurrent()).toBe("ollama");
    for (const adapter of Object.values(adapters)) expect(adapter.translate).not.toHaveBeenCalled();
    unloading.resolve({ state: "unloaded" });
    expect((await switching).current).toBe(provider);
    await coordinator.setProvider("ollama");
    expect(local.unload).toHaveBeenCalledOnce();
    expect(local.translate).not.toHaveBeenCalled();
  });

  it("preserves local selection on unload failure and permits retry", async () => {
    const { coordinator, store, local } = setup();
    await coordinator.setProvider("ollama");
    local.unload.mockRejectedValueOnce(new TranslationFailure("timeout"));
    await expect(coordinator.setProvider("deepl")).rejects.toMatchObject({ code: "timeout" });
    expect(store.getCurrent()).toBe("ollama");
    expect((await coordinator.setProvider("deepl")).current).toBe("deepl");
  });

  it("allows cloud with stopped Ollama and skips unloading between cloud providers", async () => {
    const { coordinator, local } = setup();
    await coordinator.setProvider("ollama");
    local.unload.mockRejectedValueOnce(new TranslationFailure("unavailable"));
    expect((await coordinator.setProvider("microsoft")).current).toBe("microsoft");
    await coordinator.setProvider("deepl");
    expect(local.unload).toHaveBeenCalledOnce();
  });

  it("does not unload for an unconfigured destination or commit a superseded switch", async () => {
    const { coordinator, store, local } = setup(["microsoft"]);
    await coordinator.setProvider("ollama");
    await expect(coordinator.setProvider("deepl")).rejects.toMatchObject({ code: "not_configured" });
    expect(local.unload).not.toHaveBeenCalled();
    const unloading = deferred<{ state: "unloaded" }>();
    local.unload.mockReturnValue(unloading.promise);
    const switching = coordinator.setProvider("microsoft");
    await coordinator.setProvider("ollama");
    unloading.resolve({ state: "unloaded" });
    await expect(switching).rejects.toMatchObject({ code: "cancelled" });
    expect(store.getCurrent()).toBe("ollama");
  });

  it("requires explicit choice after migrating a retired current provider instead of silently routing locally or to cloud", async () => {
    const { coordinator, store, adapters, local, repository } = setup([]);
    repository.writeTranslationState(JSON.stringify({ version: 1, current: "aws", providers: { aws: { state: "exhausted" } } }), { provider: "aws", encrypted: Buffer.from("retired account") });
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "not_configured" });
    expect(store.getCurrent()).toBeNull();
    expect(repository.readTranslationSecret("aws")).toBeUndefined();
    expect(local.translate).not.toHaveBeenCalled();
    for (const adapter of Object.values(adapters)) expect(adapter.translate).not.toHaveBeenCalled();
    await coordinator.setProvider("ollama");
    expect(local.translate).not.toHaveBeenCalled();
    expect(await coordinator.translate("Hallo")).toEqual({ text: "Local English", provider: "ollama" });
  });

  it("uses only the selected provider and translates local only when explicitly selected", async () => {
    const { coordinator, adapters, local } = setup();
    await coordinator.setProvider("deepl");
    expect(await coordinator.translate("Hallo")).toEqual({ text: "English", provider: "deepl" });
    expect(adapters.deepl.translate).toHaveBeenCalledOnce();
    expect(adapters.microsoft.translate).not.toHaveBeenCalled();
    expect(local.translate).not.toHaveBeenCalled();
    await coordinator.setProvider("ollama");
    expect(local.translate).not.toHaveBeenCalled();
    expect(await coordinator.translate("Hallo")).toEqual({ text: "Local English", provider: "ollama" });
  });

  it("falls back in the fixed order, saves each switch, and never restores an earlier provider", async () => {
    const { coordinator, store, adapters } = setup();
    await coordinator.setProvider("deepl");
    vi.mocked(adapters.deepl.translate).mockRejectedValue(new CloudTranslationFailure("exhausted"));
    expect(await coordinator.translate("Hallo")).toMatchObject({ provider: "microsoft" });
    expect(store.getCurrent()).toBe("microsoft");
    expect(store.getAvailability("deepl")).toEqual({ state: "exhausted" });
    await coordinator.checkAvailability("deepl");
    expect(store.getCurrent()).toBe("microsoft");
    await coordinator.translate("Noch einmal");
    expect(adapters.microsoft.translate).toHaveBeenCalledTimes(2);
    expect(adapters.deepl.translate).toHaveBeenCalledOnce();
  });

  it("persists a switch before the fallback request and stays there after a non-exhaustion error", async () => {
    const { coordinator, store, adapters } = setup();
    vi.mocked(adapters.microsoft.translate).mockRejectedValue(new CloudTranslationFailure("exhausted"));
    vi.mocked(adapters.deepl.translate).mockImplementation(async () => {
      expect(store.getCurrent()).toBe("deepl");
      throw new CloudTranslationFailure("network");
    });
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "network" });
    expect(store.getCurrent()).toBe("deepl");
    expect(adapters.microsoft.translate).toHaveBeenCalledOnce();
    expect(adapters.deepl.translate).toHaveBeenCalledOnce();
  });

  it("bounds exhaustion chains to one attempt per configured provider and never calls local", async () => {
    const { coordinator, store, adapters, local } = setup();
    for (const adapter of Object.values(adapters)) vi.mocked(adapter.translate).mockRejectedValue(new CloudTranslationFailure("exhausted"));
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "exhausted" });
    for (const provider of ["microsoft", "deepl"] as const) expect(adapters[provider].translate).toHaveBeenCalledOnce();
    expect(store.getCurrent()).toBe("deepl");
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "exhausted" });
    for (const provider of ["microsoft", "deepl"] as const) expect(adapters[provider].translate).toHaveBeenCalledOnce();
    expect(local.translate).not.toHaveBeenCalled();
  });

  it("skips the known exhausted current provider without a network attempt", async () => {
    const { coordinator, store, adapters } = setup();
    store.setAvailability("microsoft", { state: "exhausted" });
    expect(await coordinator.translate("Hallo")).toMatchObject({ provider: "deepl" });
    expect(adapters.microsoft.translate).not.toHaveBeenCalled();
    expect(adapters.deepl.translate).toHaveBeenCalledOnce();
  });

  it("does not attempt an unconfigured fallback after the only connected provider exhausts", async () => {
    const { coordinator, store, adapters, local } = setup(["microsoft"]);
    vi.mocked(adapters.microsoft.translate).mockRejectedValue(new CloudTranslationFailure("exhausted"));
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "exhausted" });
    expect(adapters.microsoft.translate).toHaveBeenCalledOnce();
    expect(adapters.deepl.translate).not.toHaveBeenCalled();
    expect(local.translate).not.toHaveBeenCalled();
    expect(store.getCurrent()).toBe("microsoft");
  });

  it.each(["rate_limited", "authentication", "network", "timeout", "service_error", "invalid_output"] as const)("stops on %s without automatic retry or exhaustion metadata", async code => {
    const { coordinator, store, adapters } = setup();
    vi.mocked(adapters.microsoft.translate).mockRejectedValue(new CloudTranslationFailure(code));
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code });
    expect(adapters.microsoft.translate).toHaveBeenCalledOnce();
    expect(adapters.deepl.translate).not.toHaveBeenCalled();
    expect(store.getAvailability("microsoft")).toEqual({ state: "unknown" });
    expect(store.getCurrent()).toBe("microsoft");
  });

  it("does not send text or persist exhaustion after selection becomes invalid during a response", async () => {
    const { coordinator, store, adapters } = setup();
    let valid = true;
    vi.mocked(adapters.microsoft.translate).mockImplementation(async () => {
      valid = false;
      throw new CloudTranslationFailure("exhausted");
    });
    await expect(coordinator.translate("Hallo", () => valid)).rejects.toMatchObject({ code: "cancelled" });
    expect(adapters.deepl.translate).not.toHaveBeenCalled();
    expect(store.getCurrent()).toBe("microsoft");
    expect(store.getAvailability("microsoft")).toEqual({ state: "unknown" });
  });

  it("checks expiry before sending text and again before fallback commit", async () => {
    const { coordinator, store, adapters } = setup();
    let now = 100;
    const expiresAt = now + 120_000;
    vi.mocked(adapters.microsoft.translate).mockImplementation(async () => {
      now = expiresAt + 1;
      throw new CloudTranslationFailure("exhausted");
    });
    await expect(coordinator.translate("Hallo", () => now < expiresAt)).rejects.toMatchObject({ code: "cancelled" });
    expect(store.getCurrent()).toBe("microsoft");
    expect(adapters.deepl.translate).not.toHaveBeenCalled();
    await expect(coordinator.translate("Hallo", () => false)).rejects.toMatchObject({ code: "cancelled" });
    expect(adapters.microsoft.translate).toHaveBeenCalledOnce();
  });

  it("manual switching wins over delayed exhaustion and aborts the old request", async () => {
    const { coordinator, store, adapters } = setup();
    const delayed = deferred<{ text: string }>();
    vi.mocked(adapters.microsoft.translate).mockReturnValue(delayed.promise);
    const translating = coordinator.translate("Hallo");
    const signal = vi.mocked(adapters.microsoft.translate).mock.calls[0][2];
    await coordinator.setProvider("deepl");
    expect(signal.aborted).toBe(true);
    delayed.reject(new CloudTranslationFailure("exhausted"));
    await expect(translating).rejects.toMatchObject({ code: "cancelled" });
    expect(store.getCurrent()).toBe("deepl");
    expect(adapters.deepl.translate).not.toHaveBeenCalled();
    expect(coordinator.getProgress()).toEqual({ phase: "idle", provider: null });
  });

  it("a repeated Translate supersedes the first request even for identical text", async () => {
    const { coordinator, adapters } = setup();
    const delayed = deferred<{ text: string }>();
    vi.mocked(adapters.microsoft.translate).mockReturnValueOnce(delayed.promise);
    const first = coordinator.translate("Hallo");
    const signal = vi.mocked(adapters.microsoft.translate).mock.calls[0][2];
    expect(await coordinator.translate("Hallo")).toMatchObject({ provider: "microsoft", text: "English" });
    expect(signal.aborted).toBe(true);
    delayed.resolve({ text: "Old English" });
    await expect(first).rejects.toMatchObject({ code: "cancelled" });
    expect(coordinator.getProgress()).toEqual({ phase: "complete", provider: "microsoft" });
  });

  it("keeps exhaustion on unknown checks and does not translate text or switch on recovery", async () => {
    const { coordinator, store, adapters, local } = setup();
    store.setAvailability("deepl", { state: "exhausted" });
    vi.mocked(adapters.deepl.checkAvailability).mockResolvedValue({ state: "unknown" });
    await coordinator.checkAvailability("deepl");
    expect(store.getAvailability("deepl")).toEqual({ state: "exhausted" });
    vi.mocked(adapters.deepl.checkAvailability).mockResolvedValue({ state: "available" });
    await coordinator.checkAvailability("deepl");
    expect(store.getAvailability("deepl")).toEqual({ state: "available" });
    expect(store.getCurrent()).toBe("microsoft");
    for (const adapter of Object.values(adapters)) expect(adapter.translate).not.toHaveBeenCalled();
    expect(local.translate).not.toHaveBeenCalled();
  });

  it("credential replacement invalidates old checks and old translation results", async () => {
    const { coordinator, store, adapters } = setup();
    const check = deferred<Availability>();
    vi.mocked(adapters.deepl.checkAvailability).mockReturnValue(check.promise);
    const checking = coordinator.checkAvailability("deepl");
    coordinator.saveProvider({ provider: "deepl", apiKey: "new-key" });
    check.resolve({ state: "exhausted" });
    await expect(checking).rejects.toMatchObject({ code: "cancelled" });
    expect(store.getAvailability("deepl")).toEqual({ state: "unknown" });
    const response = deferred<{ text: string }>();
    vi.mocked(adapters.microsoft.translate).mockReturnValue(response.promise);
    const translating = coordinator.translate("Hallo");
    coordinator.removeProvider("microsoft");
    response.resolve({ text: "Old result" });
    await expect(translating).rejects.toMatchObject({ code: "cancelled" });
    expect(store.getCurrent()).toBeNull();
  });

  it("a translation invalidates an older availability check so it cannot undo new exhaustion", async () => {
    const { coordinator, store, adapters } = setup();
    const check = deferred<Availability>();
    vi.mocked(adapters.microsoft.checkAvailability).mockReturnValue(check.promise);
    const checking = coordinator.checkAvailability("microsoft");
    vi.mocked(adapters.microsoft.translate).mockRejectedValue(new CloudTranslationFailure("exhausted"));
    expect(await coordinator.translate("Hallo")).toMatchObject({ provider: "deepl" });
    check.resolve({ state: "available" });
    await expect(checking).rejects.toMatchObject({ code: "cancelled" });
    expect(store.getAvailability("microsoft")).toEqual({ state: "exhausted" });
  });

  it("rejects empty or oversized text, no provider, and oversized output", async () => {
    const { coordinator, adapters } = setup();
    await expect(coordinator.translate(" ")).rejects.toMatchObject({ code: "invalid_request" });
    await expect(coordinator.translate("a".repeat(5001))).rejects.toMatchObject({ code: "invalid_request" });
    expect(adapters.microsoft.translate).not.toHaveBeenCalled();
    vi.mocked(adapters.microsoft.translate).mockResolvedValue({ text: "a".repeat(20_001) });
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "invalid_output" });
    coordinator.removeProvider("microsoft");
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "not_configured" });
    expect(adapters.deepl.translate).not.toHaveBeenCalled();
  });

  it("stops safely when a fallback account cannot be decrypted rather than skipping the storage error", async () => {
    const { coordinator, store, adapters } = setup();
    vi.mocked(adapters.microsoft.translate).mockRejectedValue(new CloudTranslationFailure("exhausted"));
    const getConfiguration = store.getConfiguration.bind(store);
    vi.spyOn(store, "getConfiguration").mockImplementation(provider => {
      if (provider === "deepl") throw new CloudTranslationFailure("storage");
      return getConfiguration(provider);
    });
    await expect(coordinator.translate("Hallo")).rejects.toMatchObject({ code: "storage" });
    expect(store.getCurrent()).toBe("microsoft");
    expect(adapters.deepl.translate).not.toHaveBeenCalled();
  });

  it("cancels pending availability checks on shutdown or selection invalidation", async () => {
    const { coordinator, store, adapters } = setup();
    const check = deferred<Availability>();
    vi.mocked(adapters.deepl.checkAvailability).mockReturnValue(check.promise);
    const checking = coordinator.checkAvailability("deepl");
    const signal = vi.mocked(adapters.deepl.checkAvailability).mock.calls[0][1];
    coordinator.cancel();
    expect(signal.aborted).toBe(true);
    check.resolve({ state: "exhausted" });
    await expect(checking).rejects.toMatchObject({ code: "cancelled" });
    expect(store.getAvailability("deepl")).toEqual({ state: "unknown" });
  });
});
