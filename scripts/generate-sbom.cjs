const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const FONT_INVENTORY = [
  {
    id: "liberation-sans",
    family: "Liberation Sans Reader",
    label: "Liberation Sans",
    version: "2.1.5",
    type: "bundled",
    origin: "https://github.com/liberationfonts/liberation-fonts",
    sha256: "f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f",
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE",
      copyright: "Copyright 2010 Google Corporation; Copyright 2012 Red Hat, Inc.",
    },
    status: "shipped",
  },
  {
    id: "atkinson-hyperlegible",
    family: "Atkinson Hyperlegible Reader",
    label: "Atkinson Hyperlegible",
    version: "google/fonts@1b22086d13bdbbf5ec63d01a39a49246e4ac355f",
    type: "optional-download",
    origin: "https://raw.githubusercontent.com/google/fonts/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Regular.ttf",
    sha256: "7fb917c89019896d0b52ee84b7cbb3304c18cb90b19a62f5e32712bd23e97669",
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://github.com/google/fonts/blob/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/OFL.txt",
      copyright: "Copyright 2020 Braille Institute of America, Inc.",
    },
    status: "cataloged",
    note: "Catalog pin only - downloaded at runtime, hash verified on install",
  },
  {
    id: "source-serif-4",
    family: "Source Serif 4 Reader",
    label: "Source Serif 4",
    version: "google/fonts@7b203a635ebe80801c80f29633d4fc467cd1214e",
    type: "optional-download",
    origin: "https://raw.githubusercontent.com/google/fonts/7b203a635ebe80801c80f29633d4fc467cd1214e/ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf",
    sha256: "97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b",
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md",
      copyright: "Copyright 2014–2021 Adobe Systems Incorporated. Reserved Font Name: Source.",
    },
    status: "cataloged",
    note: "Catalog pin only - downloaded at runtime, hash verified on install",
  },
];

async function runCycloneDx(args) {
  try {
    // pnpm's generator follows the actual lockfile, including overrides and
    // artifact integrity. npm ls misidentifies pnpm's hoisted tree as invalid.
    execSync(`pnpm sbom --sbom-format cyclonedx --sbom-spec-version 1.6 --sbom-type application ${args}`, {
      stdio: ["pipe", "pipe", "inherit"],
      cwd: path.join(__dirname, ".."),
    });
    return true;
  } catch (error) {
    console.error("[sbom] CycloneDX generation failed:", error.message);
    return false;
  }
}

async function main() {
  const outputDir = path.join(__dirname, "..", "release-artifacts");
  fs.mkdirSync(outputDir, { recursive: true });

  const sbomPath = path.join(outputDir, "sbom.json");
  const sbomCdxPath = path.join(outputDir, "sbom.cdx.json");

  console.log("[sbom] Generating CycloneDX SBOM (all deps)...");

  const ok1 = await runCycloneDx(`--out "${sbomCdxPath}"`);
  if (!ok1) {
    process.exitCode = 1;
    return;
  }
  console.log("[sbom] CycloneDX SBOM written to:", sbomCdxPath);

  console.log("[sbom] Generating CycloneDX SBOM (production only)...");
  const ok2 = await runCycloneDx(`--out "${sbomPath}" --prod`);
  if (!ok2) {
    process.exitCode = 1;
    return;
  }
  console.log("[sbom] Production SBOM written to:", sbomPath);

  const cdx = JSON.parse(fs.readFileSync(sbomCdxPath, "utf8"));
  const components = flattenComponents(cdx.components || []);
  console.log("[sbom] Total components (including dev):", components.length);

  const productionCdx = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
  const prodComponents = flattenComponents(productionCdx.components || []);
  console.log("[sbom] Production components:", prodComponents.length);

  const localPatch = { path: 'patches/epubjs@0.3.93.patch', sha256: createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'patches/epubjs@0.3.93.patch'))).digest('hex') };
  for (const list of [components, prodComponents]) {
    const engine = list.find(component => component.name === 'epubjs' && component.version === '0.3.93');
    if (!engine) throw new Error('Patched epub.js absent from SBOM');
    engine.properties = [...(engine.properties || []),
      { name: 'e06:local-patch:path', value: localPatch.path },
      { name: 'e06:local-patch:sha256', value: localPatch.sha256 }];
  }
  fs.writeFileSync(sbomCdxPath, JSON.stringify(cdx, null, 2));
  fs.writeFileSync(sbomPath, JSON.stringify(productionCdx, null, 2));

  const fontComponents = FONT_INVENTORY.map(font => ({
    type: "font",
    name: font.id,
    version: font.version,
    family: font.family,
    label: font.label,
    fontType: font.type,
    origin: font.origin,
    sha256: font.sha256,
    license: font.license,
    status: font.status,
    note: font.note,
  }));

  const summary = {
    generatedAt: new Date().toISOString(),
    specVersion: cdx.specVersion || "1.6",
    totalComponents: components.length,
    productionComponents: prodComponents.length,
    fontComponents: fontComponents.length,
    localPatches: [localPatch],
    components: prodComponents.map(c => ({
      name: c.group ? `${c.group}/${c.name}` : c.name,
      version: c.version,
      purl: c.purl,
      licenses: c.licenses?.map(l => l.license?.id || l.license?.name || l.expression).filter(Boolean) || [],
      hashes: c.hashes || c.externalReferences?.filter(r => r.type === "distribution").flatMap(r => r.hashes || []) || [],
      provenance: c.externalReferences || [],
      supplier: c.supplier ? { name: c.supplier.name, url: c.supplier.url } : null,
    })),
    fonts: fontComponents,
  };

  const summaryPath = path.join(outputDir, "sbom-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log("[sbom] Summary written to:", summaryPath);

  const fontInventoryPath = path.join(outputDir, "font-inventory.json");
  fs.writeFileSync(fontInventoryPath, JSON.stringify({ generatedAt: new Date().toISOString(), fonts: fontComponents }, null, 2));
  console.log("[sbom] Font inventory written to:", fontInventoryPath);
}

function flattenComponents(components) {
  return components.flatMap(component => [component, ...flattenComponents(component.components || [])]);
}

main().catch(err => {
  console.error("[sbom] Fatal error:", err);
  process.exitCode = 1;
});
