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

/** Removes HTML tags, leaving plain text (for SEO descriptions, snippets, etc.). */
export function htmlToText(markdownOrHtml: string): string {
  return markdownOrHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#\-|\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const generateSlug = (title: string) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

export const extractGoogleDocId = (url: string) => {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

