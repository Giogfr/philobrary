import { Resvg } from '@resvg/resvg-js';

const DB_URL = 'https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app';

const COVER_W = 1200;
const COVER_H = 630;

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function htmlToText(markdownOrHtml: string) {
  return markdownOrHtml
    .replace(/<[^>]*>?/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#\-|\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapTitle(title: string, maxChars: number) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length <= maxChars) {
      line = (line + ' ' + word).trim();
    } else {
      if (line) lines.push(line);
      line = word;
    }
    if (lines.length === 2 && line) break;
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].slice(0, maxChars - 1).trimEnd() + '\u2026';
  }
  return lines;
}

function coverSvg(paper: any) {
  const title = paper.title || 'Untitled essay';
  const fontSize = title.length <= 42 ? 56 : title.length <= 90 ? 48 : 40;
  const maxChars = fontSize >= 52 ? 32 : fontSize >= 46 ? 38 : 46;
  const lines = wrapTitle(title, maxChars);
  const lineHeight = Math.round(fontSize * 1.22);
  const titleBlockH = lines.length * lineHeight;
  const titleTop = 250;
  const titleBottom = titleTop + titleBlockH;
  const titleTspans = lines.map((ln, i) =>
    `<tspan x="90" dy="${i === 0 ? 0 : lineHeight}">${esc(ln)}</tspan>`).join('\n    ');

  const author = paper.author ? `BY ${esc(paper.author.toUpperCase())}` : '';
  const short = (paper.metaDescription || htmlToText(paper.content || '')).slice(0, 150).trim();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14102E"/>
      <stop offset="0.55" stop-color="#1E1B4B"/>
      <stop offset="1" stop-color="#312E81"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6366F1"/>
      <stop offset="1" stop-color="#22D3EE"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0" cy="0" r="1">
      <stop offset="0" stop-color="#6366F1" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#6366F1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0" cy="0" r="1">
      <stop offset="0" stop-color="#22D3EE" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="80" r="260" fill="url(#glow1)"/>
  <circle cx="120" cy="600" r="300" fill="url(#glow2)"/>
  <circle cx="1120" cy="570" r="40" fill="none" stroke="#22D3EE" stroke-opacity="0.35" stroke-width="2"/>
  <circle cx="1160" cy="530" r="10" fill="#22D3EE" fill-opacity="0.5"/>
  <text x="90" y="92" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="10" fill="#A5B4FC">PHILOBRARY</text>
  <rect x="90" y="112" width="46" height="6" rx="3" fill="url(#accent)"/>
  <text font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#FFFFFF">
    <tspan x="90" dy="${titleTop}">${titleTspans}</tspan>
  </text>
  <rect x="90" y="${titleBottom + 28}" width="110" height="5" rx="2.5" fill="url(#accent)"/>
  ${short ? `<text x="90" y="${titleBottom + 78}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#C7D2FE" xml:space="preserve">${esc(short)}</text>` : ''}
  <text x="90" y="576" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="#E0E7FF">${author}</text>
  <text x="1110" y="576" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="1" fill="#818CF8">philobrary.vercel.app</text>
</svg>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url.startsWith('http') ? request.url : 'https://vercel.local' + request.url);
  const slug = url.searchParams.get('slug')?.trim() || '';

  if (!slug) return new Response('Not Found', { status: 404 });

  let paper: any = null;
  try {
    const res = await fetch(`${DB_URL}/papers.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        paper = Object.values(data).find((p: any) => p && p.slug === slug) || null;
      }
    }
  } catch {
    /* fall through */
  }

  if (!paper) return new Response('Not Found', { status: 404 });

  try {
    const r = new Resvg(coverSvg(paper), {
      fitTo: { mode: 'width', value: COVER_W },
      font: { loadSystemFonts: true },
    });
    const png = r.render().asPng();
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    return new Response(`Failed to render cover: ${e}`, { status: 500 });
  }
}