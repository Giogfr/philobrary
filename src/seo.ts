import { htmlToText } from './utils';
import { currentLang } from './i18n';

const SITE_NAME = 'Philobrary';
const BASE_URL = (import.meta.env.APP_URL || 'https://philobrary.vercel.app').replace(/\/$/, '');

const SUPPORTED_LANGS = ['en', 'ka', 'ru', 'pl', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ja', 'zh', 'uk'] as const;

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

export function addJsonLd(id: string, data: object) {
  removeJsonLd(id);
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/** Adds hreflang alternate links for all supported languages. */
export function setHreflangAlternates(path: string) {
  const clean = path.replace(/^\/(en|ka|ru|pl|he|ar|es|fr|de|it|pt|tr|ja|zh|uk)\b/, '').replace(/\/+$/, '') || '/';
  SUPPORTED_LANGS.forEach(lang => {
    const href = `${BASE_URL}/${lang}${clean}`;
    let el = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${lang}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', lang);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  });
  // x-default
  let xDefault = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="x-default"]`);
  if (!xDefault) {
    xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    document.head.appendChild(xDefault);
  }
  xDefault.setAttribute('href', `${BASE_URL}${clean}`);
}

/** Creates BreadcrumbList JSON-LD for the given path segments. */
export function createBreadcrumbJsonLd(segments: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: segments.map((seg, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: seg.name,
      item: seg.url,
    })),
  };
}

export interface SeoProps {
  title: string;
  description?: string;
  url?: string;
  ogImage?: string;
  type?: string;
  keywords?: string;
  robots?: string;
  jsonLd?: object;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
    section?: string;
    tags?: string[];
  };
}

/** Sets document title + meta/OG/Twitter tags + optional JSON-LD. */
export function setSeo({ title, description, url, ogImage, type = 'website', keywords, robots, jsonLd, article }: SeoProps) {
  document.title = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;

  const image = ogImage || BASE_URL + '/assets/logo-512.png';

  setMeta('name', 'description', description || '');
  setMeta('name', 'keywords', keywords || '');
  setMeta('name', 'robots', robots || 'index, follow');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:url', url || BASE_URL + '/');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:description', description || '');
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:image:alt', description?.slice(0, 200) || title);
  setMeta('property', 'og:locale', ogLocale());
  setMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description || '');
  setMeta('name', 'twitter:image', image);
  setLink('canonical', url || BASE_URL + '/');

  if (type === 'article') {
    setMeta('property', 'article:published_time', article?.publishedTime || '');
    setMeta('property', 'article:modified_time', article?.modifiedTime || '');
    setMeta('property', 'article:author', (article?.authors || []).join(', '));
    setMeta('property', 'article:section', article?.section || '');
    setMeta('property', 'article:tag', (article?.tags || []).join(', '));
  }

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
