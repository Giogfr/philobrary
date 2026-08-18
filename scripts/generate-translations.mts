/**
 * Generates public/translations-bundle.json — a single static file containing
 * pre-translated UI strings, paper metadata/content, and tag names for every
 * supported language. The SPA fetches this at startup and seeds its translation
 * store, so switching languages and reading papers is instant (no runtime
 * Google Translate calls).
 *
 * Runs BEFORE `vite build` so vite copies it into dist/. Reuses the same
 * translation cache as scripts/prerender-papers.mjs, so paper content is only
 * ever translated once.
 *
 * Bundle shape:
 * {
 *   ui:     { ka: { "request.title": "...", ... }, ... },
 *   papers: { ka: { "<paperId>": { title, focusArea, content, description }, ... }, ... },
 *   tags:   { ka: { "<tagId>": "...", ... }, ... }
 * }
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaries, googleTranslate, translatePaperContent } from '../src/i18n.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_FILE = resolve(ROOT, 'scripts/.cache/translations.json');
const DB_URL = 'https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app';
const LANGS = Object.keys(dictionaries) as (keyof typeof dictionaries)[];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

function loadCache(): Record<string, string> {
  try {
    if (existsSync(CACHE_FILE)) return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch { /* ignore */ }
  return {};
}

const cache = loadCache();
let dirty = false;

function flushCache() {
  if (!dirty) return;
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
    dirty = false;
  } catch { /* best effort */ }
}

async function translateShortCached(text: string, lang: string, kind: string, id: string): Promise<string> {
  if (!text || lang === 'en') return text;
  const key = `${lang}|short|${kind}|${id}|${hash(text)}`;
  if (cache[key] !== undefined) return cache[key];
  try {
    const result = await googleTranslate(text, lang as Parameters<typeof googleTranslate>[1]);
    cache[key] = result || text;
    dirty = true;
    return result || text;
  } catch (e) {
    console.warn(`  short translate fallback (${kind} ${lang} ${id}): ${e?.message || e}`);
    return text;
  }
}

async function translateContentCached(content: string, lang: string, id: string): Promise<string> {
  if (!content || lang === 'en') return content;
  const key = `${lang}|content|${id}|${hash(content)}`;
  if (cache[key] !== undefined) return cache[key];
  try {
    const result = await translatePaperContent(content, lang as Parameters<typeof translatePaperContent>[1]);
    cache[key] = result;
    dirty = true;
    return result;
  } catch (e) {
    console.warn(`  content translate fallback (${lang} ${id}): ${e?.message || e}`);
    return content;
  }
}

async function translateUiShort(text: string, lang: string, key: string): Promise<string> {
  if (!text || lang === 'en') return text;
  const kind = `ui:${key}`;
  const id = 'ui';
  return translateShortCached(text, lang, kind, id);
}

async function main() {
  // 1) Fetch papers + tags from Firebase.
  let papers: any[] = [];
  try {
    const res = await fetch(`${DB_URL}/papers.json`);
    const data = await res.json();
    if (data && typeof data === 'object') {
      papers = Object.values(data).filter((p: any) => p?.id && p?.title);
    }
  } catch (e) {
    console.warn('Could not fetch papers:', e?.message || e);
  }

  let tags: any[] = [];
  try {
    const res = await fetch(`${DB_URL}/tags.json`);
    const data = await res.json();
    if (data && typeof data === 'object') tags = Object.values(data).filter((t: any) => t?.id && t?.name);
  } catch (e) {
    console.warn('Could not fetch tags:', e?.message || e);
  }

  const bundle: Record<string, any> = { ui: {}, papers: {}, tags: {} };

  const CONCURRENCY = 6;
  const en = dictionaries.en;

  // 2) UI strings — translate every key whose non-English value equals the
  //    English value (i.e. it was never actually translated).
  for (const lang of LANGS) {
    if (lang === 'en') continue;
    const dict = dictionaries[lang];
    const uiOverrides: Record<string, string> = {};
    const keys = Object.keys(en);
    let cursor = 0;
    const worker = async () => {
      while (cursor < keys.length) {
        const key = keys[cursor++];
        const enValue = en[key];
        const langValue = dict?.[key];
        if (langValue === undefined || langValue === enValue) {
          try {
            const translated = await translateUiShort(enValue, lang, key);
            if (translated) uiOverrides[key] = translated;
          } catch {
            // keep English fallback on failure
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, () => worker()));
    bundle.ui[lang] = uiOverrides;
    console.log(`  ui ${lang}: ${Object.keys(uiOverrides).length} keys`);
  }

  // 3) Papers — title, focusArea, metaDescription, content.
  for (const lang of LANGS) {
    if (lang === 'en') continue;
    const paperMap: Record<string, any> = {};
    let cursor = 0;
    const worker = async () => {
      while (cursor < papers.length) {
        const paper = papers[cursor++];
        const id = paper.id;
        const [title, focusArea, description, content] = await Promise.all([
          translateShortCached(paper.title || '', lang, 'title', id),
          paper.focusArea ? translateShortCached(paper.focusArea, lang, 'section', id) : Promise.resolve(''),
          paper.metaDescription ? translateShortCached(paper.metaDescription, lang, 'meta', id) : Promise.resolve(''),
          translateContentCached(paper.content || '', lang, id),
        ]);
        paperMap[id] = { title, focusArea, content, description };
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, papers.length) }, () => worker()));
    bundle.papers[lang] = paperMap;
    console.log(`  papers ${lang}: ${Object.keys(paperMap).length}`);
  }

  // 4) Tags.
  for (const lang of LANGS) {
    if (lang === 'en') continue;
    const tagMap: Record<string, string> = {};
    let cursor = 0;
    const worker = async () => {
      while (cursor < tags.length) {
        const tag = tags[cursor++];
        tagMap[tag.id] = await translateShortCached(tag.name, lang, 'tag', tag.id);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tags.length) }, () => worker()));
    bundle.tags[lang] = tagMap;
    console.log(`  tags ${lang}: ${Object.keys(tagMap).length}`);
  }

  flushCache();

  const outPath = resolve(ROOT, 'public/translations-bundle.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(bundle), 'utf8');
  console.log(`Wrote translations-bundle.json (${(outPath.length > 0 ? Buffer.byteLength(JSON.stringify(bundle)) : 0).toLocaleString()} bytes)`);
}

main();