const DB_URL = 'https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app';
const BASE = 'https://philobrary.vercel.app';

export async function GET() {
  let papers: any[] = [];
  let tags: Record<string, any> = {};

  try {
    const [papersRes, tagsRes] = await Promise.all([
      fetch(`${DB_URL}/papers.json`),
      fetch(`${DB_URL}/tags.json`),
    ]);
    if (papersRes.ok) {
      const data = await papersRes.json();
      if (data && typeof data === 'object') papers = Object.values(data);
    }
    if (tagsRes.ok) {
      const data = await tagsRes.json();
      if (data && typeof data === 'object') tags = data;
    }
  } catch { /* return empty */ }

  const published = papers.filter(p => p.status === 'published');

  const tagMap: Record<string, string> = {};
  Object.values(tags).forEach((t: any) => {
    if (t?.id && t?.name) tagMap[t.id] = t.name;
  });

  const body = {
    name: 'Philobrary',
    description: 'A curated digital library of philosophy essays, thinkers, and original research by Gio. Translated into 15 languages.',
    url: BASE,
    paperCount: published.length,
    languages: ['en', 'ka', 'ru', 'pl', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ja', 'zh', 'uk'],
    papers: published.map(p => ({
      title: p.title,
      slug: p.slug,
      author: p.author,
      description: (p.metaDescription || '').slice(0, 300),
      tags: (p.tags || []).map((id: string) => tagMap[id]).filter(Boolean),
      focusArea: p.focusArea || '',
      url: `${BASE}/p/${p.slug}`,
      wordCount: p.wordCount || 0,
      readingTimeMinutes: p.readingTimeMinutes || 0,
      publishedAt: p.publishedAt || '',
    })),
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
