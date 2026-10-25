import { app, BrowserWindow, session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { TrustedPublicationSessions } from './publications';
import { LibraryRepository, inspectLocalEpub } from './library';
import { requireAppMainFrame } from './security';
import type { IpcMainInvokeEvent } from 'electron';

export async function runReleaseTests(window: BrowserWindow, publications: TrustedPublicationSessions, library: LibraryRepository): Promise<boolean> {
  const output = process.env.E06_EVIDENCE_DIR!;
  const corpus = process.env.E06_CORPUS_DIR!;
  if (!output || !corpus || !process.env.E06_TEST_ROOT) throw new Error('Release tests require isolated data, corpus and evidence directories');
  await fs.mkdir(output, { recursive: true });
  const report: { [key: string]: any } = {
    generatedAt: new Date().toISOString(), packaged: app.isPackaged,
    versions: process.versions, machine: { os: os.release(), cpu: os.cpus()[0].model, ramMiB: os.totalmem() / 1048576 },
    fixtures: [], boundaries: {}, performanceFailures: [], errors: [],
    pending: ['offline UI and accessibility matrix (separate manual evidence)'],
    qualification: { cleanMachineRequired: false, ownerScopeChange: '2026-10-02 personal-use release; reasonable memory expansion allowed', ordinaryWorkingSetMiB: 768, stressWorkingSetMiB: 1024, twentyCycleResidualMiB: 75 },
  };
  function check(value: unknown, label: string) { if (!value) throw new Error(label); }
  async function ready() {
    for (let i = 0; i < 100; i++) {
      if (await window.webContents.executeJavaScript('typeof window.releaseTest === "function"')) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Runtime test module did not load');
  }
  const memory = () => app.getAppMetrics().reduce((sum, item) => sum + item.memory.workingSetSize / 1024, 0);
  const processMemory = () => app.getAppMetrics().map(item => ({ type: item.type, pid: item.pid, workingSetMiB: item.memory.workingSetSize / 1024, privateMiB: item.memory.privateBytes === undefined ? null : item.memory.privateBytes / 1024 }));
  const heap = async () => {
    await window.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
    const usage = await window.webContents.debugger.sendCommand('Runtime.getHeapUsage');
    return { ...usage, dom: await window.webContents.debugger.sendCommand('Memory.getDOMCounters') };
  };
  try {
    await ready();
    // Exercise the real bridge and Windows protected storage without contacting providers.
    // The runner always supplies an isolated profile; these are deliberately fake credentials.
    const cloudConfiguration = await window.webContents.executeJavaScript(`(async () => {
      const initial = await window.readerApi.getTranslationProviders();
      const saved = await window.readerApi.saveTranslationProvider({ provider: 'microsoft', apiKey: 'qualification-test-key' });
      const selected = await window.readerApi.setTranslationProvider('microsoft');
      const invalidCheck = await window.readerApi.checkTranslationProviderAvailability({ provider: 'microsoft', text: 'forbidden' });
      const staleStatus = await window.readerApi.getTranslationRequestStatus({ sessionId: crypto.randomUUID(), selectionId: crypto.randomUUID() });
      const removed = await window.readerApi.removeTranslationProvider('microsoft');
      const restored = await window.readerApi.setTranslationProvider('ollama');
      return {
        defaultLocal: initial.ok && initial.value.current === 'ollama',
        saved: saved.ok && saved.value.providers.some(p => p.provider === 'microsoft' && p.configured),
        redacted: saved.ok && !JSON.stringify(saved.value).includes('qualification-test-key') && !JSON.stringify(saved.value).includes('apiKey'),
        selected: selected.ok && selected.value.current === 'microsoft',
        invalidCheckRejected: !invalidCheck.ok && invalidCheck.error.code === 'INVALID_REQUEST',
        staleStatusRejected: !staleStatus.ok && staleStatus.error.code === 'CLOUD_CANCELLED',
        removed: removed.ok && removed.value.current === null && !removed.value.providers.some(p => p.provider === 'microsoft' && p.configured),
        restored: restored.ok && restored.value.current === 'ollama'
      };
    })()`, true) as Record<string, boolean>;
    report.boundaries.cloudConfiguration = cloudConfiguration;
    check(Object.values(cloudConfiguration).every(Boolean), 'cloud configuration bridge/protected-storage checks failed');
    window.webContents.debugger.attach('1.3');
    const manifest = JSON.parse(await fs.readFile(path.join(corpus, 'release-corpus.json'), 'utf8'));
    for (const fixture of manifest.fixtures) {
      const source = path.join(corpus, fixture.name);
      try {
        publications.authorizeSource(source);
        let opened = await publications.open(source, window.webContents.session);
        check(createHash('sha256').update(Buffer.from(opened.archiveBytes)).digest('hex') === fixture.sha256, 'corpus hash mismatch');
        const baselineHeap = await heap();
        const baseline = memory();
        let peak = baseline;
        const monitor = setInterval(() => { peak = Math.max(peak, memory()); }, 100);
        const cycles = fixture.name === 'interaction-smoke.epub' || fixture.stress ? 20 : 1;
        let result: any;
        try { result = await window.webContents.executeJavaScript(`window.releaseTest(${JSON.stringify(Array.from(new Uint8Array(opened.archiveBytes)))}, ${JSON.stringify(fixture.expected)}, ${cycles})`); }
        finally { clearInterval(monitor); }
        await new Promise(resolve => setTimeout(resolve, 1000));
        const afterBeforeCollection = memory();
        const afterFirstCollectionHeap = await heap();
        const afterFirstCollectionMiB = memory();
        // Blink's native DOM collection can finish after the V8 collection
        // response. Keep the first reading and allow an idle turn before the
        // second diagnostic collection, so detached-frame retention is visible.
        await new Promise(resolve => setTimeout(resolve, 1000));
        const afterHeap = await heap();
        const after = memory();
        const processesAfter = processMemory();
        if (fixture.stress && process.env.E06_HEAP_SNAPSHOT === '1') {
          const chunks: string[] = [];
          const collect = (_event: unknown, method: string, params: { chunk?: string }) => { if (method === 'HeapProfiler.addHeapSnapshotChunk' && params.chunk) chunks.push(params.chunk); };
          window.webContents.debugger.on('message', collect);
          try {
            await window.webContents.debugger.sendCommand('HeapProfiler.takeHeapSnapshot');
            await fs.writeFile(path.join(output, 'stress-after-close.heapsnapshot'), chunks.join(''));
          } finally { window.webContents.debugger.removeListener('message', collect); }
        }
        await publications.closeOwned(opened.sessionId, window.webContents.session);
        check(!publications.verifySessionOwned(opened.sessionId, window.webContents.session), 'session survived close');
        if (fixture.expected === 'supported') {
          const input = await inspectLocalEpub(source);
          const bookId = library.findByHash(input.hash)?.id ?? library.add(input);
          library.saveLocation(bookId, result.location);
          const stored = library.getLocation(bookId);
          publications.authorizeSource(source);
          opened = await publications.open(source, window.webContents.session);
          const restored = await window.webContents.executeJavaScript(`window.releaseTest(${JSON.stringify(Array.from(new Uint8Array(opened.archiveBytes)))}, "supported", 1, ${JSON.stringify(stored)})`) as any;
          check(restored.location.href === stored?.href, 'offline location restore failed');
          await publications.closeOwned(opened.sessionId, window.webContents.session);
          for (const timing of result.timings) {
            if (timing.openMs > (fixture.stress ? 5000 : 2000)) report.performanceFailures.push(`${fixture.name}: open`);
            if (timing.nextMs > 100) report.performanceFailures.push(`${fixture.name}: navigation`);
            if (timing.modeChangeMs > (fixture.stress ? 2000 : 1000)) report.performanceFailures.push(`${fixture.name}: mode change`);
            if (timing.reflowMs > (fixture.stress ? 2000 : 1000)) report.performanceFailures.push(`${fixture.name}: reflow`);
          }
          if (peak > (fixture.stress ? 1024 : 768) || (cycles === 20 && after - baseline > 75)) report.performanceFailures.push(`${fixture.name}: memory`);
          if (cycles === 20 && (afterHeap.usedSize - baselineHeap.usedSize) / 1048576 > 10) report.performanceFailures.push(`${fixture.name}: retained JS heap`);
          if (fixture.name === 'missing-navigation.epub') check(!result.hasNavigation, 'missing navigation was invented');
        }
        report.fixtures.push({ ...fixture, result, memory: { baselineMiB: baseline, peakObservedMiB: peak, afterBeforeCollectionMiB: afterBeforeCollection, afterFirstCollectionMiB, afterFirstCollectionHeap, afterMiB: after, residualMiB: after - baseline, baselineHeap, afterHeap, processesAfter, collectionIsDiagnosticOnly: true }, passed: true });
        console.log(`[release-test] ${fixture.name}: passed`);
      } catch (error) {
        report.fixtures.push({ ...fixture, passed: false, failure: error instanceof Error ? error.message : 'unknown' });
        report.errors.push(`${fixture.name} failed`);
        console.error(`[release-test] ${fixture.name}: failed`);
        await publications.closeAll();
      }
    }
    const sparse = path.join(process.env.E06_TEST_ROOT!, 'oversized.epub');
    const handle = await fs.open(sparse, 'w'); await handle.truncate(128 * 1048576 + 1); await handle.close();
    publications.authorizeSource(sparse);
    let oversized = false;
    try { await publications.open(sparse, window.webContents.session); } catch (error) { oversized = (error as { code?: string }).code === 'QUOTA_EXCEEDED'; }
    check(oversized, 'oversized source accepted'); await fs.unlink(sparse);
    const fixture = path.join(corpus, 'deep-marker.epub');
    publications.authorizeSource(fixture);
    const live = await publications.open(fixture, window.webContents.session);
    let crossSession = false;
    try { await publications.closeOwned(live.sessionId, session.fromPartition('release-test-other')); } catch { crossSession = true; }
    check(crossSession, 'cross-session access accepted');
    for (const url of ['app://evil/index.html', 'app://app.evil/index.html', 'https://app/index.html', 'app://user@app/index.html', 'app://app:42/index.html']) {
      const frame = { url }; let denied = false;
      try { requireAppMainFrame({ senderFrame: frame, sender: { mainFrame: frame } } as unknown as IpcMainInvokeEvent); } catch { denied = true; }
      check(denied, 'wrong-origin IPC accepted');
    }
    const denied = await window.webContents.executeJavaScript(`(async () => {
      const malformed = await window.readerApi.openSession('invalid');
      const oversized = await window.readerApi.registerTranslationSelection({sessionId:${JSON.stringify(live.sessionId)},text:'x'.repeat(5001),rects:[{x:0,y:0,width:1,height:1}]});
      const proof = await window.readerApi.openProofFixture();
      const blocked = async url => { try { await fetch(url); return false; } catch { return true; } };
      return {malformed,oversized,proof,network:await blocked('https://example.com'),file:await blocked('file:///C:/Windows/win.ini')};
    })()`);
    check(!denied.malformed.ok && !denied.oversized.ok && !denied.proof.ok && denied.network && denied.file, 'renderer boundary failed');
    report.boundaries = { ...report.boundaries, oversizedSource: oversized, crossSession, wrongOrigins: true, ipc: denied };
    const recovered = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('renderer did not recover')), 15_000);
      window.webContents.once('did-finish-load', () => { clearTimeout(timer); resolve(); });
    });
    window.webContents.debugger.detach();
    window.webContents.forcefullyCrashRenderer(); await recovered; await ready();
    check(!publications.verifySessionOwned(live.sessionId, window.webContents.session), 'crash leaked session');
    report.boundaries.crashRecovery = true;
    report.libraryCount = library.list().length;
  } catch (error) { report.errors.push(error instanceof Error ? error.message : 'unknown'); }
  report.passed = report.errors.length === 0 && report.performanceFailures.length === 0;
  await fs.writeFile(path.join(output, 'packaged-runtime.json'), JSON.stringify(report, null, 2));
  console.log(`[release-test] runtime ${report.passed ? 'passed' : 'failed'}; evidence written`);
  return report.passed;
}
