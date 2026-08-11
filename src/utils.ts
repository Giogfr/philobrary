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

export const generateSlug = (title: string) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

export const extractGoogleDocId = (url: string) => {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

