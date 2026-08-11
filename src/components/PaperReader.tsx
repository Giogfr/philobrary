import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useNavigate } from 'react-router-dom';
import { Paper, Tag } from '../types';
import { X, Check, Clock, Calendar, ChevronLeft, List, ExternalLink, Download, Bookmark, Quote, Activity, FileDown, History, Type, AlignLeft, Sparkles, Sun, Moon, Globe, Eye, ArrowUp, Share2, AtSign, ThumbsUp, Send, MessageCircle, Briefcase, Copy, Shuffle, ZoomIn } from 'lucide-react';
import { getRelativeTime, headingSlug, stripDarkInlineColors } from '../utils';
import { useStore } from '../store';
import { t, languageShortNames } from '../i18n';
import { BASE_URL } from '../seo';
import { Flag } from './Flag';
import { LanguageSelector } from './LanguageSelector';

interface PaperReaderProps {
  paper: Paper;
  tags: Tag[];
  allPapers: Paper[];
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onClose: () => void;
}

type FontFamily = 'Inter' | 'Georgia' | 'Merriweather' | 'JetBrains Mono';
type LineSpacing = 'compact' | 'normal' | 'relaxed';

const FONT_STACKS: Record<FontFamily, string> = {
  Inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Merriweather: "'Merriweather', Georgia, serif",
  'JetBrains Mono': "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
};

const SPACING_VALUES: Record<LineSpacing, string> = {
  compact: '1.5',
  normal: '1.75',
  relaxed: '2.1',
};

const FONT_SIZE_VALUES = { base: '1rem', lg: '1.125rem', xl: '1.3125rem' } as const;
type FontSize = keyof typeof FONT_SIZE_VALUES;

const PROGRESS_KEY = (slug: string) => `philobrary_progress_${slug}`;

export const PaperReader: React.FC<PaperReaderProps> = ({ paper, tags, allPapers, isBookmarked, onToggleBookmark, onClose }) => {
  const { language, setLanguage, theme, toggleTheme, translatedTitle, translatedContent, translatedFocusArea, translatedTagName, ensureContentTranslation, pendingTranslations, showToast } = useStore();
  const navigate = useNavigate();
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showFormatting, setShowFormatting] = useState(true);
  const [headings, setHeadings] = useState<{id: string, text: string, level: number}[]>([]);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('lg');
  const [fontFamily, setFontFamily] = useState<FontFamily>('Inter');
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('normal');
  const [isSepia, setIsSepia] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [headerHidden, setHeaderHidden] = useState(false);
  const [zoomedImg, setZoomedImg] = useState<string | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const saveProgressTimer = useRef<number | null>(null);
  const lastScrollTop = useRef(0);

  const isMarkdown = paper.contentType === 'native_markdown';
  const isTranslating = pendingTranslations.has(`content:${paper.id}:${language}`);

  const scrollTo = useCallback((top: number, smooth = false) => {
    const el = document.getElementById('reader-main');
    if (!el) return;
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollTo(0);

    if (isMarkdown) {
      const extractedHeadings: {id: string, text: string, level: number}[] = [];
      const lines = paper.content.split('\n');
      lines.forEach(line => {
        const match = line.match(/^(#{1,3})\s+(.+)$/);
        if (match) {
          const level = match[1].length;
          const { text, id } = headingSlug(match[2]);
          extractedHeadings.push({ id, text, level });
        }
      });
      setHeadings(extractedHeadings);
    }

    // Restore reading progress for this paper.
    try {
      const saved = Number(localStorage.getItem(PROGRESS_KEY(paper.slug)) || 0);
      const mainEl = document.getElementById('reader-main');
      if (mainEl && saved > 0 && saved < 100) {
        const max = mainEl.scrollHeight - mainEl.clientHeight;
        if (max > 0) mainEl.scrollTop = (saved / 100) * max;
      }
    } catch { /* ignore storage errors */ }

    const handleScroll = () => {
      const el = document.getElementById('reader-main');
      if (el) {
        const currentTop = el.scrollTop;
        const scrollHeight = el.scrollHeight - el.clientHeight;
        const progress = scrollHeight > 0 ? (currentTop / scrollHeight) * 100 : 0;
        setReadingProgress(progress);
        setShowBackToTop(currentTop > 500);

        // Auto-hide header on scroll down, show on scroll up
        if (currentTop > 120 && currentTop > lastScrollTop.current + 10) {
          setHeaderHidden(true);
        } else if (currentTop < lastScrollTop.current - 10 || currentTop < 60) {
          setHeaderHidden(false);
        }
        lastScrollTop.current = currentTop;

        // Scroll-spy TOC active heading tracking
        if (headings.length > 0) {
          for (let i = headings.length - 1; i >= 0; i--) {
            const headingEl = document.getElementById(headings[i].id);
            if (headingEl) {
              const rect = headingEl.getBoundingClientRect();
              if (rect.top <= 140) {
                setActiveHeadingId(headings[i].id);
                break;
              }
            }
          }
        }

        // Throttled localStorage write of reading progress.
        if (saveProgressTimer.current) window.clearTimeout(saveProgressTimer.current);
        saveProgressTimer.current = window.setTimeout(() => {
          try { localStorage.setItem(PROGRESS_KEY(paper.slug), String(Math.min(99, Math.max(0, progress)))); } catch { /* ignore */ }
        }, 800);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomedImg) setZoomedImg(null);
        else if (showCitations) setShowCitations(false);
        else if (showShare) setShowShare(false);
        else if (showLangSelector) setShowLangSelector(false);
        else if (showOutline) setShowOutline(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const mainEl = document.getElementById('reader-main');
    if (mainEl) mainEl.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
      if (saveProgressTimer.current) window.clearTimeout(saveProgressTimer.current);
    };
  }, [paper, isMarkdown, scrollTo, headings, zoomedImg, showCitations, showShare, showLangSelector, showOutline]);

  useEffect(() => {
    if (isMarkdown) {
      ensureContentTranslation(paper, language);
    }
  }, [paper, language, isMarkdown, ensureContentTranslation]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    showToast('reader.copied', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: displayTitle,
      text: `${displayTitle} — by ${paper.author}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share unavailable — fall through to modal.
      }
    }
    setShowShare(true);
  };

  const displayTitle = translatedTitle(paper);
  const displayContent = stripDarkInlineColors(translatedContent(paper));

  const handleExportTxt = () => {
    const blob = new Blob([`${displayTitle}\nBy ${paper.author}\n\n${displayContent}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMd = () => {
    const blob = new Blob([`# ${displayTitle}\n> By ${paper.author}\n\n${displayContent}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formattedDate = paper.publishedAt 
    ? new Date(paper.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : t('reader.unpublished');
  
  const relativeDate = paper.publishedAt ? getRelativeTime(paper.publishedAt) : '';

  const paperTags = paper.tags.map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];

  const year = paper.publishedAt ? new Date(paper.publishedAt).getFullYear() : new Date().getFullYear();
  const url = `${BASE_URL}/p/${paper.slug}`;
  const citationAPA = `${paper.author}. (${year}). ${displayTitle}. Philobrary. Retrieved from ${url}`;
  const citationMLA = `${paper.author}. "${displayTitle}." Philobrary, ${formattedDate}, ${url}.`;
  const citationChicago = `${paper.author}. "${displayTitle}." Philobrary, ${formattedDate}. ${url}.`;
  const handleCopyContent = () => {
    navigator.clipboard.writeText(`# ${displayTitle}\n\nBy ${paper.author}\n\n${displayContent}`);
    showToast('reader.copiedContent', 'success');
  };

  const citationBibTeX = `@misc{philobrary_${paper.slug.replace(/[^a-zA-Z0-9_]/g, '')},\n  author = {${paper.author}},\n  title = {${displayTitle}},\n  year = {${year}},\n  howpublished = {\\url{${url}}},\n  note = {Philobrary Library}\n}`;

  const handleCopyCitation = (format: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    showToast('reader.citationCopied', 'success');
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const openRandomPaper = () => {
    const candidates = allPapers.filter(p => p.id !== paper.id && p.status === 'published');
    if (candidates.length === 0) return;
    const random = candidates[Math.floor(Math.random() * candidates.length)];
    openPaper(random);
  };

  const timeLeftMinutes = Math.max(1, Math.round((paper.readingTimeMinutes || 1) * Math.max(0, 1 - readingProgress / 100)));

  const relatedPapers = allPapers
    .filter(p => p.id !== paper.id && p.status === 'published')
    .map(p => ({ paper: p, shared: p.tags.filter(tid => paper.tags.includes(tid)).length }))
    .filter(x => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.paper.views - a.paper.views)
    .slice(0, 3)
    .map(x => x.paper);

  const shareUrl = window.location.href;
  const socialLinks = [
    { name: 'Twitter', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${displayTitle} — by ${paper.author}`)}&url=${encodeURIComponent(shareUrl)}`, icon: <AtSign size={18} />, color: '#1DA1F2' },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, icon: <ThumbsUp size={18} />, color: '#1877F2' },
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${displayTitle} ${shareUrl}`)}`, icon: <Send size={18} />, color: '#25D366' },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(displayTitle)}`, icon: <MessageCircle size={18} />, color: '#229ED9' },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, icon: <Briefcase size={18} />, color: '#0A66C2' },
  ];

  const openPaper = (p: Paper) => {
    ensureContentTranslation(p, language);
    navigate(`/p/${p.slug}`);
  };

  const jumpToHeading = (id: string) => {
    setShowOutline(false);
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const closeModal = (setter: (v: boolean) => void) => setter(false);

  return (
    <div className={`reader-root fixed inset-0 z-40 flex flex-col bg-bg-primary overflow-hidden ${isSepia ? 'reader-sepia' : ''}`}>
      {/* Progress Bar */}
      <div className="absolute top-0 start-0 h-1 bg-accent-indigo transition-all duration-150 z-50" style={{ width: `${readingProgress}%` }} />
      
      <header className={`flex items-center justify-between px-4 md:px-6 py-4 bg-bg-primary/80 backdrop-blur-md border-b border-border-subtle z-10 shrink-0 gap-3 transition-transform duration-200 ${headerHidden ? '-translate-y-full' : 'translate-y-0'}`}>
        <button 
          onClick={onClose}
          className="flex items-center px-3 md:px-4 py-2 text-sm font-medium text-text-secondary bg-bg-card hover:bg-bg-hover hover:text-text-primary rounded-full transition-colors shrink-0"
        >
          <ChevronLeft size={16} className="me-2 rtl:rotate-180" />
          {t('reader.back')}
        </button>

        <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setIsSepia(!isSepia)}
            className={`p-2.5 rounded-full transition-colors shrink-0 ${isSepia ? 'bg-[#E8DCC0] text-[#3B2F1D]' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
            title={isSepia ? t('reader.normalMode') : t('reader.sepia')}
          >
            <Type size={18} />
          </button>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            className="p-2.5 rounded-full transition-colors bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary shrink-0"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={() => setShowLangSelector(true)}
            className="flex items-center gap-2 px-2.5 md:px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-card hover:bg-bg-hover rounded-full transition-colors shrink-0"
            title={t('lang.title')}
          >
            <Globe size={16} className="text-accent-indigo" />
            <Flag code={language} className="w-4 h-4" />
            <span className="hidden sm:inline">{languageShortNames[language]}</span>
          </button>

          {isMarkdown && (
            <div className="hidden md:flex items-center bg-bg-card rounded-full p-1 border border-border-subtle shrink-0">
              <button onClick={() => setFontSize('base')} className={`px-2.5 py-1 text-xs rounded-full transition-colors ${fontSize === 'base' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`}>A</button>
              <button onClick={() => setFontSize('lg')} className={`px-2.5 py-1 text-sm rounded-full transition-colors ${fontSize === 'lg' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`}>A</button>
              <button onClick={() => setFontSize('xl')} className={`px-2.5 py-1 text-base rounded-full transition-colors ${fontSize === 'xl' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`}>A</button>
            </div>
          )}
          
          <button onClick={() => onToggleBookmark(paper.id)} className={`p-2.5 rounded-full transition-colors shrink-0 ${isBookmarked ? 'bg-accent-indigo/20 text-accent-indigo' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`} title={t('reader.bookmark')}>
            <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
          </button>
          
          <button onClick={() => setShowCitations(true)} className="p-2.5 bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded-full transition-colors shrink-0" title={t('reader.citations')}>
            <Quote size={18} />
          </button>
          
          {isMarkdown && (
            <button onClick={() => setShowOutline(!showOutline)} className={`p-2.5 rounded-full transition-colors shrink-0 ${showOutline ? 'bg-accent-cyan text-bg-primary' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`} title={t('reader.outline')}>
              <List size={18} />
            </button>
          )}

          {isMarkdown && (
            <button onClick={() => setShowFormatting(!showFormatting)} className={`hidden md:flex p-2.5 rounded-full transition-colors shrink-0 ${showFormatting ? 'bg-accent-indigo text-white' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`} title={t('reader.format.title')}>
              <Type size={18} />
            </button>
          )}

          <button onClick={handleShare} className="flex items-center px-3 md:px-4 py-2 text-sm font-medium text-bg-primary bg-text-primary hover:bg-bg-hover rounded-full transition-colors shrink-0" title={t('reader.share')}>
            {copied ? <Check size={16} className="me-2" /> : <Share2 size={16} className="me-2" />}
            <span className="hidden sm:inline">{copied ? t('reader.copied') : t('reader.share')}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {showOutline && isMarkdown && headings.length > 0 && (
          <aside className="w-64 md:w-80 shrink-0 overflow-y-auto border-e border-border-subtle bg-bg-secondary/50 p-6 hidden md:block">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">{t('reader.contents')}</h3>
            <ul className="space-y-3 text-sm">
              {headings.map((h, i) => (
                <li key={i} className={`${h.level === 1 ? 'ms-0 font-medium text-text-secondary' : h.level === 2 ? 'ms-4 text-text-muted' : 'ms-8 text-text-muted'}`}>
                  <button onClick={() => jumpToHeading(h.id)} className={`hover:text-accent-cyan transition-colors block py-1 text-start w-full ${activeHeadingId === h.id ? 'text-accent-cyan font-semibold border-s-2 border-accent-cyan ps-2' : ''}`}>{h.text}</button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <main id="reader-main" className="flex-1 overflow-y-auto scroll-smooth">
          <article className="max-w-4xl mx-auto p-4 md:p-8 lg:p-12">
            <header className="mb-12">
              <div className="flex flex-wrap gap-2 mb-6 items-center">
                {translatedFocusArea(paper) && (
                  <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 rounded-full">
                    {translatedFocusArea(paper)}
                  </span>
                )}
                {paperTags.map(t => (
                  <span key={t.id} style={{ color: t.color, backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }} className="px-3 py-1 text-xs font-medium uppercase tracking-wider border rounded-full">
                    {translatedTagName(t)}
                  </span>
                ))}
                {isTranslating && (
                  <span className="flex items-center px-3 py-1 text-xs font-medium text-accent-indigo bg-accent-indigo/10 border border-accent-indigo/30 rounded-full">
                    <Sparkles size={12} className="me-1 animate-pulse" /> {t('reader.translating')}
                  </span>
                )}
                {paper.status !== 'published' && (
                  <span className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 rounded-full">
                    {paper.status}
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-text-primary mb-6 leading-tight tracking-tight">
                {displayTitle}
              </h1>
              
              <div className="flex flex-wrap items-center gap-y-4 gap-x-8 text-sm text-text-secondary border-t border-b border-border-subtle py-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-indigo to-accent-cyan flex items-center justify-center text-white font-bold me-3 shadow-lg">
                    {paper.author.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-text-primary text-base">{paper.author}</span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex items-center"><Calendar size={14} className="me-2 opacity-70" /> {formattedDate}</div>
                  <div className="text-xs text-text-muted ms-6">{relativeDate}</div>
                </div>
                
                <div className="flex flex-col gap-1 ms-auto">
                  <div className="flex items-center justify-end"><Clock size={14} className="me-2 opacity-70" /> {paper.readingTimeMinutes} {t('reader.minRead')} ({timeLeftMinutes} {t('reader.timeLeft')})</div>
                  {isMarkdown && (
                    <div className="flex items-center justify-end text-xs text-text-muted"><Activity size={12} className="me-1" /> {paper.wordCount.toLocaleString()} {t('reader.words')}</div>
                  )}
                  <div className="flex items-center justify-end text-xs text-text-muted gap-3">
                    <span className="flex items-center"><Eye size={12} className="me-1" /> {paper.views.toLocaleString()} {t('reader.views')}</span>
                    <span className="flex items-center"><Bookmark size={12} className="me-1" /> {(paper.savedCount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </header>

            {paper.contentType === 'google_doc' ? (
              <div className="w-full flex flex-col gap-4">
                <div className="flex justify-end">
                  <a href={paper.googleDocUrl} target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 text-sm font-medium text-white bg-accent-cyan hover:opacity-90 rounded-full transition-opacity">
                    {t('reader.openDocs')} <ExternalLink size={16} className="ms-2" />
                  </a>
                </div>
                <div className="w-full aspect-[8.5/11] bg-white rounded-3xl overflow-hidden shadow-2xl border border-border-subtle">
                  <iframe src={paper.googleDocUrl?.replace('/edit', '/preview') || `${paper.googleDocUrl}?embedded=true`} className="w-full h-full border-0" title="Google Doc Preview" />
                </div>
              </div>
            ) : (
              <div 
                className="reader-canvas markdown-body max-w-[70ch] mx-auto px-6 py-10 md:p-12"
                style={{ 
                  '--reader-font': FONT_STACKS[fontFamily], 
                  '--reader-line-height': SPACING_VALUES[lineSpacing],
                  '--reader-font-size': FONT_SIZE_VALUES[fontSize],
                } as React.CSSProperties}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    h1: ({node, children, ...props}) => { const { id } = headingSlug(String(children)); return <h1 id={id} {...props}>{children}</h1> },
                    h2: ({node, children, ...props}) => { const { id } = headingSlug(String(children)); return <h2 id={id} {...props}>{children}</h2> },
                    h3: ({node, children, ...props}) => { const { id } = headingSlug(String(children)); return <h3 id={id} {...props}>{children}</h3> },
                    img: ({node, src, alt, ...props}) => (
                      <span className="relative inline-block my-4 group cursor-pointer" onClick={() => src && setZoomedImg(src)}>
                        <img src={src} alt={alt || ''} className="rounded-2xl border border-border-subtle shadow-md max-w-full h-auto transition-transform group-hover:scale-[1.01]" {...props} />
                        <span className="absolute bottom-3 end-3 p-2 bg-bg-primary/80 backdrop-blur-md rounded-full text-text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <ZoomIn size={16} />
                        </span>
                      </span>
                    )
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
                
                {paper.googleDocUrl && (
                  <div className="flex justify-end mb-8">
                    <a href={paper.googleDocUrl} target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 text-sm font-medium text-white bg-accent-cyan hover:opacity-90 rounded-full transition-opacity">
                      {t('reader.openDocs')} <ExternalLink size={16} className="ms-2" />
                    </a>
                  </div>
                )}

                <div className="mt-16 pt-8 border-t border-border-subtle flex flex-wrap justify-end gap-3">
                  <button onClick={handleCopyContent} className="flex items-center px-4 py-2 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-full transition-colors">
                    <Copy size={16} className="me-2 text-accent-indigo" /> {t('reader.copyContent')}
                  </button>
                  <button onClick={handleExportTxt} className="flex items-center px-4 py-2 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-full transition-colors">
                    <FileDown size={16} className="me-2 text-accent-cyan" /> {t('reader.exportTxt')}
                  </button>
                  <button onClick={handleExportMd} className="flex items-center px-4 py-2 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-full transition-colors">
                    <Download size={16} className="me-2 text-success" /> {t('reader.exportMd')}
                  </button>
                </div>
              </div>
            )}

            {/* Related Papers */}
            {relatedPapers.length > 0 && (
              <div className="mt-16">
                <h3 className="text-xl font-bold text-text-primary mb-6 flex items-center">
                  <Activity size={20} className="me-3 text-accent-indigo" />
                  {t('reader.related')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {relatedPapers.map(p => {
                    const pTags = p.tags.map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
                    return (
                      <button
                        key={p.id}
                        onClick={() => openPaper(p)}
                        className="text-start bg-bg-card border border-border-subtle hover:border-accent-indigo/50 rounded-2xl p-5 transition-all hover:shadow-lg cursor-pointer group"
                      >
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {pTags.slice(0, 2).map(t => (
                            <span key={t.id} style={{ color: t.color, backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }} className="px-2 py-0.5 text-[10px] font-medium border rounded-full">
                              {translatedTagName(t)}
                            </span>
                          ))}
                        </div>
                        <h4 className="font-semibold text-text-primary mb-2 leading-snug line-clamp-2 group-hover:text-accent-cyan transition-colors">
                          {translatedTitle(p)}
                        </h4>
                        <div className="flex items-center text-xs text-text-muted gap-3">
                          <span className="flex items-center gap-1"><Eye size={11} /> {p.views.toLocaleString()}</span>
                          <span>{p.readingTimeMinutes} {t('reader.minRead')}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Revisions Log */}
            {paper.revisions && paper.revisions.length > 0 && (
              <div className="mt-16 bg-bg-card border border-border-subtle rounded-3xl p-6 md:p-8">
                <div className="flex items-center mb-6 text-text-primary">
                  <History size={20} className="me-3 text-accent-indigo" />
                  <h3 className="text-xl font-bold">{t('reader.revisions')}</h3>
                </div>
                <div className="space-y-6">
                  {paper.revisions.slice().reverse().map((rev, i) => (
                    <div key={i} className="flex items-start">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent-cyan mt-1.5 me-4 shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.5)]"></div>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-medium text-text-secondary">{t('reader.by')} {rev.author}</span>
                          <span className="text-xs text-text-muted">{new Date(rev.timestamp).toLocaleString()} ({getRelativeTime(rev.timestamp)})</span>
                        </div>
                        <p className="text-sm text-text-secondary bg-bg-secondary p-3 rounded-2xl border border-border-subtle mt-2">{rev.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        </main>
      </div>

      {/* Mobile Outline Drawer */}
      {showOutline && isMarkdown && headings.length > 0 && (
        <div className="md:hidden fixed inset-0 z-50 bg-bg-primary/60 backdrop-blur-sm flex justify-end">
          <div className="w-72 h-full bg-bg-card border-s border-border-subtle p-6 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{t('reader.contents')}</h3>
              <button onClick={() => setShowOutline(false)} className="p-2 text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-3 text-sm">
              {headings.map((h, i) => (
                <li key={i} className={`${h.level === 1 ? 'ms-0 font-medium text-text-secondary' : h.level === 2 ? 'ms-4 text-text-muted' : 'ms-8 text-text-muted'}`}>
                  <button onClick={() => jumpToHeading(h.id)} className="hover:text-accent-cyan transition-colors block py-1 text-start w-full">{h.text}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Back to Top */}
      {showBackToTop && (
        <button
          onClick={() => scrollTo(0, true)}
          className="fixed bottom-24 end-6 z-40 p-3 bg-bg-card border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-full shadow-xl transition-all"
          title={t('reader.top')}
        >
          <ArrowUp size={20} />
        </button>
      )}

      {/* Floating Formatting Bar */}
      {isMarkdown && showFormatting && (
        <div className="absolute bottom-5 inset-x-0 flex justify-center z-40 pointer-events-none px-4">
          <div className="pointer-events-auto flex items-center gap-3 bg-bg-card/95 backdrop-blur-md border border-border-subtle rounded-2xl px-4 py-3 shadow-2xl shadow-black/30 max-w-full overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 shrink-0">
              <AlignLeft size={16} className="text-accent-indigo" />
              <select
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value as FontFamily)}
                className="px-3 py-2 bg-bg-secondary border border-border-subtle text-text-primary rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
              >
                <option value="Inter">Inter</option>
                <option value="Georgia">Georgia</option>
                <option value="Merriweather">Merriweather</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
              </select>
            </div>
            <div className="w-px h-6 bg-border-subtle shrink-0"></div>
            <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-full shrink-0">
              <span className="px-2 text-xs text-text-muted">{t('reader.format.spacing')}</span>
              {(['compact', 'normal', 'relaxed'] as LineSpacing[]).map(s => (
                <button
                  key={s}
                  onClick={() => setLineSpacing(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${lineSpacing === s ? 'bg-accent-indigo text-white' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  {t(`reader.format.${s}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Citations Modal */}
      {showCitations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-md" onClick={() => closeModal(setShowCitations)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto p-8 bg-bg-card border border-border-subtle shadow-2xl rounded-3xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => closeModal(setShowCitations)} className="absolute top-4 end-4 p-2 text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-full transition-colors">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-bold text-text-primary mb-6">{t('reader.citeTitle')}</h2>
            <div className="space-y-5 text-sm">
              {[
                { label: 'APA', format: 'apa', color: 'text-accent-indigo', text: citationAPA },
                { label: 'MLA', format: 'mla', color: 'text-accent-cyan', text: citationMLA },
                { label: 'Chicago', format: 'chicago', color: 'text-success', text: citationChicago },
                { label: t('reader.bibtex'), format: 'bibtex', color: 'text-warning', text: citationBibTeX }
              ].map(item => (
                <div key={item.format}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${item.color}`}>{item.label}</span>
                    <button
                      onClick={() => handleCopyCitation(item.format, item.text)}
                      className="flex items-center text-xs text-text-muted hover:text-text-primary transition-colors gap-1"
                    >
                      {copiedFormat === item.format ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      {copiedFormat === item.format ? t('reader.copied') : t('reader.copyCitation')}
                    </button>
                  </div>
                  <div className="p-4 bg-bg-secondary rounded-2xl border border-border-subtle text-text-secondary font-mono text-xs select-all leading-relaxed whitespace-pre-wrap">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-md" onClick={() => closeModal(setShowShare)}>
          <div className="relative w-full max-w-md p-8 bg-bg-card border border-border-subtle shadow-2xl rounded-3xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => closeModal(setShowShare)} className="absolute top-4 end-4 p-2 text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-full transition-colors">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-bold text-text-primary mb-2">{t('reader.shareTitle')}</h2>
            <p className="text-sm text-text-secondary mb-6 line-clamp-1">{displayTitle}</p>

            {navigator.share && (
              <button
                onClick={() => { closeModal(setShowShare); navigator.share({ title: displayTitle, url: shareUrl }); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 bg-text-primary text-bg-primary rounded-2xl font-medium hover:bg-bg-hover transition-colors"
              >
                <Share2 size={18} /> {t('reader.shareSystem')}
              </button>
            )}

            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-6 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl font-medium hover:bg-bg-hover transition-colors"
            >
              {copied ? <Check size={18} className="text-success" /> : <Copy size={18} className="text-accent-indigo" />}
              {copied ? t('reader.copied') : t('reader.copyLink')}
            </button>

            <div className="grid grid-cols-5 gap-3 mb-6">
              {socialLinks.map(s => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  title={s.name}
                  className="flex items-center justify-center p-3 rounded-2xl transition-transform hover:scale-105"
                  style={{ backgroundColor: `${s.color}1A`, color: s.color }}
                >
                  {s.icon}
                </a>
              ))}
            </div>

            {/* QR Code Section */}
            <div className="pt-4 border-t border-border-subtle flex flex-col items-center">
              <p className="text-xs text-text-muted mb-3">{t('reader.scanQR')}</p>
              <div className="p-3 bg-white rounded-2xl border border-border-subtle shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR Code"
                  className="w-32 h-32"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" onClick={() => setZoomedImg(null)}>
          <button onClick={() => setZoomedImg(null)} className="absolute top-6 end-6 p-3 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            <X size={24} />
          </button>
          <img src={zoomedImg} alt="Zoomed view" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}

      {showLangSelector && <LanguageSelector onClose={() => setShowLangSelector(false)} />}
    </div>
  );
};
