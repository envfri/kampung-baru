// Ikon kecil untuk kunjungan bareng: ekspresi, aksi, dan bahan Masak bareng.
const S = 'stroke="#2B2F4A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
export const EMOTE_ICON: Record<string, string> = {
  lambai: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 17V9a2 2 0 0 1 4 0v6V6a2 2 0 0 1 4 0v9V8a2 2 0 0 1 4 0v9l1-3a2 2 0 0 1 3.6 1.6L23 24a6 6 0 0 1-6 4h-2a6 6 0 0 1-6-6Z" fill="#F6C9A8" ${S}/><path d="M4 9q-1 3 0 6M27 5q2 2 2 5" fill="none" ${S}/></svg>`,
  tawa: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="#FFE07A" ${S}/><path d="M10 13q2-3 4 0M18 13q2-3 4 0" fill="none" ${S}/><path d="M9 18h14q-1 7-7 7t-7-7Z" fill="#8E3B46" ${S}/></svg>`,
  hati: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27 5 17a6 6 0 0 1 11-8 6 6 0 0 1 11 8Z" fill="#FF6B8A" ${S}/></svg>`,
  kaget: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="#BFE3F5" ${S}/><circle cx="11.5" cy="13" r="2" fill="#2B2F4A"/><circle cx="20.5" cy="13" r="2" fill="#2B2F4A"/><ellipse cx="16" cy="21" rx="3" ry="4" fill="#8E3B46" ${S}/></svg>`,
};
export const EMOTE_LABEL: Record<string, string> = { lambai: 'Lambai', tawa: 'Tertawa', hati: 'Sayang', kaget: 'Kaget' };

export const ACT_ICON: Record<string, string> = {
  sapa: EMOTE_ICON.lambai,
  peluk: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="17" r="7" fill="#F6B7A8" ${S}/><circle cx="21" cy="17" r="7" fill="#9FD0E8" ${S}/><path d="M16 9 13 6a2.2 2.2 0 0 1 3-3 2.2 2.2 0 0 1 3 3Z" fill="#FF6B8A" ${S}/></svg>`,
  camilan: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="18" r="9" fill="#3FA06A" ${S}/><path d="M11 15q5 4 10 0" fill="none" stroke="#FFFDF7" stroke-width="2" stroke-linecap="round"/><path d="M16 9q2-5 6-5" fill="none" ${S}/></svg>`,
  kejar: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="19" cy="7" r="3.5" fill="#F2B632" ${S}/><path d="M18 12 13 17l5 3-3 7M13 17l-6 1M18 12l5 5 4-1" fill="none" ${S}/><path d="M3 23h5M2 27h6" ${S}/></svg>`,
  duduk: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="15" width="24" height="7" rx="3" fill="#C8955A" ${S}/><path d="M6 15V9q0-3 3-3h14q3 0 3 3v6M7 22v4M25 22v4" fill="none" ${S}/></svg>`,
};

/** bahan Masak bareng (urutannya sama dengan server) */
export const INGREDIENT: Record<string, { name: string; svg: string }> = {
  bawang: { name: 'Bawang', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5q8 6 8 14a8 8 0 0 1-16 0q0-8 8-14Z" fill="#E7C6E4" ${S}/><path d="M16 5v-2M13 27q3 2 6 0" fill="none" ${S}/></svg>` },
  cabai: { name: 'Cabai', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 9q3 16 18 18-12-6-13-18Z" fill="#E0583F" ${S}/><path d="M8 9q-1-4 2-6" fill="none" stroke="#3FA06A" stroke-width="3" stroke-linecap="round"/></svg>` },
  telur: { name: 'Telur', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="17" rx="9" ry="11" fill="#FFF6E0" ${S}/></svg>` },
  tomat: { name: 'Tomat', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="18" r="10" fill="#E0583F" ${S}/><path d="M11 9l5 3 5-3M16 12V6" fill="none" stroke="#3FA06A" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  kecap: { name: 'Kecap', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 4h6v6l3 4v13a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V14l3-4Z" fill="#5B3A29" ${S}/><rect x="11" y="16" width="10" height="7" fill="#F2B632"/></svg>` },
  garam: { name: 'Garam', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 10h12l-1 18H11Z" fill="#FFFDF7" ${S}/><path d="M10 10q6-6 12 0" fill="#9AA7B8" ${S}/><circle cx="14" cy="8" r=".9" fill="#2B2F4A"/><circle cx="18" cy="8" r=".9" fill="#2B2F4A"/></svg>` },
  nasi: { name: 'Nasi', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16h24q-2 11-12 11T4 16Z" fill="#3F7FBF" ${S}/><path d="M6 16q2-8 10-8t10 8Z" fill="#FFFDF7" ${S}/></svg>` },
  daun: { name: 'Daun bawang', svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 28 22 6M12 28 26 10M10 28l6-16" fill="none" stroke="#3FA06A" stroke-width="3.5" stroke-linecap="round"/></svg>` },
};
