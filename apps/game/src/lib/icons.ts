// Ikon garis sederhana (24×24). Disisipkan dengan {@html}.
const s = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  home: s('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  map: s('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
  shop: s('<path d="M4 9h16l-1.5-5h-13z"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>'),
  bag: s('<rect x="5" y="7" width="14" height="13" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/><path d="M5 12h14"/>'),
  friends: s('<circle cx="9" cy="9" r="3.5"/><circle cx="17" cy="10" r="2.8"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M15 15.2c3 .2 6 1.8 6 4.8"/>'),
  eat: s('<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9 8c0-2 2-2 2-4M14 8c0-2 2-2 2-4"/>'),
  bath: s('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
  play: s('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>'),
  sleep: s('<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>'),
  edit: s('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'),
  smile: s('<circle cx="12" cy="12" r="8"/><path d="M8.5 14c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2"/><path d="M9 10h.01M15 10h.01"/>'),
  bolt: s('<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>'),
  gear: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  gift: s('<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8C10 4 6 4 7 7c.5 1.3 3 1 5 1zM12 8c2-4 6-4 5-1-.5 1.3-3 1-5 1z"/>'),
  back: s('<path d="M15 18l-6-6 6-6"/>'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  share: s('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  copy: s('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  news: s('<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v9a2 2 0 0 1-2 2"/><path d="M7 9h7M7 13h7"/>'),
  calendar: s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  book: s('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
  bell: s('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  quest: s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3"/><path d="M9 12l2 2 4-4"/><path d="M9 17h6"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  down: s('<path d="M12 4v12M6 11l6 6 6-6"/><path d="M5 20h14"/>'),
};
export const COIN = `<svg class="coin-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#F2B632" stroke="#2B2F4A" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#B9800F" stroke-width="2"/></svg>`;
export const PEARL = `<svg class="pearl-ic" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="pg" cx=".35" cy=".32" r=".75"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#ECE6F6"/><stop offset="1" stop-color="#B5A9D6"/></radialGradient></defs><circle cx="12" cy="12" r="9.5" fill="url(#pg)" stroke="#2B2F4A" stroke-width="2"/></svg>`;
