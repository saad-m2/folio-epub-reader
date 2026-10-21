const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const main = fs.readFileSync(path.join(__dirname, "..", "src", "main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "..", "src", "preload.cjs"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");

test("BrowserWindow retains hardened Electron settings", () => {
  for (const expected of ["sandbox: true", "contextIsolation: true", "nodeIntegration: false", "webSecurity: true", "allowRunningInsecureContent: false"]) assert.match(main, new RegExp(expected));
});

test("preload exposes a narrow intent-level API and no generic IPC", () => {
  assert.match(preload, /readFixture/);
  assert.match(preload, /openEpub/);
  assert.doesNotMatch(preload, /send:\s*\(/);
  assert.doesNotMatch(preload, /invoke:\s*\(/);
});

test("host CSP denies network connections, objects, and forms", () => {
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /form-action 'none'/);
});

