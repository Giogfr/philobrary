/**
 * One-time helper: backfills every English UI key into each of the 14
 * language dictionaries in src/i18n.ts (English values as placeholders),
 * so no key silently falls back at runtime and translators have a complete
 * template. Run: node scripts/backfill-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'src/i18n.ts');
const raw = readFileSync(FILE, 'utf8');
const hasCRLF = raw.includes('\r\n');
const lines = raw.split(/\r?\n/);

const esc = (v) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// 1) Extract English keys + values.
const enStart = lines.findIndex(l => /^const en: TranslationKey = \{/.test(l));
if (enStart < 0) throw new Error('en block not found');
const enVals = new Map();
for (let i = enStart + 1; i < lines.length; i++) {
  if (/^\};/.test(lines[i])) break;
  const m = lines[i].match(/^  '([^']+)': '(.*)',?$/);
  if (m) enVals.set(m[1], m[2]);
}
console.log(`English keys: ${enVals.size}`);

// 2) Find language blocks inside `const dictionaries`.
const dictStart = lines.findIndex(l => /^const dictionaries: Record<SupportedLanguage, TranslationKey> = \{/.test(l));
if (dictStart < 0) throw new Error('dictionaries block not found');

const out = lines.slice(0, dictStart + 1);
let i = dictStart + 1;
let insertedAny = false;

for (; i < lines.length; i++) {
  const lang = lines[i].match(/^  ([a-z]{2}): \{$/);
  if (lang && lang[1] !== 'en') {
    const code = lang[1];
    let j = i + 1;
    const block = [];
    while (j < lines.length && !/^  \},$/.test(lines[j])) {
      block.push(lines[j]);
      j++;
    }
    if (j >= lines.length) throw new Error(`Could not find closing brace for '${code}' block`);
    const existing = new Set();
    for (const l of block) {
      const m = l.match(/^    '([^']+)':/);
      if (m) existing.add(m[1]);
    }
    const missing = [...enVals.keys()].filter(k => !existing.has(k)).sort();
    if (missing.length > 0) {
      const insert = missing.map(k => `    '${k}': '${esc(enVals.get(k) || '')}',`);
      out.push(lines[i], ...block, ...insert, lines[j]);
      insertedAny = true;
      console.log(`${code}: +${missing.length} missing keys`);
    } else {
      out.push(lines[i], ...block, lines[j]);
    }
    i = j;
    continue;
  }
  out.push(lines[i]);
}

if (!insertedAny) {
  console.log('Nothing to backfill.');
  process.exit(0);
}

writeFileSync(FILE, out.join(hasCRLF ? '\r\n' : '\n') + (hasCRLF ? '\r\n' : '\n'), 'utf8');
console.log('i18n.ts updated.');
