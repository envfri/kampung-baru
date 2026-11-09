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
    } catch { /* PWA opsional */ }
  });
}
window.addEventListener('online', () => (G.online = true));
window.addEventListener('offline', () => (G.online = false));

export default app;
