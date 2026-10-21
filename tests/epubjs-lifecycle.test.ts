import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const managers = [
  ['paginated', require('epubjs/lib/managers/default/index.js').default],
  ['continuous', require('epubjs/lib/managers/continuous/index.js').default],
] as const;

describe.each(managers)('real epub.js %s manager cleanup', (_mode, Manager) => {
  function manager() {
    const value = Object.create(Manager.prototype);
    value.settings = { fullsize: false, direction: 'ltr' };
    value.container = document.createElement('div');
    value.onScroll = vi.fn();
    value.destroy = vi.fn();
    return value;
  }

  it('releases the window-owned callback after rendition teardown', () => {
    const value = manager();
    value.addEventListeners();
    try {
      window.dispatchEvent(new Event('unload'));
      expect(value.destroy).toHaveBeenCalledTimes(1);
      value.removeEventListeners();
      window.dispatchEvent(new Event('unload'));
      expect(value.destroy).toHaveBeenCalledTimes(1);
    } finally { value.removeEventListeners(); }
  });

  it('does not retain managers across twenty open/close cycles', () => {
    const instances = Array.from({ length: 20 }, manager);
    try {
      for (const value of instances) {
        value.addEventListeners();
        value.removeEventListeners();
      }
      window.dispatchEvent(new Event('unload'));
      for (const value of instances) expect(value.destroy).not.toHaveBeenCalled();
    } finally { for (const value of instances) value.removeEventListeners(); }
  });
});
