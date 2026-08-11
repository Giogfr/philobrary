import { useSyncExternalStore } from 'react';
import { Paper, User, Tag, PaperStatus } from './types';
import { sanitizeHTML } from './utils';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set, remove, update, get } from 'firebase/database';
import { setCurrentLang, t, translateShortLabel, translatePaperContent, languageNames } from './i18n';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type SupportedLanguage = 'en' | 'ka' | 'ru' | 'pl' | 'he' | 'ar' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'tr' | 'ja' | 'zh' | 'uk';

export interface PaperTranslation {
  title?: string;
  focusArea?: string;
  content?: string;
}

interface TranslationBucket {
  papers: Record<string, PaperTranslation>;
  tags: Record<string, string>;
}

const emptyBucket = (): TranslationBucket => ({ papers: {}, tags: {} });

export interface PremadeTag {
  id: string;
  name: string;
  color: string;
}

export const PREMADE_TAGS: PremadeTag[] = [
  { id: 'tag-philosophy', name: 'Philosophy', color: '#818CF8' },
  { id: 'tag-ethics', name: 'Ethics', color: '#34D399' },
  { id: 'tag-metaphysics', name: 'Metaphysics', color: '#A78BFA' },
  { id: 'tag-epistemology', name: 'Epistemology', color: '#60A5FA' },
  { id: 'tag-logic', name: 'Logic', color: '#38BDF8' },
  { id: 'tag-aesthetics', name: 'Aesthetics', color: '#F472B6' },
  { id: 'tag-ontology', name: 'Ontology', color: '#C084FC' },
  { id: 'tag-mind', name: 'Philosophy of Mind', color: '#FB7185' },
  { id: 'tag-science', name: 'Philosophy of Science', color: '#2DD4BF' },
  { id: 'tag-politics', name: 'Political Philosophy', color: '#FBBF24' },
  { id: 'tag-social', name: 'Social Philosophy', color: '#F87171' },
  { id: 'tag-phenomenology', name: 'Phenomenology', color: '#22D3EE' },
  { id: 'tag-existentialism', name: 'Existentialism', color: '#E879F9' },
  { id: 'tag-stoicism', name: 'Stoicism', color: '#A3E635' },
  { id: 'tag-nihilism', name: 'Nihilism', color: '#94A3B8' },
  { id: 'tag-pragmatism', name: 'Pragmatism', color: '#FACC15' },
  { id: 'tag-idealism', name: 'Idealism', color: '#67E8F9' },
  { id: 'tag-realism', name: 'Realism', color: '#4ADE80' },
  { id: 'tag-rationalism', name: 'Rationalism', color: '#7DD3FC' },
  { id: 'tag-empiricism', name: 'Empiricism', color: '#5EEAD4' },
  { id: 'tag-utilitarianism', name: 'Utilitarianism', color: '#FDBA74' },
  { id: 'tag-deontology', name: 'Deontology', color: '#93C5FD' },
  { id: 'tag-virtue', name: 'Virtue Ethics', color: '#6EE7B7' },
  { id: 'tag-bioethics', name: 'Bioethics', color: '#4ADE80' },
  { id: 'tag-environment', name: 'Environmental Ethics', color: '#86EFAC' },
  { id: 'tag-ai-ethics', name: 'AI Ethics', color: '#C4B5FD' },
  { id: 'tag-neuroethics', name: 'Neuroethics', color: '#FDA4AF' },
  { id: 'tag-moral-psych', name: 'Moral Psychology', color: '#F0ABFC' },
  { id: 'tag-cognitive', name: 'Cognitive Science', color: '#A5B4FC' },
  { id: 'tag-neuroscience', name: 'Neuroscience', color: '#818CF8' },
  { id: 'tag-psychology', name: 'Psychology', color: '#F9A8D4' },
  { id: 'tag-sociology', name: 'Sociology', color: '#FCA5A5' },
  { id: 'tag-anthropology', name: 'Anthropology', color: '#FCD34D' },
  { id: 'tag-history', name: 'History', color: '#FDBA74' },
  { id: 'tag-ancient', name: 'Ancient Philosophy', color: '#D6BCFA' },
  { id: 'tag-medieval', name: 'Medieval Philosophy', color: '#C4B5FD' },
  { id: 'tag-modern', name: 'Modern Philosophy', color: '#93C5FD' },
  { id: 'tag-continental', name: 'Continental Philosophy', color: '#FBCFE8' },
  { id: 'tag-analytic', name: 'Analytic Philosophy', color: '#BFDBFE' },
  { id: 'tag-language', name: 'Philosophy of Language', color: '#67E8F9' },
  { id: 'tag-religion', name: 'Philosophy of Religion', color: '#DDD6FE' },
  { id: 'tag-law', name: 'Philosophy of Law', color: '#FDE68A' },
  { id: 'tag-education', name: 'Philosophy of Education', color: '#A7F3D0' },
  { id: 'tag-technology', name: 'Philosophy of Technology', color: '#B0BEC5' },
  { id: 'tag-art', name: 'Philosophy of Art', color: '#F472B6' },
];

interface StoreState {
  papers: Paper[];
  tags: Tag[];
  user: User;
  bookmarkedIds: string[];
  toasts: ToastMessage[];
  theme: 'light' | 'dark';
  language: SupportedLanguage;
  translations: Record<SupportedLanguage, TranslationBucket>;
  pending: Set<string>;
}

const readStorage = (key: string) => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage may be unavailable (private mode etc.)
  }
};

let state: StoreState = {
  papers: [],
  tags: [],
  user: { isAuthenticated: false, email: null, lastActive: 0 },
  bookmarkedIds: [],
  toasts: [],
  theme: (readStorage('theme') as 'light' | 'dark') || 'dark',
  language: (readStorage('language') as SupportedLanguage) || 'en',
  translations: {} as Record<SupportedLanguage, TranslationBucket>,
  pending: new Set(),
};

const listeners = new Set<() => void>();

function setState(partial: Partial<StoreState>) {
  state = { ...state, ...partial };
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoreState {
  return state;
}

const ADMIN_EMAILS = ['idontsayidontsay@gmail.com', 'larpgio@gmail.com'];

export function isAdminEmail(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.includes(email);
}

function verifyAuth() {
  if (!state.user.isAuthenticated || !isAdminEmail(state.user.email)) {
    showToast('toast.unauthorized', 'error');
    throw new Error('Unauthorized');
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = crypto.randomUUID();
  setState({ toasts: [...state.toasts, { id, message: t(message), type }] });
  setTimeout(() => {
    setState({ toasts: state.toasts.filter(t => t.id !== id) });
  }, 3500);
}

function setTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  writeStorage('theme', theme);
  setState({ theme });
}

function setLanguage(lang: SupportedLanguage) {
  setCurrentLang(lang);
  const root = document.documentElement;
  root.dir = ['he', 'ar'].includes(lang) ? 'rtl' : 'ltr';
  writeStorage('language', lang);
  setState({ language: lang });
}

const toggleTheme = () => setTheme(state.theme === 'light' ? 'dark' : 'light');

// ==========================================================================
// AUTH + REALTIME LISTENERS (started once)
// ==========================================================================

onAuthStateChanged(auth, async (currentUser) => {
  if (currentUser) {
    setState({ user: { isAuthenticated: true, email: currentUser.email, lastActive: Date.now() } });
    try {
      const userDoc = await get(ref(db, 'users/' + currentUser.uid));
      const data = userDoc.exists() ? userDoc.val() : {};
      if (data?.bookmarkedIds) setState({ bookmarkedIds: data.bookmarkedIds });
    } catch {
      // ignore bookmark load failures
    }
  } else {
    setState({ user: { isAuthenticated: false, email: null, lastActive: 0 }, bookmarkedIds: [] });
  }
});

onValue(ref(db, 'papers'), (snapshot) => {
  const data = snapshot.val();
  const papers = data ? Object.values(data) as Paper[] : [];
  setState({ papers });

  // Auto-publish scheduled papers whose time has come.
  const now = Date.now();
  papers
    .filter(p => p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now)
    .forEach(p => {
      update(ref(db, 'papers/' + p.id), { status: 'published', publishedAt: p.scheduledFor });
    });
});

onValue(ref(db, 'tags'), (snapshot) => {
  const data = snapshot.val();
  setState({ tags: data ? Object.values(data) as Tag[] : [] });
});

// Apply persisted theme + language to the document on boot.
{
  const root = document.documentElement;
  root.classList.toggle('dark', state.theme === 'dark');
  root.dir = ['he', 'ar'].includes(state.language) ? 'rtl' : 'ltr';
  setCurrentLang(state.language);
}

// ==========================================================================
// ACTIONS
// ==========================================================================

const logout = async () => {
  try {
    await signOut(auth);
    showToast('toast.loggedOut', 'success');
  } catch {
    showToast('toast.logoutError', 'error');
  }
};

const toggleBookmark = async (id: string) => {
  if (!auth.currentUser) {
    showToast('toast.signinRequired', 'info');
    return;
  }
  const newBookmarks = state.bookmarkedIds.includes(id)
    ? state.bookmarkedIds.filter(bid => bid !== id)
    : [...state.bookmarkedIds, id];
  setState({ bookmarkedIds: newBookmarks });
  try {
    await update(ref(db, 'users/' + auth.currentUser.uid), { bookmarkedIds: newBookmarks });
  } catch (e) {
    console.error(e);
    showToast('toast.saveFailed', 'error');
  }
};

const cleanPaperData = (paper: Paper): any => {
  const cleaned: any = {};
  
  const copyIfNotUndefined = (key: string) => {
    if (paper[key as keyof Paper] !== undefined) {
      cleaned[key] = paper[key as keyof Paper];
    }
  };
  
  copyIfNotUndefined('id');
  copyIfNotUndefined('title');
  copyIfNotUndefined('slug');
  copyIfNotUndefined('contentType');
  copyIfNotUndefined('googleDocUrl');
  copyIfNotUndefined('content');
  copyIfNotUndefined('author');
  copyIfNotUndefined('focusArea');
  copyIfNotUndefined('tags');
  copyIfNotUndefined('status');
  copyIfNotUndefined('createdAt');
  copyIfNotUndefined('publishedAt');
  copyIfNotUndefined('updatedAt');
  copyIfNotUndefined('scheduledFor');
  copyIfNotUndefined('views');
  copyIfNotUndefined('wordCount');
  copyIfNotUndefined('characterCount');
  copyIfNotUndefined('readingTimeMinutes');
  copyIfNotUndefined('revisions');
  copyIfNotUndefined('metaDescription');
  copyIfNotUndefined('keywords');
  copyIfNotUndefined('ogImage');
  
  return cleaned;
};

const deletePaper = async (id: string) => {
  try {
    verifyAuth();
    await remove(ref(db, 'papers/' + id));
    showToast('toast.deleted', 'info');
  } catch (e) {
    console.error(e);
    showToast('toast.saveFailed', 'error');
  }
};

const incrementViews = async (id: string) => {
  try {
    const paper = state.papers.find(p => p.id === id);
    if (paper) {
      await update(ref(db, 'papers/' + id), { views: (paper.views || 0) + 1 });
    }
  } catch (e) {
    console.error('Failed to increment views:', e);
  }
};

const addPaper = async (paper: Paper) => {
  try {
    verifyAuth();
    if (paper.contentType === 'native_markdown') paper.content = sanitizeHTML(paper.content);
    
    const cleaned = cleanPaperData(paper);
    await set(ref(db, 'papers/' + paper.id), cleaned);
    showToast('toast.published', 'success');
  } catch (e) {
    console.error('Failed to save paper:', e);
    showToast('toast.saveFailed', 'error');
  }
};

const updatePaper = async (updatedPaper: Paper) => {
  try {
    verifyAuth();
    if (updatedPaper.contentType === 'native_markdown') updatedPaper.content = sanitizeHTML(updatedPaper.content);
    
    const cleaned = cleanPaperData(updatedPaper);
    await set(ref(db, 'papers/' + updatedPaper.id), cleaned);
    showToast('toast.updated', 'success');
  } catch (e) {
    console.error('Failed to update paper:', e);
    showToast('toast.saveFailed', 'error');
  }
};

const setPaperStatus = async (id: string, status: PaperStatus) => {
  try {
    verifyAuth();
    const paper = state.papers.find(p => p.id === id);
    if (!paper) return;
    const patch: Partial<Paper> = { status, updatedAt: new Date().toISOString() };
    if (status === 'published' && paper.status !== 'published') patch.publishedAt = new Date().toISOString();
    if (status === 'scheduled') patch.scheduledFor = paper.scheduledFor || undefined;
    await update(ref(db, 'papers/' + id), patch);
    showToast('toast.statusUpdated', 'success');
  } catch (e) {
    console.error('Failed to update paper status:', e);
    showToast('toast.saveFailed', 'error');
  }
};

const addTag = async (tag: Tag) => {
  try {
    verifyAuth();
    await set(ref(db, 'tags/' + tag.id), tag);
    showToast('toast.tagAdded', 'success');
  } catch (e) {
    console.error('Failed to add tag:', e);
    showToast('toast.saveFailed', 'error');
  }
};

const updateTag = async (tag: Tag) => {
  try {
    verifyAuth();
    await set(ref(db, 'tags/' + tag.id), tag);
  } catch (e) {
    console.error('Failed to update tag:', e);
    showToast('toast.saveFailed', 'error');
  }
};

const deleteTag = async (id: string) => {
  try {
    verifyAuth();
    await remove(ref(db, 'tags/' + id));
    showToast('toast.tagDeleted', 'info');
  } catch (e) {
    console.error('Failed to delete tag:', e);
    showToast('toast.saveFailed', 'error');
  }
};

const seedPremadeTags = async () => {
  verifyAuth();
  const existingIds = new Set(state.tags.map(t => t.id));
  const existingNames = new Set(state.tags.map(t => t.name.toLowerCase()));
  let added = 0;
  for (const tag of PREMADE_TAGS) {
    if (existingIds.has(tag.id) || existingNames.has(tag.name.toLowerCase())) continue;
    try {
      await set(ref(db, 'tags/' + tag.id), tag);
      added++;
    } catch {
      // stop on first write failure (likely a permissions issue)
      break;
    }
  }
  if (added > 0) showToast('toast.tagsSeeded', 'success');
};

// ==========================================================================
// DYNAMIC CONTENT TRANSLATION LAYER
// ==========================================================================

function markPending(key: string) {
  const next = new Set(state.pending);
  next.add(key);
  setState({ pending: next });
}

function unmarkPending(key: string) {
  const next = new Set(state.pending);
  next.delete(key);
  setState({ pending: next });
}

function patchBucket(lang: SupportedLanguage, update: (bucket: TranslationBucket) => TranslationBucket) {
  setState({
    translations: {
      ...state.translations,
      [lang]: update(state.translations[lang] || emptyBucket()),
    },
  });
}

function patchPaperTranslation(lang: SupportedLanguage, paperId: string, patch: PaperTranslation) {
  patchBucket(lang, bucket => ({
    ...bucket,
    papers: {
      ...bucket.papers,
      [paperId]: { ...(bucket.papers[paperId] || {}), ...patch },
    },
  }));
}

function patchTagTranslation(lang: SupportedLanguage, tagId: string, name: string) {
  patchBucket(lang, bucket => ({
    ...bucket,
    tags: { ...bucket.tags, [tagId]: name },
  }));
}

/** Translates a paper's short metadata (title + focusArea) if not cached. */
const ensureMetadataTranslation = async (paper: Paper, lang: SupportedLanguage) => {
  if (lang === 'en' || !paper) return;
  const bucket = state.translations[lang] || emptyBucket();
  const entry = bucket.papers[paper.id];
  const needsTitle = entry?.title === undefined;
  const needsFocus = entry?.focusArea === undefined;
  if (!needsTitle && !needsFocus) return;
  const key = `meta:${paper.id}:${lang}`;
  if (state.pending.has(key)) return;
  markPending(key);
  try {
    const [title, focusArea] = await Promise.all([
      needsTitle ? translateShortLabel(paper.title, lang) : Promise.resolve(entry!.title!),
      needsFocus ? (paper.focusArea ? translateShortLabel(paper.focusArea, lang) : Promise.resolve('')) : Promise.resolve(entry!.focusArea!),
    ]);
    patchPaperTranslation(lang, paper.id, { title, focusArea });
  } catch {
    // keep original text on failure
  } finally {
    unmarkPending(key);
  }
};

/** Translates the full markdown body of a paper if not cached. */
const ensureContentTranslation = async (paper: Paper, lang: SupportedLanguage) => {
  if (lang === 'en' || !paper || paper.contentType !== 'native_markdown' || !paper.content) return;
  const bucket = state.translations[lang] || emptyBucket();
  if (bucket.papers[paper.id]?.content !== undefined) return;
  const key = `content:${paper.id}:${lang}`;
  if (state.pending.has(key)) return;
  markPending(key);
  try {
    const content = await translatePaperContent(paper.content, lang);
    patchPaperTranslation(lang, paper.id, { content });
  } catch {
    // keep original content on failure
  } finally {
    unmarkPending(key);
  }
};

/** Translates tag names for the active language if not cached. */
const ensureTagTranslations = (allTags: Tag[], lang: SupportedLanguage) => {
  if (lang === 'en') return;
  allTags.forEach(tag => {
    const bucket = state.translations[lang] || emptyBucket();
    if (bucket.tags[tag.id] !== undefined) return;
    const key = `tag:${tag.id}:${lang}`;
    if (state.pending.has(key)) return;
    markPending(key);
    translateShortLabel(tag.name, lang)
      .then(name => patchTagTranslation(lang, tag.id, name))
      .catch(() => undefined)
      .finally(() => unmarkPending(key));
  });
};

/** Returns the translated title for a paper (original when English or not yet translated). */
const translatedTitle = (paper: Paper): string => {
  if (state.language === 'en' || !paper) return paper.title;
  return state.translations[state.language]?.papers?.[paper.id]?.title || paper.title;
};

/** Returns the translated focusArea for a paper. */
const translatedFocusArea = (paper: Paper): string => {
  if (state.language === 'en' || !paper) return paper.focusArea || '';
  return state.translations[state.language]?.papers?.[paper.id]?.focusArea ?? paper.focusArea ?? '';
};

/** Returns the translated content (or original) for a paper. */
const translatedContent = (paper: Paper): string => {
  if (state.language === 'en' || !paper) return paper.content;
  return state.translations[state.language]?.papers?.[paper.id]?.content ?? paper.content;
};

/** Returns the translated name for a tag. */
const translatedTagName = (tag: Tag): string => {
  if (state.language === 'en' || !tag) return tag.name;
  return state.translations[state.language]?.tags?.[tag.id] || tag.name;
};

/** Translates the active-language labels for a visible set of papers + tags. */
const ensureVisibleTranslations = (visiblePapers: Paper[], allTags: Tag[]) => {
  if (state.language === 'en') return;
  ensureTagTranslations(allTags, state.language);
  visiblePapers.forEach(p => ensureMetadataTranslation(p, state.language));
};

/** Returns the localized display name for the current language. */
const languageLabel = (): string => languageNames[state.language] || languageNames.en;

export function useStore() {
  useSyncExternalStore(subscribe, getSnapshot);
  return {
    papers: state.papers,
    tags: state.tags,
    user: state.user,
    bookmarkedIds: state.bookmarkedIds,
    toasts: state.toasts,
    theme: state.theme,
    language: state.language,
    toggleTheme,
    setLanguage,
    addPaper,
    updatePaper,
    deletePaper,
    setPaperStatus,
    incrementViews,
    addTag,
    updateTag,
    deleteTag,
    seedPremadeTags,
    toggleBookmark,
    logout,
    showToast,
    // Translation layer
    translatedTitle,
    translatedFocusArea,
    translatedContent,
    translatedTagName,
    ensureMetadataTranslation,
    ensureContentTranslation,
    ensureTagTranslations,
    ensureVisibleTranslations,
    languageLabel,
    pendingTranslations: state.pending,
  };
}
