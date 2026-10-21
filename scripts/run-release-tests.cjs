const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const development = process.argv.includes('--development');
const executable = development ? require('electron') : process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'out/windows-epub-reader-win32-x64/WindowsEpubReader.exe');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-release-'));
const environment = { ...process.env, E06_RELEASE_TEST: '1', E06_TEST_ROOT: testRoot,
  E06_CORPUS_DIR: path.join(root, 'tests/fixtures'), E06_EVIDENCE_DIR: path.join(root, 'release-artifacts') };
delete environment.ELECTRON_RUN_AS_NODE;
const evidence = path.join(root, 'release-artifacts/packaged-runtime.json');
if (fs.existsSync(evidence)) fs.renameSync(evidence, evidence.replace('.json', `-${Date.now()}.json`));
function artifact() {
  const result = { executable: path.relative(root, executable), sha256: createHash('sha256').update(fs.readFileSync(executable)).digest('hex') };
  if (!development) result.asarSha256 = createHash('sha256').update(fs.readFileSync(path.join(path.dirname(executable), 'resources/app.asar'))).digest('hex');
  return result;
}
function launchFailure(error) {
  fs.mkdirSync(path.dirname(evidence), { recursive: true });
  fs.writeFileSync(evidence, JSON.stringify({ generatedAt: new Date().toISOString(), passed: false,
    stage: 'launch', runtimeTestsExecuted: false, errors: [error.code || error.message], artifact: artifact() }, null, 2));
  console.error(`Packaged application could not launch (${error.code || error.message}); evidence written`);
  process.exitCode = 1;
}
let child;
try { child = spawn(executable, development ? [root] : [], { cwd: root, env: environment, stdio: 'inherit' }); }
catch (error) { launchFailure(error); return; }
const timer = setTimeout(() => { child.kill(); console.error('Packaged test deadline exceeded'); }, 15 * 60_000);
child.on('error', error => { clearTimeout(timer); launchFailure(error); });
child.on('exit', code => {
  clearTimeout(timer);
  // Keep isolated data for investigation; never touch the user's real library.
  console.log(`Isolated test data: ${testRoot}`);
  let evidenceValid = false;
  if (fs.existsSync(evidence)) {
    const report = JSON.parse(fs.readFileSync(evidence, 'utf8'));
    evidenceValid = development || (report.packaged === true && report.versions.electron === '42.11.6' && report.fixtures?.find(f => f.name === 'deep-marker.epub')?.result?.binaryResources === true);
    report.artifact = artifact();
    fs.writeFileSync(evidence, JSON.stringify(report, null, 2));
  }
  process.exitCode = evidenceValid ? code ?? 1 : 1;
});
