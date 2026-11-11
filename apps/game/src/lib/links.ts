// Tautan dalam game (dipakai notifikasi & deep link): /#garden, /#shop, /#friends, ...
import { G, goTo } from './game.svelte';

export function openLink(url: string) {
  let hash = '';
  try { hash = new URL(url, location.origin).hash.replace('#', ''); } catch { hash = ''; }
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
    case 'panen': G.view = 'panen'; break;
    case 'memori': G.view = 'memori'; break;
    case 'bakiak': case 'gasing': case 'layangan': case 'pinang': G.view = hash; break;
    case 'badges': G.view = 'home'; G.sheet = 'quests'; G.sheetArg = { tab: 'badges' }; break;
    default: G.view = 'home';
  }
}
