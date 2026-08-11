import { sanitizeHTML } from './utils';

/**
 * Smart clipboard paste parser for Google Docs.
 *
 * Intercepts raw `text/html` clipboard data and converts it into clean,
 * publication-ready markdown that preserves the full Google Doc formatting
 * hierarchy: headings / subtitle, inline styles (bold, italic, underline,
 * strikethrough, highlights, custom text colors), structural elements
 * (lists, blockquotes, indentation) and full HTML tables.
 *
 * Underline / highlights / custom colors cannot be expressed in pure
 * markdown, so they are emitted as inline HTML (`<u>`, `<mark>`,
 * `<span style="...">`). Each inline HTML fragment is sanitized with
 * DOMPurify as it is emitted, and the reader renders them with rehype-raw.
 */

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;
const isText = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE;

function getStyle(el: Element, prop: string): string {
  return (el.getAttribute('style') || '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.toLowerCase().startsWith(prop.toLowerCase() + ':'))
    .map(s => s.slice(s.indexOf(':') + 1).trim())[0] || '';
}

function parseLenToNumber(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  if (value.endsWith('pt')) return num / 12; // approximate: 12pt ≈ 1 rem indent
  if (value.endsWith('em')) return num;
  return num / 30; // px → rough indent unit
}

function indentationDepth(el: Element): number {
  const pad = getStyle(el, 'padding-left') || getStyle(el, 'margin-left');
  if (!pad) return 0;
  const depth = Math.round(parseLenToNumber(pad) / 1.2);
  return Math.min(6, Math.max(0, depth));
}

function isCodeLine(el: Element): boolean {
  const font = getStyle(el, 'font-family').toLowerCase();
  return font.includes('mono') || el.className.toLowerCase().includes('code');
}

function isSubtitle(el: Element): boolean {
  return el.className.toLowerCase().includes('subtitle');
}

const ESCAPE_TABLE = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function headingLevel(el: Element): number {
  const tag = el.tagName.toLowerCase();
  const map: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
  if (map[tag]) return map[tag];
  return 0;
}

/** Sanitize an inline HTML fragment we embed into the markdown output. */
const sanitizeFragment = (html: string): string => sanitizeHTML(html);

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Returns true for colors that are black/near-black/transparent and should inherit the theme text color. */
function isInheritableColor(color: string): boolean {
  const c = color.trim().toLowerCase();
  if (!c || c === 'transparent' || c === 'inherit' || c === 'initial') return true;
  const rgb = c.match(/rgba?\((\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/);
  if (rgb) {
    const [r, g, b] = [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10)];
    return r <= 60 && g <= 60 && b <= 60;
  }
  const hex = c.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const full = hex.split('').map(ch => ch + ch).join('');
    const channels = [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)].map(h => parseInt(h, 16));
    return channels.every(v => v <= 0x30);
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const channels = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map(h => parseInt(h, 16));
    return channels.every(v => v <= 0x30);
  }
  return false;
}

/** Fold Google Docs inline style hints into a single CSS style string. */
function buildSpanStyle(el: Element): string {
  const parts: string[] = [];
  const bg = getStyle(el, 'background-color');
  const color = getStyle(el, 'color');
  const fw = getStyle(el, 'font-weight');
  const fs = getStyle(el, 'font-style');
  const deco = getStyle(el, 'text-decoration');
  if (bg && bg.toLowerCase() !== 'transparent') parts.push(`background-color:${bg}`);
  if (color && !isInheritableColor(color)) parts.push(`color:${color}`);
  if (/^(700|bold)$/i.test(fw)) parts.push('font-weight:700');
  if (/italic/i.test(fs)) parts.push('font-style:italic');
  if (/underline/i.test(deco)) parts.push('text-decoration:underline');
  return parts.join(';');
}

/** Render an element's children as pure HTML (used inside `<u>`, `<mark>`, `<span>` …). */
function childrenToHTML(node: Node): string {
  return Array.from(node.childNodes).map(inlineToHTML).join('');
}

/** Render an inline element subtree as pure HTML (used inside `<u>`, `<mark>`, `<span>` …). */
function inlineToHTML(node: Node): string {
  if (isText(node)) return escapeHtmlText(node.textContent || '');
  if (!isElement(node)) return '';

  const tag = node.tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(inlineToHTML).join('');

  switch (tag) {
    case 'b':
    case 'strong':
      return `<strong>${inner}</strong>`;
    case 'i':
    case 'em':
      return `<em>${inner}</em>`;
    case 's':
    case 'del':
    case 'strike':
      return `<s>${inner}</s>`;
    case 'u':
      return `<u>${inner}</u>`;
    case 'mark':
      return `<mark>${inner}</mark>`;
    case 'sub':
      return `<sub>${inner}</sub>`;
    case 'sup':
      return `<sup>${inner}</sup>`;
    case 'code':
    case 'tt':
      return `<code>${inner}</code>`;
    case 'br':
      return '<br>';
    case 'a': {
      const href = escapeAttr(node.getAttribute('href') || '');
      return `<a href="${href}">${inner}</a>`;
    }
    case 'span':
    case 'font': {
      const style = buildSpanStyle(node);
      return style ? `<span style="${escapeAttr(style)}">${inner}</span>` : inner;
    }
    default:
      return inner;
  }
}

/** Convert an inline text node subtree into a markdown/HTML inline string. */
function inlineToMarkdown(node: Node): string {
  if (isText(node)) {
    return node.textContent || '';
  }
  if (!isElement(node)) return '';

  const tag = node.tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(inlineToMarkdown).join('');

  switch (tag) {
    case 'b':
    case 'strong':
      return inner.trim() ? `**${inner}**` : inner;
    case 'i':
    case 'em':
      return inner.trim() ? `*${inner}*` : inner;
    case 'u':
      return inner.trim() ? sanitizeFragment(`<u>${childrenToHTML(node)}</u>`) : inner;
    case 's':
    case 'del':
    case 'strike':
      return inner.trim() ? `~~${inner}~~` : inner;
    case 'mark':
      return sanitizeFragment(`<mark>${childrenToHTML(node)}</mark>`);
    case 'sub':
      return sanitizeFragment(`<sub>${childrenToHTML(node)}</sub>`);
    case 'sup':
      return sanitizeFragment(`<sup>${childrenToHTML(node)}</sup>`);
    case 'code':
    case 'tt':
      return `\`${inner}\``;
    case 'a':
      return `[${inner}](${(node.getAttribute('href') || '').replace(/\)/g, '%29').replace(/"/g, '%22')})`;
    case 'br':
      return '  \n';
    case 'span':
    case 'font': {
      const style = buildSpanStyle(node);
      if (!style) return inner;
      return sanitizeFragment(`<span style="${escapeAttr(style)}">${childrenToHTML(node)}</span>`);
    }
    default:
      return inner;
  }
}

function inlineOf(el: Element): string {
  return Array.from(el.childNodes).map(inlineToMarkdown).join('').trim();
}

interface ListItem {
  content: string;
  depth: number;
  ordered: boolean;
}

function collectListItems(list: Element, depth: number, ordered: boolean, out: ListItem[]): void {
  Array.from(list.children).forEach(li => {
    if (li.tagName.toLowerCase() !== 'li') return;
    const contentParts: string[] = [];
    let listContent = '';
    Array.from(li.childNodes).forEach(child => {
      if (isElement(child) && ['ul', 'ol'].includes(child.tagName.toLowerCase())) {
        if (listContent) {
          out.push({ content: listContent, depth, ordered });
          listContent = '';
        }
        collectListItems(child, depth + 1, child.tagName.toLowerCase() === 'ol', out);
      } else {
        listContent += isElement(child) ? inlineToMarkdown(child) : child.textContent || '';
      }
    });
    if (listContent.trim()) {
      out.push({ content: listContent.trim(), depth, ordered });
    }
  });
}

function listToMarkdown(list: Element, ordered: boolean): string {
  const items: ListItem[] = [];
  collectListItems(list, 0, ordered, items);
  const lines = items.map(item => {
    const marker = item.ordered ? `${item.depth + 1}. ` : '- ';
    const indent = '    '.repeat(item.depth);
    return `${indent}${marker}${item.content}`;
  });
  return lines.join('\n');
}

/** Convert an HTML `<table>` to a GFM markdown table. */
function tableToMarkdown(table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  const cellData: string[][] = [];
  let header: string[] | null = null;

  rows.forEach((tr, rowIndex) => {
    const cells = Array.from(tr.children).filter(el => ['td', 'th'].includes(el.tagName.toLowerCase()));
    const rowCells: string[] = [];
    cells.forEach(td => {
      const colspan = parseInt(td.getAttribute('colspan') || '1', 10) || 1;
      const content = Array.from(td.childNodes)
        .map(n => isElement(n) ? inlineToMarkdown(n) : n.textContent || '')
        .join('')
        .trim() || ' ';
      for (let i = 0; i < colspan; i++) rowCells.push(ESCAPE_TABLE(content));
    });
    while (rowCells.length > 0 && rowCells[rowCells.length - 1] === ' ') rowCells.pop();
    if (rowCells.length === 0) rowCells.push(' ');

    if (
      rowIndex === 0 &&
      (cells.some(c => c.tagName.toLowerCase() === 'th') ||
        (cells.length > 0 && cells.every(c => (c.querySelector('b, strong') !== null) && !c.getAttribute('style')?.includes('font-weight:400'))))
    ) {
      header = rowCells;
    } else {
      cellData.push(rowCells);
    }
  });

  const width = header ? header.length : Math.max(...cellData.map(r => r.length), 1);
  const pad = (arr: string[]) => {
    while (arr.length < width) arr.push(' ');
    return arr;
  };

  const lines: string[] = [];
  if (header) {
    lines.push(`| ${pad(header).join(' | ')} |`);
    lines.push(`| ${pad(new Array(width).fill('---')).join(' | ')} |`);
  }
  cellData.forEach(row => {
    lines.push(`| ${pad(row).join(' | ')} |`);
  });
  return lines.join('\n');
}

function renderBlock(el: Element): string {
  const tag = el.tagName.toLowerCase();

  if (tag === 'table') {
    return tableToMarkdown(el);
  }

  if (tag === 'ul' || tag === 'ol') {
    return listToMarkdown(el, tag === 'ol');
  }

  if (tag === 'blockquote') {
    const inner = Array.from(el.childNodes)
      .map(child => isElement(child) ? renderBlock(child) : child.textContent || '')
      .filter(s => s.trim())
      .join('\n\n');
    return inner.split('\n').map(line => `> ${line}`).join('\n');
  }

  if (tag === 'pre') {
    const code = el.textContent || '';
    return `\`\`\`\n${code.replace(/\n+$/, '')}\n\`\`\``;
  }

  if (tag === 'hr') {
    return '---';
  }

  if (tag === 'img') {
    const src = el.getAttribute('src');
    const alt = el.getAttribute('alt') || '';
    return src ? `![${alt}](${src})` : '';
  }

  const level = headingLevel(el);
  if (level > 0) {
    const text = inlineOf(el);
    const prefix = isSubtitle(el) ? '#### ' : `${'#'.repeat(level)} `;
    return `${prefix}${text}`;
  }

  // Paragraph / div / other block text
  if (tag === 'p' || tag === 'div' || tag === 'li' || tag === 'section' || tag === 'hgroup') {
    const depth = indentationDepth(el);
    const indent = '> '.repeat(depth);
    const isCode = isCodeLine(el);

    if (isCode) {
      const code = el.textContent || '';
      return `\`\`\`\n${code.replace(/\n+$/, '')}\n\`\`\``;
    }

    const text = inlineOf(el);
    if (!text) return '';
    if (indent) {
      return text.split('\n').map(l => `${indent}${l}`).join('\n');
    }
    return text;
  }

  // Fallback: render children as blocks
  const parts = Array.from(el.childNodes)
    .map(child => isElement(child) ? renderBlock(child) : (child.textContent || ''))
    .filter(s => s.trim());
  return parts.join('\n\n');
}

/** Public entry point: converts pasted Google Doc HTML into markdown. */
export function parseGoogleDocPaste(html: string): string {
  if (!html) return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  const blocks: string[] = [];
  Array.from(body.childNodes).forEach(node => {
    if (isText(node)) {
      const text = (node.textContent || '').trim();
      if (text) blocks.push(text);
    } else if (isElement(node)) {
      const rendered = renderBlock(node);
      if (rendered.trim()) blocks.push(rendered);
    }
  });

  const markdown = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return markdown;
}
