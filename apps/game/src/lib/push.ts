// Langganan notifikasi push (Web Push). Bekerja di Android (Chrome, Edge, Samsung Internet, Firefox),
// desktop, dan iPhone/iPad iOS 16.4+ setelah game dipasang ke Layar Utama.
import { api } from './api';

export type PushStatus = 'unsupported' | 'ios-install' | 'denied' | 'on' | 'off';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  if (isIos() && !standalone()) return 'ios-install';
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function subscribe(reg: ServiceWorkerRegistration) {
  const { publicKey } = await api.get('/api/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await api.post('/api/push/subscribe', { subscription: sub.toJSON() });
}

/** Minta izin & berlangganan. Harus dipanggil dari ketukan pengguna. */
export async function enablePush(): Promise<PushStatus> {
  const st = await pushStatus();
  if (st === 'unsupported' || st === 'ios-install' || st === 'denied') return st;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = (await registration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  await subscribe(reg);
  return 'on';
}

export async function disablePush() {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

/** Saat game dibuka: perbarui langganan jika izin sudah diberikan (endpoint bisa berubah). */
export async function syncPush() {
  try {
    if ((await pushStatus()) === 'unsupported' || Notification.permission !== 'granted') return;
    const reg = await registration();
    if (reg) await subscribe(reg);
  } catch { /* abaikan */ }
}
