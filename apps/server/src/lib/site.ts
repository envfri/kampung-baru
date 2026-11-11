// Pengaturan situs (admin › Situs & SEO): tag SEO & pratinjau tautan yang disuntikkan ke index.html,
// robots.txt, sitemap.xml, dan mode perawatan. Nilai disimpan di tabel settings (kunci 'site').
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APP_VERSION, DEFAULT_SITE, OG_DEFAULT, maintenancePage, mergeSettings, socialLinks, type SiteSettings } from '@kb/shared';
import type { Db } from '../db/index';
import { config } from '../config';

const TTL = 5_000;
let cache: { at: number; value: SiteSettings } | null = null;

export async function getSite(db: Db): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const row = await db.one<{ value: any }>(`select value from settings where key = 'site'`);
  const value = mergeSettings(DEFAULT_SITE, row?.value ?? {}) as SiteSettings;
  cache = { at: Date.now(), value };
  return value;
}
export async function saveSite(db: Db, value: SiteSettings) {
  await db.query(`insert into settings (key, value) values ('site', $1::text::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(value)]);
  cache = null;
}
export const invalidateSite = () => { cache = null; };

/**
 * Perbaikan sekali jalan: akun Instagram bawaan v0.22.0 salah ketik (playbudi). Bila admin sudah menyimpan
 * Situs & SEO dengan nilai itu, ganti ke akun yang benar (@playbupi). Akun lain tidak disentuh.
 */
export async function migrateSite(db: Db) {
  const rows = await db.query(
    `update settings set value = jsonb_set(value, '{social,instagram}', '"playbupi"'), updated_at = now()
      where key = 'site' and lower(coalesce(value #>> '{social,instagram}', '')) in ('playbudi', '@playbudi', 'https://www.instagram.com/playbudi', 'https://instagram.com/playbudi')
      returning key`);
  cache = null;
  return rows.length > 0;
}

/** Boleh diindeks mesin pencari: hanya server produksi ber-HTTPS, dan admin tidak mematikannya. */
export function indexStatus(s: SiteSettings) {
  const why: string[] = [];
  if (!config.isProd) why.push('Server tidak berjalan dengan NODE_ENV=production.');
  if (!config.publicUrl.startsWith('https://')) why.push('PUBLIC_URL belum https://.');
  if (s.seo.index === false) why.push('Admin mematikan "Izinkan mesin pencari".');
  return { indexable: why.length === 0, why };
}

/* ---------------- gambar pratinjau ---------------- */

/** Ukuran gambar PNG / JPEG dari isi file (tanpa pustaka tambahan). */
export function imageSize(b: Buffer): { width: number; height: number } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

export interface OgImage { url: string; width?: number; height?: number; type?: string }
const mediaInfo = new Map<string, { type: string; width?: number; height?: number } | null>();
export async function ogImage(db: Db, s: SiteSettings): Promise<OgImage> {
  const v = String(s.seo.image ?? '').trim();
  const fallback = { url: config.publicUrl + OG_DEFAULT.path, width: OG_DEFAULT.width, height: OG_DEFAULT.height, type: OG_DEFAULT.type };
  const m = v.match(/^\/media\/([\w.-]+)$/);
  if (m) {
    if (!mediaInfo.has(m[1])) {
      const row = await db.one<{ mime: string; bytes: Buffer }>(`select mime, bytes from media where id = $1`, [m[1]]);
      mediaInfo.set(m[1], row ? { type: row.mime, ...(imageSize(Buffer.from(row.bytes)) ?? {}) } : null);
    }
    const info = mediaInfo.get(m[1]);
    return info ? { url: config.publicUrl + v, ...info } : fallback;
  }
  if (/^https:\/\/[^\s"<>]+$/.test(v)) return { url: v };
  return fallback;
}
export const forgetMediaInfo = (id?: string) => (id ? mediaInfo.delete(id) : mediaInfo.clear());

/* ---------------- tag <head> ---------------- */

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

export interface Invite { name: string; code: string }
/** Tag SEO, Open Graph, kartu X/Twitter, verifikasi, dan data terstruktur (JSON-LD) untuk index.html. */
export function seoHead(s: SiteSettings, img: OgImage, opts: { path: string; invite?: Invite | null; indexable: boolean }) {
  const U = config.publicUrl, home = U + '/';
  const name = s.seo.siteName || 'BUPI';
  const title = s.seo.title || name, desc = s.seo.description;
  const ogTitle = opts.invite ? `${opts.invite.name} ngajak kamu main ${name}!` : title;
  const ogDesc = opts.invite ? clip(`Masukkan kode teman ${opts.invite.code} biar langsung berteman. ${desc}`, 200) : desc;
  const robots = opts.indexable && opts.path === '/' ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow';
  const links = socialLinks(s.social);
  const x = links.find((l) => l.key === 'x');
  const alt = s.seo.imageAlt || title;
  const meta = (k: string, v: unknown, attr = 'name') => (v === undefined || v === null || v === '' ? '' : `<meta ${attr}="${k}" content="${esc(v)}" />`);
  const og = (k: string, v: unknown) => meta(k, v, 'property');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${U}/#website`, url: home, name, description: desc, inLanguage: 'id-ID', publisher: { '@id': `${U}/#org` } },
      {
        '@type': 'Organization', '@id': `${U}/#org`, name, url: home,
        logo: { '@type': 'ImageObject', url: `${U}/icons/icon-512.png`, width: 512, height: 512 },
        ...(links.length ? { sameAs: links.map((l) => l.url) } : {}),
      },
      {
        '@type': ['VideoGame', 'WebApplication'], '@id': `${U}/#game`, name, url: home, description: desc,
        image: img.url, inLanguage: 'id-ID', isAccessibleForFree: true,
        applicationCategory: 'GameApplication', applicationSubCategory: 'Virtual pet',
        operatingSystem: 'Android, iOS, Windows, macOS, ChromeOS', browserRequirements: 'Membutuhkan JavaScript. Bisa dipasang sebagai aplikasi (PWA).',
        genre: ['Virtual pet', 'Simulasi', 'Sosial', 'Kasual'], gamePlatform: ['Web browser', 'Android', 'iOS'], playMode: ['SinglePlayer', 'MultiPlayer'],
        softwareVersion: APP_VERSION,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR', availability: 'https://schema.org/InStock' },
        publisher: { '@id': `${U}/#org` },
      },
    ],
  };
  return [
    `<title>${esc(title)}</title>`,
    meta('description', desc),
    meta('keywords', s.seo.keywords),
    meta('robots', robots),
    meta('application-name', name),
    meta('author', name),
    meta('google-site-verification', s.seo.googleVerify),
    meta('msvalidate.01', s.seo.bingVerify),
    `<link rel="canonical" href="${esc(home)}" />`,
    `<link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png" />`,
    og('og:type', 'website'),
    og('og:site_name', name),
    og('og:locale', 'id_ID'),
    og('og:url', opts.invite ? `${U}/?undang=${encodeURIComponent(opts.invite.code)}` : home),
    og('og:title', ogTitle),
    og('og:description', ogDesc),
    og('og:image', img.url),
    img.url.startsWith('https://') ? og('og:image:secure_url', img.url) : '',
    og('og:image:type', img.type),
    og('og:image:width', img.width),
    og('og:image:height', img.height),
    og('og:image:alt', alt),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', ogTitle),
    meta('twitter:description', ogDesc),
    meta('twitter:image', img.url),
    meta('twitter:image:alt', alt),
    x ? meta('twitter:site', '@' + x.handle) : '',
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n    ');
}

/** index.html game dengan tag SEO terkini (file dibaca ulang hanya bila berubah). */
let indexCache: { file: string; mtime: number; html: string } | null = null;
export function renderIndex(file: string, head: string) {
  const mtime = statSync(file).mtimeMs;
  if (!indexCache || indexCache.file !== file || indexCache.mtime !== mtime) indexCache = { file, mtime, html: readFileSync(file, 'utf8') };
  const html = indexCache.html;
  if (/<!--seo-->[\s\S]*?<!--\/seo-->/.test(html)) return html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, () => head);
  // build lama tanpa penanda: buang judul & deskripsi bawaan, sisipkan sebelum </head>
  return html.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta name="description"[^>]*>/, '').replace('</head>', () => `    ${head}\n  </head>`);
}

/* ---------------- mode perawatan ---------------- */

let fontCss: string | null = null;
/** @font-face Baloo 2 dari hasil build game (nama file ber-hash), supaya halaman perawatan memakai huruf yang sama. */
function maintFont() {
  if (fontCss !== null) return fontCss;
  try {
    const files = readdirSync(join(config.gameDist, 'assets'));
    fontCss = [600, 800].map((w) => {
      const f = files.find((n) => n.startsWith(`baloo-2-latin-${w}-normal`) && n.endsWith('.woff2'));
      return f ? `@font-face{font-family:'Baloo 2';font-style:normal;font-weight:${w};font-display:swap;src:url(/assets/${f}) format('woff2')}` : '';
    }).join('');
  } catch { fontCss = ''; }
  return fontCss;
}

export function maintenanceInfo(s: SiteSettings) {
  const m = s.maintenance;
  return { title: m.title || DEFAULT_SITE.maintenance.title, message: m.message || DEFAULT_SITE.maintenance.message, until: m.until || null };
}
/** Detik untuk header Retry-After: sampai perkiraan selesai (2 menit – 1 hari), bawaan 30 menit. */
export function retryAfter(s: SiteSettings, now = Date.now()) {
  const t = Date.parse(s.maintenance.until || '');
  return Number.isFinite(t) && t > now ? Math.min(86_400, Math.max(120, Math.ceil((t - now) / 1000))) : 1800;
}
/** Halaman perawatan HTML + CSP dengan nonce untuk skrip kecilnya. */
export function maintenanceResponse(s: SiteSettings, kind: 'server' | 'preview' = 'server') {
  const nonce = randomBytes(16).toString('base64');
  const html = maintenancePage(maintenanceInfo(s), socialLinks(s.social), { kind, nonce, fontCss: maintFont() });
  const csp = `default-src 'self'; script-src 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  return { html, csp };
}

/** Jalur yang tetap jalan saat perawatan: panel admin, webhook pembayaran/email/WA, file statis, cek kesehatan. */
const MAINT_OPEN = [
  /^\/healthz$/, /^\/api\/(version|site)$/,
  /^\/admin(\/|$)/, /^\/api\/admin\//,
  /^\/(assets|icons|og|media|fonts)\//, /^\/(sw\.js|manifest\.webmanifest|robots\.txt|sitemap\.xml|favicon\.ico)$/,
  /^\/api\/payments\/(zepay\/webhook|midtrans\/notify)$/, /^\/api\/email\/(mailketing\/|unsubscribe)/, /^\/api\/wa\/klikflow\/webhook$/, /^\/pay\//,
];
export const maintenanceOpen = (path: string) => MAINT_OPEN.some((r) => r.test(path));
