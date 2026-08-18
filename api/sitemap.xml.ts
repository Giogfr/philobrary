const BASE = 'https://philobrary.vercel.app';
const DB_URL = 'https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app';
const LANGS = ['en', 'ka', 'ru', 'pl', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ja', 'zh', 'uk'];

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const iso = (d?: string) => {
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
};

const escSlug = (s: string) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

export async function GET() {
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

  const tagSlugs = new Set<string>();
  const papers: any[] = [];
  try {
    const [papersRes, tagsRes] = await Promise.all([
      fetch(`${DB_URL}/papers.json`),
      fetch(`${DB_URL}/tags.json`),
    ]);
    if (tagsRes.ok) {
      const tagsData = await tagsRes.json();
      if (tagsData && typeof tagsData === 'object') {
        Object.values(tagsData).forEach((tag: any) => {
          if (tag && typeof tag.name === 'string' && tag.name.trim()) tagSlugs.add(escSlug(tag.name));
        });
      }
    }
    if (papersRes.ok) {
      const papersData = await papersRes.json();
      if (papersData && typeof papersData === 'object') papers.push(...Object.values(papersData));
    }
  } catch {
    /* fall back to static URLs only */
  }

  const now = Date.now();
  const seen = new Set<string>();
  for (const p of papers) {
    const isLive =
      p.status === 'published' ||
      (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now);
    if (!isLive || !p.slug || seen.has(p.slug)) continue;
    seen.add(p.slug);
    const lastmod = iso(p.updatedAt);
    const alternates =
      LANGS.map((l) => `      <xhtml:link rel="alternate" hreflang="${l}" href="${BASE}/${l}/p/${esc(p.slug)}"/>`).join('\n') +
      `\n      <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/p/${esc(p.slug)}"/>`;
    lines.push(`  <url>
    <loc>${BASE}/p/${esc(p.slug)}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${alternates}
    <image:image>
      <image:loc>${BASE}/assets/logo-512.png</image:loc>
      <image:title>${esc(p.title || '')}</image:title>
    </image:image>
  </url>`);
  }

  for (const slug of tagSlugs) {
    lines.push(`  <url>
    <loc>${BASE}/t/${esc(slug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  lines.push('</urlset>');

  return new Response(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
