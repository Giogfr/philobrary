import DOMPurify from 'dompurify';

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getRelativeTime(timestampStr: string): string {
  const timestamp = new Date(timestampStr).getTime();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const daysDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
  if (Math.abs(daysDifference) > 0) return rtf.format(daysDifference, 'day');
  
  const hoursDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60));
  if (Math.abs(hoursDifference) > 0) return rtf.format(hoursDifference, 'hour');
  
  const minutesDifference = Math.round((timestamp - Date.now()) / (1000 * 60));
  if (Math.abs(minutesDifference) > 0) return rtf.format(minutesDifference, 'minute');
  
  return 'just now';
}

export const getWordCount = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
export const getCharCount = (text: string) => text.length;
export const calculateReadingTime = (text: string) => Math.max(1, Math.ceil(getWordCount(text) / 200));

export const sanitizeHTML = (html: string) => DOMPurify.sanitize(html);

/** Strips inline color styles that are black/near-black/transparent so text inherits the theme color (fixes black text in dark mode). */
export function stripDarkInlineColors(markdownOrHtml: string): string {
  return markdownOrHtml.replace(
    /color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|transparent|inherit)\s*[;}]?/g,
    (match, color) => {
      const c = color.trim().toLowerCase();
      if (c === 'transparent' || c === 'inherit') return '';
      const rgb = c.match(/rgba?\((\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/);
      if (rgb) {
        const [r, g, b] = [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)];
        return r <= 60 && g <= 60 && b <= 60 ? '' : match;
      }
      const hex = c.replace(/^#/, '');
      const channels = (hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex).replace(/ff$/i, '');
      if (/^[0-9a-f]{6}$/i.test(channels)) {
        const [r, g, b] = [channels.slice(0, 2), channels.slice(2, 4), channels.slice(4, 6)].map(h => parseInt(h, 16));
        if (r <= 0x30 && g <= 0x30 && b <= 0x30) return '';
      }
      return match;
    }
  );
}

/** Removes HTML tags (including malformed ones missing `>`), leaving plain text (for SEO descriptions, snippets, etc.). */
export function htmlToText(markdownOrHtml: string): string {
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

/**
 * Repairs content produced by an older Google Docs paste parser that flattened
 * table rows into a run of adjacent `<span>` cells (with `&nbsp;` separators
 * and white header cells). Detects the flattened-table pattern and rebuilds it
 * as a GFM markdown table.
 */
export function repairFlattenedTables(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map(block => {
      if (!/<span\b/.test(block)) return block;
      const matches = Array.from(block.matchAll(/<span\b[^>]*>[\s\S]*?<\/span>/g)).map(m => m[0]);
      if (matches.length < 6) return block;
      // A flattened table is a paragraph made entirely of back-to-back spans.
      if (matches.join('').replace(/\s+/g, '') !== block.replace(/\s+/g, '')) return block;

      const cells = matches.map(span => {
        const text = span.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\u00A0/g, ' ').trim();
        const isWhite = /color:#fff(fff)?|color:white|color:rgb\(255\s*,\s*255\s*,\s*255\)/i.test(span);
        return { text, isWhite };
      });

      const headerCount = cells.filter(c => c.isWhite).length;
      if (headerCount < 2) return block;

      let i = 0;
      while (i < cells.length && cells[i].isWhite) i++;
      if (i < cells.length && cells[i].text === '') i++;
      const body = cells.slice(i).filter(c => c.text !== '');
      if (body.length === 0 || body.length % headerCount !== 0) return block;

      const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const header = cells.slice(0, headerCount).map(c => esc(c.text));
      const lines = [
        `| ${header.join(' | ')} |`,
        `| ${Array(headerCount).fill('---').join(' | ')} |`,
      ];
      for (let r = 0; r < body.length; r += headerCount) {
        lines.push(`| ${body.slice(r, r + headerCount).map(c => esc(c.text)).join(' | ')} |`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Repairs content that was saved with malformed Google Docs inline HTML
 * (e.g. `<span style="..."` fragments missing `>` and broken color values).
 * Strips span/font tags (keeping inner text) and fixes color declarations.
 */
export function cleanLegacyMarkdown(md: string): string {
  let out = md;
  // Fix color declarations missing the leading `#`.
  out = out.replace(/color:\s*(#?)([0-9a-fA-F]{6})(?=[;"\s])/g, 'color:#$2');
  // Drop all span/font tags (well-formed or malformed), keeping inner text.
  out = out.replace(/<\s*\/?\s*(?:span|font)\b[^>]*?>/gi, ' ');
  // Drop malformed fragments that are missing the closing `>` entirely.
  out = out.replace(/<\s*\/?\s*(?:span|font)\b[^>]*(?=$|<|\s+\w)/gi, ' ');
  return out;
}

/**
 * Repairs legacy SEO fields that were saved with raw HTML and CSS-token junk
 * (e.g. `metaDescription` containing `<span ...>` and `keywords` being
 * "span, style, background-color, ..."). Returns a copy with clean values.
 */
export function repairSeoFields(paper: { metaDescription?: string; keywords?: string; content?: string }): { metaDescription?: string; keywords?: string } {
  const GARBAGE_KEYWORDS = new Set(['span', 'style', 'background-color', 'transparent', 'color', 'font-weight', '700', '700"', 'background']);
  const result: { metaDescription?: string; keywords?: string } = {};

  if (paper.metaDescription) {
    const clean = htmlToText(paper.metaDescription).slice(0, 320);
    if (clean && clean !== paper.metaDescription.trim()) result.metaDescription = clean;
    else if (!clean) result.metaDescription = paper.content ? htmlToText(paper.content).slice(0, 320) : paper.metaDescription;
  }

  if (paper.keywords) {
    const tokens = paper.keywords
      .toLowerCase()
      .split(/[,\n]+/)
      .map(k => k.trim())
      .filter(k => k.length > 2);
    if (tokens.some(k => GARBAGE_KEYWORDS.has(k) || k.includes('222222') || k.includes('111111'))) {
      result.keywords = htmlToText(paper.content || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !GARBAGE_KEYWORDS.has(w))
        .filter((w, i, a) => a.indexOf(w) === i)
        .slice(0, 8)
        .join(', ');
    }
  }

  return result;
}

export const generateSlug = (title: string) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

export const extractGoogleDocId = (url: string) => {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

