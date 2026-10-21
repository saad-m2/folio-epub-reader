import fs from 'node:fs';
import path from 'node:path';

export function offlineFetch(base: typeof fetch, record: (entry: { origin: string; method: string; allowed: boolean }) => void): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const allowed = url.origin === 'http://127.0.0.1:11434';
    record({ origin: url.origin, method: init?.method ?? 'GET', allowed });
    if (!allowed) throw new TypeError('Network unavailable during offline qualification');
    return base(input, init);
  };
}

/** Test transport only: block public requests while retaining the local model service. */
export function configureOfflineQualification(): void {
  if (process.env.E06_OFFLINE_TEST !== '1') return;
  if ((!process.env.E06_UI_TEST && !process.env.E06_RELEASE_TEST) || !process.env.E06_TEST_ROOT || !process.env.E06_EVIDENCE_DIR) throw new Error('Offline qualification requires an isolated test run');
  const file = path.join(process.env.E06_EVIDENCE_DIR, 'offline-network.json');
  const entries: Array<{ origin: string; method: string; allowed: boolean }> = [];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const save = () => fs.writeFileSync(file, JSON.stringify({ mode: 'per-app public-network failure injection; loopback retained', entries }, null, 2));
  save();
  globalThis.fetch = offlineFetch(globalThis.fetch, entry => { entries.push(entry); save(); });
}
