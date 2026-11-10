import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { G } from './lib/game.svelte';

const app = mount(App, { target: document.getElementById('app')! });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      // reload otomatis hanya saat versi baru menggantikan versi lama, bukan saat pemasangan pertama
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register('/sw.js');
      const onWaiting = () => { if (reg.waiting && navigator.serviceWorker.controller) G.update = true; };
      onWaiting();
      reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', onWaiting));
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
      // PWA yang dibiarkan terbuka berhari-hari tetap mendapat versi baru:
      // cek tiap 30 menit dan saat aplikasi dibuka lagi dari latar (paling sering 5 menit sekali)
      let lastCheck = Date.now();
      const check = () => { if (Date.now() - lastCheck < 5 * 60_000) return; lastCheck = Date.now(); reg.update().catch(() => {}); };
      setInterval(() => { lastCheck = 0; check(); }, 30 * 60_000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    } catch { /* PWA opsional */ }
  });
}
window.addEventListener('online', () => (G.online = true));
window.addEventListener('offline', () => (G.online = false));

export default app;
