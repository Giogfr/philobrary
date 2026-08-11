/**
 * Generates public/sitemap.xml with every published paper URL.
 * Runs before `vite build` (Vercel + local). Falls back to a minimal
 * sitemap if the Firebase RTDB read fails so the build never breaks.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://philobrary.vercel.app';
const DB_URL = 'https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const url = (loc, changefreq = 'weekly', priority = 0.7) =>
  `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

async function main() {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  lines.push(url(`${BASE}/`, 'weekly', '1.0'));
  lines.push(url(`${BASE}/saved`, 'monthly', '0.3'));
  lines.push(url(`${BASE}/login`, 'monthly', '0.2'));
  lines.push(url(`${BASE}/profile`, 'monthly', '0.2'));

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
        lines.push(url(`${BASE}/p/${esc(p.slug)}`, 'weekly', '0.8'));
      }
    }
  } catch (e) {
    console.warn('Sitemap generation: could not fetch papers, using static URLs only.', e?.message || e);
  }

  lines.push('</urlset>');
  const out = resolve(ROOT, 'public/sitemap.xml');
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`Sitemap written: ${out} (${lines.length - 2} URLs)`);
}

main();
