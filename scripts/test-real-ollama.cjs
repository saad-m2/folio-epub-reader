const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const { LocalTranslationGateway, TRANSLATION_MODEL } = require('../dist/main/main/translation.js');
const origin = 'http://127.0.0.1:11434';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { generatedAt: new Date().toISOString(), scope: 'Real local Ollama through the compiled application gateway; packaged UI and disconnected-internet testing excluded',
  machine: { os: os.release(), cpu: os.cpus()[0].model, ramMiB: os.totalmem() / 1048576 },
  requests: [], cycles: [], translations: [], checks: {}, errors: [], gpuSamples: [] };
let phase = 'baseline';
function gpu() {
  const result = spawnSync('nvidia-smi', ['--query-gpu=name,driver_version,memory.total,memory.used', '--format=csv,noheader,nounits'], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
  if (result.status !== 0) return { phase, error: 'GPU telemetry unavailable' };
  const [name, driver, total, used] = result.stdout.trim().split(',').map(s => s.trim());
  return { at: Date.now(), phase, name, driver, totalMiB: Number(total), usedMiB: Number(used) };
}
async function api(endpoint) { return (await fetch(origin + endpoint, { signal: AbortSignal.timeout(5000), redirect: 'error' })).json(); }
function check(condition, message) { if (!condition) throw new Error(message); }
async function unloaded() {
  const start = performance.now();
  while (performance.now() - start < 10_000) {
    if (!(await api('/api/ps')).models.some(m => m.name === TRANSLATION_MODEL)) return performance.now() - start;
    await wait(250);
  }
  throw new Error('Model still resident 10 seconds after unload');
}
const gateway = new LocalTranslationGateway({ fetcher: async (url, init) => {
  check(new URL(url).origin === origin, 'Gateway attempted non-loopback request');
  const body = init.body ? JSON.parse(init.body) : undefined;
  const entry = { path: new URL(url).pathname, method: init.method, promptCharacters: body?.prompt?.length, keepAlive: body?.keep_alive, phase };
  report.requests.push(entry);
  const response = await fetch(url, init);
  if (body) {
    const data = await response.clone().json().catch(() => ({}));
    entry.response = { status: response.status, done: data.done, doneReason: data.done_reason, loadDurationMs: data.load_duration / 1e6,
      totalDurationMs: data.total_duration / 1e6, evalCount: data.eval_count, evalDurationMs: data.eval_duration / 1e6 };
  }
  return response;
} });
let monitor;
(async () => {
  try {
    const archive = path.join(root, 'out/windows-epub-reader-win32-x64/resources/app.asar');
    report.artifact = { asarSha256: hash(fs.readFileSync(archive)), matchedCompiledFiles: [] };
    for (const relative of ['dist/main/main/translation.js', 'dist/main/shared/contracts.js']) {
      const entry = asar.listPackage(archive).find(p => p.replaceAll('\\', '/') === '/' + relative);
      check(entry, 'Compiled gateway missing from package');
      const bytes = fs.readFileSync(path.join(root, relative));
      check(bytes.equals(asar.extractFile(archive, entry.slice(1))), 'Compiled gateway differs from packaged code');
      report.artifact.matchedCompiledFiles.push({ file: relative, sha256: hash(bytes) });
    }
    report.ollama = await api('/api/version');
    report.model = (await api('/api/tags')).models.find(m => m.name === TRANSLATION_MODEL);
    check(report.model, 'Required model absent; no model will be downloaded');
    report.initialModels = (await api('/api/ps')).models;
    check(!report.initialModels.some(m => m.name === TRANSLATION_MODEL), 'Model already in use; refusing to disturb an existing loaded model');
    report.gpuSamples.push(gpu());
    monitor = setInterval(() => report.gpuSamples.push(gpu()), 1000);
    phase = 'status-only';
    for (let i = 0; i < 3; i++) check((await gateway.getStatus()).state === 'unloaded', 'Read-only status unexpectedly loaded model');
    const postsBefore = report.requests.filter(r => r.method === 'POST').length;
    let refusal;
    try { await gateway.translate('Guten Morgen.'); } catch (error) { refusal = error.code; }
    check(refusal === 'unloaded' && report.requests.filter(r => r.method === 'POST').length === postsBefore, 'Unloaded translation implicitly loaded/submitted text');
    report.checks.statusDoesNotLoadAndUnloadedTranslationDoesNotSubmit = true;
    for (let cycle = 0; cycle < 3; cycle++) {
      phase = `load-${cycle + 1}`;
      let start = performance.now();
      check((await gateway.load()).state === 'loaded', 'Explicit Load did not load model');
      const measured = { cycle: cycle + 1, loadMs: performance.now() - start, resident: (await api('/api/ps')).models.find(m => m.name === TRANSLATION_MODEL), gpuLoaded: gpu() };
      phase = `warm-translation-${cycle + 1}`;
      const input = ['Guten Morgen! Heute scheint die Sonne.', 'Der Zug nach Berlin fährt um neun Uhr ab.', 'Bitte schließen Sie das Fenster. Es ist kalt.'][cycle];
      start = performance.now();
      const result = await gateway.translate(input);
      report.translations.push({ syntheticGerman: input, english: result.text, elapsedMs: performance.now() - start });
      check(result.text && result.text !== input, 'No usable English translation');
      phase = `unload-${cycle + 1}`;
      start = performance.now();
      await gateway.unload();
      measured.unloadCallMs = performance.now() - start;
      measured.releaseObservedMs = await unloaded();
      await wait(1000);
      measured.gpuAfter = gpu();
      report.cycles.push(measured);
      console.log(`Cycle ${cycle + 1}: load ${Math.round(measured.loadMs)} ms; translation ${Math.round(report.translations.at(-1).elapsedMs)} ms; GPU ${measured.gpuLoaded.usedMiB} -> ${measured.gpuAfter.usedMiB} MiB`);
    }
    phase = 'cancel-and-unload';
    await gateway.load();
    const translation = gateway.translate('Ein langer deutscher Text über eine Reise durch Deutschland. '.repeat(70));
    // This is the gateway cancellation entry point used when switching/closing books.
    const abortTimer = setTimeout(() => gateway.cancelActiveTranslation(), 500);
    let cancelled;
    try { await translation; } catch (error) { cancelled = error.code; }
    finally { clearTimeout(abortTimer); }
    check(cancelled === 'cancelled', 'Active translation did not cancel');
    await gateway.unload(); await unloaded();
    report.checks.bookLifecycleGatewayCancellationAndUnload = true;
    phase = 'shutdown-dispose';
    await gateway.load();
    const start = performance.now();
    await gateway.dispose();
    report.disposeMs = performance.now() - start;
    check(report.disposeMs < 2500, 'Best-effort shutdown disposal exceeded bounded budget');
    report.disposeReleaseObservedMs = await unloaded();
    report.checks.boundedOwnedModelExitRelease = true;
    report.checks.loopbackOnly = true;
    report.checks.repeatedLoadTranslateUnload = report.cycles.length === 3;
  } catch (error) {
    report.errors.push(error.code || error.message);
    console.error('Real Ollama test failed:', error.code || error.message);
  } finally {
    clearInterval(monitor);
    await gateway.dispose();
    // Clean up only a model loaded by this run; never unload an initially resident model.
    if (report.initialModels && !report.initialModels.some(m => m.name === TRANSLATION_MODEL)) {
      try {
        if ((await api('/api/ps')).models.some(m => m.name === TRANSLATION_MODEL)) {
          await fetch(origin + '/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: TRANSLATION_MODEL, prompt: '', keep_alive: 0, stream: false }), signal: AbortSignal.timeout(10_000) });
          await unloaded();
        }
        await wait(1500);
        report.finalModels = (await api('/api/ps')).models;
      } catch (error) { report.errors.push('Cleanup: ' + error.message); }
    }
    phase = 'final'; report.gpuSamples.push(gpu());
    report.passed = report.errors.length === 0;
    fs.writeFileSync(path.join(root, 'release-artifacts/real-ollama.json'), JSON.stringify(report, null, 2));
    process.exitCode = report.passed ? 0 : 1;
    console.log(`Real Ollama evidence written; ${report.passed ? 'passed' : 'failed'}`);
  }
})();
