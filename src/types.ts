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
}

export interface User {
  isAuthenticated: boolean;
  email: string | null;
  lastActive: number;
}

