import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranslationSettings } from "../src/renderer/translation-settings";
import { Reader } from "../src/renderer/reader";
import type { TranslationProvidersView, TranslationResult } from "../src/shared/translation";
import type { ReaderSelection } from "../src/renderer/reader-adapter";

const adapter = vi.hoisted(() => ({
  selection: undefined as ReaderSelection | undefined,
  listener: undefined as ((selection?: ReaderSelection) => void) | undefined,
}));
vi.mock("../src/renderer/reader-adapter", () => ({
  ReaderAdapter: class {
    open = vi.fn(async () => ({ label: "Chapter", progress: 0, hasNavigation: false, toc: [], location: { href: "chapter.xhtml" } }));
    close = vi.fn(async () => {});
    subscribe = vi.fn(() => () => {});
    subscribeSelection = vi.fn((listener: (selection?: ReaderSelection) => void) => { adapter.listener = listener; return () => {}; });
    subscribeSelectionTooLong = vi.fn(() => () => {});
    subscribeInteraction = vi.fn(() => () => {});
    subscribeExternalLink = vi.fn(() => () => {});
    getSelection = vi.fn(() => adapter.selection);
    clearSelection = vi.fn(() => { adapter.selection = undefined; adapter.listener?.(undefined); });
    captureLocation = vi.fn(() => ({ href: "chapter.xhtml" }));
  },
}));

describe("cloud provider controls", () => {
  let root: Root;
  let container: HTMLDivElement;
  let view: TranslationProvidersView;
  let translateResult: (value: unknown) => void;
  const getProviders = vi.fn(async () => ({ ok: true, value: view }));
  const setProvider = vi.fn(async (provider: TranslationProvidersView["current"]) => ({ ok: true, value: view = { ...view, current: provider } }));
  const saveProvider = vi.fn(async () => ({ ok: true, value: view }));
  const removeProvider = vi.fn(async () => ({ ok: true, value: view = { ...view, current: null } }));
  const checkProvider = vi.fn(async () => ({ ok: true, value: view }));
  const modelStatus = vi.fn(async () => ({ ok: true, value: { state: "unloaded" } }));
  const translate = vi.fn(() => new Promise<unknown>(resolve => { translateResult = resolve; }));
  const progress = vi.fn(async () => ({ ok: true, value: { phase: "fallback", provider: "microsoft" } }));
  const clear = vi.fn(async () => ({ ok: true, value: {} }));
  const loadModel = vi.fn(async () => ({ ok: true, value: { state: "loaded" } }));
  const leaveReader = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    view = { current: "deepl", providers: [
      { provider: "microsoft", configured: true, availability: "available" },
      { provider: "deepl", configured: true, availability: "unknown" },
    ] };
    for (const mock of [getProviders, setProvider, saveProvider, removeProvider, checkProvider, modelStatus, translate, progress, clear, loadModel, leaveReader]) mock.mockClear();
    saveProvider.mockResolvedValue({ ok: true, value: view });
    adapter.selection = undefined; adapter.listener = undefined;
    vi.stubGlobal("readerApi", {
      getTranslationProviders: getProviders, setTranslationProvider: setProvider,
      saveTranslationProvider: saveProvider, removeTranslationProvider: removeProvider,
      checkTranslationProviderAvailability: checkProvider,
      getTranslationModelStatus: modelStatus, translateSelection: translate,
      loadTranslationModel: loadModel,
      getTranslationRequestStatus: progress, clearTranslationSelection: clear,
      registerTranslationSelection: vi.fn(async () => ({ ok: true, value: { selectionId: "selection" } })),
      saveLocator: vi.fn(async () => ({ ok: true, value: {} })),
    });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount()); container.remove();
    vi.useRealTimers(); vi.unstubAllGlobals();
  });
  const button = (text: string, within: ParentNode = container) => Array.from(within.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent?.trim() === text)!;
  async function settings(): Promise<void> { await act(async () => root.render(React.createElement(TranslationSettings))); }
  async function reader(): Promise<void> {
    await act(async () => root.render(React.createElement(Reader, {
      session: { bookId: "book", sessionId: "session", archiveBytes: new ArrayBuffer(0), metadata: { title: "Book", author: "Reader" } },
      settings: { mode: "continuous", pageLayout: "single", appearance: { theme: "light", fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Liberation Sans Reader" } },
      fonts: [], saveSettings: vi.fn(), leave: leaveReader, registerFlush: vi.fn(),
    })));
  }
  async function select(): Promise<void> {
    await act(async () => {
      adapter.selection = { text: "Ein Wort", cfi: "epubcfi(/6/2!/4/2)", rects: [{ x: 20, y: 20, width: 100, height: 20 }] };
      adapter.listener?.(adapter.selection);
    });
  }
  async function openReaderSettings(): Promise<void> {
    if (container.querySelector("#reader-settings")) return;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Reader settings"]')!.click());
  }
  async function pick(provider: string): Promise<void> {
    await openReaderSettings();
    await act(async () => {
      const control = container.querySelector<HTMLSelectElement>('[aria-label="Translation service"]')!;
      control.value = provider;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("switches providers in the reader without translating or loading a local model", async () => {
    await reader();
    expect(container.querySelector('.reader-toolbar select')).toBeNull();
    expect(container.querySelector('.reader-toolbar .model-status')).toBeNull();
    expect(container.querySelector('.reader-toolbar .reader-cloud-status')).toBeNull();
    expect(container.querySelector('[aria-label="Translation service"]')).toBeNull();
    await openReaderSettings();
    const panel = container.querySelector('#reader-settings')!;
    expect(panel.getAttribute("aria-label")).toBe("Reader settings");
    expect(panel.textContent).toContain("Reading appearance");
    expect(panel.textContent).toContain("Translation");
    const control = container.querySelector<HTMLSelectElement>('[aria-label="Translation service"]')!;
    expect(Array.from(control.options).map(option => option.value)).toEqual(["", "ollama", "microsoft", "deepl"]);
    await pick("microsoft");
    expect(setProvider).toHaveBeenLastCalledWith("microsoft");
    expect(control.value).toBe("microsoft");
    await pick("ollama");
    expect(control.value).toBe("ollama");
    expect(button("Load model")).toBeDefined();
    expect(translate).not.toHaveBeenCalled();
    expect(loadModel).not.toHaveBeenCalled();
    expect(checkProvider).not.toHaveBeenCalled();
    expect(leaveReader).not.toHaveBeenCalled();
    await act(async () => control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(leaveReader).not.toHaveBeenCalled();
    expect(container.querySelector('#reader-settings')).toBe(panel);
    expect(container.querySelector('.reader-book-label')?.textContent).toContain("Book");
    expect(container.querySelector('.reader-progress')?.textContent).toContain("Chapter");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close reader settings"]')!.click());
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(container.querySelector('#reader-settings')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('[aria-label="Reader settings"]'));
  });

  it("ignores a late provider refresh that began before a manual reader switch", async () => {
    await reader();
    let finish!: (value: unknown) => void;
    getProviders.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }) as never);
    await act(async () => { vi.advanceTimersByTime(10000); });
    await pick("microsoft");
    await act(async () => finish({ ok: true, value: { ...view, current: "deepl" } }));
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Translation service"]')?.value).toBe("microsoft");
  });

  it("keeps local model loading explicit inside reader settings", async () => {
    view = { ...view, current: "ollama" };
    await reader();
    expect(container.querySelector('.reader-toolbar [aria-label="Load translation model"]')).toBeNull();
    await openReaderSettings();
    const panel = container.querySelector('#reader-settings')!;
    expect(loadModel).not.toHaveBeenCalled();
    await act(async () => button("Load model", panel).click());
    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(container.querySelector('#reader-settings')).toBe(panel);
    expect(translate).not.toHaveBeenCalled();
    expect(leaveReader).not.toHaveBeenCalled();
  });

  it("traps keyboard focus in reader settings and closes the panel before leaving the book", async () => {
    await reader(); await openReaderSettings();
    const close = container.querySelector<HTMLButtonElement>('[aria-label="Close reader settings"]')!;
    const picker = container.querySelector<HTMLSelectElement>('[aria-label="Translation service"]')!;
    picker.focus();
    await act(async () => picker.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(close);
    await act(async () => close.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(picker);
    close.focus();
    await act(async () => close.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(container.querySelector('#reader-settings')).toBeNull();
    expect(leaveReader).not.toHaveBeenCalled();
  });

  it("does not let an earlier local status read overwrite a newly loaded model", async () => {
    view = { ...view, current: "ollama" };
    let finish!: (value: unknown) => void;
    modelStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }) as never);
    modelStatus.mockResolvedValueOnce({ ok: true, value: { state: "loaded" } });
    await reader(); await openReaderSettings();
    await act(async () => button("Load model").click());
    expect(button("Unload model")).toBeDefined();
    await act(async () => finish({ ok: true, value: { state: "unloaded" } }));
    expect(button("Unload model")).toBeDefined();
    expect(loadModel).toHaveBeenCalledTimes(1);
  });

  it("waits for earlier selection registration before switching and does not revive the old selection", async () => {
    await reader();
    let finish!: (value: unknown) => void;
    vi.mocked(window.readerApi.registerTranslationSelection).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await select();
    await pick("microsoft");
    expect(setProvider).not.toHaveBeenCalled();
    await act(async () => finish({ ok: true, value: { selectionId: "old-selection" } }));
    expect(setProvider).toHaveBeenCalledExactlyOnceWith("microsoft");
    expect(container.querySelector(".translation-action")).toBeNull();
    expect(translate).not.toHaveBeenCalled();
  });

  it("immediately hides pending translation and rejects late results while a reader switch is pending", async () => {
    await reader(); await select();
    await act(async () => button("Translate").click());
    let finish!: (value: unknown) => void;
    setProvider.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }) as never);
    await pick("microsoft");
    expect(container.querySelector(".translation-bubble")).toBeNull();
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Translation service"]')?.disabled).toBe(true);
    await act(async () => translateResult({ ok: true, value: { text: "Obsolete response", provider: "deepl" } }));
    expect(container.textContent).not.toContain("Obsolete response");
    await act(async () => finish({ ok: true, value: { ...view, current: "microsoft" } }));
    expect(container.querySelector(".translation-action")).toBeNull();
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CLOUD_STORAGE", "could not be protected or opened"],
    ["MODEL_TIMEOUT", "Could not finish unloading the local model"],
  ])("keeps the previous service and shows an actionable error on %s", async (code, message) => {
    await reader();
    setProvider.mockResolvedValueOnce({ ok: false, error: { code } } as never);
    await pick("microsoft");
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Translation service"]')?.value).toBe("deepl");
    expect(container.textContent).toContain(message);
    expect(translate).not.toHaveBeenCalled();
  });

  it("only reads configuration on opening and explains explicit cloud checks", async () => {
    await settings();
    expect(getProviders).toHaveBeenCalledTimes(1);
    expect(setProvider).not.toHaveBeenCalled(); expect(checkProvider).not.toHaveBeenCalled(); expect(translate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("stays there");
    expect(container.textContent).toContain("fixed test phrase");
    expect(container.textContent).not.toContain("Amazon");
    expect(container.textContent).not.toContain("AWS");
    await act(async () => button("Check availability Microsoft Translator").click());
    expect(checkProvider).toHaveBeenCalledExactlyOnceWith("microsoft");
    expect(setProvider).not.toHaveBeenCalled(); expect(translate).not.toHaveBeenCalled();
  });

  it("requires an explicit provider selection and never translates while switching", async () => {
    await settings();
    await act(async () => button("Use provider Microsoft Translator").click());
    expect(setProvider).toHaveBeenCalledExactlyOnceWith("microsoft");
    expect(container.querySelector("#provider-title-microsoft")?.textContent).toContain("Current");
    expect(translate).not.toHaveBeenCalled(); expect(modelStatus).not.toHaveBeenCalled();
  });

  it("clears entered credentials immediately even when protected storage fails", async () => {
    saveProvider.mockResolvedValueOnce({ ok: false, error: { code: "CLOUD_STORAGE" } } as never);
    await settings();
    await act(async () => button("Replace credentials DeepL").click());
    const form = container.querySelector<HTMLFormElement>("#provider-form-deepl")!;
    const input = form.querySelector<HTMLInputElement>("input[name=apiKey]")!;
    input.value = "new-secret";
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(saveProvider).toHaveBeenCalledExactlyOnceWith({ provider: "deepl", apiKey: "new-secret" });
    expect(input.value).toBe(""); expect(container.textContent).not.toContain("new-secret");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("protected");
  });

  it("shows a choose-provider state after removing the current cloud account", async () => {
    await settings();
    await act(async () => button("Remove DeepL").click());
    expect(removeProvider).toHaveBeenCalledExactlyOnceWith("deepl");
    expect(container.textContent).toContain("Choose a provider before your next translation.");
    expect(setProvider).not.toHaveBeenCalled();
  });

  it("restores keyboard focus to the provider editor button after a successful save", async () => {
    await settings();
    await act(async () => button("Replace credentials DeepL").click());
    const form = container.querySelector<HTMLFormElement>("#provider-form-deepl")!;
    form.querySelector<HTMLInputElement>("input[name=apiKey]")!.value = "replacement-key";
    const submit = button("Save account", form);
    submit.focus();
    expect(document.activeElement).toBe(submit);
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.querySelector("#provider-form-deepl")).toBeNull();
    expect(document.activeElement).toBe(button("Replace credentials DeepL"));
  });

  it("translates with cloud while Ollama is unloaded and attributes a fallback result as text", async () => {
    await reader(); await select();
    expect(modelStatus).not.toHaveBeenCalled(); expect(translate).not.toHaveBeenCalled();
    await act(async () => button("Translate").click());
    expect(translate).toHaveBeenCalledExactlyOnceWith({ sessionId: "session", selectionId: "selection" });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(container.textContent).toContain("Allowance exhausted. Trying Microsoft Translator");
    view = { ...view, current: "microsoft" };
    await act(async () => translateResult({ ok: true, value: { text: "<script>plain text</script>", provider: "microsoft" } satisfies TranslationResult }));
    expect(container.querySelector(".translation-text")?.textContent).toBe("<script>plain text</script>");
    expect(container.querySelector(".translation-bubble script")).toBeNull();
    expect(container.querySelector(".bubble-status")?.textContent).toContain("Microsoft Translator");
    expect(container.querySelector(".bubble-status")?.textContent).not.toContain("On-device");
    expect(modelStatus).not.toHaveBeenCalled();
  });

  it("requires local Load before translating when Ollama is selected", async () => {
    view = { ...view, current: "ollama" };
    await reader(); await select();
    await act(async () => button("Translate").click());
    expect(modelStatus).toHaveBeenCalled(); expect(translate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Use Load translation model");
  });

  it("discards late cloud results after dismissal and stops request polling", async () => {
    await reader(); await select();
    await act(async () => button("Translate").click());
    await act(async () => button("Dismiss").click());
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(progress).not.toHaveBeenCalled();
    await act(async () => translateResult({ ok: true, value: { text: "stale", provider: "deepl" } }));
    expect(container.querySelector(".translation-bubble")).toBeNull();
    expect(container.textContent).not.toContain("stale");
  });

  it("offers an explicit retry after a cloud timeout without automatically resubmitting", async () => {
    await reader(); await select();
    await act(async () => button("Translate").click());
    await act(async () => translateResult({ ok: false, error: { code: "CLOUD_TIMEOUT" } }));
    expect(container.querySelector(".translation-text")?.textContent).toContain("Retry or choose another provider");
    expect(button("Retry")).toBeDefined();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(translate).toHaveBeenCalledTimes(1);
    await act(async () => button("Retry").click());
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it("explains a cloud credential failure without blaming connectivity or automatically retrying", async () => {
    await reader(); await select();
    await act(async () => button("Translate").click());
    await act(async () => translateResult({ ok: false, error: { code: "CLOUD_AUTHENTICATION" } }));
    expect(container.querySelector(".translation-text")?.textContent).toContain("credentials");
    expect(container.querySelector(".translation-text")?.textContent).not.toContain("Check your connection");
    expect(button("Retry")).toBeUndefined();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("attributes a fast fallback failure to the actual failed provider before any progress poll", async () => {
    await reader(); await select();
    await act(async () => button("Translate").click());
    progress.mockResolvedValueOnce({ ok: true, value: { phase: "error", provider: "microsoft" } });
    await act(async () => translateResult({ ok: false, error: { code: "CLOUD_NETWORK" } }));
    expect(progress).toHaveBeenCalledExactlyOnceWith({ sessionId: "session", selectionId: "selection" });
    expect(container.querySelector(".bubble-status")?.textContent).toContain("Microsoft Translator");
    expect(container.querySelector(".bubble-status")?.textContent).not.toContain("DeepL");
    expect(translate).toHaveBeenCalledTimes(1);
  });
});
