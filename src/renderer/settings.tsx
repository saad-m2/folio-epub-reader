import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Appearance, PageLayout, ReaderMode } from "../shared/contracts";
import { AppearanceControls, Icon, ModeSwitch, PageLayoutSwitch } from "./ui";
import { SettingsUpdates } from "./settings-updates";
import { appearanceColors } from "./appearance";

export type FontEntry = {
  id: string;
  family: string;
  label: string;
  installed: boolean;
  bundled: boolean;
  license?: { name: string; url: string; copyright: string };
};
type Settings = { mode: ReaderMode; pageLayout: PageLayout; appearance: Appearance };
type ModelState =
  | "unavailable"
  | "missing"
  | "unloaded"
  | "loading"
  | "loaded"
  | "unloading"
  | "error";
type ModelStatus = { state: ModelState; reason?: string };
type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: string } };
type Props = {
  settings: Settings;
  fonts: FontEntry[];
  persist: (change: Partial<Settings>) => Promise<void>;
  downloadFont: (fontId: string) => Promise<void>;
  fontNotice: string;
  headingRef: React.RefObject<HTMLHeadingElement>;
};
const tabs = [
  ["reading", "Reading appearance"],
  ["fonts", "Font library"],
  ["translation", "Local translation"],
  ["updates", "App updates"],
  ["about", "About"],
] as const;
type Tab = (typeof tabs)[number][0];
const modelLabels: Record<ModelState, string> = {
  unavailable: "Ollama is not running",
  missing: "Translation model not installed",
  unloaded: "Translation model unloaded",
  loading: "Loading translation model…",
  loaded: "Translation model loaded",
  unloading: "Unloading translation model…",
  error: "Translation needs attention",
};
function modelError(code: string): string {
  switch (code) {
    case "SERVICE_UNAVAILABLE":
      return "Ollama is unavailable. Install and start Ollama, then check again.";
    case "MODEL_MISSING":
      return "Install the supported model using the command below, then check again.";
    case "MODEL_OUT_OF_MEMORY":
      return "There is not enough memory to load the model. Free GPU memory, then check again and retry.";
    case "MODEL_TIMEOUT":
      return "The local service took too long. Check Ollama, then try again.";
    case "MODEL_CANCELLED":
      return "The model operation was cancelled. Check its status before trying again.";
    case "MODEL_LOAD_FAILED":
      return "The model could not be loaded. Check Ollama and available memory, then try again.";
    default:
      return "Could not update the translation model. Check Ollama, then check again.";
  }
}

export function SettingsView({
  settings,
  fonts,
  persist,
  downloadFont,
  fontNotice,
  headingRef,
}: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>("reading");
  const tabList = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [downloading, setDownloading] = useState<string>();
  const downloadLock = useRef(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [model, setModel] = useState<ModelStatus>();
  const [modelBusy, setModelBusy] = useState(false);
  const modelLock = useRef(false);
  const [checking, setChecking] = useState(false);
  const checkLock = useRef(false);
  const [modelNotice, setModelNotice] = useState("");
  const installed = fonts.filter((font) => font.installed);

  async function save(change: Partial<Settings>): Promise<void> {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setSaveNotice("");
    try {
      await persist(change);
    } catch {
      setSaveNotice("Your preferences could not be saved. Try again.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  async function installFont(font: FontEntry): Promise<void> {
    if (downloadLock.current || font.installed) return;
    downloadLock.current = true;
    setDownloading(font.id);
    setDownloadNotice("");
    try {
      await downloadFont(font.id);
    } catch {
      setDownloadNotice(
        "The font could not be downloaded. Check your connection and try again.",
      );
    } finally {
      downloadLock.current = false;
      setDownloading(undefined);
    }
  }
  const refreshModel = useCallback(async (): Promise<void> => {
    if (modelLock.current || checkLock.current) return;
    checkLock.current = true;
    setChecking(true);
    try {
      const result =
        (await window.readerApi.getTranslationModelStatus()) as Result<ModelStatus>;
      if (result.ok) setModel(result.value);
      else {
        setModel({ state: "error", reason: result.error.code });
        setModelNotice(modelError(result.error.code));
      }
    } catch {
      setModel({ state: "error" });
      setModelNotice(
        "Could not check the local service. Start Ollama, then check again.",
      );
    } finally {
      checkLock.current = false;
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (tab !== "translation") return;
    void refreshModel();
    const timer = window.setInterval(() => void refreshModel(), 10_000);
    return () => window.clearInterval(timer);
  }, [tab, refreshModel]);
  async function changeModel(action: "load" | "unload"): Promise<void> {
    if (modelLock.current || checkLock.current) return;
    modelLock.current = true;
    setModelBusy(true);
    setModelNotice("");
    setModel({ state: action === "load" ? "loading" : "unloading" });
    try {
      const result = (await (action === "load"
        ? window.readerApi.loadTranslationModel()
        : window.readerApi.unloadTranslationModel())) as Result<ModelStatus>;
      if (result.ok) {
        setModel(result.value);
        setModelNotice(
          action === "load"
            ? "Model loaded. Select a passage in the reader and choose Translate when you are ready."
            : "Model unloaded. Reading remains available.",
        );
      } else {
        setModel({ state: "error", reason: result.error.code });
        setModelNotice(modelError(result.error.code));
      }
    } catch {
      setModel({ state: "error" });
      setModelNotice(
        "Could not reach the local service. Check Ollama, then try again.",
      );
    } finally {
      modelLock.current = false;
      setModelBusy(false);
      void refreshModel();
    }
  }
  function tabKey(event: React.KeyboardEvent<HTMLElement>): void {
    const current = tabs.findIndex(([id]) => id === tab);
    let index: number;
    if (event.key === "ArrowRight") index = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      index = (current + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[index][0]);
    tabList.current
      ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
      [index]?.focus();
  }
  const palette = appearanceColors(settings.appearance, window.matchMedia("(prefers-color-scheme: dark)").matches);
  const previewColors = { background: palette.background, color: palette.color };
  return (
    <main className="settings-main">
      <div className="eyebrow">Make yourself comfortable</div>
      <h1 ref={headingRef} tabIndex={-1}>
        Settings
      </h1>
      <p className="muted">
        A few thoughtful adjustments. A better place to read.
      </p>
      <nav
        className="tabs"
        role="tablist"
        aria-label="Settings sections"
        ref={tabList}
        onKeyDown={tabKey}
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            id={`settings-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        <section
          role="tabpanel"
          id="settings-panel-reading"
          aria-labelledby="settings-tab-reading"
          hidden={tab !== "reading"}
        >
          <div className="settings-grid">
            <section
              className="card"
              aria-labelledby="reading-appearance-title"
            >
              <h2 id="reading-appearance-title">Reading appearance</h2>
              <p>Find the page that feels like you.</p>
              <fieldset
                disabled={saving}
                aria-busy={saving}
                style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
              >
                <legend className="sr-only">Global reading preferences</legend>
                <div className="form-row">
                  <span className="small">Reading mode</span>
                  <ModeSwitch
                    mode={settings.mode}
                    onChange={(mode) => void save({ mode })}
                  />
                </div>
                {settings.mode === "paginated" && (
                  <div className="form-row">
                    <span className="small">Page layout</span>
                    <PageLayoutSwitch layout={settings.pageLayout} onChange={(pageLayout) => void save({ pageLayout })} />
                  </div>
                )}
                <AppearanceControls
                  appearance={settings.appearance}
                  update={(appearance) => {
                    if (
                      installed.some(
                        (font) => font.family === appearance.fontFamily,
                      )
                    )
                      void save({ appearance });
                  }}
                  fonts={Array.from(
                    new Set(installed.map((font) => font.family)),
                  )}
                />
              </fieldset>
              {saving && (
                <p className="small muted" role="status">
                  Saving preferences…
                </p>
              )}
              {saveNotice && (
                <p className="small" role="alert">
                  {saveNotice}
                </p>
              )}
            </section>
            <aside aria-label="Reading appearance preview">
              <div
                className="type-preview"
                style={{
                  ...previewColors,
                  fontFamily: `"${settings.appearance.fontFamily}", sans-serif`,
                  paddingInline: Math.min(55, settings.appearance.margin / 2),
                }}
              >
                <div className="eyebrow">A preview of your page</div>
                <h3 style={{ fontFamily: "inherit" }}>
                  A little room to read.
                </h3>
                <p
                  style={{
                    fontSize: settings.appearance.fontSize,
                    lineHeight: settings.appearance.lineHeight,
                    marginBottom: `${settings.appearance.paragraphSpacing}em`,
                  }}
                >
                  There is something about a book that invites us to slow down.
                  A quiet moment, a comfortable chair, and the promise of
                  another world.
                </p>
              </div>
              <div className="info-line">
                <Icon name="check" />
                <span>
                  Saved automatically. These preferences apply to every book.
                </span>
              </div>
              <div className="info-line">
                <Icon name="info" />
                <span>
                  The library stays dark. Your page theme only changes the
                  reading surface.
                </span>
              </div>
            </aside>
          </div>
        </section>
        <section
          role="tabpanel"
          id="settings-panel-fonts"
          aria-labelledby="settings-tab-fonts"
          hidden={tab !== "fonts"}
        >
          <h2>A good story deserves good type.</h2>
          <p className="muted small">
            The included font is ready offline. Optional fonts need a one-time
            download, then work offline too.
          </p>
          <div
            className="card"
            style={{ padding: "0 24px", marginTop: 25 }}
            aria-label="Available reading fonts"
          >
            {fonts.map((font) => (
              <article className="font-card" key={font.id}>
                <div
                  className="font-sample"
                  aria-hidden="true"
                  style={{
                    fontFamily: font.installed
                      ? `"${font.family}", sans-serif`
                      : "inherit",
                  }}
                >
                  Aa
                </div>
                <div className="font-description">
                  <h3>
                    {font.label}{" "}
                    {font.bundled && <span className="badge">Included</span>}{" "}
                    {!font.bundled && font.installed && (
                      <span className="badge">Available offline</span>
                    )}
                  </h3>
                  <p>
                    {font.bundled
                      ? "Clean, familiar, and ready from your first page."
                      : font.id === "source-serif-4"
                        ? "A warm, bookish serif for longer reads."
                        : font.id === "atkinson-hyperlegible"
                          ? "Distinct letterforms, designed for clarity."
                          : "An optional reading font."}
                  </p>
                  {font.license && (
                    <p>
                      {font.license.name}
                      <br />
                      {font.license.copyright}
                    </p>
                  )}
                  {!font.installed && <p>Download to preview this font.</p>}
                </div>
                {font.installed ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={
                      saving || settings.appearance.fontFamily === font.family
                    }
                    onClick={() =>
                      void save({
                        appearance: {
                          ...settings.appearance,
                          fontFamily: font.family,
                        },
                      })
                    }
                  >
                    <Icon name="check" />
                    {settings.appearance.fontFamily === font.family
                      ? "Selected"
                      : "Use font"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!!downloading}
                    aria-busy={downloading === font.id}
                    onClick={() => void installFont(font)}
                  >
                    <Icon name="download" />
                    {downloading === font.id ? "Downloading…" : "Download"}
                  </button>
                )}
              </article>
            ))}
            {fonts.length === 0 && (
              <p className="small muted" style={{ padding: 24 }}>
                No reading fonts are currently available. Restart the app to
                reload the font catalog.
              </p>
            )}
          </div>
          <p
            className="small"
            role={
              (downloadNotice || fontNotice).includes("could not")
                ? "alert"
                : "status"
            }
          >
            {downloadNotice || fontNotice}
          </p>
          {saveNotice && (
            <p className="small" role="alert">
              {saveNotice}
            </p>
          )}
          <div className="info-line">
            <Icon name="info" />
            <span>
              Downloads use the app’s verified font catalog. Choose Use font
              after installation to change your reading font.
            </span>
          </div>
        </section>
        <section
          role="tabpanel"
          id="settings-panel-translation"
          aria-labelledby="settings-tab-translation"
          hidden={tab !== "translation"}
        >
          <div className="settings-grid">
            <section aria-labelledby="local-translation-title">
              <h2 id="local-translation-title">
                A little help between languages.
              </h2>
              <p className="small muted">
                Translate selected German passages into English, without leaving
                your book. Entirely on your device.
              </p>
              <div className="status-box" aria-busy={modelBusy || checking}>
                <div>
                  <h3 role="status">
                    <span
                      className="dot"
                      style={{
                        background:
                          model?.state === "loaded" ? "var(--sage)" : "#c2ac7f",
                      }}
                    />
                    {model
                      ? modelLabels[model.state]
                      : "Checking local translation…"}
                  </h3>
                  <p>
                    {model?.state === "loaded"
                      ? "Ready when you ask. Text stays on your device."
                      : "Reading works normally without translation."}
                  </p>
                </div>
                {model?.state === "loaded" ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={modelBusy || checking}
                    onClick={() => void changeModel("unload")}
                  >
                    Unload model
                  </button>
                ) : model?.state === "unloaded" ? (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={modelBusy || checking}
                    onClick={() => void changeModel("load")}
                  >
                    Load model
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    disabled={modelBusy || checking}
                    onClick={() => {
                      setModelNotice("");
                      void refreshModel();
                    }}
                  >
                    {checking
                      ? "Checking…"
                      : modelBusy
                        ? "Please wait…"
                        : "Check again"}
                  </button>
                )}
              </div>
              {model &&
                (model.state === "loaded" || model.state === "unloaded") && (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={modelBusy || checking}
                    onClick={() => {
                      setModelNotice("");
                      void refreshModel();
                    }}
                  >
                    {checking ? "Checking…" : "Refresh status"}
                  </button>
                )}
              {modelNotice && (
                <p className="small" role="status">
                  {modelNotice}
                </p>
              )}
              <div className="card" style={{ marginTop: 20 }}>
                <h3>Only when you ask</h3>
                <p>
                  Select a passage, then choose Translate. Selecting text alone
                  never starts a translation or loads the model. Loading sends
                  no book text and never translates an earlier selection.
                </p>
                <p className="small muted">
                  Loading keeps the model in memory. Unload to release its
                  memory; Ollama is a shared local service and other apps may
                  also use it.
                </p>
              </div>
              <div className="info-line">
                <Icon name="leaf" />
                <span>
                  No account. No API key. No per-translation charge.
                  <br />
                  Ordinary reading never depends on the model.
                </span>
              </div>
            </section>
            <aside className="card" aria-labelledby="translation-setup-title">
              <h3 id="translation-setup-title">
                Set up once. Read at your own pace.
              </h3>
              <div className="setup-step">
                <span className="step-number">1</span>
                <div>
                  <h3>Install and start Ollama</h3>
                  <p>
                    The local service that runs your translation model.
                    Installed separately from this reader.
                  </p>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-number">2</span>
                <div>
                  <h3>Install the supported model</h3>
                  <p>
                    Tencent Hy-MT2-7B, Q4_K_M. Run this in your terminal after
                    installing Ollama:
                  </p>
                  <code>ollama pull hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M</code>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-number">3</span>
                <div>
                  <h3>Load when you need it</h3>
                  <p>
                    Use Load model here or in the reader. Unload it any time to
                    free memory. After loading, select a passage in the reader
                    and choose Translate.
                  </p>
                </div>
              </div>
              <span className="badge">German → English</span>
            </aside>
          </div>
        </section>
        <section
          role="tabpanel"
          id="settings-panel-about"
          aria-labelledby="settings-tab-about"
          hidden={tab !== "about"}
        >
          <div className="card" style={{ maxWidth: 660 }}>
            <div className="brand" style={{ padding: "0 0 20px" }}>
              <Icon name="book" />
              Leaf
            </div>
            <h2>A quieter place to read.</h2>
            <p>
              A local-first EPUB reader for Windows. Your own books, a
              remembered place, and enough room to get lost in the story.
            </p>
            <div className="form-row">
              <span className="small muted">Your library</span>
              <span className="small">Original EPUB files stay in place</span>
            </div>
            <div className="form-row">
              <span className="small muted">Reading preferences</span>
              <span className="small">Saved on this device</span>
            </div>
            <div className="form-row">
              <span className="small muted">Optional translation</span>
              <span className="small">Ollama · German to English</span>
            </div>
            <p className="small muted">
              Books and reading work offline. Translation works offline after
              installing Ollama and its supported model. Translations are
              temporary and are not saved to your book.
            </p>
          </div>
        </section>
        <section
          role="tabpanel"
          id="settings-panel-updates"
          aria-labelledby="settings-tab-updates"
          hidden={tab !== "updates"}
        >
          {tab === "updates" && <SettingsUpdates />}
        </section>
      </div>
    </main>
  );
}
