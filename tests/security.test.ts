import { describe, expect, it } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { requireAppMainFrame, redactError, safeError } from '../src/main/security';

function event(url: string, child = false): IpcMainInvokeEvent {
  const frame = { url };
  return { senderFrame: frame, sender: { mainFrame: child ? { url } : frame } } as unknown as IpcMainInvokeEvent;
}
describe('application IPC origin', () => {
  it('accepts the application main frame', () => { expect(() => requireAppMainFrame(event('app://app/index.html'))).not.toThrow(); });
  it.each(['app://evil/index.html', 'app://app.evil/index.html', 'app://user@app/index.html', 'app://app:80/index.html', 'https://app/index.html', 'file:///book.xhtml', 'invalid'])('denies %s', url => {
    expect(() => requireAppMainFrame(event(url))).toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });
  it('denies publication subframes even at the application origin', () => { expect(() => requireAppMainFrame(event('app://app/index.html', true))).toThrow(); });
});

describe('redacted IPC failures', () => {
  it('preserves only the documented safe error envelope', () => {
    const safe = safeError('UNAUTHORIZED');
    expect(redactError(safe)).toEqual(safe);
  });
  it.each([
    Object.assign(new Error('private book text'), { code: 'ENOENT', path: 'C:/private/book.epub' }),
    { ...safeError('INVALID_REQUEST'), text: 'private translation', path: 'C:/private/book.epub' },
    new Error('private model output'),
  ])('removes paths, text and raw diagnostics', error => {
    const redacted = redactError(error);
    expect(redacted).toEqual({ code: 'INVALID_REQUEST', correlationId: expect.any(String) });
    expect(Object.keys(redacted).sort()).toEqual(['code', 'correlationId']);
  });
});
