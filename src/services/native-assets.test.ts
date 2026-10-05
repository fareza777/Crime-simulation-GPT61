import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../public/native-bootstrap.js', import.meta.url), 'utf8');

describe('native APK cache migration', () => {
  it('retires legacy PWA registrations and only their precache, preserving other storage', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const remove = vi.fn().mockResolvedValue(true);
    const replace = vi.fn();
    const context = {
      navigator: { serviceWorker: { getRegistrations: async () => [{ unregister }], controller: null, register: vi.fn() } },
      caches: { keys: async () => ['workbox-precache-v2-https://localhost/', 'blackline-other'], delete: remove },
      location: { href: 'https://localhost/', replace }, window: { stop: vi.fn() } as { stop: () => void; __blacklineNativeReady?: Promise<void> }, console,
    };
    runInNewContext(source, context);
    await context.window.__blacklineNativeReady;
    expect(unregister).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledExactlyOnceWith('workbox-precache-v2-https://localhost/');
    expect(replace).not.toHaveBeenCalled();
    expect(context.window.stop).not.toHaveBeenCalled();
    await expect(context.navigator.serviceWorker.register()).rejects.toThrow('bundled offline assets');
  });

  it('reloads a controlled old document once its cache is retired, before new app startup', async () => {
    const replace = vi.fn();
    const context = {
      navigator: { serviceWorker: { getRegistrations: async () => [{ unregister: async (): Promise<boolean> => { context.navigator.serviceWorker.controller = null; return true; } }], controller: {} as object | null } },
      caches: { keys: async () => [], delete: vi.fn() },
      location: { href: 'https://localhost/', replace }, window: { stop: vi.fn() } as { stop: () => void; __blacklineNativeReady?: Promise<void> }, console,
    };
    runInNewContext(source, context);
    expect(context.window.stop).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith('https://localhost/'));
    expect(context.navigator.serviceWorker.controller).toBeNull();
  });

  it('blocks cached scripts immediately while registration retirement is deferred', async () => {
    let finish!: (value: []) => void;
    const pending = new Promise<[]>(resolve => { finish = resolve; });
    const stop = vi.fn();
    const replace = vi.fn();
    const context = {
      navigator: { serviceWorker: { getRegistrations: () => pending, controller: {} as object | null } },
      caches: { keys: async () => [], delete: vi.fn() },
      location: { href: 'https://localhost/', replace }, window: { stop }, console,
    };
    runInNewContext(source, context);
    expect(stop).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    context.navigator.serviceWorker.controller = null;
    finish([]);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
  });

  it('can create the recovery document before an HTML element has been parsed', async () => {
    const html = { innerHTML: '' };
    const appendChild = vi.fn();
    const context = {
      navigator: { serviceWorker: { getRegistrations: async () => { throw new Error('Unavailable'); }, controller: {} } },
      location: { reload: vi.fn() }, window: { stop: vi.fn() }, console: { error: vi.fn() },
      document: { documentElement: null, createElement: vi.fn(() => html), appendChild, querySelector: () => ({ addEventListener: vi.fn() }) },
    };
    runInNewContext(source, context);
    await vi.waitFor(() => expect(html.innerHTML).toContain('Retry update'));
    expect(appendChild).toHaveBeenCalledExactlyOnceWith(html);
  });

  it('offers a retry if a controlled legacy document cannot be retired', async () => {
    const button = { addEventListener: vi.fn() };
    const context = {
      navigator: { serviceWorker: { getRegistrations: async () => { throw new Error('Unavailable'); }, controller: {} } },
      location: { reload: vi.fn() }, window: { stop: vi.fn() } as { stop: () => void; __blacklineNativeReady?: Promise<void> },
      document: { documentElement: { innerHTML: '' }, querySelector: () => button }, console: { error: vi.fn() },
    };
    runInNewContext(source, context);
    let settled = false;
    void context.window.__blacklineNativeReady?.then(() => { settled = true; });
    await vi.waitFor(() => expect(context.document.documentElement.innerHTML).toContain('Retry update'));
    expect(settled).toBe(false);
    expect(context.console.error).toHaveBeenCalledOnce();
    expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    button.addEventListener.mock.calls[0][1]();
    expect(context.location.reload).toHaveBeenCalledOnce();
  });

  it('leaves a clean native install alone without a reload or cache deletion', async () => {
    const keys = vi.fn();
    const replace = vi.fn();
    const context = {
      navigator: { serviceWorker: { getRegistrations: async () => [], controller: null } },
      caches: { keys }, location: { replace }, window: {} as { __blacklineNativeReady?: Promise<void> }, console,
    };
    runInNewContext(source, context);
    await context.window.__blacklineNativeReady;
    expect(keys).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
