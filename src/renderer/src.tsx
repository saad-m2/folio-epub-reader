import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, Button, Text, webDarkTheme, makeStyles, Dialog, DialogBody, DialogSurface, DialogTitle } from "@fluentui/react-components";
import "./style.css";
import type { Appearance, LibraryBook, ReaderLocation, ReaderMode } from "../shared/contracts";
import { PublicationValidationError, validateAndExtractCover } from "./publication-validation";
import { ReaderAdapter, type ReaderSelection, type ReaderSnapshot, type TocItem } from "./reader-adapter";
if (new URLSearchParams(window.location.search).has("release-test")) void import("./release-tests");

type Route = "library" | "reader" | "settings";
type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string } };
type Settings = { mode: ReaderMode; appearance: Appearance };
type BookSession = { bookId: string; sessionId: string; archiveBytes: ArrayBuffer; metadata: { title: string; author: string }; initialLocation?: ReaderLocation };
const defaults: Settings = { mode: "continuous", appearance: { theme: "system", fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: .75, fontFamily: "Liberation Sans Reader" } };
const useStyles = makeStyles({ shell: { minHeight: "100vh", padding: "32px", backgroundColor: "#111214" }, nav: { display: "flex", gap: "12px", marginBottom: "32px" }, content: { maxWidth: "1100px", margin: "0 auto" } });
type ModelState = "unavailable" | "missing" | "unloaded" | "loading" | "loaded" | "unloading" | "error";
type ModelStatus = { state: ModelState; reason?: string };
type TranslationSurface = { phase: "loading" | "result" | "error"; message: string; selection: ReaderSelection; selectionId: string; expanded: boolean; retry: boolean };
type FontEntry = { id: string; family: string; label: string; installed: boolean; bundled: boolean; license?: { name: string; url: string; copyright: string } };
const modelLabels: Record<ModelState, string> = { unavailable: "Ollama is not running", missing: "Translation model is not installed", unloaded: "Translation model is unloaded", loading: "Loading translation model…", loaded: "Translation model is loaded", unloading: "Unloading translation model…", error: "Translation model needs attention" };
function translationMessage(code: string): string {
  switch (code) {
    case "SERVICE_UNAVAILABLE": return "Ollama is unavailable. Install and start Ollama, then check again.";
    case "MODEL_MISSING": return "Install the supported translation model in Ollama, then check again.";
    case "MODEL_UNLOADED": case "MODEL_UNEXPECTED_RELOAD": return "The model is unloaded. Use Load translation model, then select the text and click Translate again.";
    case "MODEL_OUT_OF_MEMORY": return "The model ran out of memory. Try a shorter selection or free GPU memory.";
    case "MODEL_TIMEOUT": return "Translation took too long. You can try again.";
    case "MODEL_CANCELLED": return "This selection is no longer available. Select the text again to translate it.";
    case "MODEL_INVALID_OUTPUT": return "The model did not return usable text. You can try again.";
    case "MODEL_INTERRUPTED": case "MODEL_SERVICE_ERROR": return "The local translation service was interrupted. Check Ollama and try again.";
    default: return "Translation could not finish. You can try again.";
  }
}
const retryableTranslationError = (code: string): boolean => ["MODEL_TIMEOUT", "MODEL_OUT_OF_MEMORY", "MODEL_INVALID_OUTPUT", "MODEL_INTERRUPTED", "MODEL_SERVICE_ERROR"].includes(code);
const appearanceBounds = { fontSize: [12, 36, 1], margin: [16, 120, 8], lineHeight: [1.1, 2.5, .1], paragraphSpacing: [0, 4, .1] } as const;
function AppearanceControls({ appearance, update, fonts }: { appearance: Appearance; update: (next: Appearance) => void; fonts: string[] }): React.ReactElement {
  const adjust = (key: keyof typeof appearanceBounds, direction: -1 | 1): void => {
    const [min, max, step] = appearanceBounds[key];
    update({ ...appearance, [key]: Math.min(max, Math.max(min, Number((appearance[key] + direction * step).toFixed(2)))) });
  };
  return <div className="appearance-controls">
    <label>Reader theme <select value={appearance.theme} onChange={event => update({ ...appearance, theme: event.target.value as Appearance["theme"] })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option><option value="sepia">Sepia</option></select></label>
    <label>Reading font <select value={appearance.fontFamily} onChange={event => update({ ...appearance, fontFamily: event.target.value })}>{fonts.map(font => <option key={font} value={font}>{font}</option>)}</select></label>
    {([ ["fontSize", "Text size", "px"], ["margin", "Page margins", "px"], ["lineHeight", "Line spacing", ""], ["paragraphSpacing", "Paragraph spacing", "em"] ] as const).map(([key, label, unit]) => <div className="appearance-stepper" key={key}><span>{label}: {appearance[key]}{unit}</span><div><Button aria-label={`Decrease ${label.toLowerCase()}`} disabled={appearance[key] <= appearanceBounds[key][0]} onClick={() => adjust(key, -1)}>−</Button><Button aria-label={`Increase ${label.toLowerCase()}`} disabled={appearance[key] >= appearanceBounds[key][1]} onClick={() => adjust(key, 1)}>+</Button></div></div>)}
  </div>;
}

function Toc({ items, active, go }: { items: TocItem[]; active?: string; go: (item: TocItem) => void }): React.ReactElement {
  return <ul className="toc-list">{items.map(item => <li key={item.id}><button className={active === item.id ? "toc-active" : ""} onClick={() => go(item)}>{item.label}</button>{item.children.length > 0 && <Toc items={item.children} active={active} go={go} />}</li>)}</ul>;
}

function Reader({ session, settings, fonts, saveSettings, leave, registerFlush, proof = false }: { session: BookSession; settings: Settings; fonts: FontEntry[]; saveSettings: (change: Partial<Settings>) => Promise<void>; leave: () => void; registerFlush: (flush?: () => Promise<void>) => void; proof?: boolean }): React.ReactElement {
  const host = useRef<HTMLDivElement>(null); const adapter = useRef<ReaderAdapter>(); const saveTimer = useRef<number>(); const [snapshot, setSnapshot] = useState<ReaderSnapshot>(); const [toc, setToc] = useState(false); const [appearanceOpen, setAppearanceOpen] = useState(false); const [toolbarVisible, setToolbarVisible] = useState(false); const [error, setError] = useState("");
  const [modelStatus, setModelStatus] = useState<ModelStatus>({ state: "unloaded" }); const [modelBusy, setModelBusy] = useState(false); const busyModel = useRef(false); const [modelNotice, setModelNotice] = useState("");
  const [selected, setSelected] = useState<{ selection: ReaderSelection; selectionId: string }>(); const [translation, setTranslation] = useState<TranslationSurface>();
  const selectionVersion = useRef(0); const translationVersion = useRef(0); const selectionRegistration = useRef<Promise<unknown>>(Promise.resolve()); const currentSelection = useRef<{ selection: ReaderSelection; selectionId: string }>(); const currentTranslation = useRef<TranslationSurface>();
  const toolbar = useRef<HTMLElement>(null); const toolbarTrigger = useRef<HTMLButtonElement>(null); const tocButton = useRef<HTMLButtonElement>(null); const appearanceButton = useRef<HTMLButtonElement>(null); const overlay = useRef<HTMLElement>(null);
  const lastWheelAt = useRef(-Infinity);
  const overlayOpen = toc || appearanceOpen || !!translation?.expanded;
  const showTranslation = (next?: TranslationSurface): void => { currentTranslation.current = next; setTranslation(next); };
  const dismissTranslation = (): void => { ++translationVersion.current; showTranslation(undefined); adapter.current?.clearSelection(); };
  const refreshModelStatus = useCallback(async (): Promise<void> => {
    if (busyModel.current) return;
    try { const result = await window.readerApi.getTranslationModelStatus() as Result<ModelStatus>; if (result.ok) setModelStatus(result.value); else setModelStatus({ state: "error", reason: result.error.code }); }
    catch { setModelStatus({ state: "error" }); }
  }, []);
  useEffect(() => { void refreshModelStatus(); const timer = window.setInterval(() => { void refreshModelStatus(); }, 10000); return () => window.clearInterval(timer); }, [refreshModelStatus]);
  async function changeModel(action: "load" | "unload"): Promise<void> {
    if (busyModel.current) return;
    adapter.current?.clearSelection();
    setSelected(undefined);
    dismissTranslation();
    busyModel.current = true; setModelBusy(true); setModelNotice(""); setModelStatus({ state: action === "load" ? "loading" : "unloading" });
    try {
      const result = await (action === "load" ? window.readerApi.loadTranslationModel() : window.readerApi.unloadTranslationModel()) as Result<ModelStatus>;
      if (result.ok) setModelStatus(result.value);
      else { setModelNotice(translationMessage(result.error.code)); setModelStatus({ state: "error", reason: result.error.code }); }
    } catch { setModelNotice("Could not reach the local translation service. Check Ollama and try again."); setModelStatus({ state: "error" }); }
    finally { busyModel.current = false; setModelBusy(false); void refreshModelStatus(); }
  }
  async function requestTranslation(intent?: { selection: ReaderSelection; selectionId: string }): Promise<void> {
    const active = intent ?? currentSelection.current;
    if (!active || currentSelection.current?.selectionId !== active.selectionId || adapter.current?.getSelection()?.text !== active.selection.text) return;
    const version = ++translationVersion.current;
    const surface: TranslationSurface = { phase: "loading", message: "Translating German to English…", selection: active.selection, selectionId: active.selectionId, expanded: false, retry: false };
    showTranslation(surface); setSelected(undefined);
    try {
      const status = await window.readerApi.getTranslationModelStatus() as Result<ModelStatus>;
      if (version !== translationVersion.current || currentSelection.current?.selectionId !== active.selectionId) return;
      if (!status.ok || status.value.state !== "loaded") {
        if (status.ok) setModelStatus(status.value);
        const code = !status.ok ? status.error.code : status.value.state === "unavailable" ? "SERVICE_UNAVAILABLE" : status.value.state === "missing" ? "MODEL_MISSING" : "MODEL_UNLOADED";
        showTranslation({ ...surface, phase: "error", message: translationMessage(code), retry: false });
        return;
      }
      const result = await window.readerApi.translateSelection({ sessionId: session.sessionId, selectionId: active.selectionId }) as Result<{ text: string }>;
      if (version !== translationVersion.current || currentSelection.current?.selectionId !== active.selectionId || adapter.current?.getSelection()?.text !== active.selection.text) return;
      if (result.ok) showTranslation({ ...surface, phase: "result", message: result.value.text, retry: false });
      else { showTranslation({ ...surface, phase: "error", message: translationMessage(result.error.code), retry: retryableTranslationError(result.error.code) }); void refreshModelStatus(); }
    } catch {
      if (version === translationVersion.current) showTranslation({ ...surface, phase: "error", message: "The local translation service could not be reached. Check Ollama and try again.", retry: true });
    }
  }
  async function copyTranslation(): Promise<void> {
    const result = currentTranslation.current;
    if (result?.phase !== "result") return;
    try {
      const copied = await window.readerApi.copyTranslation(session.sessionId, result.selectionId) as Result<unknown>;
      if (!copied.ok) setError("Could not copy the translation. Select the text and translate it again.");
    } catch { setError("Could not copy the translation."); }
  }
  const closeOverlay = useCallback((): boolean => {
    if (currentTranslation.current) { dismissTranslation(); return true; }
    if (appearanceOpen) { setAppearanceOpen(false); window.setTimeout(() => appearanceButton.current?.focus(), 0); return true; }
    if (toc) { setToc(false); window.setTimeout(() => tocButton.current?.focus(), 0); return true; }
    return false;
  }, [appearanceOpen, toc]);
  useEffect(() => {
    if (!translation) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      if (!target?.closest(".translation-bubble, .translation-expanded")) dismissTranslation();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [translation]);
  const navigate = useCallback((direction: "previous" | "next"): void => {
    if (settings.mode !== "paginated" || overlayOpen) return;
    const reader = adapter.current;
    if (reader) void (direction === "next" ? reader.next() : reader.previous()).catch(() => setError("Could not turn the page."));
  }, [settings.mode, overlayOpen]);
  const wheelNavigate = useCallback((deltaY: number): void => {
    if (!deltaY || settings.mode !== "paginated" || overlayOpen) return;
    const now = performance.now();
    if (now - lastWheelAt.current < 280) return;
    lastWheelAt.current = now;
    navigate(deltaY < 0 ? "previous" : "next");
  }, [navigate, overlayOpen, settings.mode]);
  useEffect(() => {
    if (!host.current) return;
    const reader = new ReaderAdapter(host.current); adapter.current = reader;
    registerFlush(async () => {
      window.clearTimeout(saveTimer.current);
      const location = reader.captureLocation();
      if (!proof && location.href) await window.readerApi.saveLocator(session.sessionId, session.bookId, location);
    });
    const unsubscribe = reader.subscribe(next => { setSnapshot(next); if (!proof) { window.clearTimeout(saveTimer.current); saveTimer.current = window.setTimeout(() => { void window.readerApi.saveLocator(session.sessionId, session.bookId, next.location); }, 300); } });
    void reader.open({ archiveBytes: session.archiveBytes, mode: settings.mode, appearance: settings.appearance, initialLocation: session.initialLocation }).then(setSnapshot).catch(() => setError("This book could not be rendered."));
    return () => { ++selectionVersion.current; ++translationVersion.current; currentSelection.current = undefined; selectionRegistration.current = selectionRegistration.current.catch(() => undefined).then(() => window.readerApi.clearTranslationSelection()); window.clearTimeout(saveTimer.current); registerFlush(undefined); unsubscribe(); void reader.close(); if (adapter.current === reader) adapter.current = undefined; };
  }, [session]);
  useEffect(() => {
    const reader = adapter.current;
    if (!reader) return;
    const stopIssue = reader.subscribeSelectionTooLong(() => setError("Select 5,000 characters or fewer to translate."));
    const stopSelection = reader.subscribeSelection(selection => {
      if (selection) setError("");
      const prior = currentSelection.current;
      if (selection && prior && selection.text === prior.selection.text && selection.cfi === prior.selection.cfi) {
        const updated = { ...prior, selection }; currentSelection.current = updated;
        if (!currentTranslation.current) setSelected(updated);
        return;
      }
      const version = ++selectionVersion.current;
      ++translationVersion.current; currentSelection.current = undefined; setSelected(undefined); showTranslation(undefined);
      if (!selection) { selectionRegistration.current = selectionRegistration.current.catch(() => undefined).then(() => window.readerApi.clearTranslationSelection()); return; }
      selectionRegistration.current = selectionRegistration.current.catch(() => undefined).then(() => window.readerApi.registerTranslationSelection({ sessionId: session.sessionId, text: selection.text, ...(selection.cfi ? { rangeCfi: selection.cfi } : {}), rects: selection.rects })).then(raw => {
        const result = raw as Result<{ selectionId: string }>;
        if (version !== selectionVersion.current || reader !== adapter.current || !result.ok) return;
        const active = { selection, selectionId: result.value.selectionId };
        currentSelection.current = active; setSelected(active);
      }).catch(() => { if (version === selectionVersion.current) setError("Could not prepare the selected text for translation."); });
    });
    return () => { stopIssue(); stopSelection(); };
  }, [session]);
  useEffect(() => {
    const reader = adapter.current;
    if (!reader) return;
    return reader.subscribeInteraction(interaction => {
      if (interaction.kind === "reader-click") {
        if (currentTranslation.current) { dismissTranslation(); return; }
        if (overlayOpen) return;
        if (settings.mode === "paginated" && interaction.zone !== "center") navigate(interaction.zone === "left" ? "previous" : "next");
        else setToolbarVisible(value => !value);
      } else if (interaction.kind === "wheel") {
        wheelNavigate(interaction.deltaY);
      } else if (interaction.kind === "key" && interaction.key === "Escape") {
        if (!closeOverlay()) leave();
      } else if (interaction.kind === "key" && settings.mode === "paginated" && !overlayOpen) {
        if (interaction.key === "ArrowLeft" || interaction.key === "PageUp" || interaction.key === " " && interaction.shiftKey) navigate("previous");
        if (interaction.key === "ArrowRight" || interaction.key === "PageDown" || (interaction.key === " " || interaction.key === "Spacebar") && !interaction.shiftKey) navigate("next");
      }
    });
  }, [session, navigate, wheelNavigate, closeOverlay, leave, overlayOpen, settings.mode]);
  useEffect(() => {
    const reader = adapter.current;
    if (!reader) return;
    return reader.subscribeExternalLink(url => {
      void window.readerApi.openExternalLink(session.sessionId, url).then(result => {
        if (!(result as Result<{ outcome: string }>).ok) setError("That external link could not be opened.");
      });
    });
  }, [session]);
  useEffect(() => {
    if (toolbar.current) toolbar.current.inert = !toolbarVisible || overlayOpen;
    if (toolbarTrigger.current) toolbarTrigger.current.inert = overlayOpen;
    if (host.current) host.current.inert = toc || appearanceOpen;
  }, [toolbarVisible, overlayOpen]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      if (settings.mode !== "paginated" || overlayOpen) return;
      event.preventDefault(); wheelNavigate(event.deltaY);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [wheelNavigate, overlayOpen, settings.mode]);
  useEffect(() => {
    if (overlayOpen) { setToolbarVisible(true); overlay.current?.querySelector<HTMLElement>("button, [href], [tabindex='0']")?.focus(); }
  }, [toc, appearanceOpen, overlayOpen]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") { event.preventDefault(); if (!closeOverlay()) leave(); return; }
      if (overlayOpen) {
        if (event.key === "Tab" && overlay.current) {
          const controls = Array.from(overlay.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex='0']"));
          const first = controls[0], last = controls.at(-1);
          if (first && last && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
            event.preventDefault(); (event.shiftKey ? last : first).focus();
          }
        }
        return;
      }
      if (settings.mode !== "paginated" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, input, textarea, select, [contenteditable='true']")) return;
      let direction: "previous" | "next" | undefined;
      if (event.key === "ArrowLeft" || event.key === "PageUp" || (event.key === " " && event.shiftKey)) direction = "previous";
      if (event.key === "ArrowRight" || event.key === "PageDown" || (event.key === " " && !event.shiftKey)) direction = "next";
      if (direction) { event.preventDefault(); navigate(direction); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOverlay, leave, navigate, overlayOpen, settings.mode]);
  useEffect(() => {
    let timer: number | undefined;
    const onResize = (): void => { window.clearTimeout(timer); timer = window.setTimeout(() => { if (adapter.current) void adapter.current.reflow(settings.appearance).catch(() => setError("The reader could not reflow this book.")); }, 180); };
    window.addEventListener("resize", onResize); return () => { window.clearTimeout(timer); window.removeEventListener("resize", onResize); };
  }, [settings.appearance]);
  async function switchMode(): Promise<void> { const mode: ReaderMode = settings.mode === "continuous" ? "paginated" : "continuous"; await saveSettings({ mode }); setSnapshot(await adapter.current!.setMode(mode, settings.appearance)); }
  async function updateAppearance(next: Appearance): Promise<void> { await saveSettings({ appearance: next }); setSnapshot(await adapter.current!.applyAppearance(next)); }
  const anchor = (translation?.selection ?? selected?.selection)?.rects[0];
  const hostHeight = host.current?.clientHeight ?? window.innerHeight;
  const hostWidth = host.current?.clientWidth ?? window.innerWidth;
  const bubbleAbove = !!anchor && anchor.y > hostHeight - anchor.y - anchor.height;
  const previewTranslation = !!translation && translation.phase === "result" && (translation.message.length > 300 || hostHeight < 450);
  const bubbleStyle: React.CSSProperties | undefined = anchor ? { left: Math.max(12, Math.min(hostWidth - 300, anchor.x)), top: bubbleAbove ? Math.max(12, anchor.y - (translation ? 210 : 48)) : Math.min(hostHeight - 48, anchor.y + anchor.height + 8) } : undefined;
  useEffect(() => {
    if (!proof) return;
    const switchForProof = (): void => { void switchMode().catch(error => setError(error instanceof Error ? error.message : "Proof mode switch failed.")); };
    window.addEventListener("reader-proof-switch", switchForProof);
    return () => window.removeEventListener("reader-proof-switch", switchForProof);
  }, [proof, settings.mode, settings.appearance]);
  return <section className={`reader theme-${settings.appearance.theme}`} data-reader-mode={settings.mode} {...(proof ? { "data-proof-session": session.sessionId } : {})}>
    <button ref={toolbarTrigger} className="reader-toolbar-trigger" aria-label="Show reader controls" onPointerEnter={() => setToolbarVisible(true)} onFocus={() => setToolbarVisible(true)} onClick={() => setToolbarVisible(true)} />
    <header ref={toolbar} className={`reader-toolbar ${toolbarVisible || overlayOpen ? "is-visible" : ""}`} aria-label="Reader controls" aria-hidden={!toolbarVisible || overlayOpen} onPointerEnter={() => setToolbarVisible(true)} onPointerLeave={() => { if (!overlayOpen && !toolbar.current?.contains(document.activeElement)) setToolbarVisible(false); }}>
      <Button onClick={leave}>Back to library</Button>
      <Button ref={tocButton} aria-expanded={toc} aria-controls="reader-toc" onClick={() => { setAppearanceOpen(false); setToc(value => !value); }}>Table of contents</Button>
      <Text className="reader-progress">{snapshot ? `${snapshot.label} · ${Math.round(snapshot.progress * 100)}%` : "Opening book..."}</Text>
      <Button onClick={() => void switchMode()}>{settings.mode === "continuous" ? "Page-by-page" : "Continuous"}</Button>
      <Button ref={appearanceButton} aria-expanded={appearanceOpen} aria-controls="reader-appearance" onClick={() => { setToc(false); setAppearanceOpen(value => !value); }}>Appearance</Button>
      <Text className="model-status" role="status">{modelLabels[modelStatus.state]}</Text>
      <Button disabled={modelBusy || modelStatus.state === "loaded"} onClick={() => void changeModel("load")}>Load translation model</Button>
      <Button disabled={modelBusy || modelStatus.state !== "loaded"} onClick={() => void changeModel("unload")}>Unload translation model</Button>
    </header>
    {overlayOpen && <div className="reader-overlay-scrim" aria-hidden="true" onClick={() => closeOverlay()} />}
    {toc && <aside id="reader-toc" ref={overlay} className="reader-overlay" role="dialog" aria-modal="true" aria-label="Table of contents">
      <Button onClick={() => closeOverlay()}>Close contents</Button>
      {snapshot?.hasNavigation ? <Toc items={snapshot.toc} active={snapshot.location.navId} go={item => void adapter.current?.goTo({ href: item.href, navId: item.id }).then(setSnapshot).then(() => closeOverlay())} /> : <Text>No table of contents is available.</Text>}
    </aside>}
    {appearanceOpen && <aside id="reader-appearance" ref={overlay} className="reader-overlay appearance-overlay" role="dialog" aria-modal="true" aria-label="Appearance settings">
      <Button onClick={() => closeOverlay()}>Close appearance</Button>
      <AppearanceControls appearance={settings.appearance} update={next => void updateAppearance(next)} fonts={Array.from(new Set([settings.appearance.fontFamily, ...fonts.filter(font => font.installed).map(font => font.family)]))} />
    </aside>}
    <div className="reader-host" ref={host} />
    {selected && !translation && anchor && <div className="translation-action" style={bubbleStyle} onPointerDown={event => event.preventDefault()}><Button appearance="primary" onClick={() => void requestTranslation(selected)}>Translate</Button></div>}
    {translation && anchor && <div className={`translation-bubble ${translation.expanded ? "is-hidden" : ""}`} style={bubbleStyle} role="status" aria-live="polite">
      <div className="translation-heading">German to English</div><div className={`translation-text ${previewTranslation ? "is-preview" : ""}`}>{translation.message}</div>
      {translation.phase === "result" && <div className="translation-actions"><Button onClick={() => void copyTranslation()}>Copy</Button>{previewTranslation && <Button onClick={() => showTranslation({ ...translation, expanded: true })}>Expand</Button>}</div>}
      {translation.phase === "error" && translation.retry && <Button onClick={() => void requestTranslation({ selection: translation.selection, selectionId: translation.selectionId })}>Retry</Button>}
      <Button appearance="subtle" onClick={dismissTranslation}>Dismiss</Button>
    </div>}
    {translation?.expanded && <div className="translation-modal-backdrop" onClick={dismissTranslation}><div ref={overlay as React.RefObject<HTMLDivElement>} className="translation-expanded" role="dialog" aria-modal="true" aria-label="Translation" onClick={event => event.stopPropagation()}><h2>German to English</h2><div className="translation-full-text">{translation.message}</div><div className="translation-actions"><Button onClick={() => void copyTranslation()}>Copy</Button><Button onClick={dismissTranslation}>Close</Button></div></div></div>}
    <Text className="reader-status" aria-live="polite" aria-atomic="true">{snapshot ? `${snapshot.label}, ${Math.round(snapshot.progress * 100)} percent` : "Opening book"}</Text>
    <Text className="reader-error" role={error || modelNotice ? "alert" : undefined}>{error || modelNotice}</Text>
  </section>;
}

function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>("library");
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [session, setSession] = useState<BookSession>();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [fonts, setFonts] = useState<FontEntry[]>([]);
  const [fontNotice, setFontNotice] = useState("");
  const [status, setStatus] = useState("");
  const [removeTarget, setRemoveTarget] = useState<LibraryBook | null>(null);
  const flushReader = useRef<() => Promise<void>>();
  const libraryHeading = useRef<HTMLHeadingElement>(null);
  const settingsHeading = useRef<HTMLHeadingElement>(null);
  const proof = new URLSearchParams(window.location.search).has("proof");
  const styles = useStyles();

  const refresh = async (): Promise<void> => { const result = await window.readerApi.listLibrary() as Result<LibraryBook[]>; if (result.ok) setBooks(result.value); };
  useEffect(() => {
    if (route === "library") libraryHeading.current?.focus();
    if (route === "settings") settingsHeading.current?.focus();
  }, [route]);
  useEffect(() => { void refresh(); void window.readerApi.getSettings().then(result => { const typed = result as Result<Settings>; if (typed.ok) setSettings(typed.value); }); }, []);
  const refreshFonts = async (): Promise<void> => { const result = await window.readerApi.listFonts() as Result<FontEntry[]>; if (result.ok) setFonts(result.value); };
  useEffect(() => { void refreshFonts(); }, []);
  useEffect(() => {
    if (!proof) return;
    void window.readerApi.openProofFixture().then(result => {
      const opened = result as Result<Omit<BookSession, "bookId">>;
      if (opened.ok) { setSession({ ...opened.value, bookId: "proof" }); setRoute("reader"); }
      else setStatus("The trusted publication proof could not be opened.");
    });
  }, [proof]);

  async function persist(change: Partial<Settings>): Promise<void> {
    const next = { ...settings, ...change, appearance: change.appearance ?? settings.appearance };
    const result = await window.readerApi.saveSettings(next) as Result<Settings>;
    if (result.ok) setSettings(result.value);
  }
  async function downloadFont(fontId: string): Promise<void> {
    setFontNotice("Downloading font…");
    try { const result = await window.readerApi.downloadFont(fontId) as Result<unknown>; setFontNotice(result.ok ? "Font installed for offline reading." : "The font could not be downloaded. Check your connection and try again."); await refreshFonts(); }
    catch { setFontNotice("The font could not be downloaded. Check your connection and try again."); }
  }

  async function addBooks(): Promise<void> {
    const selected = await window.readerApi.chooseBooks() as Result<{ cancelled: boolean; sessionId?: string; archiveBytes?: ArrayBuffer }>;
    if (!selected.ok) {
      setStatus(selected.error.code === "QUOTA_EXCEEDED"
        ? "This EPUB exceeds the 128 MiB size limit. Choose a smaller book."
        : "This EPUB could not be read. Check that the file is available and try again.");
      return;
    }
    if (selected.value.cancelled || !selected.value.sessionId || !selected.value.archiveBytes) return;
    try {
      const cover = await validateAndExtractCover(selected.value.archiveBytes);
      const metadata = await ReaderAdapter.inspect(selected.value.archiveBytes);
      let resolvedLocation: ReaderLocation | undefined;
      if (metadata.packageId) {
        const previous = await window.readerApi.getReplacementLocation(metadata.packageId) as Result<ReaderLocation | undefined>;
        if (previous.ok && previous.value) {
          resolvedLocation = await ReaderAdapter.resolveReplacement(selected.value.archiveBytes, previous.value);
        }
      }
      const committed = await window.readerApi.commitImport(
        selected.value.sessionId,
        metadata.title,
        metadata.author,
        metadata.packageId,
        cover,
        resolvedLocation
      ) as Result<unknown>;
      if (!committed.ok) throw new Error();
      await refresh();
      setStatus("Library updated.");
    } catch (error) {
      await window.readerApi.closeSession(selected.value.sessionId);
      setStatus(error instanceof PublicationValidationError ? "That EPUB uses features this reader does not support." : "That file is not a supported EPUB.");
    }
  }

  async function openBook(book: LibraryBook): Promise<void> {
    const result = await window.readerApi.openSession(book.id) as Result<Omit<BookSession, "bookId">>;
    if (!result.ok) {
      setStatus(result.error.code === "NOT_FOUND" ? "File not found." : "This book could not be opened.");
      return;
    }
    setSession({ ...result.value, bookId: book.id });
    setRoute("reader");
  }

  async function leave(): Promise<void> {
    if (session) {
      await flushReader.current?.();
      await window.readerApi.closeSession(session.sessionId);
    }
    setSession(undefined);
    setRoute("library");
    await refresh();
  }

  async function removeBook(book: LibraryBook): Promise<void> {
    await window.readerApi.removeBook(book.id);
    await refresh();
    setStatus(`${book.title} removed.`);
  }

  async function confirmRemove(): Promise<void> {
    if (removeTarget) {
      await removeBook(removeTarget);
      setRemoveTarget(null);
    }
  }

  return (
    <FluentProvider theme={webDarkTheme} className={`${styles.shell} ${route === "reader" ? "app-reading" : ""}`} style={route === "reader" ? { padding: 0, overflow: "hidden" } : undefined}>
      {route !== "reader" && <nav className={styles.nav} aria-label="Application">
        <Button onClick={() => void leave()}>Library</Button>
        <Button onClick={() => setRoute("settings")}>Settings</Button>
      </nav>}
      <main className={`${styles.content} ${route === "reader" ? "reader-main" : ""}`} style={route === "reader" ? { margin: 0, maxWidth: "none" } : undefined}>
        {route === "library" && (
          <>
            <h1 ref={libraryHeading} tabIndex={-1}>Your library</h1>
            {books.length === 0 && <Text as="p">Welcome. Add an EPUB to start reading.</Text>}
            <div className="library-grid">
              {books.map(book => (
                <article className="book-card" key={book.id}>
                  {book.cover ? <img className="cover" src={book.cover} alt="" /> : <div className="cover-fallback">EPUB</div>}
                  <Text as="h2">{book.title}</Text>
                  <Text as="p">{book.author}</Text>
                  <Text as="p">{Math.round(book.progress * 100)}%{book.missing ? " · File not found" : ""}</Text>
                  <div className="book-actions">
                    {book.missing ? (
                      <>
                        <Button appearance="primary" onClick={(e) => { e.stopPropagation(); setRemoveTarget(book); }}>Remove from library</Button>
                        <Button onClick={(e) => { e.stopPropagation(); setRemoveTarget(null); }}>Cancel</Button>
                      </>
                    ) : (
                      <><Button appearance="primary" onClick={() => void openBook(book)}>Open book</Button><Button appearance="subtle" onClick={() => setRemoveTarget(book)}>Remove</Button></>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <Button appearance="primary" onClick={() => void addBooks()}>Add books</Button>
            <Text aria-live="polite">{status}</Text>
          </>
        )}
        {route === "reader" && session && <Reader session={session} settings={settings} fonts={fonts} saveSettings={persist} leave={() => void leave()} registerFlush={flush => { flushReader.current = flush; }} proof={proof} />}
        {route === "settings" && (
          <>
            <h1 ref={settingsHeading} tabIndex={-1}>Settings</h1>
            <p>Reader preferences apply to every book. The app stays dark regardless of the reading theme.</p>
            <section className="settings-section" aria-labelledby="reading-settings-heading"><h2 id="reading-settings-heading">Reading</h2>
              <label>Reading mode <select value={settings.mode} onChange={event => void persist({ mode: event.target.value as ReaderMode })}><option value="continuous">Continuous</option><option value="paginated">Page-by-page</option></select></label>
              <AppearanceControls appearance={settings.appearance} update={appearance => void persist({ appearance })} fonts={Array.from(new Set([settings.appearance.fontFamily, ...fonts.filter(font => font.installed).map(font => font.family)]))} />
            </section>
            <section className="settings-section" aria-labelledby="font-settings-heading"><h2 id="font-settings-heading">Reading fonts</h2><p>The included font works offline. Additional fonts require a one-time download and then work offline.</p>
              {fonts.filter(font => !font.bundled).length ? <ul className="font-catalog">{fonts.filter(font => !font.bundled).map(font => <li key={font.id}><span>{font.label}{font.license ? ` · ${font.license.name}` : ""}</span>{font.installed ? <span>Installed</span> : <Button onClick={() => void downloadFont(font.id)}>Download</Button>}</li>)}</ul> : <p>No optional fonts are available yet.</p>}
              <Text role={fontNotice.includes("could not") ? "alert" : "status"}>{fontNotice}</Text>
            </section>
            <section className="settings-section" aria-labelledby="translation-settings-heading"><h2 id="translation-settings-heading">Local translation</h2><p>German-to-English translation uses Ollama and the supported Tencent Hy-MT2-7B Q4_K_M model, installed separately on this PC. Install and start Ollama, then run this command in a terminal:</p><code>ollama pull hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M</code><p>No API key is needed. Translation runs locally and only when you select text and click Translate. Use Load translation model in the reader toolbar first. If Ollama is unavailable, start it. If the model is missing, run the command above.</p></section>
          </>
        )}
        {removeTarget && (
          <Dialog open onOpenChange={(_, data) => { if (!data.open) setRemoveTarget(null); }}>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Remove book?</DialogTitle>
                {removeTarget.missing ? (
                  <Text>The file for "{removeTarget.title}" was not found at its saved location. Remove it from your library?</Text>
                ) : (
                  <Text>Remove "{removeTarget.title}" from your library? The original file will not be changed.</Text>
                )}
              </DialogBody>
              <div className="dialog-actions">
                <Button appearance="primary" onClick={() => void confirmRemove()}>Remove</Button>
                <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
              </div>
            </DialogSurface>
          </Dialog>
        )}
      </main>
    </FluentProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
