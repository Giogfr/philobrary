export type PaperStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type PaperContentType = 'google_doc' | 'native_markdown';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Revision {
  timestamp: string; // ISO 8601
  note: string;
  author: string;
}

export interface Paper {
  id: string;
  title: string;
  slug: string;
  contentType: PaperContentType;
  googleDocUrl?: string;
  content: string; // Markdown content
  author: string;
  authorPhotoURL?: string;
  focusArea: string;
  tags: string[]; // Tag IDs
  status: PaperStatus;
  createdAt: string; // ISO 8601
  publishedAt?: string;
  updatedAt: string;
  scheduledFor?: string;
  views: number;
  savedCount?: number;
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
  revisions: Revision[];
  metaDescription?: string;
  keywords?: string;
  ogImage?: string;
  featuredOrder?: number; // For featured/recommended papers ordering
}

export interface User {
  isAuthenticated: boolean;
  email: string | null;
  lastActive: number;
  displayName?: string;
  photoURL?: string;
  uid?: string;
}

export interface Visit {
  at?: number;
  t?: number;
  ip?: string;
  type?: string;
  continent?: string;
  continentCode?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionCode?: string;
  city?: string;
  postal?: string;
  lat?: number;
  lon?: number;
  isEu?: boolean;
  callingCode?: string;
  capital?: string;
  flagEmoji?: string;
  flagImg?: string;
  isp?: string;
  org?: string;
  asn?: number | string;
  connectionDomain?: string;
  timezoneId?: string;
  timezoneAbbr?: string;
  timezoneUtc?: string;
  timezoneOffset?: number;
  timezoneDst?: boolean;
  currentTime?: string;
  currency?: string;
  currencyCode?: string;
  currencySymbol?: string;
  currencyPlural?: string;
  exchangeRate?: number;
  borders?: string[];
  anonymous?: boolean;
  proxy?: boolean;
  vpn?: boolean;
  tor?: boolean;
  hosting?: boolean;
  ua?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
  screen?: string;
  lang?: string;
  referrer?: string;
  path?: string;
  campaign?: string;
}


