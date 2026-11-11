// Situs & SEO: status perawatan publik, robots.txt, sitemap.xml, dan pengaturan admin (SEO, media sosial, mode perawatan).
import type { FastifyInstance } from 'fastify';
import { DEFAULT_SITE, SEO_LIMITS, SOCIALS, socialLink, socialLinks, type SiteSettings, type SocialKey } from '@kb/shared';
import type { Db } from '../db/index';
import { config } from '../config';
import { bad } from '../lib/core';
import { audit, loadAdmin, requireAdmin } from '../lib/auth';
import { BUILD } from '../lib/version';
import { getSite, indexStatus, maintenanceInfo, maintenanceResponse, ogImage, saveSite } from '../lib/site';

const text = (v: unknown, label: string, max: number, min = 0) => {
  const s = String(v ?? '').replace(/\r\n/g, '\n').trim();
  if (s.length < min) throw bad('invalid', `${label} wajib diisi.`);
  if (s.length > max) throw bad('invalid', `${label} maksimal ${max} karakter.`);
  if (/[<>]/.test(s)) throw bad('invalid', `${label} tidak boleh berisi tanda < atau >.`);
  return s;
};
/** Kode verifikasi: boleh menempel seluruh tag <meta ... content="..."> dari Search Console. */
const verifyCode = (v: unknown, label: string) => {
  let s = String(v ?? '').trim();
  const m = s.match(/content\s*=\s*["']([^"']+)["']/i);
  if (m) s = m[1].trim();
  if (s && !/^[\w.-]{6,120}$/.test(s)) throw bad('invalid', `${label} tidak valid. Salin nilai content="..." dari tag meta verifikasi.`);
  return s;
};

export default async function siteRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const mod = { preHandler: requireAdmin(db, 'moderator') };
  const adm = { preHandler: requireAdmin(db, 'admin') };

  /** Status perawatan & akun media sosial (publik, dipakai game dan halaman perawatan). */
  app.get('/api/site', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const s = await getSite(db);
    const m = s.maintenance;
    const bypass = !!m.on && m.adminBypass !== false && !!(await loadAdmin(db, req));
    return { maintenance: m.on ? { on: true, ...maintenanceInfo(s), bypass } : { on: false }, social: socialLinks(s.social) };
  });

  app.get('/robots.txt', async (_req, reply) => {
    const s = await getSite(db);
    const ix = indexStatus(s);
    // Server non-produksi (staging/uji) ditutup total. Di produksi tautan tetap boleh dibaca bot pratinjau
    // (WhatsApp, Facebook, X); bila admin mematikan indeks, halamannya memakai meta robots noindex.
    const lines = !config.isProd
      ? ['User-agent: *', 'Disallow: /']
      : ['User-agent: *', 'Allow: /', 'Disallow: /admin/', 'Disallow: /pay/', ...(ix.indexable ? ['', `Sitemap: ${config.publicUrl}/sitemap.xml`] : [])];
    reply.header('Cache-Control', 'public, max-age=3600').type('text/plain; charset=utf-8');
    return lines.join('\n') + '\n';
  });

  app.get('/sitemap.xml', async (_req, reply) => {
    const s = await getSite(db);
    const img = await ogImage(db, s);
    const last = (BUILD.builtAt ?? BUILD.startedAt).slice(0, 10);
    const x = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    reply.header('Cache-Control', 'public, max-age=3600').type('application/xml; charset=utf-8');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${x(config.publicUrl)}/</loc>
    <lastmod>${last}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image><image:loc>${x(img.url)}</image:loc></image:image>
  </url>
</urlset>
`;
  });

  app.get('/favicon.ico', (_req, reply) => reply.header('Cache-Control', 'public, max-age=86400').redirect('/icons/icon-192.png', 301));

  /* ---------------- admin ---------------- */

  async function view() {
    const s = await getSite(db);
    const ix = indexStatus(s);
    return {
      site: s, defaults: DEFAULT_SITE, limits: SEO_LIMITS,
      info: {
        publicUrl: config.publicUrl, production: config.isProd, indexable: ix.indexable, why: ix.why,
        image: await ogImage(db, s),
        robots: `${config.publicUrl}/robots.txt`, sitemap: `${config.publicUrl}/sitemap.xml`,
      },
    };
  }
  app.get('/api/admin/site', mod, async () => view());

  app.put('/api/admin/site', adm, async (req: any) => {
    const b = req.body ?? {};
    const cur = await getSite(db);
    const seo = b.seo ?? {}, soc = b.social ?? {}, mt = b.maintenance ?? {};
    const image = String(seo.image ?? '').trim();
    if (image) {
      const media = image.match(/^\/media\/([\w.-]+)$/);
      if (media) {
        if (!(await db.one(`select 1 from media where id = $1`, [media[1]]))) throw bad('invalid', 'Gambar pratinjau tidak ditemukan di Media.');
      } else if (!/^https:\/\/[^\s"<>]{4,500}$/.test(image)) throw bad('invalid', 'Gambar pratinjau harus dari menu Media atau URL https://.');
    }
    const social = {} as Record<SocialKey, string>;
    for (const s of SOCIALS) {
      const raw = String(soc[s.key] ?? '').trim();
      if (raw && !socialLink(s.key, raw)) throw bad('invalid', `Akun ${s.label} tidak valid. Isi nama akun (mis. @playbupi) atau URL profil ${s.hosts[0]}.`);
      social[s.key] = raw;
    }
    let until = '';
    if (mt.until) {
      const t = Date.parse(String(mt.until));
      if (!Number.isFinite(t)) throw bad('invalid', 'Perkiraan selesai tidak valid.');
      until = new Date(t).toISOString();
    }
    const next: SiteSettings = {
      seo: {
        siteName: text(seo.siteName, 'Nama situs', 40, 1),
        title: text(seo.title, 'Judul', 120, 1),
        description: text(seo.description, 'Deskripsi', 320, 1),
        keywords: text(seo.keywords, 'Kata kunci', SEO_LIMITS.keywords),
        image,
        imageAlt: text(seo.imageAlt, 'Teks alternatif gambar', SEO_LIMITS.imageAlt),
        index: seo.index !== false,
        googleVerify: verifyCode(seo.googleVerify, 'Kode verifikasi Google'),
        bingVerify: verifyCode(seo.bingVerify, 'Kode verifikasi Bing'),
      },
      social,
      maintenance: {
        on: mt.on === true,
        title: text(mt.title, 'Judul perawatan', SEO_LIMITS.maintTitle, 1),
        message: text(mt.message, 'Pesan perawatan', SEO_LIMITS.maintMessage, 1),
        until,
        adminBypass: mt.adminBypass !== false,
      },
    };
    await saveSite(db, next);
    if (next.maintenance.on !== cur.maintenance.on) {
      await audit(db, req, next.maintenance.on ? 'maintenance_on' : 'maintenance_off', undefined, { until: next.maintenance.until || null });
      req.log.warn({ admin: req.admin?.email, on: next.maintenance.on }, 'mode perawatan diubah');
    }
    await audit(db, req, 'site_update', undefined, { seo: next.seo.title, index: next.seo.index, maintenance: next.maintenance.on });
    return view();
  });

  /** Halaman perawatan seperti yang dilihat pemain (pengaturan tersimpan), untuk dicek admin. */
  app.get('/api/admin/site/maintenance-preview', mod, async (_req, reply) => {
    const { html, csp } = maintenanceResponse(await getSite(db), 'preview');
    reply.header('Content-Security-Policy', csp).header('Cache-Control', 'no-store').type('text/html; charset=utf-8');
    return html;
  });
}
