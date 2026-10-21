const { app, BrowserWindow, dialog, ipcMain, Menu, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FIXTURES = path.join(ROOT, "fixtures");
const ALLOWED_FIXTURES = new Set([
  "alice-gutenberg.epub",
  "ordinary-epub2.epub",
  "toc-and-images.epub",
  "awkward-security.epub",
]);
const blockedRequests = [];
const attemptedActions = [];

app.enableSandbox();
app.setPath("userData", path.join(app.getPath("temp"), "epub-reader-renderer-spike"));

function validSender(event) {
  const url = event.senderFrame?.url || "";
  return event.senderFrame === event.sender.mainFrame && url.startsWith("file://") && url.endsWith("/src/index.html");
}

function requireSender(event) {
  if (!validSender(event)) throw new Error("Rejected IPC from non-host frame");
}

async function readFixture(name) {
  if (!ALLOWED_FIXTURES.has(name)) throw new Error("Fixture is not allowlisted");
  const data = await fs.readFile(path.join(FIXTURES, name));
  return new Uint8Array(data);
}

async function createWindow() {
  const partition = "epub-renderer-spike";
  const isolatedSession = session.fromPartition(partition, { cache: false });
  isolatedSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  isolatedSession.setPermissionCheckHandler(() => false);
  isolatedSession.webRequest.onBeforeRequest((details, callback) => {
    const remote = /^https?:/i.test(details.url);
    if (remote) blockedRequests.push({ url: details.url, resourceType: details.resourceType });
    callback({ cancel: remote });
  });

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    show: process.env.SPIKE_AUTOMATED !== "1" && process.env.SPIKE_FOCUSED_RERUN !== "1",
    title: "EPUB renderer spike",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.webContents.on("will-frame-navigate", (event, url, isMainFrame) => {
    if (/^(https?|app):/i.test(url)) attemptedActions.push({ kind: "frame-navigation", url, isMainFrame });
    event.preventDefault();
  });
  await win.loadFile(path.join(__dirname, "index.html"));
  return win;
}

ipcMain.handle("fixture:read", async (event, name) => {
  requireSender(event);
  return readFixture(name);
});

ipcMain.handle("file:open-epub", async (event) => {
  requireSender(event);
  const result = await dialog.showOpenDialog({
    title: "Open EPUB for renderer spike",
    properties: ["openFile"],
    filters: [{ name: "EPUB books", extensions: ["epub"] }],
  });
  if (result.canceled || result.filePaths.length !== 1) return null;
  const data = await fs.readFile(result.filePaths[0]);
  return { name: path.basename(result.filePaths[0]), data: new Uint8Array(data) };
});

ipcMain.handle("selection:menu", async (event) => {
  requireSender(event);
  const win = BrowserWindow.fromWebContents(event.sender);
  Menu.buildFromTemplate([{ role: "copy" }, { type: "separator" }, { label: "Translate (spike only)", enabled: false }]).popup({ window: win });
});

ipcMain.handle("security:status", (event) => {
  requireSender(event);
  const prefs = event.sender.getLastWebPreferences();
  return {
    sandbox: prefs.sandbox,
    contextIsolation: prefs.contextIsolation,
    nodeIntegration: prefs.nodeIntegration,
    webSecurity: prefs.webSecurity,
    allowRunningInsecureContent: prefs.allowRunningInsecureContent,
    blockedRequests: [...blockedRequests],
    attemptedActions: [...attemptedActions],
  };
});

ipcMain.handle("security:reset-request-log", (event) => {
  requireSender(event);
  blockedRequests.length = 0;
  attemptedActions.length = 0;
});

ipcMain.handle("security:record-attempt", (event, attempt) => {
  requireSender(event);
  if (!attempt || typeof attempt !== "object" || typeof attempt.url !== "string" || !/^(https?|app):/i.test(attempt.url)) throw new Error("Invalid security attempt");
  attemptedActions.push({ kind: String(attempt.kind || "publication-api"), url: attempt.url, isMainFrame: false });
});

app.whenReady().then(async () => {
  const win = await createWindow();
  if (process.env.SPIKE_AUTOMATED === "1") {
    try {
      const results = await win.webContents.executeJavaScript("window.__spike.runAutomatedEvidence()", true);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      await fs.writeFile(path.join(ROOT, "evidence", "smoke-results.json"), JSON.stringify(results, null, 2));
      await win.webContents.capturePage().then(image => fs.writeFile(path.join(ROOT, "evidence", "harness.png"), image.toPNG()));
      console.log(JSON.stringify(results, null, 2));
      app.exit(results.every(item => item.result === "PASS") ? 0 : 1);
    } catch (error) {
      console.error(error);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      await fs.writeFile(path.join(ROOT, "evidence", "automation-error.txt"), error?.stack || String(error));
      app.exit(1);
    }
  } else if (process.env.SPIKE_FOCUSED_RERUN === "1") {
    try {
      const results = await win.webContents.executeJavaScript("window.__spike.runFocusedRerunEvidence()", true);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      await fs.writeFile(path.join(ROOT, "evidence", "focused-rerun-results.json"), JSON.stringify(results, null, 2));
      await win.webContents.capturePage().then(image => fs.writeFile(path.join(ROOT, "evidence", "focused-rerun.png"), image.toPNG()));
      console.log(JSON.stringify(results, null, 2));
      app.exit(results.contracts.every(contract => contract.result !== "FAIL") ? 0 : 1);
    } catch (error) {
      console.error(error);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      let trace;
      try { trace = await win.webContents.executeJavaScript("window.__spike?.getFocusedTrace?.()", true); } catch (traceError) { trace = { traceReadError: traceError?.message || String(traceError) }; }
      await fs.writeFile(path.join(ROOT, "evidence", "focused-rerun-error.txt"), JSON.stringify({ error: error?.stack || String(error), trace }, null, 2));
      app.exit(1);
    }
  } else if (process.env.SPIKE_SETTLED_APPEARANCE === "1") {
    try {
      const result = await win.webContents.executeJavaScript("window.__spike.runSettledAppearanceProbe()", true);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      await fs.writeFile(path.join(ROOT, "evidence", "settled-appearance-results.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      app.exit(result.result === "BEHAVIORAL_PASS" ? 0 : 1);
    } catch (error) {
      console.error(error);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      let trace;
      try { trace = await win.webContents.executeJavaScript("window.__spike?.getFocusedTrace?.()", true); } catch (traceError) { trace = { traceReadError: traceError?.message || String(traceError) }; }
      await fs.writeFile(path.join(ROOT, "evidence", "settled-appearance-error.json"), JSON.stringify({ error: error?.stack || String(error), trace }, null, 2));
      app.exit(1);
    }
  } else if (process.env.SPIKE_TARGETED_RERUN === "1") {
    try {
      const result = await win.webContents.executeJavaScript("window.__spike.runTargetedRerunEvidence()", true);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      await fs.writeFile(path.join(ROOT, "evidence", "spike003-targeted-rerun-results.json"), JSON.stringify(result, null, 2));
      await win.webContents.capturePage().then(image => fs.writeFile(path.join(ROOT, "evidence", "spike003-targeted-rerun.png"), image.toPNG()));
      console.log(JSON.stringify(result, null, 2));
      app.exit(result.contracts.every(contract => !["FAIL", "BEHAVIORAL_FAIL"].includes(contract.result)) ? 0 : 1);
    } catch (error) {
      console.error(error);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      let trace;
      try { trace = await win.webContents.executeJavaScript("window.__spike?.getFocusedTrace?.()", true); } catch (traceError) { trace = { traceReadError: traceError?.message || String(traceError) }; }
      await fs.writeFile(path.join(ROOT, "evidence", "spike003-targeted-rerun-error.json"), JSON.stringify({ error: error?.stack || String(error), trace }, null, 2));
      app.exit(1);
    }
  } else if (process.env.SPIKE_FIXTURE) {
    const fixture = process.env.SPIKE_FIXTURE;
    const safeName = fixture.replace(/[^a-z0-9-]/gi, "-");
    try {
      if (!ALLOWED_FIXTURES.has(fixture)) throw new Error("Fixture is not allowlisted");
      const navigateToc = process.env.SPIKE_TOC === "1";
      const paginate = process.env.SPIKE_MODE === "paginated";
      const nextPage = process.env.SPIKE_NEXT === "1";
      const keyPage = process.env.SPIKE_KEY === "1";
      const scenarioSuffix = navigateToc ? "-toc" : keyPage ? "-paginated-key" : nextPage ? "-paginated-next" : paginate ? "-paginated" : "";
      const probe = await win.webContents.executeJavaScript(`Promise.race([
        window.__spike.loadFixture(${JSON.stringify(fixture)}, false).then(async () => {
          await new Promise(resolve => setTimeout(resolve, 700));
          const toc = document.querySelector("#toc");
          ${navigateToc ? "toc.value = toc.options[toc.options.length - 1].value; toc.dispatchEvent(new Event('change')); await new Promise(resolve => setTimeout(resolve, 900));" : ""}
          ${paginate ? "await window.__spike.switchMode(); await new Promise(resolve => setTimeout(resolve, 700));" : ""}
          ${nextPage ? "document.querySelector('#next').click(); await new Promise(resolve => setTimeout(resolve, 1200));" : ""}
          ${keyPage ? "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await new Promise(resolve => setTimeout(resolve, 1200));" : ""}
          return { result: "PASS", state: window.__spike.getState(), tocEntries: toc.options.length - 1, selectedToc: toc.value, status: document.querySelector("#status").textContent };
        }),
        new Promise(resolve => setTimeout(() => resolve({ result: "FAIL", evidence: "Timed out after 20 seconds" }), 20000))
      ])`, true);
      await fs.mkdir(path.join(ROOT, "evidence"), { recursive: true });
      await fs.writeFile(path.join(ROOT, "evidence", `probe-${safeName}${scenarioSuffix}.json`), JSON.stringify(probe, null, 2));
      await win.webContents.capturePage().then(image => fs.writeFile(path.join(ROOT, "evidence", `probe-${safeName}${scenarioSuffix}.png`), image.toPNG()));
      console.log(JSON.stringify(probe, null, 2));
      app.exit(probe.result === "PASS" ? 0 : 1);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  }
});

app.on("window-all-closed", () => app.quit());
