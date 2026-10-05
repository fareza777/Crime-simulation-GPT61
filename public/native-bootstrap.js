// Injected by Capacitor before application scripts, including a cached v1.0 page.
// Saves and settings live in Preferences and are never touched here.
(() => {
  const workers = navigator.serviceWorker;
  if (!workers) return;
  const wasControlled = Boolean(workers.controller);
  // The cached v1.0 entry point does not know about the readiness promise.
  // Stop its scripts synchronously so it cannot autosave an older state shape.
  if (wasControlled) window.stop();
  workers.register = () => Promise.reject(new Error('Android uses bundled offline assets.'));
  window.__blacklineNativeReady = (async () => {
    const registrations = await workers.getRegistrations();
    if (!wasControlled && !registrations.length && !workers.controller) return;
    await Promise.all(registrations.map(registration => registration.unregister()));
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith('workbox-precache-')).map(name => caches.delete(name)));
    }
    if (wasControlled || workers.controller) {
      // An unregistered worker still controls this document until navigation.
      location.replace(location.href);
      await new Promise(() => {});
    }
  })().catch(error => {
    console.error('BLACKLINE asset update failed', error);
    if (wasControlled) {
      const html = document.documentElement || document.createElement('html');
      if (!document.documentElement) document.appendChild(html);
      html.innerHTML = '<head><meta name="viewport" content="width=device-width, initial-scale=1"><title>BLACKLINE</title></head><body style="margin:0;padding:32px;background:#101213;color:#eee7d8;font:18px sans-serif"><h1>Update paused</h1><p>Your saved story is safe. Tap below to try again.</p><button style="padding:16px 24px;border:0;border-radius:12px;background:#cbb084;font:inherit">Retry update</button></body>';
      document.querySelector('button').addEventListener('click', () => location.reload());
      return new Promise(() => {});
    }
  });
})();
