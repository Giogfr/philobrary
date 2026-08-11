import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { auth } from './firebase';
import { useStore, isAdminEmail } from './store';
import { Paper, Tag } from './types';
import { Flag } from './components/Flag';
import { Search, ShieldCheck, LogOut, FileText, Bookmark, SlidersHorizontal, ChevronDown, User as UserIcon, Sun, Moon, Globe, CheckCircle, AlertCircle, Info, Eye, Library as LibraryIcon } from 'lucide-react';
import { t, languageShortNames } from './i18n';
import { setSeo, resetSeo, stripMarkdown, BASE_URL } from './seo';
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

type SortOption = 'newest' | 'oldest' | 'views' | 'alpha';

const SORT_LABEL_KEY: Record<SortOption, string> = {
  newest: 'sort.newest',
  oldest: 'sort.oldest',
  views: 'sort.mostViewed',
  alpha: 'sort.alphabetical',
};

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
    papers, tags, user, bookmarkedIds, 
    toggleBookmark,
    translatedTitle, translatedTagName, translatedFocusArea,
    ensureContentTranslation, language
  } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSortDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
  
  const filteredPapers = libraryPapers.filter(paper => {
    const matchesSearch = paper.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (paper.content && paper.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          paper.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTagId === 'All' || paper.tags.includes(selectedTagId);
    return matchesSearch && matchesTag;
  }).sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    switch (sortBy) {
      case 'oldest': return aTime - bTime;
      case 'views': return b.views - a.views;
      case 'alpha': return a.title.localeCompare(b.title);
      case 'newest':
      default: return bTime - aTime;
    }
  });

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
  }, [currentView]);

  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        <div className="max-w-3xl mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-text-primary tracking-tight mb-6 leading-tight">
            {currentView === 'saved' ? t('hero.title.saved') : <>{t('hero.title.library1')}<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-indigo to-accent-cyan">{t('hero.title.library2')}</span></>}
          </h1>
          <p className="text-lg md:text-xl text-text-secondary leading-relaxed">
            {currentView === 'saved' ? t('hero.subtitle.saved') : t('hero.subtitle.library')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 text-text-muted"><Search size={20} /></div>
            <input 
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full py-4 ps-12 pe-4 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all placeholder:text-text-muted"
            />
          </div>
          
          <div className="relative min-w-[200px]" ref={sortRef}>
            <button onClick={() => setShowSortDropdown(!showSortDropdown)} className="w-full h-full flex items-center justify-between px-5 py-4 bg-bg-card border border-border-subtle text-text-primary rounded-2xl hover:bg-bg-hover transition-colors">
              <div className="flex items-center"><SlidersHorizontal size={18} className="me-3 text-text-muted" /> {t('sort.label')} {t(SORT_LABEL_KEY[sortBy])}</div>
              <ChevronDown size={16} className="text-text-muted" />
            </button>
            {showSortDropdown && (
              <div className="absolute top-full mt-2 w-full bg-bg-card border border-border-subtle rounded-2xl overflow-hidden z-20 shadow-2xl">
                {(['newest', 'oldest', 'views', 'alpha'] as SortOption[]).map(opt => (
                  <button key={opt} onClick={() => { setSortBy(opt); setShowSortDropdown(false); }} className={`w-full text-start px-5 py-3 text-sm hover:bg-bg-hover transition-colors ${sortBy === opt ? 'text-accent-cyan bg-bg-secondary' : 'text-text-secondary'}`}>
                    {t(SORT_LABEL_KEY[opt])}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-12">
          <button
            onClick={() => setSelectedTagId('All')}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-all border ${selectedTagId === 'All' ? 'bg-text-primary text-bg-primary border-text-primary' : 'bg-bg-card text-text-secondary border-border-subtle hover:bg-bg-hover hover:text-text-primary'}`}
          >
            {t('filter.all')}
          </button>
          {tags.slice(0, showAllTags || selectedTagId !== 'All' ? tags.length : 8).map(tag => (
            <button
              key={tag.id}
              onClick={() => setSelectedTagId(tag.id)}
              style={selectedTagId === tag.id ? { backgroundColor: `${tag.color}20`, borderColor: tag.color, color: tag.color } : {}}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all border ${selectedTagId === tag.id ? '' : 'bg-bg-card text-text-secondary border-border-subtle hover:bg-bg-hover hover:text-text-primary'}`}
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

        {filteredPapers.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.map(paper => {
              const paperTags = paper.tags.map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
              const isSaved = bookmarkedIds.includes(paper.id);
              const excerpt = paper.metaDescription
                ? paper.metaDescription
                : htmlToText(paper.content).slice(0, 220);
              return (
                <div 
                  key={paper.id} 
                  onClick={() => handleReadPaper(paper)}
                  className="group flex flex-col bg-bg-card border border-border-subtle hover:border-accent-indigo/50 rounded-3xl p-6 md:p-8 cursor-pointer transition-all hover:shadow-2xl hover:shadow-accent-indigo/10 hover:-translate-y-1 relative"
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleBookmark(paper.id); }}
                    aria-label={isSaved ? t('reader.bookmark') : t('reader.bookmark')}
                    className={`absolute top-6 end-6 p-2.5 rounded-full transition-colors z-10 ${isSaved ? 'text-accent-indigo bg-accent-indigo/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                  >
                    <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                  </button>

                  <div className="flex flex-wrap gap-2 mb-4 pe-10">
                    {paperTags.slice(0, 3).map(t => (
                      <span key={t.id} style={{ color: t.color, backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }} className="px-3 py-1 text-xs font-medium border rounded-full">
                        {translatedTagName(t)}
                      </span>
                    ))}
                  </div>
                  
                  <h3 className="text-xl md:text-2xl font-bold text-text-primary mb-3 leading-snug group-hover:text-accent-cyan transition-colors line-clamp-2">
                    {translatedTitle(paper)}
                  </h3>

                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 mb-5">
                    {excerpt}
                  </p>

                  {translatedFocusArea(paper) && (
                    <p className="text-xs font-medium text-accent-cyan mb-4">
                      {translatedFocusArea(paper)}
                    </p>
                  )}
                  
                  <div className="mt-auto pt-5 flex items-center justify-between border-t border-border-subtle/60">
                    <div className="flex items-center text-sm text-text-secondary">
                      <span className="truncate max-w-[140px] font-medium text-text-secondary">{paper.author}</span>
                    </div>
                    <div className="flex items-center text-xs text-text-muted font-medium gap-3">
                      <span className="flex items-center gap-1"><Eye size={12} /> {paper.views.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Bookmark size={12} /> {(paper.savedCount || 0).toLocaleString()}</span>
                      <span>{paper.readingTimeMinutes} {t('paper.minRead')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
      
      <ToastContainer />
      {showLangSelector && <LanguageSelector onClose={() => setShowLangSelector(false)} />}
    </div>
  );
}
