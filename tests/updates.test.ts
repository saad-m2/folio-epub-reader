import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { UpdateController, validUpdateRepository, type UpdateOptions } from "../src/main/updates";

function setup(options: Partial<UpdateOptions> = {}) {
  const updater = Object.assign(new EventEmitter(), {
    setFeedURL: vi.fn(), checkForUpdates: vi.fn(), quitAndInstall: vi.fn(),
  });
  const beforeInstall = vi.fn(async () => {});
  const controller = new UpdateController(updater, {
    version: "0.2.0", repository: "reader-owner/epub-reader", packaged: true,
    installed: true, platform: "win32", arch: "x64", beforeInstall, ...options,
  });
  return { updater, beforeInstall, controller };
}

describe("application updates", () => {
  it("does not contact or configure a feed on startup or status reads", () => {
    const { controller, updater } = setup();
    expect(controller.getStatus()).toEqual({ version: "0.2.0", state: "idle" });
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it.each(["", undefined, "https://github.com/owner/repo", "owner/../repo", "owner/repo.git", "owner/repo/extra", "owner@host/repo", "owner/repo?x", ".owner/repo", "owner/%2e%2e"])("rejects ambiguous repository configuration %s", async repository => {
    expect(validUpdateRepository(repository)).toBe(false);
    const { controller, updater } = setup({ repository });
    expect((await controller.check()).state).toBe("unconfigured");
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it.each([{ packaged: false }, { installed: false }, { platform: "linux" }, { arch: "arm64" }, { version: "../../evil" }])("disables updates outside a supported installed release: %j", async options => {
    const { controller, updater } = setup(options);
    expect((await controller.check()).state).toBe("unavailable");
    expect(updater.setFeedURL).not.toHaveBeenCalled();
  });

  it("deduplicates checks and follows actual download events", async () => {
    const { controller, updater } = setup();
    await Promise.all([controller.check(), controller.check()]);
    expect(updater.setFeedURL).toHaveBeenCalledWith({ url: "https://update.electronjs.org/reader-owner/epub-reader/win32-x64/0.2.0" });
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(controller.getStatus().state).toBe("checking");
    updater.emit("update-available");
    expect((await controller.check()).state).toBe("downloading");
    updater.emit("update-downloaded");
    expect((await controller.check()).state).toBe("ready");
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("reports current and allows a later explicit recheck", async () => {
    const { controller, updater } = setup();
    await controller.check();
    updater.emit("update-not-available");
    expect(controller.getStatus().state).toBe("current");
    await controller.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("ignores unsolicited events before a user requests a check", () => {
    const { controller, updater } = setup({ repository: "" });
    updater.emit("update-downloaded");
    updater.emit("error", new Error("private path"));
    expect(controller.getStatus().state).toBe("unconfigured");
  });

  it("redacts event errors and allows retry", async () => {
    const { controller, updater } = setup();
    await controller.check();
    updater.emit("error", new Error("private path and remote URL"));
    expect(controller.getStatus()).toEqual({ version: "0.2.0", state: "error", message: "Could not update the app. Check your connection and try again." });
    await controller.check();
    expect(controller.getStatus().state).toBe("checking");
  });

  it("handles synchronous configuration errors and asynchronous request rejection", async () => {
    const { controller, updater } = setup();
    updater.setFeedURL.mockImplementationOnce(() => { throw new Error("secret"); });
    expect((await controller.check()).state).toBe("error");
    updater.checkForUpdates.mockImplementationOnce(() => Promise.reject(new Error("secret")));
    expect((await controller.check()).state).toBe("error");
  });

  it("waits out the first-run installer lock without checking automatically", async () => {
    let now = 1_000;
    const { controller, updater } = setup({ firstRun: true, now: () => now });
    expect((await controller.check()).state).toBe("first-run");
    now = 11_000;
    expect(controller.getStatus().state).toBe("idle");
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    await controller.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("installs only a downloaded update and awaits cleanup once", async () => {
    let finishCleanup!: () => void;
    const cleanup = vi.fn(() => new Promise<void>(resolve => { finishCleanup = resolve; }));
    const { controller, updater } = setup({ beforeInstall: cleanup });
    await controller.install();
    expect(cleanup).not.toHaveBeenCalled();
    await controller.check();
    updater.emit("update-downloaded");
    const installing = controller.install();
    await controller.install();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    finishCleanup();
    await installing;
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
    await controller.install();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it("does not quit if cleanup fails", async () => {
    const { controller, updater } = setup({ beforeInstall: async () => { throw new Error("private cleanup error"); } });
    await controller.check();
    updater.emit("update-downloaded");
    expect((await controller.install()).state).toBe("error");
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    expect(controller.getStatus().message).not.toContain("private");
  });

  it("reports platform restart failures and permits a new explicit check", async () => {
    const { controller, updater } = setup();
    await controller.check();
    updater.emit("update-downloaded");
    updater.quitAndInstall.mockImplementationOnce(() => { throw new Error("private updater path"); });
    expect((await controller.install()).state).toBe("error");
    await controller.check();
    updater.emit("update-downloaded");
    await controller.install();
    updater.emit("error", new Error("private asynchronous updater failure"));
    expect(controller.getStatus().state).toBe("error");
    expect((await controller.check()).state).toBe("checking");
  });

  it("does not restart after an updater error during cleanup", async () => {
    let finishCleanup!: () => void;
    const { controller, updater } = setup({ beforeInstall: () => new Promise<void>(resolve => { finishCleanup = resolve; }) });
    await controller.check();
    updater.emit("update-downloaded");
    const installing = controller.install();
    updater.emit("error", new Error("platform update failure"));
    finishCleanup();
    expect((await installing).state).toBe("error");
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });
});
