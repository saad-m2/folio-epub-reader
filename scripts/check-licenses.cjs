const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_LICENSES = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSD-0-Clause",
  "0BSD",
  "ISC",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-3.0",
  "Unlicense",
  "Zlib",
  "BlueOak-1.0.0",
  "Python-2.0",
  "MPL-2.0",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "OFL-1.1",
  "SIL Open Font License 1.1",
]);

const BLOCKED_LICENSES = new Set([
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  "SSPL-1.0",
  "Commons Clause",
  "Proprietary",
  "Commercial",
]);

const KNOWN_EXCEPTIONS = new Map([
  ["@fluentui/react-components@9.72.5", "MIT"],
  ["@vitejs/plugin-react@4.7.0", "MIT"],
  ["epubjs@0.3.93", "BSD-2-Clause"],
  ["jszip@3.10.1", "MIT"],
  ["react@18.3.1", "MIT"],
  ["react-dom@18.3.1", "MIT"],
  ["zod@3.24.4", "MIT"],
  ["@electron-forge/cli@7.8.3", "MIT"],
  ["@electron-forge/maker-squirrel@7.8.3", "MIT"],
  ["@types/node@22.15.29", "MIT"],
  ["@types/react@18.3.20", "MIT"],
  ["@types/react-dom@18.3.7", "MIT"],
  ["electron@38.7.2", "MIT"],
  ["jsdom@30.1.1", "MIT"],
  ["typescript@5.8.3", "Apache-2.0"],
  ["vite@6.3.5", "MIT"],
  ["vitest@3.2.2", "MIT"],
  ["tslib@2.8.1", "0BSD"],
  ["pako@1.0.11", "Zlib"],
  ["caniuse-lite@1.0.30001810", "CC-BY-4.0"],
]);

const FONT_LICENSES = [
  {
    id: "liberation-sans",
    family: "Liberation Sans Reader",
    version: "2.1.5",
    license: "OFL-1.1",
    licenseName: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE",
    copyright: "Copyright 2010 Google Corporation; Copyright 2012 Red Hat, Inc.",
    status: "allowed",
    type: "bundled",
  },
  {
    id: "atkinson-hyperlegible",
    family: "Atkinson Hyperlegible Reader",
    version: "google/fonts@1b22086d13bdbbf5ec63d01a39a49246e4ac355f",
    license: "OFL-1.1",
    licenseName: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/google/fonts/blob/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/OFL.txt",
    copyright: "Copyright 2020 Braille Institute of America, Inc.",
    status: "allowed",
    type: "optional-download",
  },
  {
    id: "source-serif-4",
    family: "Source Serif 4 Reader",
    version: "google/fonts@7b203a635ebe80801c80f29633d4fc467cd1214e",
    license: "OFL-1.1",
    licenseName: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md",
    copyright: "Copyright 2014–2021 Adobe Systems Incorporated. Reserved Font Name: Source.",
    status: "allowed",
    type: "optional-download",
  },
];

function parseCompoundLicense(license) {
  return license
    .replace(/[()]/g, "")
    .split(/\s+(AND|OR)\s+/i)
    .map(l => l.trim())
    .filter(l => l && l !== "AND" && l !== "OR");
}

async function main() {
  const outputDir = path.join(__dirname, "..", "release-artifacts");
  fs.mkdirSync(outputDir, { recursive: true });

  console.log("[license-check] Running license-checker...");

  let rawOutput;
  try {
    const executable = path.join(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "license-checker.cmd" : "license-checker");
    rawOutput = execSync(`"${executable}" --json --unknown`, {
      stdio: ["pipe", "pipe", "inherit"],
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    });
  } catch (error) {
    console.error("[license-check] Failed to run license-checker:", error.message);
    process.exitCode = 1;
    return;
  }

  const deps = JSON.parse(rawOutput);
  const results = [];
  let hasBlockingIssue = false;

  for (const [depKey, depInfo] of Object.entries(deps)) {
    const licenses = (depInfo.licenses || "UNKNOWN").split(";").map(l => l.trim());
    const repo = depInfo.repository || depInfo.url || "unknown";
    const licenseFile = depInfo.licenseFile
      ? path.relative(path.join(__dirname, ".."), depInfo.licenseFile).split(path.sep).join("/")
      : "none";

    let status = "unknown";
    let reason = "";

    for (const license of licenses) {
      const parsed = parseCompoundLicense(license);
      const hasOr = license.includes(" OR ");
      const hasAnd = license.includes(" AND ");

      if (hasOr) {
        const anyAllowed = parsed.some(p => ALLOWED_LICENSES.has(p));
        const anyBlocked = parsed.some(p => BLOCKED_LICENSES.has(p));
        if (anyAllowed) {
          status = "allowed";
          break;
        }
        if (anyBlocked && !anyAllowed) {
          const blocked = parsed.find(p => BLOCKED_LICENSES.has(p));
          status = "blocked";
          reason = `Blocked license in OR clause: ${blocked}`;
          hasBlockingIssue = true;
          break;
        }
      } else if (hasAnd) {
        const allAllowed = parsed.every(p => ALLOWED_LICENSES.has(p));
        const anyBlocked = parsed.some(p => BLOCKED_LICENSES.has(p));
        if (allAllowed) {
          status = "allowed";
          break;
        }
        if (anyBlocked) {
          const blocked = parsed.find(p => BLOCKED_LICENSES.has(p));
          status = "blocked";
          reason = `Blocked license in AND clause: ${blocked}`;
          hasBlockingIssue = true;
          break;
        }
      } else {
        if (ALLOWED_LICENSES.has(license)) {
          status = "allowed";
          break;
        }
        if (BLOCKED_LICENSES.has(license)) {
          status = "blocked";
          reason = `Blocked license: ${license}`;
          hasBlockingIssue = true;
          break;
        }
      }
    }

    if (status === "unknown") {
      const exception = KNOWN_EXCEPTIONS.get(depKey);
      if (exception && ALLOWED_LICENSES.has(exception)) {
        status = "allowed (exception)";
        reason = `Exception: ${exception}`;
      } else if (depKey.startsWith("windows-epub-reader@") && licenses.includes("UNLICENSED")) {
        status = "allowed (project)";
        reason = "Private project package, not a dependency";
      } else if (licenses.includes("UNKNOWN") || licenses.includes("SEE LICENSE IN LICENSE")) {
        status = "review";
        reason = "License unknown or requires manual review";
        hasBlockingIssue = true;
      } else {
        status = "review";
        reason = `Unclassified license(s): ${licenses.join(", ")}`;
        hasBlockingIssue = true;
      }
    }

    results.push({
      name: depKey,
      version: depInfo.version,
      licenses,
      repository: repo,
      licenseFile,
      status,
      reason,
    });
  }

  const fontResults = FONT_LICENSES.map(font => ({
    name: `font:${font.id}`,
    version: font.version,
    licenses: [font.licenseName],
    repository: font.licenseUrl,
    licenseFile: "bundled",
    status: font.status,
    reason: `Font license: ${font.licenseName}`,
    fontType: font.type,
    family: font.family,
    copyright: font.copyright,
  }));

  const allResults = [...results, ...fontResults];
  const allowed = allResults.filter(r => r.status.startsWith("allowed")).length;
  const blocked = allResults.filter(r => r.status === "blocked").length;
  const review = allResults.filter(r => r.status === "review").length;

  console.log(`[license-check] Allowed: ${allowed}, Blocked: ${blocked}, Review: ${review}`);

  const report = {
    generatedAt: new Date().toISOString(),
    summary: { allowed, blocked, review, total: allResults.length, dependencies: results.length, fonts: fontResults.length },
    dependencies: results,
    fonts: fontResults,
    policy: {
      allowedLicenses: Array.from(ALLOWED_LICENSES).sort(),
      blockedLicenses: Array.from(BLOCKED_LICENSES).sort(),
      knownExceptions: Object.fromEntries(KNOWN_EXCEPTIONS),
    },
  };

  const reportPath = path.join(outputDir, "license-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("[license-check] Report written to:", reportPath);

  if (hasBlockingIssue) {
    console.error("[license-check] BLOCKING ISSUES FOUND - see license-report.json");
    process.exitCode = 1;
  } else {
    console.log("[license-check] All licenses compliant");
  }
}

main().catch(err => {
  console.error("[license-check] Fatal error:", err);
  process.exitCode = 1;
});
