const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = path.join(root, "release-artifacts");
const requiredPins = { electron: "42.11.18", epubjs: "0.3.93" };
const installer = path.join(root, "out", "make", "squirrel.windows", "x64", "WindowsEpubReaderSetup.exe");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
const problems = [];
const report = {
  generatedAt: new Date().toISOString(),
  pins: {},
  bundledFont: {},
  installer: { status: "not checked" },
  audit: { status: "not checked" },
  problems,
};

for (const [name, version] of Object.entries(requiredPins)) {
  report.pins[name] = { expected: version, actual: dependencies[name] || null };
  if (dependencies[name] !== version) problems.push(`${name} must be pinned to ${version}`);
}
for (const [name, version] of Object.entries(dependencies)) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) problems.push(`${name} is not pinned exactly`);
}
if (!fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8").includes("lockfileVersion:")) {
  problems.push("Missing or invalid pnpm lockfile");
}

const fontPath = path.join(root, "src", "renderer", "public", "fonts", "LiberationSans-Regular.ttf");
const expectedFontHash = "f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f";
const fontHash = fs.existsSync(fontPath) ? sha256(fontPath) : null;
report.bundledFont = { expectedSha256: expectedFontHash, actualSha256: fontHash };
if (fontHash !== expectedFontHash) problems.push("Bundled font hash mismatch");

if (process.argv.includes("--installer")) {
  if (!fs.existsSync(installer)) {
    report.installer = { status: "missing" };
    problems.push("Windows x64 Setup.exe missing");
  } else {
    const sizeBytes = fs.statSync(installer).size;
    report.installer = { status: "present", path: path.relative(root, installer), sizeBytes, sha256: sha256(installer) };
    if (sizeBytes === 0) problems.push("Installer is empty");
  }
}

// pnpm audit exits nonzero when it finds advisories. A failed/unavailable audit is
// not a clean scan: require a parseable advisory report before passing this gate.
const audit = spawnSync("pnpm", ["audit", "--json"], {
  cwd: root, encoding: "utf8", timeout: 60_000, shell: process.platform === "win32",
});
try {
  const data = JSON.parse(audit.stdout);
  if (!data.advisories || !data.metadata?.vulnerabilities) throw new Error("incomplete audit response");
  const advisories = Object.values(data.advisories).map(item => ({
    id: item.github_advisory_id, module: item.module_name,
    severity: item.severity, affected: item.findings?.map(f => f.version),
  }));
  report.audit = { status: "completed", scope: "production and build dependencies", advisories, counts: data.metadata.vulnerabilities };
  if (advisories.length) problems.push(`${advisories.length} dependency advisories require resolution or explicit owner approval`);
} catch {
  report.audit = { status: "unavailable", reason: audit.error?.code || `exit ${audit.status}` };
  problems.push("Production audit failed or returned an invalid report");
}

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "dependency-verification.json"), JSON.stringify(report, null, 2));
if (problems.length) {
  for (const problem of problems) console.error(`[verify-deps] ${problem}`);
  process.exitCode = 1;
} else console.log("[verify-deps] Dependency, audit, and requested artifact checks passed");

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
