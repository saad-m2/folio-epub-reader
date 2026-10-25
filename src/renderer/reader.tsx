import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "@fluentui/react-components";
import { Button, Icon, ModeSwitch, PageLayoutSwitch, AppearanceControls } from "./ui";
import { appearanceColors } from "./appearance";
import { PROVIDER_LABELS, type TranslationProvider, type TranslationProvidersView, type TranslationProgress, type TranslationResult } from "../shared/translation";
import { cloudTranslationMessage } from "./translation-ui";
import type { FontEntry } from "./settings";
import type {
  Appearance,
  PageLayout,
  ReaderLocation,
  ReaderMode,
} from "../shared/contracts";
import {
  ReaderAdapter,
  type ReaderSelection,
  type ReaderSnapshot,
  type TocItem,
} from "./reader-adapter";

type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: string } };
export type Settings = { mode: ReaderMode; pageLayout: PageLayout; appearance: Appearance };
export type BookSession = {
  bookId: string;
  sessionId: string;
  archiveBytes: ArrayBuffer;
  metadata: { title: string; author: string };
  initialLocation?: ReaderLocation;
};
type ModelState =
  | "unavailable"
  | "missing"
  | "unloaded"
  | "loading"
  | "loaded"
  | "unloading"
  | "error";
type ModelStatus = { state: ModelState; reason?: string };
type TranslationSurface = {
  phase: "loading" | "result" | "error";
  message: string;
  selection: ReaderSelection;
  selectionId: string;
  expanded: boolean;
  retry: boolean;
  provider: TranslationProvider | null;
};
const modelLabels: Record<ModelState, string> = {
  unavailable: "Ollama is not running",
  missing: "Translation model is not installed",
  unloaded: "Translation model is unloaded",
  loading: "Loading translation model…",
  loaded: "Translation model is loaded",
  unloading: "Unloading translation model…",
  error: "Translation model needs attention",
};
function translationMessage(code: string): string {
  if (code.startsWith("CLOUD_")) return cloudTranslationMessage(code);
  switch (code) {
    case "SERVICE_UNAVAILABLE":
      return "Ollama is unavailable. Install and start Ollama, then check again.";
    case "MODEL_MISSING":
      return "Install the supported translation model in Ollama, then check again.";
    case "MODEL_UNLOADED":
    case "MODEL_UNEXPECTED_RELOAD":
      return "The model is unloaded. Use Load translation model, then select the text and click Translate again.";
    case "MODEL_OUT_OF_MEMORY":
      return "The model ran out of memory. Try a shorter selection or free GPU memory.";
    case "MODEL_TIMEOUT":
      return "Translation took too long. You can try again.";
    case "MODEL_CANCELLED":
      return "This selection is no longer available. Select the text again to translate it.";
    case "MODEL_INVALID_OUTPUT":
      return "The model did not return usable text. You can try again.";
    case "MODEL_INTERRUPTED":
    case "MODEL_SERVICE_ERROR":
      return "The local translation service was interrupted. Check Ollama and try again.";
    default:
      return "Translation could not finish. You can try again.";
  }
}
const retryableTranslationError = (code: string): boolean =>
  [
    "MODEL_TIMEOUT",
    "MODEL_OUT_OF_MEMORY",
    "MODEL_INVALID_OUTPUT",
    "MODEL_INTERRUPTED",
    "MODEL_SERVICE_ERROR",
    "CLOUD_TIMEOUT",
    "CLOUD_NETWORK",
    "CLOUD_RATE_LIMITED",
    "CLOUD_INVALID_OUTPUT",
    "CLOUD_SERVICE_ERROR",
  ].includes(code);
function Toc({
  items,
  active,
  go,
}: {
  items: TocItem[];
  active?: string;
  go: (item: TocItem) => void;
}): React.ReactElement {
  return (
    <ul className="toc-list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            className={active === item.id ? "toc-active" : ""}
            onClick={() => go(item)}
          >
            {item.label}
          </button>
          {item.children.length > 0 && (
            <Toc items={item.children} active={active} go={go} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function Reader({
  session,
  settings,
  fonts,
  saveSettings,
  leave,
  registerFlush,
  proof = false,
}: {
  session: BookSession;
  settings: Settings;
  fonts: FontEntry[];
  saveSettings: (change: Partial<Settings>) => Promise<void>;
  leave: () => void;
  registerFlush: (flush?: () => Promise<void>) => void;
  proof?: boolean;
}): React.ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const adapter = useRef<ReaderAdapter>();
  const saveTimer = useRef<number>();
  const [snapshot, setSnapshot] = useState<ReaderSnapshot>();
  const [toc, setToc] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [error, setError] = useState("");
  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    state: "unloaded",
  });
  const [modelBusy, setModelBusy] = useState(false);
  const busyModel = useRef(false);
  const modelRevision = useRef(0);
  const modelRead = useRef(0);
  const [modelNotice, setModelNotice] = useState("");
  const [providers, setProviders] = useState<TranslationProvidersView>();
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerNotice, setProviderNotice] = useState("");
  const providerSwitch = useRef(false);
  const providerRevision = useRef(0);
  const providerRead = useRef(0);
  const providerPicker = useRef<HTMLSelectElement>(null);
  const restoreProviderFocus = useRef(false);
  const readerMounted = useRef(false);
  const [selected, setSelected] = useState<{
    selection: ReaderSelection;
    selectionId: string;
  }>();
  const [translation, setTranslation] = useState<TranslationSurface>();
  const selectionVersion = useRef(0);
  const translationVersion = useRef(0);
  const selectionRegistration = useRef<Promise<unknown>>(Promise.resolve());
  const currentSelection = useRef<{
    selection: ReaderSelection;
    selectionId: string;
  }>();
  const currentTranslation = useRef<TranslationSurface>();
  const toolbar = useRef<HTMLElement>(null);
  const toolbarTrigger = useRef<HTMLButtonElement>(null);
  const tocButton = useRef<HTMLButtonElement>(null);
  const appearanceButton = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLElement>(null);
  const lastWheelAt = useRef(-Infinity);
  const footer = useRef<HTMLElement>(null);
  const preferenceLock = useRef(false);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [appliedMode, setAppliedMode] = useState(settings.mode);
  const overlayOpen = toc || appearanceOpen || !!translation?.expanded;
  const showTranslation = (next?: TranslationSurface): void => {
    currentTranslation.current = next;
    setTranslation(next);
  };
  const dismissTranslation = (): void => {
    ++translationVersion.current;
    showTranslation(undefined);
    adapter.current?.clearSelection();
  };
  const refreshModelStatus = useCallback(async (): Promise<void> => {
    if (busyModel.current) return;
    const revision = modelRevision.current;
    const read = ++modelRead.current;
    try {
      const result =
        (await window.readerApi.getTranslationModelStatus()) as Result<ModelStatus>;
      if (!readerMounted.current || busyModel.current || revision !== modelRevision.current || read !== modelRead.current) return;
      if (result.ok) setModelStatus(result.value);
      else setModelStatus({ state: "error", reason: result.error.code });
    } catch {
      if (readerMounted.current && !busyModel.current && revision === modelRevision.current && read === modelRead.current) setModelStatus({ state: "error" });
    }
  }, []);
  const refreshProviders = useCallback(async (): Promise<TranslationProvidersView | undefined> => {
    if (providerSwitch.current) return undefined;
    const revision = providerRevision.current;
    const read = ++providerRead.current;
    try {
      const result = await window.readerApi.getTranslationProviders() as Result<TranslationProvidersView>;
      if (revision !== providerRevision.current || providerSwitch.current) return undefined;
      if (result.ok) {
        if (readerMounted.current && read === providerRead.current) setProviders(result.value);
        return result.value;
      }
    } catch { /* Reading remains available if provider configuration cannot be read. */ }
    return undefined;
  }, []);
  async function changeProvider(provider: TranslationProvider): Promise<void> {
    if (providerSwitch.current || provider === providers?.current) return;
    restoreProviderFocus.current = document.activeElement === providerPicker.current;
    providerSwitch.current = true;
    ++modelRevision.current;
    ++providerRevision.current;
    ++selectionVersion.current;
    ++translationVersion.current;
    currentSelection.current = undefined;
    setSelected(undefined);
    showTranslation(undefined);
    adapter.current?.clearSelection();
    setProviderBusy(true);
    setProviderNotice("");
    setModelNotice("");
    setError("");
    setToolbarVisible(true);
    // Drain any earlier selection registration before main switches and clears it.
    // New selections are ignored while this operation is pending.
    const operation = selectionRegistration.current.catch(() => undefined)
      .then(() => window.readerApi.setTranslationProvider(provider));
    selectionRegistration.current = operation;
    try {
      const result = await operation as Result<TranslationProvidersView>;
      if (!readerMounted.current) return;
      if (result.ok) {
        setProviders(result.value);
        setProviderNotice(`${PROVIDER_LABELS[provider]} selected. Select text and press Translate when ready.`);
      } else setError(cloudTranslationMessage(result.error.code));
    } catch {
      if (readerMounted.current) setError("Could not change translation service. Try again.");
    } finally {
      ++providerRevision.current;
      adapter.current?.clearSelection();
      providerSwitch.current = false;
      if (readerMounted.current) setProviderBusy(false);
    }
  }
  useEffect(() => {
    if (!providerBusy && restoreProviderFocus.current) {
      restoreProviderFocus.current = false;
      providerPicker.current?.focus();
    }
  }, [providerBusy]);
  useEffect(() => {
    readerMounted.current = true;
    void refreshProviders();
    const timer = window.setInterval(() => void refreshProviders(), 10000);
    return () => { readerMounted.current = false; window.clearInterval(timer); };
  }, [refreshProviders]);
  useEffect(() => {
    if (providers?.current !== "ollama") return;
    void refreshModelStatus();
    const timer = window.setInterval(() => {
      void refreshModelStatus();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [providers?.current, refreshModelStatus]);
  useEffect(() => {
    if (translation?.phase !== "loading") return;
    let active = true;
    let checking = false;
    const version = translationVersion.current;
    const selectionId = translation.selectionId;
    const poll = async (): Promise<void> => {
      if (checking) return;
      checking = true;
      try {
        const result = await window.readerApi.getTranslationRequestStatus({ sessionId: session.sessionId, selectionId }) as Result<TranslationProgress>;
        const surface = currentTranslation.current;
        if (!active || version !== translationVersion.current || !result.ok || surface?.phase !== "loading") return;
        const provider = result.value.provider;
        if (provider && (result.value.phase === "translating" || result.value.phase === "fallback")) {
          showTranslation({ ...surface, provider, message: result.value.phase === "fallback" ? `Allowance exhausted. Trying ${PROVIDER_LABELS[provider]}…` : `Translating with ${PROVIDER_LABELS[provider]}…` });
        }
      } catch { /* Progress polling never retries or submits a translation. */ }
      finally { checking = false; }
    };
    const timer = window.setInterval(() => void poll(), 400);
    return () => { active = false; window.clearInterval(timer); };
  }, [translation?.phase, translation?.selectionId, session.sessionId]);
  async function changeModel(action: "load" | "unload"): Promise<void> {
    if (busyModel.current || providerSwitch.current || providers?.current !== "ollama") return;
    adapter.current?.clearSelection();
    setSelected(undefined);
    dismissTranslation();
    busyModel.current = true;
    ++modelRevision.current;
    setModelBusy(true);
    setModelNotice("");
    setModelStatus({ state: action === "load" ? "loading" : "unloading" });
    try {
      const result = (await (action === "load"
        ? window.readerApi.loadTranslationModel()
        : window.readerApi.unloadTranslationModel())) as Result<ModelStatus>;
      if (result.ok) setModelStatus(result.value);
      else {
        setModelNotice(translationMessage(result.error.code));
        setModelStatus({ state: "error", reason: result.error.code });
      }
    } catch {
      setModelNotice(
        "Could not reach the local translation service. Check Ollama and try again.",
      );
      setModelStatus({ state: "error" });
    } finally {
      busyModel.current = false;
      setModelBusy(false);
      void refreshModelStatus();
    }
  }
  async function requestTranslation(intent?: {
    selection: ReaderSelection;
    selectionId: string;
  }): Promise<void> {
    if (providerSwitch.current) return;
    const active = intent ?? currentSelection.current;
    if (
      !active ||
      currentSelection.current?.selectionId !== active.selectionId ||
      adapter.current?.getSelection()?.text !== active.selection.text
    )
      return;
    const version = ++translationVersion.current;
    let surface: TranslationSurface = {
      phase: "loading",
      message: "Translating German to English…",
      selection: active.selection,
      selectionId: active.selectionId,
      expanded: false,
      retry: false,
      provider: providers?.current ?? null,
    };
    const stillCurrent = (): boolean => version === translationVersion.current &&
      currentSelection.current?.selectionId === active.selectionId &&
      adapter.current?.getSelection()?.text === active.selection.text;
    const failureProvider = async (): Promise<TranslationProvider | null> => {
      const pending = currentTranslation.current;
      const lastProvider = pending?.selectionId === active.selectionId ? pending.provider : surface.provider;
      if (surface.provider === "ollama") return "ollama";
      try {
        const status = await window.readerApi.getTranslationRequestStatus({ sessionId: session.sessionId, selectionId: active.selectionId }) as Result<TranslationProgress>;
        if (status.ok && status.value.provider) return status.value.provider;
      } catch { /* Keep the last observed provider if request status is unavailable. */ }
      return lastProvider;
    };
    showTranslation(surface);
    setSelected(undefined);
    try {
      const configured = await refreshProviders();
      if (version !== translationVersion.current) return;
      if (!configured?.current) {
        showTranslation({ ...surface, phase: "error", message: cloudTranslationMessage("CLOUD_NOT_CONFIGURED") });
        return;
      }
      surface = { ...surface, provider: configured.current };
      showTranslation(surface);
      if (configured.current === "ollama") {
        const status =
          (await window.readerApi.getTranslationModelStatus()) as Result<ModelStatus>;
        if (!stillCurrent()) return;
        if (!status.ok || status.value.state !== "loaded") {
          if (status.ok) setModelStatus(status.value);
          if (
            status.ok &&
            (status.value.state === "loading" ||
              status.value.state === "unloading")
          ) {
            showTranslation({
              ...surface,
              phase: "error",
              message:
                status.value.state === "loading"
                  ? "The translation model is still loading. Wait for it to finish, then select your passage and choose Translate again."
                  : "The translation model is unloading. Load it again before requesting a translation.",
              retry: false,
            });
            return;
          }
          const code = !status.ok
            ? status.error.code
            : status.value.state === "unavailable"
              ? "SERVICE_UNAVAILABLE"
              : status.value.state === "missing"
                ? "MODEL_MISSING"
                : status.value.state === "error"
                  ? status.value.reason === "timeout"
                    ? "MODEL_TIMEOUT"
                    : "MODEL_SERVICE_ERROR"
                  : "MODEL_UNLOADED";
          showTranslation({
            ...surface,
            phase: "error",
            message: translationMessage(code),
            retry: retryableTranslationError(code),
          });
          return;
        }
      }
      const result = (await window.readerApi.translateSelection({
        sessionId: session.sessionId,
        selectionId: active.selectionId,
      })) as Result<TranslationResult>;
      if (
        version !== translationVersion.current ||
        currentSelection.current?.selectionId !== active.selectionId ||
        adapter.current?.getSelection()?.text !== active.selection.text
      )
        return;
      if (result.ok)
        showTranslation({
          ...surface,
          phase: "result",
          message: result.value.text,
          retry: false,
          provider: result.value.provider,
        });
      else {
        const provider = await failureProvider();
        if (!stillCurrent()) return;
        showTranslation({
          ...surface,
          provider,
          phase: "error",
          message: translationMessage(result.error.code),
          retry: retryableTranslationError(result.error.code),
        });
        if (configured.current === "ollama") void refreshModelStatus();
      }
    } catch {
      if (!stillCurrent()) return;
      const provider = await failureProvider();
      if (stillCurrent())
        showTranslation({
          ...surface,
          provider,
          phase: "error",
          message:
            surface.provider === "ollama" ? "The local translation service could not be reached. Check Ollama and try again." : cloudTranslationMessage("CLOUD_NETWORK"),
          retry: true,
        });
    } finally {
      if (readerMounted.current) void refreshProviders();
    }
  }
  async function copyTranslation(): Promise<void> {
    const result = currentTranslation.current;
    if (result?.phase !== "result") return;
    try {
      const copied = (await window.readerApi.copyTranslation(
        session.sessionId,
        result.selectionId,
      )) as Result<unknown>;
      if (!copied.ok)
        setError(
          "Could not copy the translation. Select the text and translate it again.",
        );
    } catch {
      setError("Could not copy the translation.");
    }
  }
  const closeOverlay = useCallback((): boolean => {
    if (currentTranslation.current) {
      dismissTranslation();
      return true;
    }
    if (appearanceOpen) {
      setAppearanceOpen(false);
      window.setTimeout(() => appearanceButton.current?.focus(), 0);
      return true;
    }
    if (toc) {
      setToc(false);
      window.setTimeout(() => tocButton.current?.focus(), 0);
      return true;
    }
    return false;
  }, [appearanceOpen, toc]);
  useEffect(() => {
    if (!translation) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      if (!target?.closest(".translation-bubble, .translation-expanded"))
        dismissTranslation();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [translation]);
  const navigate = useCallback(
    (direction: "previous" | "next"): void => {
      if (
        settings.mode !== "paginated" ||
        overlayOpen ||
        preferenceLock.current
      )
        return;
      const reader = adapter.current;
      if (reader)
        void (direction === "next" ? reader.next() : reader.previous()).catch(
          () => setError("Could not turn the page."),
        );
    },
    [settings.mode, overlayOpen],
  );
  const wheelNavigate = useCallback(
    (deltaY: number): void => {
      if (!deltaY || settings.mode !== "paginated" || overlayOpen) return;
      const now = performance.now();
      if (now - lastWheelAt.current < 280) return;
      lastWheelAt.current = now;
      navigate(deltaY < 0 ? "previous" : "next");
    },
    [navigate, overlayOpen, settings.mode],
  );
  useEffect(() => {
    if (!host.current) return;
    const reader = new ReaderAdapter(host.current);
    adapter.current = reader;
    let active = true;
    const savePosition = async (location: ReaderLocation): Promise<void> => {
      const result = (await window.readerApi.saveLocator(
        session.sessionId,
        session.bookId,
        location,
      )) as Result<unknown>;
      if (!result.ok) throw new Error("Reading position could not be saved.");
    };
    registerFlush(async () => {
      window.clearTimeout(saveTimer.current);
      const location = reader.captureLocation();
      if (!proof && location.href) await savePosition(location);
    });
    const unsubscribe = reader.subscribe((next) => {
      setSnapshot(next);
      if (!proof) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          void savePosition(next.location).catch(() => {
            if (active)
              setError(
                "Your reading place could not be saved. Keep the book open and try returning to the library again.",
              );
          });
        }, 300);
      }
    });
    void reader
      .open({
        archiveBytes: session.archiveBytes,
        mode: settings.mode,
        appearance: settings.appearance,
        pageLayout: settings.pageLayout,
        initialLocation: session.initialLocation,
      })
      .then(setSnapshot)
      .catch(() => setError("This book could not be rendered."));
    return () => {
      active = false;
      ++selectionVersion.current;
      ++translationVersion.current;
      currentSelection.current = undefined;
      selectionRegistration.current = selectionRegistration.current
        .catch(() => undefined)
        .then(() => window.readerApi.clearTranslationSelection());
      window.clearTimeout(saveTimer.current);
      registerFlush(undefined);
      unsubscribe();
      void reader.close();
      if (adapter.current === reader) adapter.current = undefined;
    };
  }, [session]);
  useEffect(() => {
    const reader = adapter.current;
    if (!reader) return;
    const stopIssue = reader.subscribeSelectionTooLong(() =>
      setError("Select 5,000 characters or fewer to translate."),
    );
    const stopSelection = reader.subscribeSelection((selection) => {
      if (providerSwitch.current) return;
      if (selection) setError("");
      const prior = currentSelection.current;
      if (
        selection &&
        prior &&
        selection.text === prior.selection.text &&
        selection.cfi === prior.selection.cfi
      ) {
        const updated = { ...prior, selection };
        currentSelection.current = updated;
        if (!currentTranslation.current) setSelected(updated);
        return;
      }
      const version = ++selectionVersion.current;
      ++translationVersion.current;
      currentSelection.current = undefined;
      setSelected(undefined);
      showTranslation(undefined);
      if (!selection) {
        selectionRegistration.current = selectionRegistration.current
          .catch(() => undefined)
          .then(() => window.readerApi.clearTranslationSelection());
        return;
      }
      selectionRegistration.current = selectionRegistration.current
        .catch(() => undefined)
        .then(() =>
          window.readerApi.registerTranslationSelection({
            sessionId: session.sessionId,
            text: selection.text,
            ...(selection.cfi ? { rangeCfi: selection.cfi } : {}),
            rects: selection.rects,
          }),
        )
        .then((raw) => {
          const result = raw as Result<{ selectionId: string }>;
          if (
            version !== selectionVersion.current ||
            reader !== adapter.current ||
            !result.ok
          )
            return;
          const active = { selection, selectionId: result.value.selectionId };
          currentSelection.current = active;
          setSelected(active);
        })
        .catch(() => {
          if (version === selectionVersion.current)
            setError("Could not prepare the selected text for translation.");
        });
    });
    return () => {
      stopIssue();
      stopSelection();
    };
  }, [session]);
  useEffect(() => {
    const reader = adapter.current;
    if (!reader) return;
    return reader.subscribeInteraction((interaction) => {
      if (interaction.kind === "reader-click") {
        if (currentTranslation.current) {
          dismissTranslation();
          return;
        }
        if (overlayOpen) return;
        if (settings.mode === "paginated" && interaction.zone !== "center")
          navigate(interaction.zone === "left" ? "previous" : "next");
        else setToolbarVisible((value) => !value);
      } else if (interaction.kind === "wheel") {
        wheelNavigate(interaction.deltaY);
      } else if (interaction.kind === "key" && interaction.key === "Escape") {
        if (!closeOverlay()) leave();
      } else if (
        interaction.kind === "key" &&
        settings.mode === "paginated" &&
        !overlayOpen
      ) {
        if (
          interaction.key === "ArrowLeft" ||
          interaction.key === "PageUp" ||
          (interaction.key === " " && interaction.shiftKey)
        )
          navigate("previous");
        if (
          interaction.key === "ArrowRight" ||
          interaction.key === "PageDown" ||
          ((interaction.key === " " || interaction.key === "Spacebar") &&
            !interaction.shiftKey)
        )
          navigate("next");
      }
    });
  }, [
    session,
    navigate,
    wheelNavigate,
    closeOverlay,
    leave,
    overlayOpen,
    settings.mode,
  ]);
  useEffect(() => {
    const reader = adapter.current;
    if (!reader) return;
    return reader.subscribeExternalLink((url) => {
      void window.readerApi
        .openExternalLink(session.sessionId, url)
        .then((result) => {
          if (!(result as Result<{ outcome: string }>).ok)
            setError("That external link could not be opened.");
        });
    });
  }, [session]);
  useEffect(() => {
    if (toolbar.current) toolbar.current.inert = !toolbarVisible || overlayOpen;
    if (toolbarTrigger.current) toolbarTrigger.current.inert = overlayOpen;
    if (host.current) host.current.inert = toc || appearanceOpen;
    if (footer.current) footer.current.inert = overlayOpen;
  }, [toolbarVisible, overlayOpen]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      if (settings.mode !== "paginated" || overlayOpen) return;
      event.preventDefault();
      wheelNavigate(event.deltaY);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [wheelNavigate, overlayOpen, settings.mode]);
  useEffect(() => {
    if (overlayOpen) {
      setToolbarVisible(true);
      overlay.current
        ?.querySelector<HTMLElement>("button, [href], [tabindex='0']")
        ?.focus();
    }
  }, [toc, appearanceOpen, overlayOpen]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!closeOverlay()) leave();
        return;
      }
      if (overlayOpen) {
        if (event.key === "Tab" && overlay.current) {
          const controls = Array.from(
            overlay.current.querySelectorAll<HTMLElement>(
              "button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex='0']",
            ),
          );
          const first = controls[0],
            last = controls.at(-1);
          if (
            first &&
            last &&
            ((event.shiftKey && document.activeElement === first) ||
              (!event.shiftKey && document.activeElement === last))
          ) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }
        return;
      }
      if (
        settings.mode !== "paginated" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, [contenteditable='true']",
        )
      )
        return;
      let direction: "previous" | "next" | undefined;
      if (
        event.key === "ArrowLeft" ||
        event.key === "PageUp" ||
        (event.key === " " && event.shiftKey)
      )
        direction = "previous";
      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        (event.key === " " && !event.shiftKey)
      )
        direction = "next";
      if (direction) {
        event.preventDefault();
        navigate(direction);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOverlay, leave, navigate, overlayOpen, settings.mode]);
  useEffect(() => {
    let timer: number | undefined;
    const onResize = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (adapter.current)
          void adapter.current
            .reflow(settings.appearance)
            .catch(() => setError("The reader could not reflow this book."));
      }, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [settings.appearance]);
  async function switchMode(next?: ReaderMode): Promise<void> {
    if (preferenceLock.current || !adapter.current) return;
    const mode: ReaderMode =
      next ?? (appliedMode === "continuous" ? "paginated" : "continuous");
    if (mode === appliedMode) return;
    preferenceLock.current = true;
    setPreferencesBusy(true);
    try {
      await saveSettings({ mode });
      setSnapshot(await adapter.current.setMode(mode, settings.appearance, settings.pageLayout));
      setAppliedMode(mode);
    } catch {
      setError("The reading mode could not be changed. Try again.");
    } finally {
      preferenceLock.current = false;
      setPreferencesBusy(false);
    }
  }
  async function switchPageLayout(pageLayout: PageLayout): Promise<void> {
    if (preferenceLock.current || !adapter.current || pageLayout === settings.pageLayout) return;
    preferenceLock.current = true;
    setPreferencesBusy(true);
    try {
      await saveSettings({ pageLayout });
      setSnapshot(await adapter.current.setPageLayout(pageLayout, settings.appearance));
    } catch {
      setError("The page layout could not be changed. Try again.");
    } finally {
      preferenceLock.current = false;
      setPreferencesBusy(false);
    }
  }
  async function updateAppearance(next: Appearance): Promise<void> {
    if (preferenceLock.current || !adapter.current) return;
    preferenceLock.current = true;
    setPreferencesBusy(true);
    try {
      await saveSettings({ appearance: next });
      setSnapshot(await adapter.current.applyAppearance(next));
    } catch {
      setError("Your reading appearance could not be updated. Try again.");
    } finally {
      preferenceLock.current = false;
      setPreferencesBusy(false);
    }
  }
  const anchor = (translation?.selection ?? selected?.selection)?.rects[0];
  const hostHeight = host.current?.clientHeight ?? window.innerHeight;
  const hostWidth = host.current?.clientWidth ?? window.innerWidth;
  const bubbleAbove =
    !!anchor && anchor.y > hostHeight - anchor.y - anchor.height;
  const previewTranslation =
    !!translation &&
    translation.phase === "result" &&
    (translation.message.length > 300 || hostHeight < 450);
  const currentCloud = providers?.providers.find(item => item.provider === providers.current);
  const cloudReadiness = currentCloud?.credentialError ? "Credentials need attention" : !currentCloud?.configured ? "Not configured" : currentCloud.availability === "exhausted" ? "Allowance exhausted" : currentCloud.availability === "available" ? "Ready" : "Allowance not confirmed";
  const bubbleStyle: React.CSSProperties | undefined = anchor
    ? {
        left: Math.max(12, Math.min(hostWidth - 300, anchor.x)),
        top: bubbleAbove
          ? Math.max(12, anchor.y - (translation ? 210 : 48))
          : Math.min(hostHeight - 48, anchor.y + anchor.height + 8),
      }
    : undefined;
  useEffect(() => {
    if (!proof) return;
    const switchForProof = (): void => {
      void switchMode().catch((error) =>
        setError(
          error instanceof Error ? error.message : "Proof mode switch failed.",
        ),
      );
    };
    window.addEventListener("reader-proof-switch", switchForProof);
    return () =>
      window.removeEventListener("reader-proof-switch", switchForProof);
  }, [proof, settings.mode, settings.pageLayout, settings.appearance, appliedMode]);
  return (
    <section
      className={`reader theme-${settings.appearance.theme}`}
      style={settings.appearance.theme === "custom" ? {
        "--paper": appearanceColors(settings.appearance).background,
        "--reading-ink": appearanceColors(settings.appearance).color,
      } as React.CSSProperties : undefined}
      data-reader-mode={appliedMode}
      {...(proof ? { "data-proof-session": session.sessionId } : {})}
    >
      <button
        ref={toolbarTrigger}
        className="reader-toolbar-trigger"
        aria-label="Show reader controls"
        onPointerEnter={() => setToolbarVisible(true)}
        onFocus={() => setToolbarVisible(true)}
        onClick={() => setToolbarVisible(true)}
      />
      <header
        ref={toolbar}
        className={`reader-toolbar ${toolbarVisible || overlayOpen ? "is-visible" : ""}`}
        aria-label="Reader controls"
        aria-hidden={!toolbarVisible || overlayOpen}
        onPointerEnter={() => setToolbarVisible(true)}
        onPointerLeave={() => {
          if (
            !providerSwitch.current && !overlayOpen &&
            !toolbar.current?.contains(document.activeElement)
          )
            setToolbarVisible(false);
        }}
      >
        <Button
          className="icon-btn"
          appearance="subtle"
          onClick={leave}
          aria-label="Back to library"
          title="Back to library"
        >
          <Icon name="left" />
        </Button>
        <span className="divider" />
        <Button
          className="icon-btn"
          appearance="subtle"
          ref={tocButton}
          aria-label="Table of contents"
          title="Table of contents"
          aria-expanded={toc}
          aria-controls="reader-toc"
          onClick={() => {
            setAppearanceOpen(false);
            setToc((value) => !value);
          }}
        >
          <Icon name="list" />
        </Button>
        <div className="reader-book-label">
          <span>{session.metadata.title}</span>
          <small>{session.metadata.author}</small>
          <span className="sr-only reader-progress">
            {snapshot
              ? `${snapshot.label} · ${Math.round(snapshot.progress * 100)}%`
              : "Opening book..."}
          </span>
        </div>
        <fieldset className="reader-mode-switch" disabled={preferencesBusy}>
          <legend className="sr-only">Reading mode</legend>
          <ModeSwitch
            mode={appliedMode}
            onChange={(mode) => void switchMode(mode)}
          />
        </fieldset>
        <div className="reader-tools">
          <span className="divider" />
          <Button
            appearance="subtle"
            className="icon-btn"
            ref={appearanceButton}
            aria-label="Reader settings"
            title="Reader settings"
            aria-expanded={appearanceOpen}
            aria-controls="reader-settings"
            onClick={() => {
              setToc(false);
              setAppearanceOpen((value) => !value);
            }}
          >
            <Icon name="settings" />
          </Button>
          <Button
            appearance="subtle"
            className="icon-btn"
            aria-label="Hide reader controls"
            onClick={() => setToolbarVisible(false)}
          >
            <Icon name="close" />
          </Button>
        </div>
      </header>
      {overlayOpen && (
        <div
          className="reader-overlay-scrim"
          aria-hidden="true"
          onClick={() => closeOverlay()}
        />
      )}
      {toc && (
        <aside
          id="reader-toc"
          ref={overlay}
          className="reader-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Table of contents"
        >
          <div className="drawer-title">
            <h2>Contents</h2>
            <Button
              appearance="subtle"
              className="icon-btn"
              aria-label="Close contents"
              onClick={() => closeOverlay()}
            >
              <Icon name="close" />
            </Button>
          </div>
          <div className="eyebrow">{session.metadata.title}</div>
          <p className="small muted">{session.metadata.author}</p>
          {snapshot?.hasNavigation ? (
            <Toc
              items={snapshot.toc}
              active={snapshot.location.navId}
              go={(item) =>
                void adapter.current
                  ?.goTo({ href: item.href, navId: item.id })
                  .then(setSnapshot)
                  .then(() => closeOverlay())
                  .catch(() =>
                    setError("This chapter could not be opened. Try again."),
                  )
              }
            />
          ) : (
            <p className="small muted">No table of contents is available.</p>
          )}
        </aside>
      )}
      {appearanceOpen && (
        <aside
          id="reader-settings"
          ref={overlay}
          className="reader-overlay appearance-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Reader settings"
        >
          <div className="drawer-title">
            <h2>Reader settings</h2>
            <Button
              appearance="subtle"
              className="icon-btn"
              aria-label="Close reader settings"
              onClick={() => closeOverlay()}
            >
              <Icon name="close" />
            </Button>
          </div>
          <h3>Reading appearance</h3>
          <fieldset className="appearance-fields" disabled={preferencesBusy}>
            <legend className="sr-only">Global reading preferences</legend>
            <div className="form-row">
              <span>Reading mode</span>
              <ModeSwitch
                mode={appliedMode}
                onChange={(mode) => void switchMode(mode)}
              />
            </div>
            {appliedMode === "paginated" && (
              <div className="form-row">
                <span>Page layout</span>
                <PageLayoutSwitch layout={settings.pageLayout} onChange={(layout) => void switchPageLayout(layout)} />
              </div>
            )}
            <AppearanceControls
              appearance={settings.appearance}
              update={(next) => void updateAppearance(next)}
              fonts={Array.from(
                new Set([
                  settings.appearance.fontFamily,
                  ...fonts
                    .filter((font) => font.installed)
                    .map((font) => font.family),
                ]),
              )}
            />
          </fieldset>
          <div className="info-line">
            <Icon name="check" />
            <span>Saved for all your books.</span>
          </div>
          <section className="reader-translation-settings" aria-labelledby="reader-translation-title">
            <h3 id="reader-translation-title">Translation</h3>
            <p className="small muted">Choose a service for German to English. Connecting accounts is available in the main Settings.</p>
            <select
              ref={providerPicker}
              className="reader-provider-picker"
              aria-label="Translation service"
              title="Translation service"
              value={providers?.current ?? ""}
              disabled={!providers || providerBusy || modelBusy}
              aria-busy={providerBusy}
              onChange={event => void changeProvider(event.target.value as TranslationProvider)}
              onKeyDown={event => {
                // Let the native picker close without Escape leaving the book.
                if (event.key === "Escape") event.stopPropagation();
              }}
            >
              <option value="" disabled>{providers ? "Choose translation service" : "Loading services…"}</option>
              <option value="ollama">{PROVIDER_LABELS.ollama}</option>
              {providers?.providers.filter(account => account.configured).map(account => (
                <option key={account.provider} value={account.provider} disabled={account.credentialError}>
                  {PROVIDER_LABELS[account.provider]}{account.credentialError ? " (reconnect in Settings)" : account.availability === "exhausted" ? " (exhausted)" : ""}
                </option>
              ))}
            </select>
            <p className="small muted" role="status">{providerBusy ? "Changing translation service…" : providerNotice}</p>
            {providers?.current === "ollama" ? <>
              <span className="small model-status" role="status">
                {modelLabels[modelStatus.state]}
              </span>
              <Button
                appearance="subtle"
                title={modelLabels[modelStatus.state]}
                aria-label={
                  modelStatus.state === "loaded"
                    ? "Unload translation model"
                    : "Load translation model"
                }
                disabled={
                  modelBusy || providerBusy ||
                  modelStatus.state === "loading" ||
                  modelStatus.state === "unloading"
                }
                onClick={() =>
                  void changeModel(
                    modelStatus.state === "loaded" ? "unload" : "load",
                  )
                }
              >
                <span
                  className={`dot ${modelStatus.state === "loaded" ? "" : "inactive"}`}
                />
                {modelBusy
                  ? "Please wait…"
                  : modelStatus.state === "loaded"
                    ? "Unload model"
                    : "Load model"}
              </Button>
            </> : <span className="reader-cloud-status" role="status">
              {providers?.current ? cloudReadiness : providers ? "Choose a translation service" : "Checking translation provider…"}
            </span>}
            {modelNotice && <p className="small" role="status">{modelNotice}</p>}
            <p className="small muted">Switching never translates a selection or loads a local model. Cloud fallback stays on the next service until you switch again or its allowance runs out.</p>
          </section>
        </aside>
      )}
      <div className="reader-host" ref={host} />
      <footer ref={footer} className="reader-footer" aria-hidden={overlayOpen}>
        <span>
          {snapshot
            ? `${snapshot.label} / ${Math.round(snapshot.progress * 100)}% of ${snapshot.hasNavigation ? "chapter" : "book"}`
            : "Opening book…"}
        </span>
        <div className="track" aria-hidden="true">
          <i style={{ width: `${(snapshot?.progress ?? 0) * 100}%` }} />
        </div>
        {appliedMode === "paginated" ? (
          <div className="reader-footer-nav">
            <Button
              appearance="subtle"
              className="icon-btn"
              aria-label="Previous page"
              onClick={() => navigate("previous")}
            >
              <Icon name="left" />
            </Button>
            <span>Page by page</span>
            <Button
              appearance="subtle"
              className="icon-btn"
              aria-label="Next page"
              onClick={() => navigate("next")}
            >
              <Icon name="right" />
            </Button>
          </div>
        ) : (
          <span className="scroll-hint">Scroll to keep reading</span>
        )}
      </footer>
      {!snapshot && !error && (
        <div className="reader-loading" role="status">
          <span className="spinner" />
          <p>Finding your place in the story…</p>
        </div>
      )}
      {selected && !translation && anchor && (
        <div
          className="translation-action"
          style={bubbleStyle}
          onPointerDown={(event) => event.preventDefault()}
        >
          <Button
            appearance="primary"
            onClick={() => void requestTranslation(selected)}
          >
            Translate
          </Button>
        </div>
      )}
      {translation && anchor && (
        <div
          className={`translation-bubble ${translation.expanded ? "is-hidden" : ""}`}
          style={bubbleStyle}
          role="status"
          aria-live="polite"
        >
          <div className="translation-heading">
            German <span aria-label="to">→</span> English
          </div>
          <div
            className={`translation-text ${previewTranslation ? "is-preview" : ""}`}
          >
            {translation.phase === "loading" && <span className="spinner" />}
            {translation.message}
          </div>
          {translation.phase === "result" && (
            <div className="translation-actions">
              <Button onClick={() => void copyTranslation()}>
                <Icon name="copy" size={14} />
                Copy
              </Button>
              {previewTranslation && (
                <Button
                  onClick={() =>
                    showTranslation({ ...translation, expanded: true })
                  }
                >
                  <Icon name="expand" size={14} />
                  Expand
                </Button>
              )}
            </div>
          )}
          {translation.phase === "error" && translation.retry && (
            <Button
              onClick={() =>
                void requestTranslation({
                  selection: translation.selection,
                  selectionId: translation.selectionId,
                })
              }
            >
              Retry
            </Button>
          )}
          <Button appearance="subtle" onClick={dismissTranslation}>
            Dismiss
          </Button>
          <div className="bubble-status">
            <span className="dot" />
            {translation.provider === "ollama" ? "On-device translation" : translation.provider ? PROVIDER_LABELS[translation.provider] : "Translation provider unavailable"}
          </div>
        </div>
      )}
      {translation?.expanded && (
        <div
          className="translation-modal-backdrop"
          onClick={dismissTranslation}
        >
          <div
            ref={overlay as React.RefObject<HTMLDivElement>}
            className="translation-expanded"
            role="dialog"
            aria-modal="true"
            aria-label="Translation"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>German to English</h2>
            <p className="small muted">{translation.provider === "ollama" ? "On-device translation" : translation.provider ? PROVIDER_LABELS[translation.provider] : "Translation provider unavailable"}</p>
            <div className="translation-full-text">{translation.message}</div>
            <div className="translation-actions">
              <Button onClick={() => void copyTranslation()}>Copy</Button>
              <Button onClick={dismissTranslation}>Close</Button>
            </div>
          </div>
        </div>
      )}
      <Text className="reader-status" aria-live="polite" aria-atomic="true">
        {snapshot
          ? `${snapshot.label}, ${Math.round(snapshot.progress * 100)} percent`
          : "Opening book"}
      </Text>
      {error && (
        <div className="reader-error" role="alert">
          <Icon name="warning" />
          <span>{error}</span>
          {!snapshot && <Button onClick={leave}>Back to library</Button>}
          <Button
            appearance="subtle"
            className="icon-btn"
            aria-label="Dismiss reader message"
            onClick={() => {
              setError("");
              setModelNotice("");
            }}
          >
            <Icon name="close" />
          </Button>
        </div>
      )}
    </section>
  );
}
