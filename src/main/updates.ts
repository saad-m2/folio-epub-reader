export type UpdateState = "unconfigured" | "unavailable" | "idle" | "checking" | "downloading" | "current" | "ready" | "error" | "first-run";

export interface UpdateStatus {
  version: string;
  state: UpdateState;
  message?: string;
}

// Keep Electron behind this small interface so state and lifecycle behavior can
// be exercised without starting an application or contacting a release feed.
export interface UpdaterAdapter {
  on(event: string, listener: () => void): unknown;
  setFeedURL(options: { url: string }): void;
  checkForUpdates(): void | Promise<unknown>;
  quitAndInstall(): void;
}

export interface UpdateOptions {
  version: string;
  repository: unknown;
  packaged: boolean;
  installed: boolean;
  platform?: string;
  arch?: string;
  firstRun?: boolean;
  now?: () => number;
  beforeInstall: () => Promise<void>;
}

const FAILURE = "Could not update the app. Check your connection and try again.";

export function validUpdateRepository(repository: unknown): repository is string {
  // This is trusted build configuration, never a renderer-provided URL. Restrict
  // slugs further than GitHub allows to exclude URL/path ambiguity entirely.
  return typeof repository === "string" && repository.length <= 140
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9](?:[A-Za-z0-9_-]{0,99})$/.test(repository);
}

export class UpdateController {
  private state: UpdateState;
  private message?: string;
  private readonly now: () => number;
  private readonly firstRunUntil: number;
  private readonly feed?: string;
  private installing = false;

  constructor(private readonly updater: UpdaterAdapter, private readonly options: UpdateOptions) {
    this.now = options.now ?? Date.now;
    this.firstRunUntil = options.firstRun ? this.now() + 10_000 : 0;
    const repository = options.repository;
    if (!validUpdateRepository(repository)) {
      this.state = "unconfigured";
    } else if (!options.packaged || !options.installed || (options.platform ?? process.platform) !== "win32" || (options.arch ?? process.arch) !== "x64") {
      this.state = "unavailable";
    } else if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(options.version)) {
      this.state = "unavailable";
    } else {
      this.feed = `https://update.electronjs.org/${repository}/win32-x64/${options.version}`;
      this.state = options.firstRun ? "first-run" : "idle";
    }

    updater.on("checking-for-update", () => this.accept("checking", ["checking"]));
    updater.on("update-available", () => this.accept("downloading", ["checking"]));
    updater.on("update-not-available", () => this.accept("current", ["checking"]));
    updater.on("update-downloaded", () => this.accept("ready", ["checking", "downloading"]));
    // Never send raw updater errors, URLs, or local paths to the renderer.
    updater.on("error", () => {
      if (this.state === "checking" || this.state === "downloading" || this.installing) {
        this.installing = false;
        this.fail();
      }
    });
  }

  private accept(state: UpdateState, from: UpdateState[]): void {
    if (!from.includes(this.state)) return;
    this.state = state;
    this.message = undefined;
  }

  private fail(): void {
    this.state = "error";
    this.message = FAILURE;
  }

  getStatus(): UpdateStatus {
    if (this.state === "first-run" && this.now() >= this.firstRunUntil) this.state = "idle";
    return { version: this.options.version, state: this.state, ...(this.message ? { message: this.message } : {}) };
  }

  async check(): Promise<UpdateStatus> {
    const { state } = this.getStatus();
    if (!this.feed || this.installing || !["idle", "current", "error"].includes(state)) return this.getStatus();
    this.state = "checking";
    this.message = undefined;
    try {
      this.updater.setFeedURL({ url: this.feed });
      await this.updater.checkForUpdates();
    } catch {
      this.fail();
    }
    return this.getStatus();
  }

  async install(): Promise<UpdateStatus> {
    if (this.state !== "ready" || this.installing) return this.getStatus();
    this.installing = true;
    try {
      await this.options.beforeInstall();
      if (!this.installing || this.state !== "ready") return this.getStatus();
      this.updater.quitAndInstall();
    } catch {
      this.fail();
      this.installing = false;
    }
    return this.getStatus();
  }
}
