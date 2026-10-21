const { app, BrowserWindow, ipcMain, session, screen } = require("electron");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const FIXTURE = path.join(ROOT, "..", "renderer", "fixtures", "toc-and-images.epub");
const EVIDENCE = path.join(ROOT, "evidence");
const ATTEMPT = new Date().toISOString().replace(/[:.]/g, "-");
const attemptFiles = name => path.join(EVIDENCE, `attempt-${ATTEMPT}-${name}`);
const runtime = { pageLoadStartedAt: null, pageLoadCompletedAt: null, rendererReadyAt: null, readySignal: false, probeStarted: false, viewOpen: false, lastCheckpoint: null, checkpoints: [], rendererConsole: [], rendererErrors: [], rejectedPromises: [], foliateErrors: [] };

app.enableSandbox();
app.setPath("userData", path.join(app.getPath("temp"), "epub-reader-foliate-spike"));

function requireHost(event) {
  const frame = event.senderFrame;
  if (frame !== event.sender.mainFrame || !frame.url.endsWith("/src/index.html")) throw new Error("Rejected non-host IPC");
}

function sha256(file) {
  return crypto.createHash("sha256").update(fsSync.readFileSync(file)).digest("hex");
}

function git(args) {
  try { return execFileSync("git", args, { cwd: path.join(ROOT, "..", ".."), encoding: "utf8" }).trim(); } catch (error) { return `unavailable: ${error.message}`; }
}

async function provenance() {
  const files = [FIXTURE, path.join(ROOT, "pnpm-lock.yaml"), __filename, path.join(__dirname, "preload.cjs"), path.join(__dirname, "renderer.js"), path.join(__dirname, "index.html")];
  const hashes = Object.fromEntries(files.map(file => [path.relative(path.join(ROOT, "..", ".."), file), sha256(file)]));
  let foliateCommit = "unavailable";
  try { foliateCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.join(ROOT, "vendor", "foliate-js"), encoding: "utf8" }).trim(); } catch {}
  return {
    attemptId: ATTEMPT,
    command: process.argv.join(" "),
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
    repositoryRevision: git(["rev-parse", "HEAD"]),
    repositoryDirtySummary: git(["status", "--short"]),
    os: { platform: process.platform, release: os.release(), version: os.version(), arch: process.arch, hostname: os.hostname() },
    runtimeVersions: { node: process.versions.node, electron: process.versions.electron, chromium: process.versions.chrome, v8: process.versions.v8, hostNode: process.env.npm_node_execpath || process.execPath, pnpm: process.env.npm_config_user_agent || null },
    foliateCommit,
    pinnedElectron: "38.7.2",
    sourceHashesSha256: hashes,
    fixture: { path: path.relative(path.join(ROOT, "..", ".."), FIXTURE), sha256: sha256(FIXTURE), bytes: fsSync.statSync(FIXTURE).size },
    commandLine: { argv: process.argv, switches: process.commandLine ? process.commandLine : [] },
  };
}

async function writeJson(name, value) {
  await fs.mkdir(EVIDENCE, { recursive: true });
  await fs.writeFile(attemptFiles(name), JSON.stringify(value, null, 2));
}

async function appendCheckpoint(checkpoint) {
  runtime.lastCheckpoint = checkpoint;
  runtime.checkpoints.push(checkpoint);
  await fs.mkdir(EVIDENCE, { recursive: true });
  await fs.appendFile(attemptFiles("checkpoints.ndjson"), `${JSON.stringify(checkpoint)}\\n`);
  await fs.writeFile(attemptFiles("checkpoint-latest.json"), JSON.stringify(checkpoint, null, 2));
}

function securitySnapshot(win, isolated) {
  return {
    sandbox: true,
    contextIsolation: win.webContents.getLastWebPreferences?.().contextIsolation ?? true,
    nodeIntegration: win.webContents.getLastWebPreferences?.().nodeIntegration ?? false,
    webSecurity: win.webContents.getLastWebPreferences?.().webSecurity ?? true,
    allowRunningInsecureContent: win.webContents.getLastWebPreferences?.().allowRunningInsecureContent ?? false,
    windowOpen: "deny",
    willNavigate: "preventDefault",
    permissions: "denied",
    https: "canceled",
    partition: isolated.getStoragePath?.() ?? "foliate-candidate-spike",
  };
}

async function createWindow() {
  const partition = "foliate-candidate-spike";
  const isolated = session.fromPartition(partition, { cache: false });
  isolated.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  isolated.setPermissionCheckHandler(() => false);
  isolated.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^https?:/i.test(details.url) }));
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  ipcMain.once("renderer:ready", event => { requireHost(event); runtime.rendererReadyAt = Date.now(); runtime.readySignal = true; void appendCheckpoint({ phase: "page-ready", atMs: 0, details: { url: event.senderFrame.url }, diagnostics: { readySignal: true }, relocations: [] }); readyResolve(); });
  const win = new BrowserWindow({
    show: process.env.SPIKE_FOLIATE_APPEARANCE !== "1",
    width: 1200,
    height: 820,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), partition, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, backgroundThrottling: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", event => event.preventDefault());
  win.webContents.on("console-message", (_event, details) => {
    runtime.rendererConsole.push({ level: details.level, message: details.message, line: details.line, sourceId: details.sourceId, at: new Date().toISOString() });
  });
  win.webContents.on("render-process-gone", (_event, details) => runtime.rendererErrors.push({ type: "render-process-gone", details }));
  runtime.pageLoadStartedAt = Date.now();
  await win.loadFile(path.join(__dirname, "index.html"));
  runtime.pageLoadCompletedAt = Date.now();
  await Promise.race([ready, new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for narrow renderer:ready signal")), 12000))]);
  const trivialExpression = await win.webContents.executeJavaScript("({ ready: true, title: document.title, href: location.href })", true);
  return { win, isolated, startup: { pageLoadStartedAt: runtime.pageLoadStartedAt, pageLoadCompletedAt: runtime.pageLoadCompletedAt, rendererReadyAt: runtime.rendererReadyAt, pageLoadDurationMs: runtime.pageLoadCompletedAt - runtime.pageLoadStartedAt, rendererReadyDurationMs: runtime.rendererReadyAt - runtime.pageLoadStartedAt, trivialExpression, gpuFeatureStatus: app.getGPUFeatureStatus(), display: screen.getPrimaryDisplay(), security: securitySnapshot(win, isolated), commandLine: process.argv } };
}

ipcMain.handle("fixture:read", async event => { requireHost(event); return new Uint8Array(await fs.readFile(FIXTURE)); });
ipcMain.on("renderer:ready", event => requireHost(event));
ipcMain.handle("probe:checkpoint", async (event, checkpoint) => {
  requireHost(event);
  if (!checkpoint || typeof checkpoint.phase !== "string") throw new Error("Rejected malformed probe checkpoint");
  runtime.viewOpen = checkpoint.diagnostics?.viewOpen === true || runtime.viewOpen;
  await appendCheckpoint({ ...checkpoint, receivedAt: new Date().toISOString() });
  return { accepted: true };
});
ipcMain.handle("appearance:screenshot", async (event, phase) => {
  requireHost(event);
  if (!["before", "after"].includes(phase)) throw new Error("Rejected screenshot phase");
  const image = await event.sender.capturePage();
  const file = attemptFiles(`appearance-${phase}.png`);
  await fs.mkdir(EVIDENCE, { recursive: true });
  await fs.writeFile(file, image.toPNG());
  return path.basename(file);
});

app.whenReady().then(async () => {
  const manifest = await provenance();
  await writeJson("provenance.json", manifest);
  let win;
  try {
    const created = await createWindow();
    win = created.win;
    const startup = created.startup;
    await writeJson("startup.json", startup);
    if (process.env.SPIKE_FOLIATE_APPEARANCE !== "1") return;
    runtime.probeStarted = true;
    const result = await win.webContents.executeJavaScript("window.__foliateSpike.runAppearanceProbe()", true);
    result.provenanceAttemptId = ATTEMPT;
    result.startup = startup;
    result.terminal = { phase: runtime.lastCheckpoint?.phase || null, checkpoints: runtime.checkpoints.length, rendererConsole: runtime.rendererConsole, rendererErrors: runtime.rendererErrors, rejectedPromises: runtime.rejectedPromises, foliateErrors: runtime.foliateErrors };
    result.classification = result.classification || result.result;
    await writeJson("behavioral-results.json", result);
    console.log(JSON.stringify(result, null, 2));
    app.exit(result.classification === "BEHAVIORAL_PASS" ? 0 : 1);
  } catch (error) {
    const classification = runtime.pageLoadCompletedAt && runtime.readySignal && runtime.probeStarted ? "BEHAVIORAL_FAIL" : "NON_EXECUTION";
    const report = { classification, error: error?.stack || String(error), failureCategory: error?.spikeFailureCategory || (runtime.probeStarted ? "probe execution" : "startup"), phase: runtime.lastCheckpoint?.phase || (runtime.probeStarted ? "probe execution" : runtime.pageLoadCompletedAt ? "renderer qualification" : "electron startup"), lastCompletedPhase: runtime.lastCheckpoint?.phase || null, lastCheckpoint: runtime.lastCheckpoint, rendererDetails: error?.spikeDetails || null, runtime, attemptId: ATTEMPT, provenance: manifest };
    await writeJson("behavioral-error.json", report);
    console.error(error);
    app.exit(classification === "BEHAVIORAL_FAIL" ? 1 : 2);
  }
});

app.on("window-all-closed", () => app.quit());
