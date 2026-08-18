/**
 * Prerenders a static, SEO-optimized HTML page for every published paper,
 * in every supported language, plus a branded 1200x630 OG social cover PNG.
 * Runs AFTER `vite build` so it can reference the hashed bundle assets.
 *
 * Output (all under dist/):
 *   p/<slug>/index.html          -> English default page (full visible article)
 *   <lang>/p/<slug>/index.html   -> translated page per language (full visible article)
 *   og/<slug>.png                -> social cover image
 *
 * Why: the app is a client-side SPA, so social/link crawlers (WhatsApp,
 * Twitter, Telegram, iMessage) and search crawlers that don't run JS would
 * otherwise see only the homepage meta. These static pages expose real,
 * indexable article text in every language.
 *
 * Translations reuse the same keyless Google Translate endpoint as the app,
 * and are cached in scripts/.cache/translations.json so rebuilds are fast.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { Resvg } from '@resvg/resvg-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const CACHE_FILE = resolve(ROOT, 'scripts/.cache/translations.json');
const BASE = 'https://philobrary.vercel.app';
const SITE_NAME = 'Philobrary';
const DB_URL = 'https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app';
const TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const LANGS = ['en', 'ka', 'ru', 'pl', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ja', 'zh', 'uk'];
const OG_LOCALES = {
  en: 'en_US', ka: 'ka_GE', ru: 'ru_RU', pl: 'pl_PL', he: 'he_IL', ar: 'ar_SA',
  es: 'es_ES', fr: 'fr_FR', de: 'de_DE', it: 'it_IT', pt: 'pt_PT', tr: 'tr_TR',
  ja: 'ja_JP', zh: 'zh_CN', uk: 'uk_UA',
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlToText(markdownOrHtml) {
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

function safeSlug(slug) {
  return String(slug).replace(/[^a-zA-Z0-9._-]/g, '').replace(/\.{2,}/g, '').slice(0, 120);
}

// ---------------------------------------------------------------------------
// Translation (mirrors the client implementation in src/i18n.ts)
// ---------------------------------------------------------------------------

async function googleTranslate(text, targetLang) {
  if (!text || targetLang === 'en') return text;
  const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLang, dt: 't', q: text });
  const res = await fetch(`${TRANSLATE_ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`Translation request failed (${res.status})`);
  const data = await res.json();
  const segments = data?.[0];
  if (!Array.isArray(segments)) throw new Error('Unexpected translation response');
  return segments.map((seg) => seg?.[0] || '').join('');
}

const PLACEHOLDER_RE = /(`[^`]*`|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+|<[^>]*>|\*\*|~~|\*|__)/g;

function protectInline(text) {
  const originals = [];
  const emphSide = [];
  const openState = {};
  let index = 0;
  const fenced = text.replace(PLACEHOLDER_RE, (match) => {
    const isEmph = /^(\*\*|~~|\*|__)$/.test(match);
    let side = null;
    if (isEmph) {
      openState[match] = !openState[match];
      side = openState[match] ? 'open' : 'close';
    }
    originals.push(match);
    emphSide.push(side);
    return `\u00A7${index++}\u00A7`;
  });
  return { fenced, originals, emphSide };
}

function restoreInline(fenced, originals, emphSide) {
  let out = fenced;
  for (let i = 0; i < originals.length; i++) {
    if (emphSide[i] === 'open') {
      out = out.replace(new RegExp(`\u00A7${i}\u00A7\\s+`), `\u00A7${i}\u00A7`);
    } else if (emphSide[i] === 'close') {
      out = out.replace(new RegExp(`\\s+\u00A7${i}\u00A7`), `\u00A7${i}\u00A7`);
    }
  }
  return out.replace(/\u00A7(\d+)\u00A7/g, (_m, i) => originals[Number(i)] ?? '');
}

async function translateTextLine(text, targetLang) {
  const { fenced, originals, emphSide } = protectInline(text);
  const translated = await googleTranslate(fenced, targetLang);
  return restoreInline(translated, originals, emphSide);
}

const MAX_CHUNK = 3500;

async function translateChunks(text, targetLang) {
  if (text.length <= MAX_CHUNK) return translateTextLine(text, targetLang);
  const parts = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_CHUNK, text.length);
    if (end < text.length) {
      const rel = text.lastIndexOf(' ', end);
      if (rel > start + MAX_CHUNK / 2) end = rel;
    }
    parts.push(await translateTextLine(text.slice(start, end), targetLang));
    start = end;
  }
  return parts.join(' ');
}

async function translatePaperContent(content, targetLang) {
  if (!content || targetLang === 'en') return content;
  const blocks = content.split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines[0]?.startsWith('```') || lines[0]?.startsWith('~~~')) {
      out.push(block);
      continue;
    }
    if (lines.length > 1 && lines.every((l) => l.includes('|'))) {
      const rows = [];
      for (const line of lines) {
        if (/^\|?[\s:-]+\|[\s:-]*(?:\|[\s:-]*)*\|?$/.test(line) && line.includes('-')) {
          rows.push(line);
          continue;
        }
        const cells = line.split('|');
        const translatedCells = [];
        for (const cell of cells) {
          translatedCells.push(cell.trim() ? await translateChunks(cell.trim(), targetLang) : cell);
        }
        rows.push(translatedCells.join('|'));
      }
      out.push(rows.join('\n'));
      continue;
    }
    const newLines = [];
    for (const line of lines) {
      if (!line.trim()) { newLines.push(line); continue; }
      const heading = line.match(/^(\s*#{1,6})\s+(.*)$/);
      if (heading) { newLines.push(`${heading[1]} ${await translateChunks(heading[2], targetLang)}`); continue; }
      const quote = line.match(/^((?:\s*>)+)\s?(.*)$/);
      if (quote && quote[2]) { newLines.push(`${quote[1]} ${await translateChunks(quote[2], targetLang)}`); continue; }
      const list = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/);
      if (list && list[2]) { newLines.push(`${list[1]}${await translateChunks(list[2], targetLang)}`); continue; }
      newLines.push(await translateChunks(line, targetLang));
    }
    out.push(newLines.join('\n'));
  }
  return out.join('\n\n');
}

// ---------------------------------------------------------------------------
// Translation cache (scripts/.cache/translations.json)
// ---------------------------------------------------------------------------

// Salt bumped when the translation pipeline changes (e.g. markdown emphasis
// spacing fix) so stale cached translations are invalidated and re-translated.
// MUST stay in sync with scripts/generate-translations.mts.
const HASH_SALT = 'v3';

function hash(str) {
  let h = 0;
  const salted = HASH_SALT + str;
  for (let i = 0; i < salted.length; i++) {
    h = (h << 5) - h + salted.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch { /* ignore */ }
  return {};
}

const translationsCache = loadCache();
let cacheDirty = false;

function flushCache() {
  if (!cacheDirty) return;
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(translationsCache, null, 0), 'utf8');
    cacheDirty = false;
  } catch { /* best effort */ }
}

async function translateCached(content, lang, kind, id) {
  if (lang === 'en') return content;
  const key = `${lang}|${kind}|${id}|${hash(content)}`;
  if (translationsCache[key] !== undefined) return translationsCache[key];
  try {
    const result = await translatePaperContent(content, lang);
    translationsCache[key] = result;
    cacheDirty = true;
    return result;
  } catch (e) {
    console.warn(`  translate fallback (${kind} ${lang} ${id}): ${e?.message || e}`);
    return content;
  }
}

async function translateShortCached(text, lang, kind, id) {
  if (!text || lang === 'en') return text;
  const key = `${lang}|short|${kind}|${id}|${hash(text)}`;
  if (translationsCache[key] !== undefined) return translationsCache[key];
  try {
    const result = await googleTranslate(text, lang);
    translationsCache[key] = result || text;
    cacheDirty = true;
    return result || text;
  } catch (e) {
    console.warn(`  short translate fallback (${kind} ${lang} ${id}): ${e?.message || e}`);
    return text;
  }
}

// ---------------------------------------------------------------------------
// OG social cover (1200x630 PNG)
// ---------------------------------------------------------------------------

const COVER_W = 1200;
const COVER_H = 630;

function wrapTitle(title, maxChars) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
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

function coverSvg(paper) {
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

function renderCover(paper, outPath) {
  const r = new Resvg(coverSvg(paper), {
    fitTo: { mode: 'width', value: COVER_W },
    font: { loadSystemFonts: true },
  });
  const png = r.render().asPng();
  writeFileSync(outPath, png);
}

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

marked.setOptions({ gfm: true, breaks: true });

function articleHtml(markdownContent) {
  const body = marked.parse(markdownContent || '');
  return `<article class="prerendered-article">
  ${body}
</article>`;
}

const PRERENDER_STYLE = `<style>
  .prerendered-article { max-width: 46rem; margin: 0 auto; padding: 2rem 1.5rem 6rem; font-family: Georgia, 'Times New Roman', serif; line-height: 1.75; font-size: 1.125rem; color: #1f2937; background: #fff; }
  .prerendered-article h1, .prerendered-article h2, .prerendered-article h3, .prerendered-article h4 { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.3; margin: 1.75em 0 0.6em; color: #111827; }
  .prerendered-article h1 { font-size: 1.75rem; } .prerendered-article h2 { font-size: 1.4rem; } .prerendered-article h3 { font-size: 1.2rem; }
  .prerendered-article p { margin: 0 0 1.1em; }
  .prerendered-article blockquote { border-inline-start: 4px solid #6366f1; margin: 1.2em 0; padding: 0.2em 1.2em; color: #374151; background: #f8fafc; }
  .prerendered-article code { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 0.9em; background: #f1f5f9; padding: 0.1em 0.3em; border-radius: 4px; }
  .prerendered-article pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  .prerendered-article table { border-collapse: collapse; width: 100%; margin: 1.2em 0; }
  .prerendered-article th, .prerendered-article td { border: 1px solid #e2e8f0; padding: 0.5em 0.75em; text-align: start; }
  .prerendered-article img { max-width: 100%; height: auto; }
</style>`;

function buildMeta(baseHtml, {
  lang, dir, title, description, keywords, url, ogImage, locale, robots, type, published, modified, author, section,
}) {
  let html = baseHtml;
  const articleBodyInsert = html.includes('<div id="root"></div>');

  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"${dir ? ` dir="${dir}"` : ''}`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(<meta name="keywords" content=")[^"]*(")/, `$1${esc(keywords)}$2`);
  html = html.replace(/(<meta name="robots" content=")[^"]*(")/, `$1${esc(robots)}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`);
  html = html.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${type}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(ogImage)}$2`);
  html = html.replace(/(<meta property="og:image:width" content=")[^"]*(")/, '$1512$2');
  html = html.replace(/(<meta property="og:image:height" content=")[^"]*(")/, '$1512$2');
  html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${locale}$2`);
  html = html.replace(/(<meta name="twitter:card" content=")[^"]*(")/, '$1summary$2');
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(ogImage)}$2`);

  // article meta.
  const articleMeta = [
    `<meta property="article:published_time" content="${published}" />`,
    `<meta property="article:modified_time" content="${modified}" />`,
    author ? `<meta property="article:author" content="${esc(author)}" />` : '',
    section ? `<meta property="article:section" content="${esc(section)}" />` : '',
  ].join('\n    ');
  html = html.replace('</head>', `${articleMeta}\n  </head>`);
  return html;
}

// ---------------------------------------------------------------------------
// Homepage + topic (tag) page static snapshots
// ---------------------------------------------------------------------------

function excerptFor(paper) {
  return (paper.metaDescription || htmlToText(paper.content || '')).replace(/\s+/g, ' ').trim().slice(0, 220);
}

function paperCardHtml(p) {
  return `<div class="pr-home-card">
  <a href="${BASE}/p/${esc(p.slug)}" class="pr-home-title">${esc(p.title || '')}</a>
  <div class="pr-home-meta">${esc(p.author || '')} \u00B7 ${esc(p.focusArea || 'Philosophy')}</div>
  <p class="pr-home-excerpt">${esc(excerptFor(p))}</p>
</div>`;
}

function homeSnapshotHtml(papers, tags, tagByPaper) {
  const published = papers
    .filter((p) => p.status === 'published')
    .sort((a, b) => (new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()));
  const tagList = tags.map((t) => t.name).sort();
  const cards = published.slice(0, 20).map(paperCardHtml).join('\n    ');
  const tagAnchors = tagList.map((name) =>
    `<a class="pr-home-tag" href="${BASE}/t/${escSlug(name)}">${esc(name)}</a>`).join(' ');
  return `<div class="pr-home" style="max-width:64rem;margin:0 auto;padding:2.5rem 1.5rem 6rem;font-family:Georgia,serif;color:#1f2937;background:#fff;line-height:1.7">
  <h1 style="font-size:2.6rem;line-height:1.15;margin:0 0 .6rem;font-family:'Segoe UI',Arial,sans-serif;color:#111827">Explore independent research &amp; analysis</h1>
  <p style="font-size:1.2rem;color:#374151;max-width:44rem;margin:0 0 1.4rem">A curated digital library of long-form academic and analytical writing by Gio. Read, explore, and expand your understanding.</p>
  <p style="color:#4b5563;max-width:44rem;margin:0 0 1.8rem">Philobrary \u2014 Gio's philosophy library \u2014 features essays on ethics, religion, metaphysics, epistemology, logic, mind, and more, translated into 15 languages. Browse ${published.length} essays by topic below.</p>
  <h2 style="font-size:1.5rem;font-family:'Segoe UI',Arial,sans-serif;color:#111827;margin:1.6em 0 .6em">Topics</h2>
  <p style="margin:0 0 1.6rem;line-height:2.1">${tagAnchors || ''}</p>
  <h2 style="font-size:1.5rem;font-family:'Segoe UI',Arial,sans-serif;color:#111827;margin:1.6em 0 .6em">Latest essays</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.1rem">
    ${cards || '<p>No essays published yet.</p>'}
  </div>
</div>`;
}

function topicListHtml(tagName, papers) {
  const cards = papers.map(paperCardHtml).join('\n    ');
  return `<div class="pr-home" style="max-width:64rem;margin:0 auto;padding:2.5rem 1.5rem 6rem;font-family:Georgia,serif;color:#1f2937;background:#fff;line-height:1.7">
  <h1 style="font-size:2.4rem;line-height:1.15;margin:0 0 .6rem;font-family:'Segoe UI',Arial,sans-serif;color:#111827">${esc(tagName)} \u2014 Philosophy</h1>
  <p style="font-size:1.15rem;color:#374151;max-width:44rem;margin:0 0 1.8rem">Explore philosophy essays about ${esc(tagName)} in Gio's Philobrary \u2014 a curated digital library of philosophy research, thinkers, and original analysis.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.1rem">
    ${cards || '<p>No essays in this topic yet.</p>'}
  </div>
</div>`;
}

function escSlug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'topic';
}

async function main() {
  let template;
  try {
    template = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  } catch (e) {
    console.warn('Prerender: dist/index.html not found, skipping.', e?.message || e);
    return;
  }

  let papers = [];
  try {
    const res = await fetch(`${DB_URL}/papers.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object') {
      const now = Date.now();
      papers = Object.values(data).filter(p => {
        if (!p.slug || !p.title) return false;
        if (p.status === 'published') return true;
        if (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now) return true;
        return false;
      });
    }
  } catch (e) {
    console.warn('Prerender: could not fetch papers, skipping.', e?.message || e);
  }

  const seen = new Set();
  const tasks = [];
  const covers = [];

  for (const paper of papers) {
    if (seen.has(paper.slug)) continue;
    seen.add(paper.slug);
    const slug = safeSlug(paper.slug);
    if (!slug) continue;
    const ogPath = resolve(DIST, 'og', `${slug}.png`);
    covers.push({ slug, paper, ogPath });
    for (const lang of LANGS) {
      tasks.push({ paper, slug, lang });
    }
  }

  // 1) Generate social covers.
  for (const { paper, ogPath } of covers) {
    try {
      mkdirSync(dirname(ogPath), { recursive: true });
      renderCover(paper, ogPath);
      console.log(`  cover ${paper.slug}.png`);
    } catch (e) {
      console.warn(`  cover failed for ${paper.slug}: ${e?.message || e}`);
    }
  }

  // 1b) Homepage static snapshot (so crawlers see real library content).
  let tags = [];
  try {
    const res = await fetch(`${DB_URL}/tags.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') tags = Object.values(data).filter((t) => t && t.name);
    }
  } catch (e) {
    console.warn('Prerender: could not fetch tags.', e?.message || e);
  }
  try {
    const homeHtml = template
      .replace('<div id="root"></div>',
        `${PRERENDER_STYLE}\n    <div id="root">\n      ${homeSnapshotHtml(papers, tags)}\n    </div>`);
    writeFileSync(resolve(DIST, 'index.html'), homeHtml, 'utf8');
    console.log('  prerendered homepage snapshot (Organization JSON-LD ships in index.html)');
  } catch (e) {
    console.warn(`  homepage snapshot failed: ${e?.message || e}`);
  }

  // 1c) Topic (tag) pages — static, indexable, one per tag.
  let topicCount = 0;
  const seenTags = new Set();
  for (const tag of tags) {
    const name = String(tag.name || '').trim();
    if (!name || seenTags.has(name.toLowerCase())) continue;
    seenTags.add(name.toLowerCase());
    const slug = escSlug(name);
    const topicPapers = papers.filter((p) =>
      p.status === 'published' && Array.isArray(p.tags) && p.tags.includes(tag.id))
      .sort((a, b) => (new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()));
    try {
      const url = `${BASE}/t/${slug}`;
      const desc = `Explore philosophy essays about ${name} in Gio's Philobrary \u2014 a curated digital library of philosophy research, thinkers, and original analysis.`;
      let html = buildMeta(template, {
        lang: 'en', dir: 'ltr',
        title: `Philosophy: ${name} \u2014 ${SITE_NAME}`,
        description: desc,
        keywords: `philosophy, ${name}, philosophy ${name}, essays, gio, library`,
        url, ogImage: `${BASE}/assets/logo-512.png`,
        locale: 'en_US', robots: 'index, follow', type: 'website',
      });
      const itemList = topicPapers.map((p, i) => ({
        '@type': 'ListItem', position: i + 1, name: p.title, url: `${BASE}/p/${p.slug}`,
      }));
      const topicLd = `<script type="application/ld+json">
${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${name} \u2014 ${SITE_NAME}`,
        description: desc,
        url,
        inLanguage: 'en',
        numberOfItems: topicPapers.length,
        mainEntity: { '@type': 'ItemList', numberOfItems: topicPapers.length, itemListElement: itemList },
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${BASE}/assets/logo-512.png` } },
      }, null, 2)}
</script>`;
      html = html
        .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, topicLd)
        .replace('<div id="root"></div>',
          `${PRERENDER_STYLE}\n    <div id="root">\n      ${topicListHtml(name, topicPapers)}\n    </div>`);
      const outDir = resolve(DIST, 't', slug);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'index.html'), html, 'utf8');
      topicCount++;
    } catch (e) {
      console.warn(`  topic page failed ${name}: ${e?.message || e}`);
    }
  }
  console.log(`Prerendered ${topicCount} topic page(s) into dist/t/`);

  // 2) Translate + emit pages (concurrency-limited).
  const CONCURRENCY = 6;
  let cursor = 0;
  let pageCount = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const { paper, slug, lang } = tasks[cursor++];
      try {
        const translatedContent = await translateCached(paper.content || '', lang, 'content', paper.id);
        const translatedTitle = await translateShortCached(paper.title, lang, 'title', paper.id);
        const translatedDescription = await translateShortCached(
          paper.metaDescription || '', lang, 'meta', paper.id);
        const translatedSection = await translateShortCached(
          paper.focusArea || '', lang, 'section', paper.id);

        const description = (translatedDescription ||
          htmlToText(translatedContent || '').slice(0, 160)).replace(/\s+/g, ' ').trim();
        const url = lang === 'en' ? `${BASE}/p/${slug}` : `${BASE}/${lang}/p/${slug}`;
        const title = `${translatedTitle} \u2014 ${SITE_NAME}`;
        const ogImage = `${BASE}/assets/logo-512.png`;
        const published = new Date(paper.publishedAt || paper.createdAt).toISOString();
        const modified = paper.updatedAt ? new Date(paper.updatedAt).toISOString() : published;

        const html = buildMeta(template, {
          lang,
          dir: ['he', 'ar'].includes(lang) ? 'rtl' : 'ltr',
          title,
          description,
          keywords: paper.keywords || '',
          url,
          ogImage,
          locale: OG_LOCALES[lang],
          robots: 'index, follow',
          type: 'article',
          published,
          modified,
          author: paper.author,
          section: translatedSection || paper.focusArea || 'Philosophy',
        });

        // Real hreflang targets.
        const alternates = LANGS.map(l =>
          `    <link rel="alternate" hreflang="${l}" href="${BASE}/${l}/p/${slug}" />`).join('\n') +
          `\n    <link rel="alternate" hreflang="x-default" href="${BASE}/p/${slug}" />`;
        const finalHtml = html
          .replace('</head>', `${alternates}\n\n  </head>`)
          .replace('<div id="root"></div>',
            `${PRERENDER_STYLE}\n    <div id="root">\n      ${articleHtml(translatedContent)}\n    </div>`);

        // JSON-LD: swap WebSite block for Article + Breadcrumb.
        const articleJsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: translatedTitle,
          description: description.slice(0, 200),
          image: ogImage,
          author: { '@type': 'Person', name: paper.author },
          publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${BASE}/assets/logo-512.png` } },
          datePublished: published,
          dateModified: modified,
          articleSection: translatedSection || paper.focusArea || 'Philosophy',
          inLanguage: lang,
          mainEntityOfPage: url,
          wordCount: (translatedContent || '').split(/\s+/).filter(Boolean).length,
        };
        if (paper.keywords) articleJsonLd.keywords = paper.keywords;
        const breadcrumbJsonLd = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Library', item: `${BASE}/` },
            { '@type': 'ListItem', position: 2, name: translatedTitle, item: url },
          ],
        };
        const jsonLd = `<script type="application/ld+json">\n${JSON.stringify([articleJsonLd, breadcrumbJsonLd], null, 2)}\n</script>`;
        const withLd = finalHtml.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, jsonLd);

        const outDir = lang === 'en'
          ? resolve(DIST, 'p', slug)
          : resolve(DIST, lang, 'p', slug);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(resolve(outDir, 'index.html'), withLd, 'utf8');
        pageCount++;
      } catch (e) {
        console.warn(`  page failed ${slug} ${lang}: ${e?.message || e}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()));
  flushCache();
  console.log(`Prerendered ${pageCount} paper page(s) (${LANGS.length} langs) + ${covers.length} cover(s) into dist/`);
}

main();
