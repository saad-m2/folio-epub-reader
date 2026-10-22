import React, { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateStatus } from "../main/updates";

type Result = { ok: true; value: UpdateStatus } | { ok: false };
const labels: Record<UpdateStatus["state"], string> = {
  unconfigured: "Online updates are not configured for this build. To update, close Leaf and run the newer installer (WindowsEpubReaderSetup.exe). Your library, reading positions, preferences, and downloaded fonts stay on this device.",
  unavailable: "Online updates are available in the installed Windows app.",
  "first-run": "Setup is finishing. Please wait a moment before checking for updates.",
  idle: "Check GitHub Releases for a newer version. If available, it will download so you can install it when ready.",
  checking: "Checking for updates…",
  downloading: "Downloading the new version… You can continue reading.",
  current: "You are up to date.",
  ready: "An update is ready. Restart Leaf to install it. Your library and preferences will be kept.",
  error: "The update could not be completed. Check your connection and try again.",
};

export function SettingsUpdates(): React.ReactElement {
  const [status, setStatus] = useState<UpdateStatus>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const result = await window.readerApi.getAppUpdateStatus() as Result;
      if (!mounted.current) return;
      if (result.ok) { setStatus(result.value); setNotice(""); }
      else setNotice("Could not read the app version or update status. Try again.");
    } catch {
      if (mounted.current) setNotice("Could not read the app version or update status. Try again.");
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [refresh]);

  async function act(install: boolean): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await (install ? window.readerApi.installAppUpdate() : window.readerApi.checkAppUpdates()) as Result;
      if (mounted.current) {
        if (result.ok) setStatus(result.value);
        else setNotice("The update action could not be completed. Please try again.");
      }
    } catch {
      if (mounted.current) setNotice("The update action could not be completed. Please try again.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const canCheck = status && ["idle", "current", "error"].includes(status.state);
  return <div className="card" style={{ maxWidth: 660, marginTop: 20 }}>
    <div className="form-row">
      <h2>App updates</h2>
      <span className="badge">{status ? `Version ${status.version}` : "Reading version…"}</span>
    </div>
    <p aria-live="polite">{status ? labels[status.state] : "Loading update status…"}</p>
    {canCheck && <button className="btn primary" disabled={busy} onClick={() => void act(false)}>Check for updates</button>}
    {(status?.state === "checking" || status?.state === "downloading") && <button className="btn primary" disabled aria-busy="true">{status.state === "checking" ? "Checking…" : "Downloading…"}</button>}
    {status?.state === "ready" && <button className="btn primary" disabled={busy} onClick={() => void act(true)}>Restart and install</button>}
    <p className="small muted">Updates are checked only when you choose. Checking downloads an available update; it is applied when you restart the app.</p>
    {notice && <div role="alert"><p>{notice}</p><button className="btn" disabled={busy} onClick={() => void refresh()}>Try again</button></div>}
  </div>;
}
