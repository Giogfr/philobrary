import { htmlToText } from './utils';

const SITE_NAME = 'Philobrary';
const BASE_URL = (import.meta.env.APP_URL || 'https://philobrary.vercel.app').replace(/\/$/, '');

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

function addJsonLd(id: string, data: object) {
  removeJsonLd(id);
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export interface SeoProps {
  title: string;
  description?: string;
  url?: string;
  ogImage?: string;
  type?: string;
  keywords?: string;
  jsonLd?: object;
}

/** Sets document title + meta/OG/Twitter tags + optional JSON-LD. */
export function setSeo({ title, description, url, ogImage, type = 'website', keywords, jsonLd }: SeoProps) {
  document.title = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;

  setMeta('name', 'description', description || '');
  setMeta('name', 'keywords', keywords || '');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:url', url || BASE_URL + '/');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:description', description || '');
  setMeta('property', 'og:image', ogImage || BASE_URL + '/assets/logo-512.png');
  setMeta('property', 'og:locale', ogLocale());
  setMeta('name', 'twitter:card', 'summary');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description || '');
  setMeta('name', 'twitter:image', ogImage || BASE_URL + '/assets/logo-512.png');
  setLink('canonical', url || BASE_URL + '/');

  if (jsonLd) addJsonLd('page-jsonld', jsonLd);
}

const OG_LOCALES: Record<string, string> = {
  en: 'en_US', ka: 'ka_GE', ru: 'ru_RU', pl: 'pl_PL', he: 'he_IL', ar: 'ar_SA',
  es: 'es_ES', fr: 'fr_FR', de: 'de_DE', it: 'it_IT', pt: 'pt_PT', tr: 'tr_TR',
  ja: 'ja_JP', zh: 'zh_CN', uk: 'uk_UA',
};

function ogLocale(): string {
  const lang = document.documentElement.lang || 'en';
  return OG_LOCALES[lang] || 'en_US';
}

/** Resets to the site-wide default SEO (used on the main pages). */
export function resetSeo() {
  setSeo({
    title: 'Philosophy Essay Library by Gio',
    description: 'A curated digital library of philosophy essays, thinkers, and original research — translated into 15 languages.',
    url: BASE_URL + '/',
  });
}

export function stripMarkdown(md: string): string {
  return htmlToText(md);
}

export { BASE_URL };
