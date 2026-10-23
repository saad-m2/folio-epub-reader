import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "../src/renderer/settings";
import type { UpdateStatus } from "../src/main/updates";

describe("in-app update controls", () => {
  let root: Root;
  let container: HTMLDivElement;
  let status: UpdateStatus;
  const check = vi.fn(async () => ({ ok: true, value: status = { ...status, state: "checking" } }));
  const install = vi.fn(async () => ({ ok: true, value: status }));

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    status = { version: "0.2.1", state: "idle" };
    check.mockClear();
    install.mockClear();
    vi.stubGlobal("readerApi", {
      getAppUpdateStatus: vi.fn(async () => ({ ok: true, value: status })),
      checkAppUpdates: check,
      installAppUpdate: install,
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(React.createElement(SettingsView, {
      settings: { mode: "continuous", pageLayout: "single", appearance: { theme: "light", fontSize: 18, margin: 48, lineHeight: 1.55, paragraphSpacing: 0.75, fontFamily: "Liberation Sans Reader" } },
      fonts: [], persist: vi.fn(), downloadFont: vi.fn(), fontNotice: "", headingRef: createRef<HTMLHeadingElement>(),
    })));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function openUpdates(): Promise<void> {
    await act(async () => container.querySelector<HTMLButtonElement>("#settings-tab-updates")!.click());
  }
  const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("#settings-panel-updates button")).find(item => item.textContent === text)!;

  it("provides an explicit check/download action and restart only after download", async () => {
    await openUpdates();
    expect(container.querySelector("#settings-panel-updates")!.hasAttribute("hidden")).toBe(false);
    expect(container.textContent).toContain("Version 0.2.1");
    expect(check).not.toHaveBeenCalled();
    await act(async () => { button("Check for updates").click(); button("Check for updates")?.click(); });
    expect(check).toHaveBeenCalledTimes(1);
    expect(button("Checking…").disabled).toBe(true);
    status = { ...status, state: "downloading" };
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(button("Downloading…").disabled).toBe(true);
    expect(button("Restart and install")).toBeUndefined();
    status = { ...status, state: "ready" };
    await act(async () => { vi.advanceTimersByTime(2000); });
    await act(async () => button("Restart and install").click());
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("offers a retry after a failed update and never checks through status polling", async () => {
    await openUpdates();
    status = { ...status, state: "error" };
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(container.textContent).toContain("Check your connection and try again.");
    expect(check).not.toHaveBeenCalled();
    await act(async () => button("Check for updates").click());
    expect(check).toHaveBeenCalledTimes(1);
  });
});
