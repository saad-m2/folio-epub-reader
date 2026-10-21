import { expect, it, vi } from 'vitest';
import { offlineFetch } from '../src/main/offline-test';

it('fails public font/network requests without invoking the real transport', async () => {
  const base = vi.fn(); const record = vi.fn();
  const fetcher = offlineFetch(base, record);
  await expect(fetcher('https://raw.githubusercontent.com/font.ttf')).rejects.toThrow(TypeError);
  await expect(fetcher('http://127.0.0.1:11435/api/generate')).rejects.toThrow(TypeError);
  expect(base).not.toHaveBeenCalled();
  expect(record).toHaveBeenCalledWith({ origin: 'https://raw.githubusercontent.com', method: 'GET', allowed: false });
});

it('keeps exactly the fixed Ollama loopback origin available', async () => {
  const response = new Response('{}'); const base = vi.fn().mockResolvedValue(response); const record = vi.fn();
  const fetcher = offlineFetch(base, record);
  expect(await fetcher('http://127.0.0.1:11434/api/tags')).toBe(response);
  expect(record).toHaveBeenCalledWith({ origin: 'http://127.0.0.1:11434', method: 'GET', allowed: true });
});
