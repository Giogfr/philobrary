import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { auth } from './firebase';
import { useStore, isAdminEmail } from './store';
import { Paper, Tag } from './types';
import { Flag } from './components/Flag';
import { Search, ShieldCheck, LogOut, FileText, Bookmark, SlidersHorizontal, ChevronDown, User as UserIcon, Sun, Moon, Globe, CheckCircle, AlertCircle, Info, Eye, Library as LibraryIcon, LayoutGrid, List, ArrowUp, X, Sparkles, Clock } from 'lucide-react';
import { t, languageShortNames } from './i18n';
import { setSeo, resetSeo, stripMarkdown, BASE_URL, setHreflangAlternates, createBreadcrumbJsonLd, addJsonLd } from './seo';
import { htmlToText } from './utils';

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
    translatedTitle, translatedTagName, translatedFocusArea,
    ensureContentTranslation, language
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
    return saved === 'list' ? 'list' : 'list';
  });
  const [showBackToTop, setShowBackToTop] = useState(false);
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

  const filteredPapers = libraryPapers.filter(paper => {
    const q = debouncedQuery.trim().toLowerCase();
    const matchesSearch = !q || paper.title.toLowerCase().includes(q) || 
                          (paper.content && paper.content.toLowerCase().includes(q)) ||
                          paper.author.toLowerCase().includes(q) ||
                          (paper.keywords || '').toLowerCase().includes(q);
    const matchesTag = selectedTagId === 'All' || (paper.tags || []).includes(selectedTagId);
    const matchesAuthor = selectedAuthor === 'All' || paper.author === selectedAuthor;
    return matchesSearch && matchesTag && matchesAuthor;
  }).sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    const aUpd = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    switch (sortBy) {
      case 'oldest': return aTime - bTime;
      case 'views': return b.views - a.views;
      case 'saves': return (b.savedCount || 0) - (a.savedCount || 0);
      case 'updated': return bUpd - aUpd;
      case 'alpha': return a.title.localeCompare(b.title);
      case 'newest':
      default: return bTime - aTime;
    }
  });

  const hasActiveFilters = debouncedQuery.trim() !== '' || selectedTagId !== 'All' || selectedAuthor !== 'All';

  const continueReading = currentView === 'library'
    ? readingHistory()
        .map(h => processedPapers.find(p => p.id === h.id))
        .filter((p): p is Paper => !!p && p.status === 'published')
        .slice(0, 4)
    : [];

  const handleReadPaper = (paper: Paper) => {
    ensureContentTranslation(paper, language);
    navigate(`/p/${paper.slug}`);
  };

  useEffect(() => {
    resetSeo();
    setSeo({
      title: currentView === 'saved' ? t('nav.saved') : 'Philosophy Essay Library by Gio',
      description: currentView === 'saved'
        ? 'Your saved philosophy essays.'
        : 'A curated digital library of philosophy essays, thinkers, and original research — translated into 15 languages.',
      url: currentView === 'saved' ? BASE_URL + '/saved' : BASE_URL + '/',
    });
    setHreflangAlternates(currentView === 'saved' ? '/saved' : '/');
  }, [currentView]);

  return (
    <>
      <div id="main-content" className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-20">
        <div className="max-w-3xl mb-12 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-text-primary tracking-tight mb-6 leading-tight">
            {currentView === 'saved' ? t('hero.title.saved') : <>{t('hero.title.library1')}<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo to-accent-cyan">{t('hero.title.library2')}</span></>}
          </h1>
          <p className="text-lg md:text-xl text-text-secondary leading-relaxed">
            {currentView === 'saved' ? t('hero.subtitle.saved') : t('hero.subtitle.library')}
          </p>
        </div>

        {continueReading.length > 0 && (
          <div className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
              <Bookmark size={14} className="text-accent-indigo" /> {t('library.continueReading')}
            </h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {continueReading.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleReadPaper(p)}
                  className="group flex items-center gap-3 shrink-0 bg-bg-card border border-border-subtle hover:border-accent-indigo/50 rounded-2xl px-4 py-3 transition-all hover:shadow-lg max-w-xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-indigo to-accent-cyan flex items-center justify-center text-white font-bold shrink-0">
                    {p.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-start">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent-cyan transition-colors">{translatedTitle(p)}</p>
                    <p className="text-xs text-text-muted">{p.readingTimeMinutes} {t('paper.minRead')}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggested for you - based on reading history tags */}
        {continueReading.length > 0 && filteredPapers.length > 0 && (
          <div className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-accent-cyan" /> {t('library.suggestedForYou')}
            </h2>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
              {(() => {
                // Get tags from user's reading history
                const historyTagIds = new Set<string>();
                readingHistory().forEach(h => {
                  const p = processedPapers.find(p => p.id === h.id);
                  p?.tags.forEach(tid => historyTagIds.add(tid));
                });
                // Score papers by tag overlap with history
                return filteredPapers
                  .filter(p => !continueReading.some(c => c.id === p.id))
                  .map(p => {
                    const overlap = (p.tags || []).filter(tid => historyTagIds.has(tid)).length;
                    return { paper: p, score: overlap + Math.random() * 0.1 };
                  })
                  .sort((a, b) => b.score - a.score)
                  .slice(0, viewMode === 'grid' ? 6 : 4)
                  .map(({ paper }) => paper);
              })().map(paper => {
                const paperTags = (paper.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
                const isSaved = bookmarkedIds.includes(paper.id);
                const primaryTag = paperTags[0];
                const displayTags = paperTags.slice(0, 3);
                const tagColor = primaryTag?.color || '#4F46E5';
                const tagBg = `${tagColor}15`;
                const tagBorder = `${tagColor}30`;
                const tagText = tagColor;
                const excerpt = paper.metaDescription
                  ? paper.metaDescription
                  : htmlToText(paper.content).slice(0, viewMode === 'grid' ? 180 : 220);
                const progressKey = `philobrary_progress_${paper.slug}`;
                const savedProgress = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(progressKey) || 0) : 0;
                const hasProgress = savedProgress > 0 && savedProgress < 100;

                if (viewMode === 'grid') {
                  return (
                    <article
                      key={paper.id}
                      onClick={() => handleReadPaper(paper)}
                      className="group relative flex flex-col bg-bg-card border border-border-subtle rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-[0_20px_40px_-12px_rgba(79,70,229,0.15)] hover:-translate-y-1 hover:border-accent-indigo/30"
                      style={{ '--tag-color': tagColor } as React.CSSProperties}
                    >
                      <div className="h-1.5 bg-[var(--tag-color)] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="p-5 pt-4 flex items-start justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          {displayTags.map(t => (
                            <span key={t.id} className="inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all"
                              style={{ backgroundColor: `${t.color}15`, borderColor: `${t.color}30`, color: t.color }}>
                              {translatedTagName(t)}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                          aria-label={t('reader.bookmark')}
                          className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${isSaved ? 'text-accent-indigo bg-accent-indigo/10 scale-100' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                        >
                          <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <div className="flex-1 p-5 pt-2 flex flex-col">
                        <h3 className="font-bold text-text-primary leading-tight mb-3 line-clamp-2 group-hover:text-accent-cyan transition-colors duration-200 text-lg md:text-xl">
                          {translatedTitle(paper)}
                        </h3>
                        <p className="text-text-secondary leading-relaxed line-clamp-3 flex-1 text-sm mb-4">
                          {excerpt}
                        </p>
                        {translatedFocusArea(paper) && (
                          <span className="mb-4 inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 rounded-full">
                            {translatedFocusArea(paper)}
                          </span>
                        )}
                        {hasProgress && (
                          <div className="mb-4 h-1.5 bg-bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={savedProgress} aria-valuemin={0} aria-valuemax={100} aria-label={`Reading progress: ${savedProgress}%`}>
                            <div className="h-full bg-[var(--tag-color)] rounded-full transition-all duration-500" style={{ width: `${savedProgress}%` }} />
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border-subtle/50">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent-indigo to-accent-cyan flex items-center justify-center text-white font-bold text-sm shadow-sm">
                              {paper.author.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-text-secondary truncate max-w-[140px] sm:max-w-[200px]">{paper.author}</span>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] font-medium text-text-muted">
                            <span className="flex items-center gap-1" title="Views"><Eye size={11} /> {paper.views.toLocaleString()}</span>
                            <span className="flex items-center gap-1" title="Saves"><Bookmark size={11} /> {(paper.savedCount || 0).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><Clock size={11} /> {paper.readingTimeMinutes} {t('paper.minRead')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-0 start-0 end-0 h-16 bg-gradient-to-t from-bg-card to-transparent pointer-events-none opacity-50 group-hover:opacity-0 transition-opacity" />
                    </article>
                  );
                }
                return (
                  <article
                    key={paper.id}
                    onClick={() => handleReadPaper(paper)}
                    className="group relative flex flex-col sm:flex-row sm:items-start gap-5 bg-bg-card border border-border-subtle rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-accent-indigo/30 hover:bg-bg-hover/50"
                    style={{ '--tag-color': tagColor } as React.CSSProperties}
                  >
                    <div className="absolute top-0 bottom-0 start-0 w-1 bg-[var(--tag-color)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-s-2xl" />
                    <div className="flex-1 min-w-0 p-1 pr-0">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {displayTags.map(t => (
                            <span key={t.id} className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border transition-all"
                              style={{ backgroundColor: `${t.color}15`, borderColor: `${t.color}30`, color: t.color }}>
                              {translatedTagName(t)}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                          aria-label={t('reader.bookmark')}
                          className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${isSaved ? 'text-accent-indigo bg-accent-indigo/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                        >
                          <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <h3 className="font-bold text-text-primary leading-snug mb-2 line-clamp-2 group-hover:text-accent-cyan transition-colors duration-200 text-lg">
                        {translatedTitle(paper)}
                      </h3>
                      <p className="text-text-secondary leading-relaxed line-clamp-2 hidden sm:block text-sm mb-3">
                        {excerpt}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-text-muted">
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-indigo to-accent-cyan flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {paper.author.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-text-secondary truncate max-w-[160px]">{paper.author}</span>
                        </div>
                        {translatedFocusArea(paper) && (
                          <span className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 rounded-full">
                            {translatedFocusArea(paper)}
                          </span>
                        )}
                        <span className="flex items-center gap-1"><Eye size={10} /> {paper.views.toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Bookmark size={10} /> {(paper.savedCount || 0).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {paper.readingTimeMinutes} {t('paper.minRead')}</span>
                        {hasProgress && (
                          <span className="flex items-center gap-1 text-accent-indigo">
                            <div className="w-16 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--tag-color)] rounded-full" style={{ width: `${savedProgress}%` }} />
                            </div>
                            <span>{savedProgress}%</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 text-text-muted"><Search size={20} /></div>
            <input 
              ref={searchRef}
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="w-full py-4 ps-12 pe-12 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all placeholder:text-text-muted"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setDebouncedQuery(''); searchRef.current?.focus(); }}
                aria-label={t('search.clear')}
                className="absolute inset-y-0 end-0 flex items-center pe-4 text-text-muted hover:text-text-primary"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1 lg:min-w-[200px]">
              <button onClick={() => setShowSortDropdown(!showSortDropdown)} aria-haspopup="listbox" aria-expanded={showSortDropdown} className="w-full h-full flex items-center justify-between px-5 py-4 bg-bg-card border border-border-subtle text-text-primary rounded-2xl hover:bg-bg-hover transition-colors">
                <div className="flex items-center"><SlidersHorizontal size={18} className="me-3 text-text-muted" /> <span className="hidden sm:inline">{t('sort.label')}</span> {t(SORT_LABEL_KEY[sortBy])}</div>
                <ChevronDown size={16} className="text-text-muted" />
              </button>
              {showSortDropdown && (
                <div className="absolute top-full mt-2 w-full bg-bg-card border border-border-subtle rounded-2xl overflow-hidden z-20 shadow-2xl" role="listbox">
                  {(['newest', 'oldest', 'views', 'saves', 'updated', 'alpha'] as SortOption[]).map(opt => (
                    <button key={opt} onClick={() => { setSortBy(opt); setShowSortDropdown(false); }} className={`w-full text-start px-5 py-3 text-sm hover:bg-bg-hover transition-colors ${sortBy === opt ? 'text-accent-cyan bg-bg-secondary' : 'text-text-secondary'}`}>
                      {t(SORT_LABEL_KEY[opt])}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center bg-bg-card border border-border-subtle rounded-2xl p-1 shrink-0" role="group" aria-label={t('library.view')}>
              <button onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'} className={`p-2.5 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary'}`} title={t('library.viewGrid')}>
                <LayoutGrid size={18} />
              </button>
              <button onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} className={`p-2.5 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary'}`} title={t('library.viewList')}>
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-10">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTagId('All')}
              aria-pressed={selectedTagId === 'All'}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all border ${selectedTagId === 'All' ? 'bg-text-primary text-bg-primary border-text-primary' : 'bg-bg-card text-text-secondary border-border-subtle hover:bg-bg-hover hover:text-text-primary'}`}
            >
              {t('filter.all')}
            </button>
            {tags.slice(0, showAllTags || selectedTagId !== 'All' ? tags.length : 8).map(tag => (
              <button
                key={tag.id}
                id={`tag-chip-${tag.id}`}
                onClick={() => setSelectedTagId(tag.id)}
                aria-pressed={selectedTagId === tag.id}
                style={selectedTagId === tag.id ? { backgroundColor: `${tag.color}20`, borderColor: tag.color, color: tag.color } : {}}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-all border scroll-mx-6 ${selectedTagId === tag.id ? '' : 'bg-bg-card text-text-secondary border-border-subtle hover:bg-bg-hover hover:text-text-primary'}`}
              >
                {translatedTagName(tag)}
              </button>
            ))}
            {!showAllTags && tags.length > 8 && (
              <button
                onClick={() => setShowAllTags(true)}
                className="px-5 py-2 text-sm font-medium rounded-full transition-all border border-border-subtle bg-bg-card text-accent-cyan hover:bg-bg-hover"
              >
                +{tags.length - 8} {t('filter.more')}
              </button>
            )}
            {showAllTags && tags.length > 8 && (
              <button
                onClick={() => setShowAllTags(false)}
                className="px-5 py-2 text-sm font-medium rounded-full transition-all border border-border-subtle bg-bg-card text-accent-cyan hover:bg-bg-hover"
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
                className="px-4 py-2 bg-bg-card border border-border-subtle text-text-secondary rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
              >
                <option value="All">{t('library.allAuthors')}</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <span className="text-sm text-text-muted whitespace-nowrap">
              {filteredPapers.length} {filteredPapers.length === 1 ? t('library.paper') : t('library.papers')}
            </span>
          </div>
        </div>

        {hasActiveFilters && filteredPapers.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-border-subtle rounded-3xl bg-bg-secondary/50">
            <Search size={48} className="mx-auto text-text-muted mb-6" />
            <h3 className="text-2xl font-bold text-text-primary mb-3">{t('empty.noMatches.title')}</h3>
            <p className="text-text-muted max-w-md mx-auto mb-8">{t('empty.noMatches.desc')}</p>
            <button onClick={() => { setSearchQuery(''); setDebouncedQuery(''); setSelectedTagId('All'); setSelectedAuthor('All'); }} className="px-6 py-3 bg-text-primary text-bg-primary rounded-full font-medium hover:bg-bg-hover transition-colors">
              {t('empty.clearFilters')}
            </button>
          </div>
        ) : filteredPapers.length === 0 && dataReady ? (
          <div className="py-24 text-center border border-dashed border-border-subtle rounded-3xl bg-bg-secondary/50">
            <FileText size={48} className="mx-auto text-text-muted mb-6" />
            <h3 className="text-2xl font-bold text-text-primary mb-3">{currentView === 'saved' ? t('empty.saved.title') : t('empty.library.title')}</h3>
            <p className="text-text-muted max-w-md mx-auto">{currentView === 'saved' ? t('empty.saved.desc') : t('empty.library.desc')}</p>
            {currentView === 'saved' && (
              <button onClick={() => navigate('/')} className="mt-8 px-6 py-3 bg-text-primary text-bg-primary rounded-full font-medium hover:bg-bg-hover transition-colors">
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
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
            {filteredPapers.map(paper => {
              const paperTags = (paper.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
              const isSaved = bookmarkedIds.includes(paper.id);
              const primaryTag = paperTags[0];
              const displayTags = paperTags.slice(0, 3);
              const tagColor = primaryTag?.color || '#4F46E5';
              const tagBg = `${tagColor}15`;
              const tagBorder = `${tagColor}30`;
              const tagText = tagColor;
              const excerpt = paper.metaDescription
                ? paper.metaDescription
                : htmlToText(paper.content).slice(0, viewMode === 'grid' ? 180 : 220);
              const progressKey = `philobrary_progress_${paper.slug}`;
              const savedProgress = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(progressKey) || 0) : 0;
              const hasProgress = savedProgress > 0 && savedProgress < 100;

              // Grid view card
              if (viewMode === 'grid') {
                return (
                  <article
                    key={paper.id}
                    onClick={() => handleReadPaper(paper)}
                    className="group relative flex flex-col bg-bg-card border border-border-subtle rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-[0_20px_40px_-12px_rgba(79,70,229,0.15)] hover:-translate-y-1 hover:border-accent-indigo/30"
                    style={{ '--tag-color': tagColor } as React.CSSProperties}
                  >
                    {/* Tag accent bar at top */}
                    <div className="h-1.5 bg-[var(--tag-color)] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Header with tags + bookmark */}
                    <div className="p-5 pt-4 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {displayTags.map(t => (
                          <span key={t.id} className="inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all"
                            style={{ backgroundColor: `${t.color}15`, borderColor: `${t.color}30`, color: t.color }}>
                            {translatedTagName(t)}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                        aria-label={t('reader.bookmark')}
                        className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${isSaved ? 'text-accent-indigo bg-accent-indigo/10 scale-100' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                      >
                        <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 p-5 pt-2 flex flex-col">
                      <h3 className="font-bold text-text-primary leading-tight mb-3 line-clamp-2 group-hover:text-accent-cyan transition-colors duration-200 text-lg md:text-xl">
                        {translatedTitle(paper)}
                      </h3>
                      
                      <p className="text-text-secondary leading-relaxed line-clamp-3 flex-1 text-sm mb-4">
                        {excerpt}
                      </p>

                      {/* Focus area badge */}
                      {translatedFocusArea(paper) && (
                        <span className="mb-4 inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 rounded-full">
                          {translatedFocusArea(paper)}
                        </span>
                      )}

                      {/* Reading progress bar */}
                      {hasProgress && (
                        <div className="mb-4 h-1.5 bg-bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={savedProgress} aria-valuemin={0} aria-valuemax={100} aria-label={`Reading progress: ${savedProgress}%`}>
                          <div className="h-full bg-[var(--tag-color)] rounded-full transition-all duration-500" style={{ width: `${savedProgress}%` }} />
                        </div>
                      )}

                      {/* Footer with author + stats */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border-subtle/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent-indigo to-accent-cyan flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {paper.author.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-text-secondary truncate max-w-[140px] sm:max-w-[200px]">{paper.author}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] font-medium text-text-muted">
                          <span className="flex items-center gap-1" title="Views"><Eye size={11} /> {paper.views.toLocaleString()}</span>
                          <span className="flex items-center gap-1" title="Saves"><Bookmark size={11} /> {(paper.savedCount || 0).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Clock size={11} /> {paper.readingTimeMinutes} {t('paper.minRead')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Subtle bottom gradient fade */}
                    <div className="absolute bottom-0 start-0 end-0 h-16 bg-gradient-to-t from-bg-card to-transparent pointer-events-none opacity-50 group-hover:opacity-0 transition-opacity" />
                  </article>
                );
              }

              // List view card
              return (
                <article
                  key={paper.id}
                  onClick={() => handleReadPaper(paper)}
                  className="group relative flex flex-col sm:flex-row sm:items-start gap-5 bg-bg-card border border-border-subtle rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-accent-indigo/30 hover:bg-bg-hover/50"
                  style={{ '--tag-color': tagColor } as React.CSSProperties}
                >
                  {/* Left accent bar */}
                  <div className="absolute top-0 bottom-0 start-0 w-1 bg-[var(--tag-color)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-s-2xl" />

                  <div className="flex-1 min-w-0 p-1 pr-0">
                    {/* Tags + bookmark row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {displayTags.map(t => (
                          <span key={t.id} className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border transition-all"
                            style={{ backgroundColor: `${t.color}15`, borderColor: `${t.color}30`, color: t.color }}>
                            {translatedTagName(t)}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                        aria-label={t('reader.bookmark')}
                        className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${isSaved ? 'text-accent-indigo bg-accent-indigo/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                      >
                        <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>

                    <h3 className="font-bold text-text-primary leading-snug mb-2 line-clamp-2 group-hover:text-accent-cyan transition-colors duration-200 text-lg">
                      {translatedTitle(paper)}
                    </h3>

                    <p className="text-text-secondary leading-relaxed line-clamp-2 hidden sm:block text-sm mb-3">
                      {excerpt}
                    </p>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-text-muted">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-indigo to-accent-cyan flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {paper.author.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-text-secondary truncate max-w-[160px]">{paper.author}</span>
                      </div>
                      {translatedFocusArea(paper) && (
                        <span className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 rounded-full">
                          {translatedFocusArea(paper)}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><Eye size={10} /> {paper.views.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Bookmark size={10} /> {(paper.savedCount || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {paper.readingTimeMinutes} {t('paper.minRead')}</span>
                      {hasProgress && (
                        <span className="flex items-center gap-1 text-accent-indigo">
                          <div className="w-16 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--tag-color)] rounded-full" style={{ width: `${savedProgress}%` }} />
                          </div>
                          <span>{savedProgress}%</span>
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 end-6 z-40 p-3 bg-bg-card border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-full shadow-xl transition-all"
          aria-label={t('reader.top')}
        >
          <ArrowUp size={20} />
        </button>
      )}
    </>
  );
}

function ProfileView() {
  const { user, showToast, theme, language } = useStore();
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setIsLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName });
      showToast('toast.profileUpdated', 'success');
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
        <Link to="/login" className="px-6 py-3 bg-accent-indigo hover:bg-accent-cyan text-white rounded-xl font-medium transition-colors">
          {t('profile.signin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-text-primary mb-6">{t('profile.title')}</h1>
      <div className="bg-bg-card p-6 rounded-2xl border border-border-subtle">
        <p className="text-text-secondary mb-4">{t('profile.email')}: <span className="font-medium text-text-primary">{user.email}</span></p>
        
        <div className="border-t border-border-subtle pt-6 mt-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">{t('profile.settings')}</h3>
          <form className="space-y-4" onSubmit={handleUpdateProfile}>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('profile.displayName')}</label>
              <input 
                type="text" 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={t('profile.namePlaceholder')}
                disabled={isLoading}
                className="w-full max-w-md py-2.5 px-4 bg-bg-secondary border border-border-subtle text-text-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 disabled:opacity-50"
              />
            </div>
            <button type="submit" disabled={isLoading} className="px-5 py-2.5 bg-accent-indigo hover:bg-accent-cyan text-white rounded-xl font-medium transition-colors disabled:opacity-50">
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
  useEffect(() => {
    setSeo({ title: t('notFound.title'), description: t('notFound.title') });
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] px-6 text-center">
      <p className="text-7xl md:text-8xl font-bold bg-gradient-to-r from-accent-indigo to-accent-cyan bg-clip-text text-transparent mb-6">404</p>
      <h1 className="text-2xl font-bold text-text-primary mb-3">{t('notFound.page')}</h1>
      <p className="text-text-muted max-w-md mb-8">{t('notFound.title')}</p>
      <button onClick={() => navigate('/')} className="px-6 py-3 bg-text-primary text-bg-primary rounded-full font-medium hover:bg-bg-hover transition-colors">
        {t('empty.explore')}
      </button>
    </div>
  );
}

function PublicPaperView() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { papers, tags, bookmarkedIds, toggleBookmark, incrementViews, language, ensureContentTranslation } = useStore();
  const navigate = useNavigate();
  const now = Date.now();
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
    setSeo({
      title: paper.title,
      description: paper.metaDescription || stripMarkdown(paper.content).slice(0, 160),
      url: `${BASE_URL}/p/${paper.slug}`,
      ogImage: paper.ogImage || undefined,
      type: 'article',
      keywords: paper.keywords,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: paper.title,
        author: { '@type': 'Person', name: paper.author },
        datePublished: paper.publishedAt || paper.createdAt,
        dateModified: paper.updatedAt,
        inLanguage: language,
        publisher: { '@type': 'Organization', name: 'Philobrary' },
        mainEntityOfPage: `${BASE_URL}/p/${paper.slug}`,
      },
    });
    setHreflangAlternates(`/p/${paper.slug}`);
    addJsonLd('breadcrumb', createBreadcrumbJsonLd([
      { name: 'Library', url: BASE_URL + '/' },
      { name: paper.title, url: `${BASE_URL}/p/${paper.slug}` },
    ]));
  }, [paper?.id, language]);

  if (!paper) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
        <p className="text-text-secondary text-lg mb-6">{t('notFound')}</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-text-primary text-bg-primary rounded-full font-medium hover:bg-bg-hover transition-colors">
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

  useEffect(() => {
    ensureVisibleTranslations(papers, tags);
  }, [language, papers, tags, ensureVisibleTranslations]);

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
    <div className="min-h-screen flex flex-col bg-bg-primary selection:bg-accent-indigo/30 selection:text-text-primary pb-20">
      <a href="#main-content" className="skip-link">{t('skipLink.main')}</a>
      <nav className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-3 cursor-pointer shrink-0">
            <img
              src="/assets/logo-rounded.webp"
              alt="Philobrary"
              className="w-9 h-9 md:w-10 md:h-10 rounded-2xl object-cover shadow-lg shadow-accent-indigo/20"
            />
            <span className="text-lg md:text-xl font-bold text-text-primary tracking-tight hidden sm:block">Philobrary</span>
          </Link>

          <div className="flex items-center gap-1.5 md:gap-4 overflow-x-auto no-scrollbar">
            <Link to="/" className={`flex items-center px-3 md:px-4 py-2 text-sm font-medium rounded-full transition-colors shrink-0 ${location.pathname === '/' ? 'bg-bg-card text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
              <LibraryIcon size={16} className="md:hidden me-1.5" />
              <span className="hidden md:inline">{t('nav.library')}</span>
              <span className="md:hidden">{t('nav.library')}</span>
            </Link>
            <Link to="/saved" className={`flex items-center px-3 md:px-4 py-2 text-sm font-medium rounded-full transition-colors shrink-0 ${location.pathname === '/saved' ? 'bg-bg-card text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
              <Bookmark size={16} className="md:hidden me-1.5" />
              <span className="hidden md:inline">{t('nav.saved')}</span>
              <span className="md:hidden">{t('nav.saved')}</span>
            </Link>

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              className="p-2.5 text-text-secondary hover:text-accent-indigo hover:bg-accent-indigo/10 rounded-full transition-colors shrink-0"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => setShowLangSelector(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-card hover:bg-bg-hover rounded-full transition-colors border border-border-subtle shrink-0"
            >
              <Globe size={16} className="text-accent-indigo" />
              <Flag code={language} className="w-5 h-5" />
              <span className="hidden sm:inline">{languageShortNames[language]}</span>
            </button>
            
            <div className="w-px h-6 bg-border-subtle mx-1 shrink-0"></div>
            {user.isAuthenticated ? (
              <>
                <Link to="/profile" className="p-2.5 text-text-secondary hover:text-accent-indigo hover:bg-accent-indigo/10 rounded-full transition-colors shrink-0" title={t('nav.profile')} aria-label={t('nav.profile')}>
                  <UserIcon size={18} />
                </Link>
                {isAdminEmail(user.email) && (
                  <Link to="/admin" className={`flex items-center px-3 md:px-4 py-2 text-sm font-medium transition-colors rounded-full shrink-0 ${location.pathname === '/admin' ? 'bg-bg-card text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}>
                    <ShieldCheck size={16} className="me-1.5 text-accent-cyan" />
                    <span className="hidden md:inline">{t('nav.admin')}</span>
                  </Link>
                )}
                <button onClick={() => { logout(); navigate('/'); }} className="p-2.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-full transition-colors shrink-0" title={t('nav.signout')} aria-label={t('nav.signout')}>
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover bg-bg-card border border-border-subtle rounded-full transition-colors shrink-0">
                {t('nav.signin')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Top Banner Ad */}
      <div className="w-full max-w-7xl mx-auto px-4 py-3" aria-hidden="true">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              atOptions = {
                'key' : 'ad027cb5c3ceeb72ca3cb64a95381d9d',
                'format' : 'iframe',
                'height' : 90,
                'width' : 728,
                'params' : {}
              };
            `
          }}
        />
        <script src="https://www.highperformanceformat.com/ad027cb5c3ceeb72ca3cb64a95381d9d/invoke.js" async={true} />
      </div>

      <main className="flex-1 w-full">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LibraryView currentView="library" />} />
            <Route path="/saved" element={<LibraryView currentView="saved" />} />
            <Route path="/p/:slug" element={<PublicPaperView />} />
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
            <Route path="*" element={<NotFoundView />} />
          </Routes>
</Suspense>
        </main>

        {/* Bottom Banner Ad */}
        <div className="w-full max-w-7xl mx-auto px-4 py-3" aria-hidden="true">
          <script
            async={true}
            data-cfasync="false"
            src="https://pl30793084.effectivecpmnetwork.com/1870ca67fd74b2bae474fc178aad37eb/invoke.js"
          />
          <div id="container-1870ca67fd74b2bae474fc178aad37eb" style={{ width: '100%', maxWidth: 728, margin: '0 auto' }} />
        </div>

        <ToastContainer />
      {showLangSelector && <LanguageSelector onClose={() => setShowLangSelector(false)} />}
    </div>
  );
}
