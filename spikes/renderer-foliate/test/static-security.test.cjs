const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const main = fs.readFileSync(path.join(__dirname, "..", "src", "main.cjs"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
test("Foliate candidate retains Electron hardening", () => {
  for (const setting of ["sandbox: true", "contextIsolation: true", "nodeIntegration: false", "webSecurity: true"]) assert.match(main, new RegExp(setting));
});
test("host CSP denies scripts from publication content and network", () => {
  assert.match(html, /script-src 'self'/);
  assert.match(html, /connect-src 'none'/);
});
