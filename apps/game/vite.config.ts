import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Membuat service worker dengan daftar file yang di-cache (app shell) setiap build. */
function serviceWorker(): Plugin {
  return {
    name: 'kb-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = new Set<string>(['/', '/manifest.webmanifest']);
      for (const f of Object.keys(bundle)) if (!f.endsWith('.map') && !f.endsWith('.woff')) files.add('/' + f);
      const pub = join(__dirname, 'public');
      const walk = (dir: string, base = '') => {
        for (const n of readdirSync(dir)) {
          const p = join(dir, n);
          if (statSync(p).isDirectory()) walk(p, base + n + '/');
          // gambar pratinjau tautan (og/) hanya untuk bot media sosial, tidak perlu disimpan di HP pemain
          else if (n !== 'sw.js' && !base.startsWith('og/')) files.add('/' + base + n);
        }
      };
      walk(pub);
      const version = Date.now().toString(36);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const VERSION='${version}';const SHELL=${JSON.stringify([...files])};\n` + SW_SOURCE,
      });
    },
  };
}

const SW_SOURCE = `
const SHELL_CACHE = 'kb-shell-' + VERSION;
const MEDIA_CACHE = 'kb-media';
const DATA_CACHE = 'kb-data';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('kb-shell-') && k !== SHELL_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
// Notifikasi push: tampil walau game/PWA sedang ditutup
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'BUPI', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    lang: 'id',
    data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin) && !c.url.includes('/admin')) {
        await c.focus();
        c.postMessage({ type: 'navigate', url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const r = await fetch('/api/push/key');
      const { publicKey } = await r.json();
      const pad = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const raw = atob((publicKey + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch('/api/push/subscribe', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    } catch (_) {}
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/pay/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/', { ignoreSearch: true })));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (url.pathname.startsWith('/media/')) {
    e.respondWith(caches.open(MEDIA_CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.pathname === '/api/catalog' || url.pathname === '/api/config') {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(DATA_CACHE).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.open(DATA_CACHE).then((c) => c.match(req)).then((r) => r || new Response('{"error":{"code":"offline","message":"Kamu sedang offline."}}', { status: 503, headers: { 'content-type': 'application/json' } }))));
  }
});
`;

export default defineConfig({
  plugins: [svelte(), serviceWorker()],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:8787', '/media': 'http://localhost:8787', '/pay': 'http://localhost:8787' },
  },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 600 },
});
