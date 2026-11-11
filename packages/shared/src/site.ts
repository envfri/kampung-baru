// Pengaturan situs (admin › Situs & SEO): SEO & pratinjau tautan, akun media sosial, dan mode perawatan.
// Disimpan terpisah dari pengaturan game (tabel settings, kunci 'site').
// Halaman perawatan dibuat di sini supaya server (halaman 503), game (layar di dalam aplikasi),
// dan halaman statis Caddy (saat server sedang dimulai ulang) tampil sama persis.
import { renderPet, type PetLook } from './art';

export const DEFAULT_SITE = {
  seo: {
    siteName: 'BUPI',
    title: 'BUPI – Game Pet Lucu: Rawat, Hias Rumah & Main Bareng',
    description: 'Main BUPI gratis langsung di HP: rawat pet lucu, hias rumah, kunjungi teman, ngobrol di alun-alun, dan main mini-game Nusantara. Tanpa unduh aplikasi.',
    keywords: 'game pet, game virtual pet, game pet online, game hias rumah, game kampung, game Indonesia, game browser, game HP gratis, BUPI',
    /** kosong = gambar bawaan (/og/bupi.jpg); atau /media/<id> dari menu Media; atau URL https */
    image: '',
    imageAlt: 'Pet-pet BUPI bermain di depan rumah di Kampung Bupi',
    /** izinkan Google & mesin pencari lain mengindeks (hanya berlaku di NODE_ENV=production) */
    index: true,
    /** isi "content" dari meta verifikasi Google Search Console / Bing Webmaster (opsional) */
    googleVerify: '',
    bingVerify: '',
  },
  social: { instagram: 'playbupi', tiktok: '', youtube: '', facebook: '', x: '' },
  maintenance: {
    on: false,
    title: 'Kampung BUPI lagi dirapikan',
    message: 'Warga kampung sedang gotong royong memperbaiki dan menambah hal baru. Progres kamu aman, sebentar lagi kita main bareng lagi!',
    /** perkiraan selesai (ISO), kosong = tidak ditampilkan */
    until: '',
    /** admin yang sedang masuk di panel admin (browser yang sama) tetap bisa main untuk mengecek */
    adminBypass: true,
  },
};
export type SiteSettings = typeof DEFAULT_SITE;
export const SEO_LIMITS = { title: 60, description: 160, keywords: 300, imageAlt: 160, maintTitle: 80, maintMessage: 400 };
/** gambar pratinjau bawaan (dibuat oleh scripts/og-image.ts, 1200×630) */
export const OG_DEFAULT = { path: '/og/bupi.jpg', width: 1200, height: 630, type: 'image/jpeg' };

export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', base: 'https://www.instagram.com/', hosts: ['instagram.com'] },
  { key: 'tiktok', label: 'TikTok', base: 'https://www.tiktok.com/@', hosts: ['tiktok.com'] },
  { key: 'youtube', label: 'YouTube', base: 'https://www.youtube.com/@', hosts: ['youtube.com', 'youtu.be'] },
  { key: 'facebook', label: 'Facebook', base: 'https://www.facebook.com/', hosts: ['facebook.com', 'fb.com'] },
  { key: 'x', label: 'X (Twitter)', base: 'https://x.com/', hosts: ['x.com', 'twitter.com'] },
] as const;
export type SocialKey = (typeof SOCIALS)[number]['key'];
export interface SocialLink { key: SocialKey; label: string; handle: string; url: string }

/**
 * Akun media sosial dari isian admin: "@playbupi", "playbupi", atau URL profil lengkap.
 * null bila kosong atau tidak valid (bukan domain platformnya, karakter aneh).
 */
export function socialLink(key: SocialKey, raw: unknown): SocialLink | null {
  const s = SOCIALS.find((x) => x.key === key);
  const v = String(raw ?? '').trim();
  if (!s || !v) return null;
  if (/^https?:\/\//i.test(v)) {
    let u: URL;
    try { u = new URL(v); } catch { return null; }
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    if (u.protocol !== 'https:' || !s.hosts.some((h) => host === h || host.endsWith('.' + h))) return null;
    const seg = u.pathname.split('/').filter(Boolean);
    const last = (seg[0] === 'channel' || seg[0] === 'c' || seg[0] === 'user' ? seg[1] : seg[0]) ?? '';
    const handle = decodeURIComponent(last).replace(/^@/, '');
    if (!/^[\w.-]{1,60}$/.test(handle)) return null;
    u.hash = '';
    return { key, label: s.label, handle, url: u.href };
  }
  const handle = v.replace(/^@/, '');
  if (!/^[\w.-]{1,60}$/.test(handle)) return null;
  return { key, label: s.label, handle, url: s.base + handle };
}
export function socialLinks(social: Partial<Record<SocialKey, unknown>> | null | undefined): SocialLink[] {
  return SOCIALS.map((s) => socialLink(s.key, social?.[s.key])).filter((x): x is SocialLink => !!x);
}

export const SOCIAL_ICONS: Record<SocialKey, string> = {
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v11.6a3.6 3.6 0 1 1-3.6-3.6"/><path d="M14 3c.6 2.7 2.4 4.4 5.2 4.7"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M14.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H9v3h2.5V21z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 4l14 16M19 4L5 20"/></svg>`,
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "2 jam 15 menit", "3 hari 4 jam", ... (dipakai juga oleh skrip halaman perawatan) */
export function durText(ms: number) {
  if (ms < 60000) return 'kurang dari 1 menit';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 48) return `${h} jam${r ? ` ${r} menit` : ''}`;
  const d = Math.floor(h / 24), hh = h % 24;
  return `${d} hari${hh ? ` ${hh} jam` : ''}`;
}
/** Perkiraan selesai perawatan untuk ditampilkan (WIB), atau null bila tidak diisi. */
export function etaText(until: string | null | undefined, now = Date.now()) {
  const t = until ? Date.parse(until) : NaN;
  if (!Number.isFinite(t)) return null;
  const at = new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  return { at, left: t - now > 0 ? `sekitar ${durText(t - now)} lagi` : 'sebentar lagi, ya!' };
}

/* ------------------------------------------------------------------ */
/* Adegan animasi: warga kampung gotong royong merapikan rumah           */
/* ------------------------------------------------------------------ */

const INK = '#2B2F4A';
const FLAGS = ['#E0583F', '#F2B632', '#3FA06A', '#3F7FBF', '#E7A1C9', '#FFFDF7'];
function bunting() {
  let out = `<path d="M6 12Q180 56 354 12" fill="none" stroke="${INK}" stroke-width="2"/>`;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, u = 1 - t;
    const x = u * u * 6 + 2 * u * t * 180 + t * t * 354, y = u * u * 12 + 2 * u * t * 56 + t * t * 12;
    out += `<g transform="translate(${x.toFixed(1)} ${(y - 1).toFixed(1)})"><path class="mt-flag" style="animation-delay:-${(i * 0.17).toFixed(2)}s" d="M-8 0H8L0 15Z" fill="${FLAGS[i % FLAGS.length]}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></g>`;
  }
  return out;
}
const cloud = (x: number, y: number, s: number, cls: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="mt-cloud ${cls}"><path d="M-30 8a12 12 0 0 1 6-20a16 16 0 0 1 29-6a12 12 0 0 1 21 8a10 10 0 0 1 4 18z" fill="#FFFFFF" opacity=".92"/></g></g>`;
const helmet = `<path d="M-38 -68Q-37 -106 0 -106Q37 -106 38 -68Z" fill="#F2B632" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-11 -105Q-14 -86 -13 -70M11 -105Q14 -86 13 -70" fill="none" stroke="#C98F16" stroke-width="3" stroke-linecap="round"/><rect x="-47" y="-75" width="94" height="10" rx="5" fill="#F7C548" stroke="${INK}" stroke-width="3"/>`;
const hammer = `<g class="mt-ham"><path d="M34 -34H74" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M34 -34H74" stroke="#C98B55" stroke-width="5" stroke-linecap="round"/><rect x="70" y="-50" width="14" height="32" rx="3" fill="#7F8BA3" stroke="${INK}" stroke-width="3"/><rect x="72" y="-47" width="4" height="26" rx="2" fill="#B8C2D6"/></g>`;
const bricks = `<g transform="translate(0 -110)"><rect x="-26" y="-12" width="52" height="12" rx="2" fill="#D9653B" stroke="${INK}" stroke-width="2.5"/><rect x="-20" y="-24" width="40" height="12" rx="2" fill="#E57B4E" stroke="${INK}" stroke-width="2.5"/><path d="M-6 -12V0M8 -24V-12" stroke="${INK}" stroke-width="2"/></g>`;
const HAMMER_PET: PetLook = { color: '#F6B7A8', ear: 'kucing', eyes: 'senyum' } as PetLook;
const CARRY_PET: PetLook = { color: '#9FD0E8', ear: 'kelinci', eyes: 'bulat' } as PetLook;

/** SVG adegan perawatan (tanpa teks), animasi lewat MAINT_CSS. */
export function maintenanceScene() {
  return `<svg class="mt-scene" viewBox="0 0 360 236" role="img" aria-label="Pet BUPI memakai helm proyek sedang memalu papan, temannya menyunggi batu bata">
<g class="mt-sun" transform="translate(44 46)"><g class="mt-rays">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45})" d="M0 -27V-21" stroke="#F2B632" stroke-width="4" stroke-linecap="round"/>`).join('')}</g><circle r="15" fill="#F7C548" stroke="${INK}" stroke-width="2.5"/></g>
${cloud(110, 70, 1, 'mt-c1')}${cloud(296, 58, 0.8, 'mt-c2')}
${bunting()}
<path d="M16 212Q96 190 180 196T344 204Q357 205 356 217Q355 231 336 231H26Q7 231 6 219Q6 211 16 212Z" fill="#A8D8A0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M30 214q4-8 8 0M300 220q4-8 8 0M196 222q4-8 8 0" fill="none" stroke="#5E9E5A" stroke-width="2.5" stroke-linecap="round"/>
<g class="mt-house">
  <rect x="38" y="140" width="104" height="70" fill="#FFFDF7" stroke="${INK}" stroke-width="3"/>
  <path d="M26 144L90 100 154 144Z" fill="#E0583F" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M46 130L90 100M134 130L90 100M60 121H120" stroke="#B9452F" stroke-width="2.4" fill="none"/>
  <rect x="98" y="114" width="16" height="11" rx="2" fill="#F2EEE3" stroke="${INK}" stroke-width="2" transform="rotate(-8 106 120)"/>
  <rect x="78" y="168" width="24" height="42" rx="2" fill="#B98A64" stroke="${INK}" stroke-width="2.6"/><circle cx="97" cy="190" r="2" fill="${INK}"/>
  <rect x="50" y="156" width="20" height="18" rx="2" fill="#BFE3F5" stroke="${INK}" stroke-width="2.4"/><path d="M60 156V174M50 165H70" stroke="${INK}" stroke-width="2"/>
  <rect x="112" y="156" width="20" height="18" rx="2" fill="#BFE3F5" stroke="${INK}" stroke-width="2.4"/><path d="M122 156V174M112 165H132" stroke="${INK}" stroke-width="2"/>
</g>
<g class="mt-scaffold" stroke="${INK}" stroke-width="2" stroke-linecap="round">
  <path d="M142 96V210M174 96V210" stroke="#D9B36A" stroke-width="6"/><path d="M142 96V210M174 96V210" fill="none" stroke-width="1.6" opacity=".5"/>
  <path d="M136 128H180M136 166H180" stroke="#D9B36A" stroke-width="5"/><path d="M142 166L174 128" stroke="#D9B36A" stroke-width="4"/>
  <rect x="128" y="122" width="58" height="6" rx="2" fill="#B98A64"/>
  <path d="M140 128h4M172 128h4M140 166h4M172 166h4" stroke-width="3"/>
</g>
<g transform="translate(160 210)"><path d="M-10 -14h20l-2 14h-16z" fill="#3F7FBF" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M-10 -14q10 6 20 0" fill="#FFFDF7" stroke="${INK}" stroke-width="2"/></g>
<g transform="translate(184 214)"><g class="mt-walk"><g class="mt-hop"><g transform="scale(.5)">${renderPet(CARRY_PET, [], { mood: 'senang' })}${bricks}</g></g></g></g>
<g class="mt-sign"><rect x="247" y="140" width="9" height="74" rx="2" fill="#B98A64" stroke="${INK}" stroke-width="2.6"/>
  <rect x="206" y="104" width="92" height="44" rx="7" fill="#FFFDF7" stroke="${INK}" stroke-width="3"/>
  <path d="M209 107h86v9h-86z" fill="#F2B632"/><path d="M216 107l-6 9M228 107l-6 9M240 107l-6 9M252 107l-6 9M264 107l-6 9M276 107l-6 9M288 107l-6 9" stroke="${INK}" stroke-width="2.4"/>
  <text x="252" y="138" text-anchor="middle" font-size="15" font-weight="800" fill="${INK}" style="font-family:inherit">DIRAPIKAN</text>
</g>
<g class="mt-spark" transform="translate(259 186)"><g class="mt-spark-in"><path d="M0 -12L3 -3 12 0 3 3 0 12-3 3-12 0-3-3Z" fill="#F7C548" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><text x="-13" y="-18" text-anchor="end" font-size="12.5" font-weight="800" fill="${INK}" style="font-family:inherit">tok!</text></g></g>
<g transform="translate(304 216) scale(-.62 .62)"><g class="mt-body">${renderPet(HAMMER_PET, [], { mood: 'senang' })}${helmet}</g>${hammer}</g>
</svg>`;
}

/** CSS halaman perawatan (semua kelas berawalan mt-, aman disisipkan di dalam game). */
export const MAINT_CSS = `
.mt{min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:max(22px,env(safe-area-inset-top)) 16px max(26px,env(safe-area-inset-bottom));text-align:center;color:${INK};font-family:'Baloo 2',ui-rounded,'Trebuchet MS',system-ui,sans-serif;background:radial-gradient(120% 70% at 50% 15%,#EAF6F0 0%,#D3E9DF 45%,#B7D7CA 100%)}
.mt *{box-sizing:border-box}
.mt-scene{display:block;width:min(100%,440px);height:auto;overflow:visible;margin-bottom:-4px}
.mt-chip{display:inline-flex;align-items:center;gap:6px;background:${INK};color:#F7C548;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;padding:3px 12px 2px;border-radius:999px}
.mt h1{margin:0;font-size:clamp(27px,7.2vw,38px);line-height:1.08;font-weight:800;max-width:18ch;text-wrap:balance}
.mt-msg{margin:0;max-width:36ch;font-size:16.5px;font-weight:600;line-height:1.45}
.mt-tape{width:min(100%,320px);height:14px;border:2.5px solid ${INK};border-radius:999px;background:repeating-linear-gradient(45deg,#F2B632 0 10px,${INK} 10px 20px);background-size:28.28px 100%;animation:mt-tape 1.1s linear infinite}
.mt-eta{margin:2px 0 0;display:flex;flex-direction:column;gap:1px;font-size:15px;font-weight:600;background:#FFFDF7;border:2.5px solid ${INK};border-radius:14px;box-shadow:0 3px 0 ${INK};padding:7px 16px}
.mt-eta b{font-size:16.5px;font-weight:800}
.mt-eta span{color:#3D6B5C;font-weight:700}
.mt-soc{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:4px;font-weight:700;font-size:15px}
.mt-ig{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#fff;font-weight:800;font-size:18px;line-height:1;padding:11px 20px 10px;border-radius:16px;border:2.5px solid ${INK};box-shadow:0 4px 0 ${INK};background:linear-gradient(45deg,#F9A13A 0%,#E1306C 50%,#8A3AB9 100%);transition:transform .12s}
.mt-ig svg{width:24px;height:24px;flex:none}
.mt-ig:active{transform:translateY(3px);box-shadow:0 1px 0 ${INK}}
.mt-more{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.mt-s{display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:${INK};background:#FFFDF7;border:2px solid ${INK};border-radius:12px;padding:6px 11px;font-weight:700;font-size:14px}
.mt-s svg{width:18px;height:18px}
.mt-btn{font:inherit;font-weight:800;font-size:15px;color:${INK};background:#FFFDF7;border:2.5px solid ${INK};border-radius:13px;box-shadow:0 3px 0 ${INK};padding:7px 18px;min-height:42px;cursor:pointer;margin-top:4px}
.mt-btn:disabled{opacity:.6}
.mt-note{font-size:13px;font-weight:600;color:#4A5568;max-width:34ch}
.mt a:focus-visible,.mt button:focus-visible{outline:3px solid #3F7FBF;outline-offset:3px}
.mt-flag{transform-box:fill-box;transform-origin:50% 0;animation:mt-sway 2.4s ease-in-out infinite alternate}
.mt-rays{animation:mt-spin 18s linear infinite;transform-box:fill-box;transform-origin:center}
.mt-cloud{animation:mt-drift 7s ease-in-out infinite alternate}
.mt-c2{animation-duration:9s;animation-direction:alternate-reverse}
.mt-ham{transform-box:fill-box;transform-origin:0% 50%;animation:mt-ham 1.1s infinite}
.mt-body{transform-box:fill-box;transform-origin:50% 100%;animation:mt-squash 1.1s infinite}
.mt-sign{transform-box:fill-box;transform-origin:50% 100%;animation:mt-sign 1.1s infinite}
.mt-spark-in{transform-box:fill-box;transform-origin:center;opacity:0;animation:mt-spark 1.1s infinite}
.mt-walk{transform-box:fill-box;transform-origin:50% 100%;animation:mt-walk 8s linear infinite}
.mt-hop{animation:mt-hop .42s ease-in-out infinite alternate}
@keyframes mt-tape{to{background-position:28.28px 0}}
@keyframes mt-sway{from{transform:rotate(-7deg)}to{transform:rotate(7deg)}}
@keyframes mt-spin{to{transform:rotate(360deg)}}
@keyframes mt-drift{from{transform:translateX(-10px)}to{transform:translateX(12px)}}
@keyframes mt-ham{0%{transform:rotate(-50deg)}52%{transform:rotate(-68deg);animation-timing-function:cubic-bezier(.6,0,.9,.4)}66%{transform:rotate(6deg)}72%{transform:rotate(-2deg)}100%{transform:rotate(-50deg)}}
@keyframes mt-squash{0%,100%{transform:none}52%{transform:translateY(-3px) scaleY(1.02)}66%{transform:translateY(1px) scaleY(.96)}76%{transform:none}}
@keyframes mt-sign{0%,64%,100%{transform:none}68%{transform:rotate(-3deg)}76%{transform:rotate(1.6deg)}84%{transform:rotate(-.7deg)}92%{transform:none}}
@keyframes mt-spark{0%,63%{opacity:0;transform:scale(.3)}67%{opacity:1;transform:scale(1.15)}80%{opacity:1;transform:scale(1)}90%,100%{opacity:0;transform:scale(.8)}}
@keyframes mt-walk{0%{transform:translateX(0)}46%{transform:translateX(38px)}50%{transform:translateX(38px) scaleX(-1)}96%{transform:translateX(0) scaleX(-1)}100%{transform:translateX(0)}}
@keyframes mt-hop{from{transform:translateY(0)}to{transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.mt *{animation:none!important}.mt-spark-in{opacity:1}}
`;

export interface MaintInfo { title: string; message: string; until?: string | null }

/** Isi halaman perawatan (elemen <main class="mt">). Teks dari admin di-escape. */
export function maintenanceHTML(m: MaintInfo, links: SocialLink[], now = Date.now()) {
  const eta = etaText(m.until, now);
  const ig = links.find((l) => l.key === 'instagram');
  const rest = links.filter((l) => l !== ig);
  const soc = links.length
    ? `<div class="mt-soc"><span>Kabar terbaru ada di</span>${ig ? `<a class="mt-ig" href="${esc(ig.url)}" target="_blank" rel="noopener">${SOCIAL_ICONS.instagram}<span>@${esc(ig.handle)}</span></a>` : ''}${rest.length ? `<div class="mt-more">${rest.map((l) => `<a class="mt-s" href="${esc(l.url)}" target="_blank" rel="noopener" aria-label="${esc(l.label)} @${esc(l.handle)}">${SOCIAL_ICONS[l.key]}<span>${esc(l.label)}</span></a>`).join('')}</div>` : ''}</div>`
    : '';
  return `<main class="mt" data-until="${esc(m.until ?? '')}">
${maintenanceScene()}
<span class="mt-chip">Sedang perawatan</span>
<h1>${esc(m.title)}</h1>
<p class="mt-msg">${esc(m.message).replace(/\r?\n/g, '<br>')}</p>
<div class="mt-tape" aria-hidden="true"></div>
${eta ? `<p class="mt-eta">Perkiraan buka lagi <b>${esc(eta.at)}</b><span data-mt-left>${esc(eta.left)}</span></p>` : ''}
${soc}
<button type="button" class="mt-btn" data-mt-check>Cek lagi</button>
<small class="mt-note">Progres dan barang kamu aman. Halaman ini terbuka sendiri begitu BUPI siap.</small>
</main>`;
}

/**
 * Skrip kecil untuk halaman perawatan di luar game: hitung mundur & cek otomatis.
 * kind "server": tanya /api/site, muat ulang saat perawatan selesai.
 * kind "static" (halaman Caddy saat server mati): muat ulang begitu server menjawab lagi.
 * kind "preview" (pratinjau admin): tanpa cek otomatis.
 */
export function maintenanceScript(kind: 'server' | 'static' | 'preview') {
  const done = kind === 'preview' ? '' : kind === 'server'
    ? `fetch('/api/site',{cache:'no-store'}).then(function(r){return r.json()}).then(function(s){var m=s&&s.maintenance;if(!m||!m.on||m.bypass)location.reload()}).catch(function(){})`
    : `fetch('/healthz',{cache:'no-store'}).then(function(r){if(r.ok)location.reload()}).catch(function(){})`;
  return `(function(){var root=document.querySelector('.mt');if(!root)return;var until=Date.parse(root.getAttribute('data-until')||'');
var dur=${durText.toString().replace(/\s+/g, ' ')};
function tick(){var el=root.querySelector('[data-mt-left]');if(!el||!isFinite(until))return;var ms=until-Date.now();el.textContent=ms>0?'sekitar '+dur(ms)+' lagi':'sebentar lagi, ya!'}
function check(){${done}}
setInterval(tick,30000);setInterval(check,${kind === 'server' ? 20000 : 5000});
var b=root.querySelector('[data-mt-check]');if(b)b.addEventListener('click',function(){b.disabled=true;b.textContent='Mengecek\\u2026';check();setTimeout(function(){b.disabled=false;b.textContent='Cek lagi'},2500)});})();`;
}

/** Halaman HTML lengkap (dipakai server untuk 503 dan untuk halaman statis Caddy). */
export function maintenancePage(m: MaintInfo, links: SocialLink[], opts: { kind: 'server' | 'static' | 'preview'; nonce?: string; fontCss?: string; now?: number }) {
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(m.title)} · BUPI</title><meta name="robots" content="noindex"><meta name="theme-color" content="#B7D7CA">
<meta name="description" content="${esc(m.message)}">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<style${opts.nonce ? ` nonce="${opts.nonce}"` : ''}>${opts.fontCss ?? ''}html,body{margin:0;height:100%;background:#B7D7CA}${MAINT_CSS}</style></head>
<body>${maintenanceHTML(m, links, opts.now)}
<script${opts.nonce ? ` nonce="${opts.nonce}"` : ''}>${maintenanceScript(opts.kind)}</script></body></html>`;
}
