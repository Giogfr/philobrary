import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { auth } from './firebase';
import { ref, set, onValue } from 'firebase/database';
import { db, storage } from './firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useStore, isAdminEmail } from './store';
import { Paper, Tag } from './types';
import { Flag } from './components/Flag';
import { Search, ShieldCheck, LogOut, FileText, Bookmark, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, User as UserIcon, Sun, Moon, Globe, CheckCircle, AlertCircle, Info, Eye, Library as LibraryIcon, LayoutGrid, LayoutDashboard, List, ArrowUp, ArrowLeft, X, Sparkles, Clock, History, PenLine } from 'lucide-react';
import { t, languageShortNames } from './i18n';
import { setSeo, resetSeo, stripMarkdown, BASE_URL, setHreflangAlternates, createBreadcrumbJsonLd, addJsonLd } from './seo';
import { htmlToText, generateSlug } from './utils';
import { LegalPage } from './components/LegalPages';
import { ContactPage } from './components/ContactPage';
import { RequestPaperPage } from './components/RequestPaperPage';
import { Preloader } from './components/Preloader';
import { BalloonHeadline } from './components/BalloonHeadline';
import SidebarAd from './components/SidebarAd';
import BannerAd from './components/BannerAd';

// Route-level code splitting — admin + auth screens load on demand.
const AdminLogin = lazy(() => import('./components/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const PaperReader = lazy(() => import('./components/PaperReader').then(m => ({ default: m.PaperReader })));
const LanguageSelector = lazy(() => import('./components/LanguageSelector').then(m => ({ default: m.LanguageSelector })));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 rounded-full border-2 border-border-subtle border-t-accent-indigo animate-spin" />
    </div>
  );
}

function resizeImageToAvatar(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not supported');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

type SortOption = 'newest' | 'oldest' | 'views' | 'saves' | 'updated' | 'alpha';

const SORT_LABEL_KEY: Record<SortOption, string> = {
  newest: 'sort.newest',
  oldest: 'sort.oldest',
  views: 'sort.mostViewed',
  saves: 'sort.mostSaved',
  updated: 'sort.updated',
  alpha: 'sort.alphabetical',
};

const VIEW_MODE_KEY = 'philobrary_view_mode';

function ToastContainer() {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[100] flex flex-col items-center gap-3 w-full max-w-md px-4">
      {toasts.map(toast => (
        <div key={toast.id} className="w-full flex items-center gap-3 px-5 py-4 bg-bg-card border border-border-subtle text-text-primary rounded-2xl shadow-2xl shadow-black/20 animate-in">
          {toast.type === 'success' && <CheckCircle size={18} className="text-success shrink-0" />}
          {toast.type === 'error' && <AlertCircle size={18} className="text-danger shrink-0" />}
          {toast.type === 'info' && <Info size={18} className="text-accent-cyan shrink-0" />}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

function LibraryView({ currentView }: { currentView: 'library' | 'saved' }) {
  const { 
    papers, tags, user, bookmarkedIds, dataReady,
    toggleBookmark, readingHistory,
    translatedTitle, translatedTagName, translatedFocusArea, translatedContent, translatedDescription,
    ensureContentTranslation, language, theme
  } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string | 'All'>('All');
  const [selectedAuthor, setSelectedAuthor] = useState<string | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortOption>('views');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return saved === 'list' ? 'list' : 'grid';
  });
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSortDropdown(false);
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    const handleScroll = () => setShowBackToTop(window.scrollY > 600);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Scroll the active tag chip into view when it is selected.
  useEffect(() => {
    if (selectedTagId !== 'All') {
      document.getElementById(`tag-chip-${selectedTagId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [selectedTagId]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Keyboard shortcuts: "/" focuses search, "Esc" clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const isTyping = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && el === searchRef.current) {
        setSearchQuery('');
        setDebouncedQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const now = Date.now();
  const processedPapers = papers.map(p => {
    if (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now) {
      return { ...p, status: 'published' as const, publishedAt: p.scheduledFor };
    }
    return p;
  });

  const libraryPapers = currentView === 'saved' 
    ? processedPapers.filter(p => bookmarkedIds.includes(p.id) && p.status === 'published')
    : processedPapers.filter(p => p.status === 'published');
  
  const authors = [...new Set(libraryPapers.map(p => p.author))].sort((a, b) => a.localeCompare(b));

  const topTags = tags
    .map(tag => ({ tag, count: libraryPapers.filter(p => (p.tags || []).includes(tag.id)).length }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
    .slice(0, 10);

  const filteredPapers = libraryPapers.map(paper => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return { paper, score: 0 };
    const tokens = q.split(/\s+/).filter(Boolean);
    const tagNames = (paper.tags || []).map(tid => tags.find(tg => tg.id === tid)?.name || tid).join(' ');
    const haystacks: { text: string; weight: number }[] = [
      { text: translatedTitle(paper), weight: 4 },
      { text: paper.title, weight: 4 },
      { text: paper.author, weight: 2 },
      { text: paper.keywords || '', weight: 2 },
      { text: tagNames, weight: 2 },
      { text: translatedFocusArea(paper) || paper.focusArea || '', weight: 1 },
      { text: paper.content || '', weight: 1 },
      { text: translatedContent(paper) || '', weight: 1 },
    ];
    const indexed = haystacks.map(h => ({ text: h.text.toLowerCase(), weight: h.weight }));
    let score = 0;
    for (const token of tokens) {
      let tokenScore = 0;
      for (const { text, weight } of indexed) {
        if (text.includes(token)) { tokenScore += weight; continue; }
        // Fuzzy: token matches the start of any word in the field.
        if (new RegExp(`(^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text)) tokenScore += weight * 0.6;
      }
      if (tokenScore === 0) return { paper, score: -1 }; // every token must match somewhere
      score += tokenScore;
    }
    return { paper, score };
  })
    .filter(({ paper, score }) => {
      if (score < 0) return false;
      const matchesTag = selectedTagId === 'All' || (paper.tags || []).includes(selectedTagId);
      const matchesAuthor = selectedAuthor === 'All' || paper.author === selectedAuthor;
      return matchesTag && matchesAuthor;
    })
    .sort((a, b) => {
      if (debouncedQuery.trim() && a.score !== b.score) return b.score - a.score;
      const pa = a.paper, pb = b.paper;
      const aTime = pa.publishedAt ? new Date(pa.publishedAt).getTime() : 0;
      const bTime = pb.publishedAt ? new Date(pb.publishedAt).getTime() : 0;
      const aUpd = pa.updatedAt ? new Date(pa.updatedAt).getTime() : 0;
      const bUpd = pb.updatedAt ? new Date(pb.updatedAt).getTime() : 0;
      switch (sortBy) {
        case 'oldest': return aTime - bTime;
        case 'views': return pb.views - pa.views;
        case 'saves': return (pb.savedCount || 0) - (pa.savedCount || 0);
        case 'updated': return bUpd - aUpd;
        case 'alpha': return pa.title.localeCompare(pb.title);
        case 'newest':
        default: return bTime - aTime;
      }
    })
    .map(entry => entry.paper);

  const hasActiveFilters = debouncedQuery.trim() !== '' || selectedTagId !== 'All' || selectedAuthor !== 'All';

  const featuredPapers = processedPapers
    .filter(p => p.featuredOrder !== undefined && p.featuredOrder > 0 && p.status === 'published')
    .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));

  const handleReadPaper = (paper: Paper) => {
    ensureContentTranslation(paper, language);
    navigate(`/p/${paper.slug}`);
  };

  // Keep the carousel index valid when the featured list changes.
  useEffect(() => {
    if (featuredIndex >= featuredPapers.length) {
      setFeaturedIndex(featuredPapers.length > 0 ? featuredPapers.length - 1 : 0);
    }
  }, [featuredPapers.length]);

  useEffect(() => {
    resetSeo();
    setSeo({
      title: currentView === 'saved' ? t('nav.saved') : 'Philosophy Essay Library by Gio',
      description: currentView === 'saved'
        ? 'Your saved philosophy essays.'
        : 'A curated digital library of philosophy essays, thinkers, and original research — translated into 15 languages.',
      url: currentView === 'saved' ? BASE_URL + '/saved' : BASE_URL + '/',
      robots: currentView === 'saved' ? 'noindex, nofollow' : 'index, follow',
    });
    setHreflangAlternates(currentView === 'saved' ? '/saved' : '/');
  }, [currentView]);

return (
    <>
      <div id="main-content" className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-20 relative">
        {/* Hero: text + featured paper side-by-side */}
        <div className={`relative flex flex-col md:flex-row items-start gap-8 mb-8 md:mb-12 ${currentView === 'library' && featuredPapers.length > 0 ? 'lg:items-start' : ''}`}>
          <div className="max-w-3xl">
            {currentView === 'saved' ? (
              <h1 className="text-[2.5rem] sm:text-[3rem] md:text-[4rem] font-bold text-text-primary tracking-tighter mb-6 leading-[1.06] hero-title">
                {t('hero.title.saved')}
              </h1>
            ) : (
              <BalloonHeadline theme={theme === 'dark' ? 'dark' : 'light'} />
            )}
            <p className={`text-[15px] md:text-[17px] text-text-secondary leading-relaxed hero-subtitle max-w-[50ch] anim-enter anim-d3`}>
              {currentView === 'saved' ? t('hero.subtitle.saved') : t('hero.subtitle.library')}
            </p>

            {currentView === 'library' && (
              <>
                {/* Library stats */}
                <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5">
                  {[
                    { label: t('library.statEssays'), value: libraryPapers.length.toLocaleString() },
                    { label: t('library.statTopics'), value: topTags.length.toLocaleString() },
                    { label: t('library.statAuthors'), value: authors.length.toLocaleString() },
                    { label: t('library.statLanguages'), value: '15' },
                  ].map((s, i) => (
                    <div key={s.label} className={`flex items-baseline gap-2 anim-enter anim-d${Math.min(i + 4, 10)}`}>
                      <dt className="text-[2rem] md:text-[2.5rem] font-bold text-text-primary tracking-tighter">{s.value}</dt>
                      <dd className="text-[10px] font-mono text-text-muted uppercase tracking-widest">{s.label}</dd>
                    </div>
                  ))}
                </dl>

                {/* Request a paper CTA */}
                <Link
                  to="/request"
                  className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full border border-accent-indigo/40 text-accent-indigo bg-accent-indigo/5 hover:bg-accent-indigo/15 hover:border-accent-indigo transition-colors anim-enter anim-d8"
                >
                  <PenLine size={16} /> {t('hero.requestCta')}
                </Link>

                {/* Popular topics */}
                {topTags.length > 0 && (
                  <div className="mt-8 anim-enter anim-d9">
                    <p className="kicker mb-3">{t('library.popularTopics')}</p>
                    <div className="flex flex-wrap gap-2">
                      {topTags.map(({ tag, count }, i) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedTagId(tag.id);
                            document.getElementById('library-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded border transition-all tag-hover anim-fade anim-d${Math.min(i + 5, 10)} ${
                            selectedTagId === tag.id
                              ? 'bg-text-primary text-bg-primary border-text-primary'
                              : 'text-text-secondary border-border-subtle hover:border-line-2 hover:text-text-primary'
                          }`}
                        >
                          {translatedTagName(tag)}
                          <span className="text-[11px] font-mono opacity-60">{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {currentView === 'library' && featuredPapers.length > 0 && (
            <div className="relative w-full md:max-w-[400px] shrink-0 anim-enter-right anim-d5">
              <div className="flex items-center gap-2 mb-3">
                <span className="kicker">{t('library.suggestedForYou')}</span>
              </div>
              {(() => {
                const paper = featuredPapers[featuredIndex % featuredPapers.length];
                const paperTags = (paper.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
                const isSaved = bookmarkedIds.includes(paper.id);
                const displayTags = paperTags.slice(0, 3);
                const excerpt = translatedDescription(paper)
                  || translatedContent(paper)
                  || htmlToText(paper.content).slice(0, 180);
                const prev = () => setFeaturedIndex(i => (i - 1 + featuredPapers.length) % featuredPapers.length);
                const next = () => setFeaturedIndex(i => (i + 1) % featuredPapers.length);
                return (
                  <article
                    key={paper.id}
                    onClick={() => handleReadPaper(paper)}
                    className="group relative flex flex-col border border-border-subtle rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:border-line-2"
                  >
                    <div className="p-5 pt-4 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {displayTags.map(t => (
                          <span key={t.id} className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded border border-border-subtle text-text-muted">
                            {translatedTagName(t)}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                        aria-label={t('reader.bookmark')}
                        className={`flex-shrink-0 p-2 rounded transition-all duration-150 ${isSaved ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                      >
                        <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <div className="flex-1 p-5 pt-2 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="kicker">{t('library.featured')}</span>
                      </div>
                      <h3 className="font-semibold text-text-primary leading-tight mb-3 line-clamp-2 text-lg tracking-tight">
                        {translatedTitle(paper)}
                      </h3>
                      <p className="text-text-secondary leading-relaxed line-clamp-3 flex-1 text-[15px] mb-4">
                        {excerpt}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border-subtle">
                        <span className="text-xs text-text-muted">{paper.author}</span>
                        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                          <span className="flex items-center gap-1"><Eye size={10} /> {(paper.views || 0).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Bookmark size={10} /> {(paper.savedCount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {/* Carousel controls */}
                    <div className="flex items-center justify-between px-5 pb-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); prev(); }}
                        aria-label={t('library.prevFeatured')}
                        className="p-2 rounded border border-border-subtle text-text-secondary hover:text-text-primary hover:border-line-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={featuredPapers.length <= 1}
                      >
                        <ChevronLeft size={14} className="rtl:rotate-180" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {featuredPapers.map((fp, i) => (
                          <button
                            key={fp.id}
                            onClick={(e) => { e.stopPropagation(); setFeaturedIndex(i); }}
                            aria-label={`${i + 1}`}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === featuredIndex % featuredPapers.length ? 'bg-text-primary w-4' : 'bg-border-subtle hover:bg-text-muted'}`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); next(); }}
                        aria-label={t('library.nextFeatured')}
                        className="p-2 rounded border border-border-subtle text-text-secondary hover:text-text-primary hover:border-line-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={featuredPapers.length <= 1}
                      >
                        <ChevronRight size={14} className="rtl:rotate-180" />
                      </button>
                    </div>
                  </article>
                );
              })()}
            </div>
          )}
        </div>

        {currentView === 'library' && (() => {
          const recentIds = readingHistory().map(h => h.id);
          const continuePapers = papers
            .filter(p => p.status === 'published' && recentIds.includes(p.id))
            .sort((a, b) => (recentIds.indexOf(a.id) - recentIds.indexOf(b.id)))
            .slice(0, 4);
          if (continuePapers.length === 0) return null;
          return (
            <section className="mb-10 anim-enter anim-d5" aria-label={t('library.continueReading')}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2 uppercase tracking-wide">
                  <History size={14} />
                  {t('library.continueReading')}
                </h2>
                <span className="text-[11px] font-mono text-text-muted">{t('library.recentlyRead')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {continuePapers.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/p/${p.slug}`)}
                    className={`group text-start border border-border-subtle rounded-lg p-4 hover:border-line-2 transition-colors anim-enter anim-d${Math.min(i + 6, 10)}`}
                  >
                    <div className="kicker mb-2">{translatedFocusArea(p) || 'Philosophy'}</div>
                    <div className="font-medium text-text-primary leading-snug line-clamp-2 text-[15px]">{translatedTitle(p)}</div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-text-muted">
                      <span>{t('library.readingTime')}: {p.readingTimeMinutes || Math.max(1, Math.round((p.wordCount || 0) / 200))} {t('library.min')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })()}

        <div className="flex flex-col lg:flex-row gap-4 mb-8 anim-enter anim-d6">
<div className="relative flex-1">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 text-text-muted"><Search size={16} /></div>
            <input 
              ref={searchRef}
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="w-full py-3.5 ps-11 pe-11 bg-bg-card border border-border-subtle text-text-primary rounded-lg text-[15px] focus:outline-none transition-all placeholder:text-text-muted search-input input-focus"
            />
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(''); setDebouncedQuery(''); searchRef.current?.focus(); }}
                aria-label={t('search.clear')}
                className="absolute inset-y-0 end-0 flex items-center pe-4 text-text-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            ) : (
              <kbd className="absolute inset-y-0 end-0 hidden sm:flex items-center me-4 px-2 py-0.5 text-[11px] font-mono text-text-muted bg-bg-secondary border border-border-subtle rounded">/</kbd>
            )}
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1 lg:min-w-[200px]">
              <button onClick={() => setShowSortDropdown(!showSortDropdown)} aria-haspopup="listbox" aria-expanded={showSortDropdown} className="w-full h-full flex items-center justify-between px-4 py-3.5 bg-bg-card border border-border-subtle text-text-primary rounded-lg text-[15px] hover:border-line-2 transition-colors">
                <div className="flex items-center gap-2"><SlidersHorizontal size={14} className="text-text-muted" /> <span className="hidden sm:inline text-text-muted text-[13px]">{t('sort.label')}</span> <span className="text-[13px]">{t(SORT_LABEL_KEY[sortBy])}</span></div>
                <ChevronDown size={14} className="text-text-muted" />
              </button>
              {showSortDropdown && (
                <div className="absolute top-full mt-1 w-full bg-bg-card border border-border-subtle rounded-lg overflow-hidden z-20" role="listbox">
                  {(['newest', 'oldest', 'views', 'saves', 'updated', 'alpha'] as SortOption[]).map(opt => (
                    <button key={opt} onClick={() => { setSortBy(opt); setShowSortDropdown(false); }} className={`w-full text-start px-4 py-2.5 text-[13px] hover:bg-bg-hover transition-colors ${sortBy === opt ? 'text-text-primary bg-bg-secondary' : 'text-text-secondary'}`}>
                      {t(SORT_LABEL_KEY[opt])}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center bg-bg-card border border-border-subtle rounded-lg p-1 shrink-0" role="group" aria-label={t('library.view')}>
              <button onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'} className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary'}`} title={t('library.viewGrid')}>
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary'}`} title={t('library.viewList')}>
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="sticky top-[60px] md:top-[72px] z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-6 bg-bg-primary/85 backdrop-blur-xl border-b border-border-subtle anim-enter anim-d7">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTagId('All')}
              aria-pressed={selectedTagId === 'All'}
              className={`px-4 py-1.5 text-[13px] font-medium rounded border transition-all btn-press ${selectedTagId === 'All' ? 'bg-text-primary text-bg-primary border-text-primary' : 'text-text-secondary border-border-subtle hover:border-line-2 hover:text-text-primary'}`}
            >
              {t('filter.all')}
            </button>
            {tags.slice(0, showAllTags || selectedTagId !== 'All' ? tags.length : 8).map(tag => (
              <button
                key={tag.id}
                id={`tag-chip-${tag.id}`}
                onClick={() => setSelectedTagId(tag.id)}
                aria-pressed={selectedTagId === tag.id}
                className={`px-4 py-1.5 text-[13px] font-medium rounded border transition-all tag-hover scroll-mx-6 ${selectedTagId === tag.id ? 'bg-text-primary text-bg-primary border-text-primary' : 'text-text-secondary border-border-subtle hover:border-line-2 hover:text-text-primary'}`}
              >
                {translatedTagName(tag)}
              </button>
            ))}
            {!showAllTags && tags.length > 8 && (
              <button
                onClick={() => setShowAllTags(true)}
                className="px-4 py-1.5 text-[13px] font-medium rounded border border-border-subtle text-text-secondary hover:border-line-2"
              >
                +{tags.length - 8} {t('filter.more')}
              </button>
            )}
            {showAllTags && tags.length > 8 && (
              <button
                onClick={() => setShowAllTags(false)}
                className="px-4 py-1.5 text-[13px] font-medium rounded border border-border-subtle text-text-secondary hover:border-line-2"
              >
                {t('filter.less')}
              </button>
            )}
          </div>

          <div className="md:ms-auto flex items-center gap-3">
            {authors.length > 1 && (
              <select
                value={selectedAuthor}
                onChange={e => setSelectedAuthor(e.target.value)}
                aria-label={t('library.author')}
                className="px-3 py-1.5 bg-bg-card border border-border-subtle text-text-secondary rounded text-[13px] focus:outline-none"
              >
                <option value="All">{t('library.allAuthors')}</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <span className="text-[13px] font-mono text-text-muted whitespace-nowrap">
              {filteredPapers.length} {filteredPapers.length === 1 ? t('library.paper') : t('library.papers')}
            </span>
          </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0">
        {hasActiveFilters && filteredPapers.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-border-subtle rounded-lg">
            <Search size={40} className="mx-auto text-text-muted mb-6" />
            <h3 className="text-xl font-semibold text-text-primary mb-3">{t('empty.noMatches.title')}</h3>
            <p className="text-text-muted max-w-md mx-auto mb-8 text-[15px]">{t('empty.noMatches.desc')}</p>
            <button onClick={() => { setSearchQuery(''); setDebouncedQuery(''); setSelectedTagId('All'); setSelectedAuthor('All'); }} className="btn-fill px-6 py-2.5 text-[13px] font-semibold rounded-full transition-all">
              {t('empty.clearFilters')}
            </button>
          </div>
        ) : filteredPapers.length === 0 && dataReady ? (
          <div className="py-24 text-center border border-dashed border-border-subtle rounded-lg">
            <FileText size={40} className="mx-auto text-text-muted mb-6" />
            <h3 className="text-xl font-semibold text-text-primary mb-3">{currentView === 'saved' ? t('empty.saved.title') : t('empty.library.title')}</h3>
            <p className="text-text-muted max-w-md mx-auto text-[15px]">{currentView === 'saved' ? t('empty.saved.desc') : t('empty.library.desc')}</p>
            {currentView === 'saved' && (
              <button onClick={() => navigate('/')} className="btn-fill px-6 py-2.5 text-[13px] font-semibold rounded-full transition-all mt-6">
                {t('empty.explore')}
              </button>
            )}
          </div>
        ) : !dataReady && filteredPapers.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-bg-card border border-border-subtle rounded-3xl p-6 md:p-8 animate-pulse">
                <div className="h-5 w-24 bg-bg-hover rounded-full mb-4" />
                <div className="h-6 bg-bg-hover rounded-xl mb-3 w-3/4" />
                <div className="h-4 bg-bg-hover rounded-lg mb-2 w-full" />
                <div className="h-4 bg-bg-hover rounded-lg mb-2 w-5/6" />
                <div className="h-4 bg-bg-hover rounded-lg mb-6 w-2/3" />
                <div className="h-4 bg-bg-hover rounded-full w-32 mt-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div id="library-results" className={`card-grid ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}`}>
            {filteredPapers.map((paper, index) => {
              const paperTags = (paper.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
              const isSaved = bookmarkedIds.includes(paper.id);
              const displayTags = paperTags.slice(0, 3);
              const excerpt = translatedDescription(paper)
                || translatedContent(paper)
                || htmlToText(paper.content).slice(0, viewMode === 'grid' ? 180 : 220);

              // Grid view card
              if (viewMode === 'grid') {
                return (
                  <article
                    key={paper.id}
                    onClick={() => handleReadPaper(paper)}
                    className={`group relative flex flex-col border border-border-subtle rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:border-line-2 animate-scale-in stagger-${Math.min(index + 1, 12)}`}
                  >
                    {/* Header with tags + bookmark */}
                    <div className="p-5 pt-4 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {displayTags.map(t => (
                          <span key={t.id} className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded border border-border-subtle text-text-muted">
                            {translatedTagName(t)}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                        aria-label={t('reader.bookmark')}
                        className={`flex-shrink-0 p-2 rounded transition-all duration-150 ${isSaved ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                      >
                        <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 p-5 pt-2 flex flex-col">
                      <h3 className="font-semibold text-text-primary leading-tight mb-3 line-clamp-2 text-lg tracking-tight">
                        {translatedTitle(paper)}
                      </h3>
                      
                      <p className="text-text-secondary leading-relaxed line-clamp-3 flex-1 text-[15px] mb-4">
                        {excerpt}
                      </p>

                      {/* Footer with author + stats */}
                      <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                        <span className="text-xs text-text-muted truncate max-w-[140px]">{paper.author}</span>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-text-muted">
                          <span className="flex items-center gap-1" title="Views"><Eye size={10} /> {(paper.views || 0).toLocaleString()}</span>
                          <span className="flex items-center gap-1" title="Saves"><Bookmark size={10} /> {(paper.savedCount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }

              // List view card
              return (
                <article
                  key={paper.id}
                  onClick={() => handleReadPaper(paper)}
                  className={`group relative flex flex-col sm:flex-row sm:items-start gap-4 border border-border-subtle rounded-lg p-5 cursor-pointer transition-all duration-200 hover:border-line-2 animate-slide-in-left stagger-${Math.min(index + 1, 8)} list-item`}
                >
                  <div className="flex-1 min-w-0">
                    {/* Tags + bookmark row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {displayTags.map(t => (
                          <span key={t.id} className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded border border-border-subtle text-text-muted">
                            {translatedTagName(t)}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                        aria-label={t('reader.bookmark')}
                        className={`flex-shrink-0 p-2 rounded transition-all duration-150 ${isSaved ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                      >
                        <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>

                    <h3 className="font-semibold text-text-primary leading-snug mb-2 line-clamp-2 text-lg tracking-tight">
                      {translatedTitle(paper)}
                    </h3>

                    <p className="text-text-secondary leading-relaxed line-clamp-2 hidden sm:block text-[15px] mb-3">
                      {excerpt}
                    </p>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-text-muted">
                      <span className="text-text-secondary">{paper.author}</span>
                      {translatedFocusArea(paper) && (
                        <span className="kicker">{translatedFocusArea(paper)}</span>
                      )}
                      <span className="flex items-center gap-1"><Eye size={10} /> {(paper.views || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Bookmark size={10} /> {(paper.savedCount || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {paper.readingTimeMinutes || 0} {t('paper.minRead')}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </div>

        <aside className="hidden xl:block w-[160px] shrink-0 sticky top-[140px] no-print">
          <SidebarAd />
        </aside>
        </div>
      </div>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 end-6 z-40 p-3 bg-bg-card border border-border-subtle text-text-secondary hover:text-text-primary rounded-lg transition-colors"
          aria-label={t('reader.top')}
        >
          <ArrowUp size={18} />
        </button>
      )}
    </>
  );
}

function ProfileView() {
  const { user, showToast, theme, language, updateUserProfile } = useStore();
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the profile photo URL (Storaged URL, with legacy base64 fallback).
  useEffect(() => {
    if (auth.currentUser) {
      const profileRef = ref(db, 'users/' + auth.currentUser.uid + '/profile');
      onValue(profileRef, (snapshot) => {
        const val = snapshot.val();
        if (val?.photoURL) setProfilePhoto(val.photoURL);
        else if (val?.photoBase64) setProfilePhoto(val.photoBase64);
      });
    }
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('toast.invalidImage', 'error');
      return;
    }
    
    // Validate file size (accept up to 5MB; downscaled to a compact avatar after)
    if (file.size > 5 * 1024 * 1024) {
      showToast('toast.imageTooLarge', 'error');
      return;
    }

    if (!auth.currentUser) return;
    
    setIsUploading(true);
    try {
      // Downscale to a small square avatar regardless of source size.
      const smallImage = await resizeImageToAvatar(file, 256);
      const userId = auth.currentUser.uid;
      let photoRef: string;

      try {
        // Preferred: upload to Firebase Storage and store the download URL.
        const storagePath = storageRef(storage, `avatars/${userId}.jpg`);
        const blob = await (await fetch(smallImage)).blob();
        await uploadBytes(storagePath, blob, { contentType: 'image/jpeg' });
        photoRef = await getDownloadURL(storagePath);
        await set(ref(db, `users/${userId}/profile/photoURL`), photoRef);
      } catch (storageErr) {
        // Fallback: keep the compact base64 in the database if Storage is unavailable.
        console.warn('Storage upload failed, falling back to base64:', storageErr);
        photoRef = smallImage;
        await set(ref(db, `users/${userId}/profile/photoBase64`), smallImage);
      }

      // Firebase Auth photoURL only accepts a real URL, so blank it for base64.
      await updateUserProfile({ photoURL: photoRef.startsWith('data:') ? '' : photoRef, authorPhotoURL: photoRef });
      showToast('toast.photoUpdated', 'success');
    } catch (error: any) {
      showToast(error.message || 'toast.photoFailed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setIsLoading(true);
    try {
      await updateUserProfile({ displayName });
      setDisplayName(displayName);
    } catch (error: any) {
      showToast(error.message || 'toast.profileFailed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user.isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-text-secondary text-lg mb-4">{t('profile.signinPrompt')}</p>
        <Link to="/login" className="btn-fill px-6 py-2.5 text-[13px] font-semibold rounded-full transition-all">
          {t('profile.signin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-[2rem] font-bold text-text-primary tracking-tight mb-6">{t('profile.title')}</h1>
      <div className="bg-bg-card p-6 rounded-lg border border-border-subtle">
        <p className="text-text-secondary mb-4">{t('profile.email')}: <span className="font-medium text-text-primary">{user.email}</span></p>
        
        <div className="border-t border-border-subtle pt-6 mt-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">{t('profile.settings')}</h3>
          
          {/* Profile Picture Section */}
          <div className="mb-8 flex items-center gap-6">
            <div className="relative">
              <img
                src={profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=000000&color=fff&size=200`}
                alt={t('profile.avatarAlt')}
                className="w-24 h-24 rounded-full object-cover border border-border-subtle"
              />
              <button
                type="button"
                onClick={handlePhotoClick}
                className="absolute bottom-0 right-0 w-8 h-8 bg-inverse text-inverse-text rounded-full flex items-center justify-center hover:opacity-86 transition-opacity"
                aria-label={t('profile.changeAvatar')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
              </button>
            </div>
            <div>
              <p className="font-medium text-text-primary">{t('profile.avatar')}</p>
              <p className="text-sm text-text-muted">{t('profile.avatarHint')}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={isUploading}
            />
          </div>

          <form className="space-y-4" onSubmit={handleUpdateProfile}>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('profile.displayName')}</label>
              <input 
                type="text" 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={t('profile.namePlaceholder')}
                disabled={isLoading}
                className="w-full max-w-md py-2.5 px-4 bg-bg-secondary border border-border-subtle text-text-primary rounded-lg focus:outline-none disabled:opacity-50 text-[15px]"
              />
            </div>
            <button type="submit" disabled={isLoading} className="btn-fill px-5 py-2.5 text-[13px] font-semibold rounded-full transition-all disabled:opacity-50">
              {isLoading ? t('profile.saving') : t('profile.save')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function NotFoundView() {
  const navigate = useNavigate();
  const { theme } = useStore();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setSeo({ title: t('notFound.title'), description: t('notFound.title') });
    setAnimate(true);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="relative z-10 max-w-md mx-auto">
        {/* 404 number */}
        <div className={`mb-8 ${animate ? 'animate-in fade-in-down duration-700' : 'opacity-0'}`}>
          <span className="text-8xl md:text-9xl font-bold text-text-primary tracking-tighter">
            404
          </span>
        </div>

        {/* Error message */}
        <div className={`mb-4 ${animate ? 'animate-in fade-in duration-700 delay-200' : 'opacity-0'}`}>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2 tracking-tight">{t('notFound.page')}</h1>
          <p className="text-[15px] text-text-secondary max-w-md mx-auto leading-relaxed">{t('notFound.title')}</p>
        </div>

        {/* Helpful suggestions */}
        <div className={`mb-8 p-5 border border-border-subtle rounded-lg ${animate ? 'animate-in fade-in-up duration-700 delay-400' : 'opacity-0'}`}>
          <h3 className="kicker mb-4 flex items-center justify-center gap-2">
            {t('notFound.suggestions')}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Link to="/" className="flex items-center justify-center gap-2 px-4 py-3 border border-border-subtle text-text-secondary hover:text-text-primary hover:border-line-2 rounded-lg transition-colors">
              <LayoutDashboard size={14} /> {t('notFound.home')}
            </Link>
            <Link to="/saved" className="flex items-center justify-center gap-2 px-4 py-3 border border-border-subtle text-text-secondary hover:text-text-primary hover:border-line-2 rounded-lg transition-colors">
              <Bookmark size={14} /> {t('nav.saved')}
            </Link>
          </div>
        </div>

        {/* Main CTA button */}
        <div className={`${animate ? 'animate-in fade-in-up duration-700 delay-600' : 'opacity-0'}`}>
          <button onClick={() => navigate('/')} className="group inline-flex items-center gap-3 btn-fill px-8 py-3.5 text-[14px] font-semibold rounded-full transition-all">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span>{t('empty.explore')}</span>
          </button>
        </div>

        {/* Footer hint */}
        <p className={`mt-10 text-sm text-text-muted ${animate ? 'animate-in fade-in duration-700 delay-800' : 'opacity-0'}`}>
          {t('notFound.hint')}
        </p>
      </div>
    </div>
  );
}

function TagView() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { papers, tags, bookmarkedIds, toggleBookmark, translatedTitle, translatedTagName, translatedFocusArea, translatedDescription, translatedContent } = useStore();
  const navigate = useNavigate();
  const now = Date.now();

  const processedPapers = papers.map(p => {
    if (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now) {
      return { ...p, status: 'published' as const, publishedAt: p.scheduledFor };
    }
    return p;
  });

  const tag = tags.find(t => generateSlug(t.name) === slug);
  const tagPapers = tag
    ? processedPapers.filter(p => p.status === 'published' && (p.tags || []).includes(tag.id))
    : [];

  useEffect(() => {
    if (!tag) {
      resetSeo();
      setHreflangAlternates('/');
      return;
    }
    const url = `${BASE_URL}/t/${slug}`;
    setSeo({
      title: t('topic.seoTitle', undefined, { topic: tag.name }),
      description: t('topic.seoDesc', undefined, { topic: tag.name }),
      url,
      keywords: `philosophy, ${tag.name}, philosophy ${tag.name}, essays, gio, library`,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${tag.name} — Philobrary`,
        description: t('topic.seoDesc', undefined, { topic: tag.name }),
        url,
        inLanguage: 'en',
        numberOfItems: tagPapers.length,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: tagPapers.length,
          itemListElement: tagPapers.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.title,
            url: `${BASE_URL}/p/${p.slug}`,
          })),
        },
        publisher: { '@type': 'Organization', name: 'Philobrary', logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/logo-512.png` } },
      },
    });
    setHreflangAlternates(`/t/${slug}`);
    addJsonLd('breadcrumb', createBreadcrumbJsonLd([
      { name: 'Library', url: BASE_URL + '/' },
      { name: tag.name, url },
    ]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag?.id, slug]);

  if (!tag) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
        <p className="text-text-secondary text-lg mb-6">{t('notFound')}</p>
        <button onClick={() => navigate('/')} className="btn-fill px-6 py-2.5 text-[13px] font-semibold rounded-full transition-all">
          {t('empty.explore')}
        </button>
      </div>
    );
  }

  return (
    <div id="main-content" className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-16 relative">
      <button
        onClick={() => navigate('/')}
        className="mb-6 flex items-center px-3 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary rounded-lg transition-colors border border-border-subtle hover:border-line-2"
      >
        <ChevronLeft size={14} className="me-2 rtl:rotate-180" />
        {t('topic.back')}
      </button>

      <header className="mb-10">
        <h1 className="text-[2.5rem] md:text-[3.5rem] font-bold text-text-primary tracking-tighter mb-4 leading-[1.06]">{translatedTagName(tag)}</h1>
        <p className="text-text-secondary text-[15px] max-w-3xl">
          {tagPapers.length === 1 ? t('topic.count.one') : `${tagPapers.length} ${t('topic.count.many')}`} — {t('topic.seoDesc', undefined, { topic: translatedTagName(tag) })}
        </p>
      </header>

      {tagPapers.length === 0 ? (
        <div className="py-24 text-center border border-dashed border-border-subtle rounded-lg">
          <FileText size={40} className="mx-auto text-text-muted mb-6" />
          <h3 className="text-xl font-semibold text-text-primary mb-3">{t('empty.library.title')}</h3>
          <p className="text-text-muted max-w-md mx-auto text-[15px]">{t('empty.library.desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tagPapers.map((paper, index) => {
            const paperTags = (paper.tags || []).map(tid => tags.find(tt => tt.id === tid)).filter(Boolean) as Tag[];
            const isSaved = bookmarkedIds.includes(paper.id);
            const primaryTag = paperTags[0];
            const displayTags = paperTags.slice(0, 3);
            const tagColor = primaryTag?.color || '#4F46E5';
            const excerpt = translatedDescription(paper) || translatedContent(paper) || htmlToText(paper.content).slice(0, 180);
            return (
              <article
                key={paper.id}
                onClick={() => navigate(`/p/${paper.slug}`)}
                className="group relative flex flex-col bg-bg-card card-shadow border border-border-subtle rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-accent-indigo/30 animate-scale-in"
              >
                <div className="h-1.5 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: tagColor }} />
                <div className="p-5 pt-4 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {displayTags.map(tt => (
                      <span key={tt.id} className="inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all"
                        style={{ backgroundColor: `${tt.color}15`, borderColor: `${tt.color}30`, color: tt.color }}>
                        {translatedTagName(tt)}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                    aria-label={t('reader.bookmark')}
                    className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${isSaved ? 'text-accent-indigo bg-accent-indigo/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                  >
                    <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                  </button>
                </div>
                <div className="flex-1 p-5 pt-2 flex flex-col">
                  <h3 className="font-bold text-text-primary leading-tight mb-3 line-clamp-2 group-hover:text-accent-cyan transition-colors duration-200 text-lg md:text-xl">
                    {translatedTitle(paper)}
                  </h3>
                  <p className="text-text-secondary leading-relaxed line-clamp-3 flex-1 text-sm mb-4">{excerpt}</p>
                  {translatedFocusArea(paper) && (
                    <span className="mb-4 inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 rounded-full">
                      {translatedFocusArea(paper)}
                    </span>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-border-subtle">
                    <span className="text-xs text-text-muted font-medium">{paper.author}</span>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="flex items-center gap-1"><Eye size={10} /> {(paper.views || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Bookmark size={10} /> {(paper.savedCount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PublicPaperView() {
  const { slug = '', lang } = useParams<{ slug: string; lang?: string }>();
  const { papers, tags, bookmarkedIds, toggleBookmark, incrementViews, language, setLanguage, ensureContentTranslation } = useStore();
  const navigate = useNavigate();
  const now = Date.now();
  const supportedLangs = ['en', 'ka', 'ru', 'pl', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ja', 'zh', 'uk'];
  const urlLang = lang && supportedLangs.includes(lang) ? lang : undefined;

  useEffect(() => {
    if (urlLang) setLanguage(urlLang as typeof language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);
  const processedPapers = papers.map(p => {
    if (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now) {
      return { ...p, status: 'published' as const, publishedAt: p.scheduledFor };
    }
    return p;
  });
  const paper = processedPapers.find(p => p.slug === slug && p.status === 'published');

  useEffect(() => {
    if (!paper) {
      resetSeo();
      setHreflangAlternates('/');
      return;
    }
    incrementViews(paper.id);
    ensureContentTranslation(paper, language);
    const paperUrl = urlLang && urlLang !== 'en'
      ? `${BASE_URL}/${urlLang}/p/${paper.slug}`
      : `${BASE_URL}/p/${paper.slug}`;
    setSeo({
      title: paper.title,
      description: paper.metaDescription || stripMarkdown(paper.content).slice(0, 160),
      url: paperUrl,
      ogImage: paper.ogImage || `${BASE_URL}/assets/logo-512.png`,
      type: 'article',
      keywords: paper.keywords,
      article: {
        publishedTime: paper.publishedAt || paper.createdAt,
        modifiedTime: paper.updatedAt,
        authors: [paper.author],
        section: paper.focusArea || 'Philosophy',
        tags: paper.tags || [],
      },
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: paper.title,
        description: (paper.metaDescription || stripMarkdown(paper.content)).slice(0, 200),
        image: paper.ogImage || `${BASE_URL}/assets/logo-512.png`,
        keywords: paper.keywords,
        articleSection: paper.focusArea || 'Philosophy',
        author: { '@type': 'Person', name: paper.author },
        datePublished: paper.publishedAt || paper.createdAt,
        dateModified: paper.updatedAt,
        inLanguage: language,
        publisher: { '@type': 'Organization', name: 'Philobrary', logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/logo-512.png` } },
        mainEntityOfPage: paperUrl,
      },
    });
    setHreflangAlternates(`/p/${paper.slug}`);
    addJsonLd('breadcrumb', createBreadcrumbJsonLd([
      { name: 'Library', url: BASE_URL + '/' },
      { name: paper.title, url: paperUrl },
    ]));
  }, [paper?.id, language]);

  if (!paper) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
        <p className="text-text-secondary text-lg mb-6">{t('notFound')}</p>
        <button onClick={() => navigate('/')} className="btn-gradient px-6 py-3 text-white rounded-full font-medium transition-all">
          {t('empty.explore')}
        </button>
      </div>
    );
  }

  return (
    <PaperReader
      paper={paper}
      tags={tags}
      allPapers={processedPapers}
      isBookmarked={bookmarkedIds.includes(paper.id)}
      onToggleBookmark={toggleBookmark}
      onClose={() => navigate('/')}
    />
  );
}

export default function App() {
  const { 
    papers, tags, user, 
    addPaper, updatePaper, deletePaper, 
    addTag, deleteTag,
    logout,
    theme, toggleTheme, language, setLanguage,
    ensureVisibleTranslations, seedPremadeTags
  } = useStore();
  
  const [showLangSelector, setShowLangSelector] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    ensureVisibleTranslations(papers, tags);
  }, [language, papers, tags, ensureVisibleTranslations]);

  // Prevent search engines from indexing private/administrative routes.
  useEffect(() => {
    const privatePath = /^\/(admin|login|profile)\b/.test(location.pathname);
    document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.setAttribute('content', privatePath ? 'noindex, nofollow' : 'index, follow');
  }, [location.pathname]);

  // Seed premade tags on first admin visit.
  useEffect(() => {
    if (user.isAuthenticated && isAdminEmail(user.email) && tags.length === 0) {
      seedPremadeTags().catch(() => undefined);
    }
  }, [user.isAuthenticated, user.email, tags.length, seedPremadeTags]);

  const now = Date.now();
  const processedPapers = papers.map(p => {
    if (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now) {
      return { ...p, status: 'published' as const, publishedAt: p.scheduledFor };
    }
    return p;
  });

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary selection:bg-accent-indigo/30 selection:text-text-primary pb-28">
      <a href="#main-content" className="skip-link">{t('skipLink.main')}</a>
      <Preloader />
      <nav className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer shrink-0 hover:opacity-80 transition-opacity">
            <span className="w-2 h-2 rounded-full bg-text-primary block"></span>
            <span className="text-[17px] font-bold text-text-primary tracking-tight">Philobrary</span>
          </Link>

          <div className="flex items-center gap-1 md:gap-3 overflow-x-auto no-scrollbar">
            <Link to="/" className={`px-3 md:px-4 py-2 text-[13px] font-medium rounded-full transition-colors shrink-0 border ${location.pathname === '/' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              <LibraryIcon size={14} className="md:hidden me-1.5 inline" />
              <span>{t('nav.library')}</span>
            </Link>
            <Link to="/saved" className={`px-3 md:px-4 py-2 text-[13px] font-medium rounded-full transition-colors shrink-0 border ${location.pathname === '/saved' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              <Bookmark size={14} className="md:hidden me-1.5 inline" />
              <span>{t('nav.saved')}</span>
            </Link>
            <Link to="/request" className={`px-3 md:px-4 py-2 text-[13px] font-medium rounded-full transition-colors shrink-0 border ${location.pathname === '/request' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              <PenLine size={14} className="md:hidden me-1.5 inline" />
              <span>{t('nav.request')}</span>
            </Link>

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              className="p-2.5 text-text-secondary hover:text-text-primary rounded-full transition-colors shrink-0"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              onClick={() => setShowLangSelector(true)}
              className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary rounded-full transition-colors border border-border-subtle shrink-0"
            >
              <Flag code={language} className="w-4 h-4" />
              <span className="hidden sm:inline">{languageShortNames[language]}</span>
            </button>
            
            <div className="w-px h-5 bg-border-subtle mx-0.5 shrink-0"></div>
            {user.isAuthenticated ? (
              <>
                <Link to="/profile" className="p-2.5 text-text-secondary hover:text-text-primary rounded-full transition-colors shrink-0" title={t('nav.profile')} aria-label={t('nav.profile')}>
                  <UserIcon size={16} />
                </Link>
                {isAdminEmail(user.email) && (
                  <Link to="/admin" className={`px-3 md:px-4 py-2 text-[13px] font-medium transition-colors rounded-full shrink-0 border ${location.pathname === '/admin' ? 'border-text-primary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                    <ShieldCheck size={14} className="me-1.5 inline" />
                    <span className="hidden md:inline">{t('nav.admin')}</span>
                  </Link>
                )}
                <button onClick={() => { logout(); navigate('/'); }} className="p-2.5 text-text-secondary hover:text-text-primary rounded-full transition-colors shrink-0" title={t('nav.signout')} aria-label={t('nav.signout')}>
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-fill px-5 py-2 text-[13px] font-semibold rounded-full transition-all shrink-0">
                {t('nav.signin')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      <BannerAd />

      <main className="flex-1 w-full">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LibraryView currentView="library" />} />
            <Route path="/saved" element={<LibraryView currentView="saved" />} />
            <Route path="/p/:slug" element={<PublicPaperView />} />
            <Route path="/:lang/p/:slug" element={<PublicPaperView />} />
            <Route path="/t/:slug" element={<TagView />} />
            <Route path="/login" element={<AdminLogin onClose={() => navigate('/')} onLogin={() => navigate('/')} />} />
            <Route path="/admin" element={
              isAdminEmail(user.email) ? (
                <AdminDashboard 
                  papers={processedPapers} tags={tags}
                  onAdd={addPaper} onUpdate={updatePaper} onDelete={deletePaper}
                  onAddTag={addTag} onDeleteTag={deleteTag}
                  onLogout={() => { logout(); navigate('/'); }}
                />
              ) : (
                <div className="flex items-center justify-center min-h-[50vh]">
                  <p className="text-text-secondary text-lg">{t('unauthorized')}</p>
                </div>
              )
            } />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/tos" element={<LegalPage />} />
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/request" element={<RequestPaperPage />} />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
</Suspense>
        </main>

        <BannerAd />

        <footer className="w-full border-t border-border-subtle mt-4">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[13px] font-mono text-text-muted uppercase tracking-wider">© 2026 Philobrary</p>
            <nav className="flex flex-wrap items-center gap-6 text-[13px]">
              <Link to="/contact" className="text-text-muted hover:text-text-primary transition-colors">Contact</Link>
              <Link to="/request" className="text-text-muted hover:text-text-primary transition-colors">Request a Paper</Link>
              <Link to="/tos" className="text-text-muted hover:text-text-primary transition-colors">Terms</Link>
              <Link to="/privacy" className="text-text-muted hover:text-text-primary transition-colors">Privacy</Link>
            </nav>
          </div>
        </footer>

        <ToastContainer />
      {showLangSelector && <LanguageSelector onClose={() => setShowLangSelector(false)} />}
    </div>
  );
}
