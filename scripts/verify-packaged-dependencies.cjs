const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const asar = require('@electron/asar');

const root = path.resolve(__dirname, '..');
const archive = path.join(root, 'out/windows-epub-reader-win32-x64/resources/app.asar');
const sbom = JSON.parse(fs.readFileSync(path.join(root, 'release-artifacts/sbom.cdx.json'), 'utf8'));
const licenses = JSON.parse(fs.readFileSync(path.join(root, 'release-artifacts/license-report.json'), 'utf8'));
const known = new Map(sbom.components.map(c => [`${c.group ? c.group + '/' : ''}${c.name}@${c.version}`, c]));
const licenseMap = new Map(licenses.dependencies.map(c => [c.name, c]));
const problems = [], packages = [];
const patch = { path: 'patches/epubjs@0.3.93.patch', sha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'patches/epubjs@0.3.93.patch'))).digest('hex'), files: [] };
for (const relative of ['src/managers/default/index.js', 'src/managers/continuous/index.js', 'lib/managers/default/index.js', 'lib/managers/continuous/index.js']) {
  const entry = path.join('node_modules', 'epubjs', relative);
  const shipped = asar.extractFile(archive, entry);
  if (!shipped.equals(fs.readFileSync(path.join(root, entry)))) problems.push(`Packaged epub.js patch mismatch: ${relative}`);
  patch.files.push({ file: relative, sha256: createHash('sha256').update(shipped).digest('hex') });
}
for (const entry of asar.listPackage(archive)) {
  if (!/\/node_modules\/(?:@[^/]+\/)?[^/]+\/package.json$/.test(entry.replaceAll('\\', '/'))) continue;
  const bytes = asar.extractFile(archive, entry.slice(1));
  const pkg = JSON.parse(bytes);
  const id = `${pkg.name}@${pkg.version}`;
  const component = known.get(id), license = licenseMap.get(id);
  if (!component) problems.push(`${id} is not in the locked SBOM`);
  if (!license?.status.startsWith('allowed')) problems.push(`${id} lacks an allowed license record`);
  packages.push({ name: pkg.name, version: pkg.version, archiveEntry: entry.replaceAll('\\', '/'),
    manifestSha256: createHash('sha256').update(bytes).digest('hex'),
    licenses: license?.licenses ?? [], provenance: component?.externalReferences ?? [] });
}
if (!packages.some(p => p.name === 'zod')) problems.push('Packaged runtime dependencies were not found');
const font = asar.extractFile(archive, path.join('dist', 'renderer', 'fonts', 'LiberationSans-Regular.ttf'));
const fontHash = createHash('sha256').update(font).digest('hex');
if (fontHash !== 'f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f') problems.push('Packaged font hash mismatch');
let supplementaryTranslationEvidence;
const translationEvidencePath = path.join(root, 'release-artifacts/real-ollama.json');
if (fs.existsSync(translationEvidencePath)) {
  const evidence = JSON.parse(fs.readFileSync(translationEvidencePath, 'utf8'));
  const matches = evidence.artifact?.matchedCompiledFiles?.every(file => createHash('sha256').update(asar.extractFile(archive, path.normalize(file.file))).digest('hex') === file.sha256);
  supplementaryTranslationEvidence = { path: 'release-artifacts/real-ollama.json', passed: evidence.passed, compiledGatewayUnchanged: matches === true };
}
const report = { generatedAt: new Date().toISOString(), passed: problems.length === 0,
  asarSha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
  bundledFontSha256: fontHash, localPatches: [patch], supplementaryTranslationEvidence, packages, problems };
fs.writeFileSync(path.join(root, 'release-artifacts/packaged-dependencies.json'), JSON.stringify(report, null, 2));
console.log(`Packaged dependency inventory: ${packages.length} manifests, ${problems.length} problems`);
if (problems.length) { problems.forEach(p => console.error(p)); process.exitCode = 1; }
