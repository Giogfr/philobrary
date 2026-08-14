/**
 * Generates public/sitemap.xml with every published paper URL, hreflang
 * alternates for every language version, and image entries for the OG covers.
 * Runs before `vite build` (Vercel + local). Falls back to a minimal sitemap
 * if the Firebase RTDB read fails so the build never breaks.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://philobrary.vercel.app';
const DB_URL = 'https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app';
const LANGS = ['en', 'ka', 'ru', 'pl', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ja', 'zh', 'uk'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const iso = (d) => {
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
};

function alternates(slug) {
  return LANGS.map((l) =>
    `      <xhtml:link rel="alternate" hreflang="${l}" href="${BASE}/${l}/p/${esc(slug)}"/>`
  ).join('\n') + `\n      <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/p/${esc(slug)}"/>`;
}

async function main() {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];

  lines.push(`  <url>
    <loc>${BASE}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);

  for (const staticPath of ['/tos', '/privacy', '/contact', '/request']) {
    lines.push(`  <url>
    <loc>${BASE}${staticPath}</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>`);
  }

  const escSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const tagSlugs = new Set();

  // Map tag ids -> url slugs (derived from tag NAME, matching the /t/:slug route).
  try {
    const res = await fetch(`${DB_URL}/tags.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        Object.values(data).forEach((tag) => {
          if (tag && typeof tag.name === 'string' && tag.name.trim()) {
            tagSlugs.add(escSlug(tag.name));
          }
        });
      }
    }
  } catch (e) {
    console.warn('Sitemap generation: could not fetch tags.', e?.message || e);
  }

  try {
    const res = await fetch(`${DB_URL}/papers.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const now = Date.now();
    if (data && typeof data === 'object') {
      const papers = Object.values(data).filter((p) => {
        if (p.status === 'published') return true;
        if (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now) return true;
        return false;
      });
      const seen = new Set();
      for (const p of papers) {
        if (!p.slug || seen.has(p.slug)) continue;
        seen.add(p.slug);
        const lastmod = iso(p.updatedAt);
        lines.push(`  <url>
    <loc>${BASE}/p/${esc(p.slug)}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${alternates(p.slug)}
    <image:image>
      <image:loc>${BASE}/og/${esc(p.slug)}.png</image:loc>
      <image:title>${esc(p.title || '')}</image:title>
    </image:image>
  </url>`);
      }
    }
  } catch (e) {
    console.warn('Sitemap generation: could not fetch papers, using static URLs only.', e?.message || e);
  }

  // Topic (tag) pages — every tag currently attached to a published paper.
  for (const slug of tagSlugs) {
    lines.push(`  <url>
    <loc>${BASE}/t/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  lines.push('</urlset>');
  const out = resolve(ROOT, 'public/sitemap.xml');
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`Sitemap written: ${out} (${lines.length - 2} URLs)`);
}

main();
