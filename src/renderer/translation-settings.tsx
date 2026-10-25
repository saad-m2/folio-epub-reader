import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CLOUD_PROVIDERS, PROVIDER_LABELS, ProviderConfigurationSchema,
  type CloudProvider, type TranslationProvider, type TranslationProvidersView,
} from "../shared/translation";
import { cloudTranslationMessage } from "./translation-ui";

type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string } };
type Props = { onCurrentChange?: (provider: TranslationProvider | null) => void };

export function TranslationSettings({ onCurrentChange }: Props): React.ReactElement {
  const [view, setView] = useState<TranslationProvidersView>();
  const [editing, setEditing] = useState<CloudProvider>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const lock = useRef(false);
  const mounted = useRef(false);
  const editButtons = useRef<Partial<Record<CloudProvider, HTMLButtonElement | null>>>({});
  const restoreFocus = useRef<CloudProvider>();
  const changed = useRef(onCurrentChange);
  changed.current = onCurrentChange;
  const apply = useCallback((next: TranslationProvidersView): void => {
    setView(next);
    changed.current?.(next.current);
  }, []);
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await window.readerApi.getTranslationProviders() as Result<TranslationProvidersView>;
      if (!mounted.current) return;
      if (result.ok) { apply(result.value); setFailure(""); }
      else setFailure(cloudTranslationMessage(result.error.code));
    } catch {
      if (mounted.current) setFailure("Could not read translation settings. Try again.");
    }
  }, [apply]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);
  useEffect(() => {
    if (busy || editing || !restoreFocus.current) return;
    editButtons.current[restoreFocus.current]?.focus();
    restoreFocus.current = undefined;
  }, [busy, editing]);

  async function act(operation: () => Promise<unknown>, success: string, closeForm?: CloudProvider): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setNotice(""); setFailure("");
    try {
      const result = await operation() as Result<TranslationProvidersView>;
      if (!mounted.current) return;
      if (result.ok) {
        apply(result.value); setNotice(success);
        if (closeForm) { restoreFocus.current = closeForm; setEditing(undefined); }
      } else setFailure(cloudTranslationMessage(result.error.code));
    } catch {
      if (mounted.current) setFailure("The provider settings could not be updated. Try again.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function save(event: React.FormEvent<HTMLFormElement>, provider: CloudProvider): void {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const config = {
      provider, apiKey: String(fields.get("apiKey") ?? "").trim(),
      ...(provider === "microsoft" && fields.get("region") ? { region: String(fields.get("region")).trim() } : {}),
    };
    // New secrets are write-only. Clear them even if validation/storage fails.
    form.reset();
    const parsed = ProviderConfigurationSchema.safeParse(config);
    if (!parsed.success) { setFailure("Check the credential and region format, then enter your details again."); return; }
    void act(() => window.readerApi.saveTranslationProvider(parsed.data), `${PROVIDER_LABELS[provider]} account saved. Your current provider selection is unchanged.`, provider);
  }

  return <section className="card translation-providers" aria-labelledby="translation-providers-title" aria-busy={busy}>
    <h2 id="translation-providers-title">Choose your translation provider</h2>
    <p className="small muted">German to English, only when you select text and press Translate. Reading always works without translation.</p>
    <p className="small">Cloud translation sends your selected text to your connected providers. If the current provider runs out, Leaf tries another connected cloud provider and stays there. Every connected cloud provider can be used for this fallback; recovered providers never take over automatically.</p>
    <p className="small muted">Use your own accounts with provider-enforced free cutoffs. A free allowance on a paid plan can incur charges. Leaf does not verify billing plans or guarantee zero charges from paid credentials.</p>
    <div className="provider-choice">
      <div><h3>Local Ollama {view?.current === "ollama" && <span className="badge">Current</span>}</h3><p className="small muted">On your device. Select this option, then explicitly load the model below. Never used as cloud fallback.</p></div>
      <button type="button" className="btn" disabled={busy || !view || view.current === "ollama"} aria-pressed={view?.current === "ollama"} onClick={() => void act(() => window.readerApi.setTranslationProvider("ollama"), "Local Ollama selected. Load the model before translating.")}>Use local Ollama</button>
    </div>
    {view?.current === null && <p role="status">Choose a provider before your next translation.</p>}
    {CLOUD_PROVIDERS.map(provider => {
      const account = view?.providers.find(item => item.provider === provider);
      const current = view?.current === provider;
      const state = account?.credentialError ? "Credentials need attention" : !account?.configured ? "Not connected" : account.availability === "available" ? "Allowance available" : account.availability === "exhausted" ? "Allowance exhausted" : "Allowance not confirmed";
      return <article className="cloud-provider" key={provider} aria-labelledby={`provider-title-${provider}`}>
        <div className="provider-choice"><div><h3 id={`provider-title-${provider}`}>{PROVIDER_LABELS[provider]} {current && <span className="badge">Current</span>}</h3><p className="small muted">{state}{account?.resetAt ? ` · Renewal: ${new Date(account.resetAt).toLocaleString()}` : ""}</p></div>
          <div className="provider-actions">
            <button ref={node => { editButtons.current[provider] = node; }} type="button" className="btn" disabled={busy || !view} aria-expanded={editing === provider} aria-controls={`provider-form-${provider}`} onClick={() => { setEditing(editing === provider ? undefined : provider); setFailure(""); }}>{editing === provider ? "Cancel" : account?.configured ? "Replace credentials" : "Connect"}<span className="sr-only"> {PROVIDER_LABELS[provider]}</span></button>
            {account?.configured && <>
              <button type="button" className="btn" disabled={busy || current || !!account.credentialError} aria-pressed={current} onClick={() => void act(() => window.readerApi.setTranslationProvider(provider), `${PROVIDER_LABELS[provider]} selected for your next translation.`)}>Use provider<span className="sr-only"> {PROVIDER_LABELS[provider]}</span></button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => void act(() => window.readerApi.checkTranslationProviderAvailability(provider), "Availability checked. An unknown or exhausted status may require checking your account with the provider. Your current provider has not changed.")}>Check availability<span className="sr-only"> {PROVIDER_LABELS[provider]}</span></button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => void act(() => window.readerApi.removeTranslationProvider(provider), `${PROVIDER_LABELS[provider]} account removed.`)}>Remove<span className="sr-only"> {PROVIDER_LABELS[provider]}</span></button>
            </>}
          </div>
        </div>
        {provider === "microsoft" && <p className="small muted">Use Microsoft Translator F0 with its enforced cutoff. Check availability sends a small fixed test phrase, never book text, and consumes a tiny amount of your allowance. It runs only when you press the button.</p>}
        {provider === "deepl" && <p className="small muted">Use DeepL API Developer with its free cutoff, or an existing API Free account. Check availability reads usage without sending text.</p>}
        {editing === provider && <form key={provider} id={`provider-form-${provider}`} className="provider-form" onSubmit={event => save(event, provider)} autoComplete="off">
          <fieldset disabled={busy}>
            <legend className="sr-only">{PROVIDER_LABELS[provider]} credentials</legend>
            <label>API key<input name="apiKey" type="password" required maxLength={512} autoComplete="new-password" spellCheck={false} /></label>
            {provider === "microsoft" && <label>Resource region (optional for global resources)<input name="region" maxLength={40} placeholder="e.g. westeurope" spellCheck={false} autoComplete="off" /></label>}
            <p className="small muted">Saved credentials are protected on this Windows device and cannot be shown again here. Connecting never translates or changes your current provider.</p>
            <button type="submit" className="btn primary">Save account</button>
          </fieldset>
        </form>}
      </article>;
    })}
    {busy && <p className="small" role="status">Updating provider settings…</p>}
    {notice && <p className="small" role="status">{notice}</p>}
    {failure && <div role="alert"><p>{failure}</p>{!view && <button type="button" className="btn" disabled={busy} onClick={() => void refresh()}>Try again</button>}</div>}
  </section>;
}
