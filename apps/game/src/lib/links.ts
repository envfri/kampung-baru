// Tautan dalam game (dipakai notifikasi & deep link): /#garden, /#shop, /#friends, ...
import { G, goTo } from './game.svelte';
import { JP } from './jepret.svelte';
import { gajiWaiting, working } from './kerja.svelte';

export function openLink(url: string) {
  let hash = '';
  try { hash = new URL(url, location.origin).hash.replace('#', ''); } catch { hash = ''; }
  // Jepret (tugas "Bagikan 1 foto" › Ke sana): di alun-alun tetap di sana, selain itu di rumah sendiri
  if (hash === 'jepret') {
    G.sheet = null;
    if (G.edit) { G.edit = false; G.draft = null; }
    if (G.view !== 'alun' && !(G.view === 'visit' && G.visit)) { G.visit = null; G.view = 'home'; }
    JP.want = true;
    return;
  }
  G.sheet = null;
  G.visit = null;
  if (G.edit) { G.edit = false; G.draft = null; }
  switch (hash) {
    case 'map': G.view = 'map'; break;
    case 'garden': G.view = 'garden'; break;
    case 'karung': G.view = 'karung'; break;
    case 'fishing': G.view = 'fishing'; break;
    case 'shop': goTo(G.shopId || 'pasar'); break;
    case 'bangunan': goTo('bangunan'); break;
    case 'alun': goTo('alun'); break;
    // kerja sambilan: pulang bawa amplop → rumah (kartu Terima gaji); sedang kerja → peta; selain itu jalan ke Papan Lowongan
    case 'kerja':
      if (gajiWaiting()) G.view = 'home';
      else if (working()) G.view = 'map';
      else goTo(G.catalog?.locations?.find((l: any) => l.kind === 'jobs')?.id ?? 'lowongan');
      break;
    // Sahabat Mungil: belum punya sahabat → rumah (anak ayam menunggu di pintu); selain itu jalan ke Pondok Sahabat
    case 'sahabat':
      if (G.me?.sahabat?.ayam) G.view = 'home';
      else goTo(G.catalog?.locations?.find((l: any) => l.kind === 'sahabat' && l.enabled !== false)?.id ?? 'pondok');
      break;
    case 'rooms': G.view = 'home'; G.sheet = 'rooms'; break;
    case 'friends': G.view = 'home'; G.sheet = 'friends'; break;
    case 'daily': G.view = 'home'; G.sheet = 'daily'; break;
    case 'news': G.view = 'home'; G.sheet = 'news'; break;
    case 'pearls': G.view = 'home'; G.sheet = 'pearls'; break;
    case 'notifs': G.view = 'home'; G.sheet = 'notifs'; break;
    case 'quests': G.view = 'home'; G.sheet = 'quests'; break;
    case 'bag': G.view = 'home'; G.sheet = 'bag'; break;
    case 'wardrobe': G.view = 'home'; G.sheet = 'wardrobe'; break;
    case 'event': G.view = 'home'; G.sheet = 'event'; break;
    case 'whatsnew': G.view = 'home'; G.sheet = 'whatsnew'; break;
    case 'games': G.view = 'map'; G.sheet = 'games'; break;
    case 'duels': G.duel = null; G.view = 'map'; G.sheet = 'duels'; break;
    case 'bukutamu': G.view = 'home'; G.sheet = 'friends'; G.sheetArg = { tab: 'book' }; break;
    case 'album': G.view = 'home'; G.sheet = 'friends'; G.sheetArg = { tab: 'album' }; break;
    case 'simpan': case 'akun': G.view = 'home'; G.sheet = 'settings'; break;
    case 'panen': G.view = 'panen'; break;
    case 'memori': G.view = 'memori'; break;
    case 'bakiak': case 'gasing': case 'layangan': case 'pinang': G.view = hash; break;
    case 'badges': G.view = 'home'; G.sheet = 'quests'; G.sheetArg = { tab: 'badges' }; break;
    default: G.view = 'home';
  }
}
