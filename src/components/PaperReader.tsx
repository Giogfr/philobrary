import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Paper, Tag } from '../types';
import { X, Check, Clock, Calendar, ChevronLeft, List, ExternalLink, Download, Bookmark, Quote, Activity, FileDown, History, Type, AlignLeft, Sparkles, Sun, Moon, Globe, Eye, ArrowUp, Share2, AtSign, ThumbsUp, Send, MessageCircle, Briefcase, Copy, Shuffle, ZoomIn, Printer, Focus, MoreHorizontal, Menu, TextSize } from 'lucide-react';
import { getRelativeTime, stripDarkInlineColors, headingSlug } from '../utils';
import { useStore } from '../store';
import { t, languageShortNames } from '../i18n';
import { BASE_URL } from '../seo';
import { Flag } from './Flag';
import { LanguageSelector } from './LanguageSelector';
const sanitizeHtml = (html: string): string => {
  const allowedTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'div', 'span']);
  const allowedAttrs: Record<string, Set<string>> = {
    a: new Set(['href', 'title', 'target', 'rel']),
    img: new Set(['src', 'alt', 'title']),
    '*': new Set(['id', 'class', 'style']),
  };
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walk = (node: Node): Node | null => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (!allowedTags.has(el.tagName.toLowerCase())) {
        const span = doc.createElement('span');
        span.textContent = el.textContent || '';
        return span;
      }
      const allowed = allowedAttrs[el.tagName.toLowerCase()] || allowedAttrs['*'];
      Array.from(el.attributes).forEach(attr => {
        if (!allowed.has(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    }
    return node;
  };
  const sanitizeRecursive = (parent: Node) => {
    Array.from(parent.childNodes).forEach(child => {
      const newNode = walk(child);
      if (newNode && newNode !== child) {
        child.replaceWith(newNode);
      }
      if (newNode && newNode.childNodes && newNode.childNodes.length > 0) {
        sanitizeRecursive(newNode);
      }
    });
  };
  sanitizeRecursive(doc.body);
  return doc.body.innerHTML;
};

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const getTextContent = (node: HastNode): string => {
  if (node.type === 'text' || node.type === 'raw') return node.value || '';
  if (node.children) return node.children.map(getTextContent).join('');
  return '';
};

const rehypeHeadingIds = () => {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      if (node.type === 'element' && node.tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
        const text = getTextContent(node);
        const { id } = headingSlug(text);
        node.properties = node.properties || {};
        node.properties.id = id;
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
};

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

export const PaperReader: React.FC<PaperReaderProps> = ({ paper, tags, allPapers, isBookmarked, onToggleBookmark, onClose }) => {
  const { language, setLanguage, theme, toggleTheme, translatedTitle, translatedContent, translatedFocusArea, translatedTagName, ensureContentTranslation, pendingTranslations, showToast } = useStore();
  const navigate = useNavigate();
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOutline, setShowOutline] = useState(true);
  const [showCitations, setShowCitations] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [headings, setHeadings] = useState<{id: string, text: string, level: number}[]>([]);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('lg');
  const [fontFamily, setFontFamily] = useState<FontFamily>('Inter');
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('normal');
  const [isSepia, setIsSepia] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [zoomedImg, setZoomedImg] = useState<string | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Focus mode: toggle a body class that hides chrome and narrows the column.
  useEffect(() => {
    document.body.classList.toggle('focus-mode', focusMode);
    return () => document.body.classList.remove('focus-mode');
  }, [focusMode]);

  const isMarkdown = paper.contentType === 'native_markdown';
  const isTranslating = pendingTranslations.has(`content:${paper.id}:${language}`);

  const displayTitle = translatedTitle(paper);
  const rawContent = stripDarkInlineColors(translatedContent(paper));
  const displayContent = isMarkdown ? rawContent : sanitizeHtml(rawContent);

  const scrollTo = useCallback((top: number, smooth = false) => {
    const el = document.getElementById('reader-main');
    if (!el) return;
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Latest UI state for the Escape handler without re-subscribing the listener.
  const uiRef = useRef({ zoomedImg, showCitations, showShare, showLangSelector, showOutline });
  useEffect(() => {
    uiRef.current = { zoomedImg, showCitations, showShare, showLangSelector, showOutline };
  }, [zoomedImg, showCitations, showShare, showLangSelector, showOutline]);

  // Close more menu on click outside
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const menuBtn = document.querySelector('[aria-label="More options"]');
      const menu = document.querySelector('[role="menu"]');
      if (menuBtn && !menuBtn.contains(target) && menu && !menu.contains(target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // Latest headings for the scroll-spy listener.
  const headingsRef = useRef(headings);
  useEffect(() => {
    headingsRef.current = headings;
  }, [headings]);

  // Reset scroll position when the paper changes.
  useEffect(() => {
    scrollTo(0);
  }, [paper, scrollTo]);

  // Build the table of contents from the (possibly translated) content.
  useEffect(() => {
    if (!isMarkdown) {
      setHeadings([]);
      return;
    }
    const extractedHeadings: {id: string, text: string, level: number}[] = [];
    const lines = displayContent.split('\n');
    lines.forEach(line => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const { text, id } = headingSlug(match[2]);
        extractedHeadings.push({ id, text, level });
      }
    });
    setHeadings(extractedHeadings);
  }, [displayContent, isMarkdown]);

  // Scroll + keyboard listeners attached once.
  useEffect(() => {
    const handleScroll = () => {
      const el = document.getElementById('reader-main');
      if (el) {
        const currentTop = el.scrollTop;
        const scrollHeight = el.scrollHeight - el.clientHeight;
        const progress = scrollHeight > 0 ? (currentTop / scrollHeight) * 100 : 0;
        
        requestAnimationFrame(() => {
          setReadingProgress(progress);
          setShowBackToTop(currentTop > 500);

          // Scroll-spy TOC active heading tracking
          const currentHeadings = headingsRef.current;
          if (currentHeadings.length > 0) {
            for (let i = currentHeadings.length - 1; i >= 0; i--) {
              const headingEl = document.getElementById(currentHeadings[i].id);
              if (headingEl) {
                const rect = headingEl.getBoundingClientRect();
                if (rect.top <= 140) {
                  setActiveHeadingId(currentHeadings[i].id);
                  break;
                }
              }
            }
          }
        });

      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const ui = uiRef.current;
        if (ui.zoomedImg) setZoomedImg(null);
        else if (ui.showCitations) setShowCitations(false);
        else if (ui.showShare) setShowShare(false);
        else if (ui.showLangSelector) setShowLangSelector(false);
        else if (ui.showOutline) setShowOutline(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const mainEl = document.getElementById('reader-main');
    if (mainEl) mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
    };
  }, [paper]);

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

  const paperTags = (paper.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];

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
    .map(p => ({ paper: p, shared: (p.tags || []).filter(tid => (paper.tags || []).includes(tid)).length }))
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
    const target = document.getElementById(id);
    const mainEl = document.getElementById('reader-main');
    if (!target || !mainEl) return;
    const top = target.getBoundingClientRect().top - mainEl.getBoundingClientRect().top + mainEl.scrollTop;
    mainEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    setActiveHeadingId(id);
    // Close the mobile outline drawer after jumping; keep the desktop outline open.
    if (window.innerWidth < 768) setShowOutline(false);
  };

  const closeModal = (setter: (v: boolean) => void) => setter(false);

  return (
    <div className={`reader-root fixed inset-0 z-[80] flex flex-col overflow-hidden ${isSepia ? 'reader-sepia' : ''} animate-fade-in`} style={{ backgroundColor: isSepia ? undefined : 'var(--bg-secondary)' }}>
      {/* Progress Bar */}
      <div className="absolute top-0 start-0 h-1 bg-accent-indigo transition-all duration-150 z-50 progress-bar" style={{ width: `${readingProgress}%` }} />

      {focusMode && (
        <button onClick={() => setFocusMode(false)} className="focus-exit-btn fixed top-4 start-1/2 -translate-x-1/2 z-[60] px-4 py-2 text-sm font-medium text-text-primary bg-bg-card/90 backdrop-blur border border-border-subtle rounded-full shadow-lg hover:bg-bg-hover transition-colors no-print" title={t('reader.focusExit')}>
          <X size={14} className="me-2 inline" /> {t('reader.focusExit')}
        </button>
      )}
      
      <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-bg-primary/95 backdrop-blur-sm border-b border-border-subtle z-10 shrink-0 gap-3 no-print">
        <button 
          onClick={onClose}
          className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary bg-bg-card hover:bg-bg-hover hover:text-text-primary rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px]"
        >
          <ChevronLeft size={20} className="me-2 rtl:rotate-180" />
          <span className="hidden sm:inline">{t('reader.back')}</span>
        </button>

        <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar">
          {/* Primary actions always visible */}
          <button
            onClick={() => setIsSepia(!isSepia)}
            className={`p-3 rounded-full transition-colors shrink-0 ${isSepia ? 'bg-[#E8DCC0] text-[#3B2F1D]' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
            title={isSepia ? t('reader.normalMode') : t('reader.sepia')}
            aria-label={isSepia ? t('reader.normalMode') : t('reader.sepia')}
          >
            <Type size={20} />
          </button>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            className="p-3 rounded-full transition-colors bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary shrink-0 theme-toggle"
            aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={() => setShowLangSelector(true)}
            className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-card hover:bg-bg-hover rounded-full transition-colors shrink-0 min-h-[44px]"
            title={t('lang.title')}
            aria-label={t('lang.title')}
          >
            <Globe size={18} className="text-accent-indigo" />
            <Flag code={language} className="w-5 h-5" />
            <span className="hidden sm:inline">{languageShortNames[language]}</span>
          </button>

          {/* Mobile: Font size quick access (replaces hidden desktop control) */}
          {isMarkdown && (
            <div className="hidden sm:flex items-center bg-bg-card rounded-full p-1 border border-border-subtle shrink-0">
              <button onClick={() => setFontSize('base')} className={`px-2.5 py-1 text-xs rounded-full transition-colors ${fontSize === 'base' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`} aria-label="Small">A</button>
              <button onClick={() => setFontSize('lg')} className={`px-2.5 py-1 text-sm rounded-full transition-colors ${fontSize === 'lg' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`} aria-label="Medium">A</button>
              <button onClick={() => setFontSize('xl')} className={`px-2.5 py-1 text-base rounded-full transition-colors ${fontSize === 'xl' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`} aria-label="Large">A</button>
            </div>
          )}

          {/* Mobile: More menu for secondary actions */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-3 rounded-full bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary shrink-0 transition-colors"
              aria-label="More options"
              aria-expanded={showMoreMenu}
            >
              <MoreHorizontal size={20} />
            </button>
            {showMoreMenu && (
              <div role="menu" className="absolute top-full right-0 mt-1 w-56 bg-bg-card border border-border-subtle rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                {isMarkdown && (
                  <>
                    <div className="px-3 py-2 border-b border-border-subtle">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('reader.format.title')}</p>
                      <div className="flex items-center gap-2">
                        <AlignLeft size={16} className="text-accent-indigo shrink-0" />
                        <select
                          value={fontFamily}
                          onChange={e => setFontFamily(e.target.value as FontFamily)}
                          className="flex-1 px-3 py-2 bg-bg-secondary border border-border-subtle text-text-primary rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
                        >
                          <option value="Inter">Inter</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Merriweather">Merriweather</option>
                          <option value="JetBrains Mono">JetBrains Mono</option>
                        </select>
                      </div>
                    </div>
                    <div className="px-3 py-2 border-b border-border-subtle">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('reader.format.spacing')}</p>
                      <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-full">
                        {(['compact', 'normal', 'relaxed'] as LineSpacing[]).map(s => (
                          <button
                            key={s}
                            onClick={() => { setLineSpacing(s); setShowMoreMenu(false); }}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${lineSpacing === s ? 'bg-accent-indigo text-white' : 'text-text-secondary hover:bg-bg-hover'}`}
                          >
                            {t(`reader.format.${s}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <button
                  onClick={() => { onToggleBookmark(paper.id); setShowMoreMenu(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-none transition-colors ${isBookmarked ? 'bg-accent-indigo/10 text-accent-indigo' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
                  {t('reader.bookmark')}
                </button>
                <button
                  onClick={() => { setShowCitations(true); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-none transition-colors"
                >
                  <Quote size={18} />
                  {t('reader.citations')}
                </button>
                <button
                  onClick={() => { window.print(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-none transition-colors"
                >
                  <Printer size={18} />
                  {t('reader.print')}
                </button>
                {isMarkdown && (
                  <button
                    onClick={() => { setShowOutline(!showOutline); setShowMoreMenu(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-none transition-colors ${showOutline ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-text-secondary hover:bg-bg-hover'}`}
                  >
                    <List size={18} />
                    {t('reader.outline')}
                  </button>
                )}
                <button
                  onClick={() => { setFocusMode(!focusMode); setShowMoreMenu(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-none transition-colors ${focusMode ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  <Focus size={18} />
                  {focusMode ? t('reader.focusExit') : t('reader.focus')}
                </button>
                <button
                  onClick={() => { handleShare(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-bg-primary bg-text-primary hover:bg-bg-hover rounded-none transition-colors"
                >
                  <Share2 size={18} />
                  {t('reader.share')}
                </button>
              </div>
            )}
          </div>
        </div>
</header>

            <div className="flex flex-1 overflow-hidden relative">
        {showOutline && isMarkdown && headings.length > 0 && (
          <aside className="w-64 md:w-72 shrink-0 overflow-y-auto border-e border-border-subtle bg-bg-primary/80 backdrop-blur-sm p-5 hidden md:block sidebar-enter no-print">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">{t('reader.contents')}</h3>
            <nav className="space-y-0.5 text-sm">
              {headings.map((h, i) => (
                <li key={i} className={`${h.level === 1 ? 'ms-0 font-medium text-text-secondary' : h.level === 2 ? 'ms-3 text-text-muted' : 'ms-6 text-text-muted'} transition-all duration-200`}>
                  <button 
                    onClick={() => jumpToHeading(h.id)} 
                    className={`w-full text-start py-1.5 px-2.5 rounded transition-all duration-200 text-[13px] leading-snug ${
                      activeHeadingId === h.id 
                        ? 'text-text-primary font-semibold bg-accent-indigo/10 border-s-2 border-accent-indigo' 
                        : 'hover:text-text-primary hover:bg-bg-hover border-s-2 border-transparent'
                    }`}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </nav>
          </aside>
        )}

        <main id="reader-main" className="flex-1 overflow-y-auto scroll-smooth" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <article className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-8 md:py-12">
            <header className="mb-10">
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                {translatedFocusArea(paper) && (
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-bg-hover border border-border-subtle rounded">
                    {translatedFocusArea(paper)}
                  </span>
                )}
                {paperTags.map(t => (
                  <span key={t.id} style={{ color: t.color, backgroundColor: `${t.color}12`, borderColor: `${t.color}25` }} className="px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider border rounded">
                    {translatedTagName(t)}
                  </span>
                ))}
                {isTranslating && (
                  <span className="flex items-center px-2.5 py-0.5 text-[11px] font-medium text-accent-indigo bg-accent-indigo/10 border border-accent-indigo/20 rounded">
                    <Sparkles size={11} className="me-1 animate-pulse" /> {t('reader.translating')}
                  </span>
                )}
                {paper.status !== 'published' && (
                  <span className="px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 rounded">
                    {paper.status}
                  </span>
                )}
              </div>
              
              <h1 className="text-2xl md:text-4xl lg:text-[2.75rem] font-semibold text-text-primary mb-5 leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                {displayTitle}
              </h1>
              
              <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-sm text-text-secondary pb-5 border-b border-border-subtle">
                <div className="flex items-center">
                  <img
                    src={paper.authorPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(paper.author || 'User')}&background=4F46E5&color=fff&size=80`}
                    alt={paper.author}
                    className="w-8 h-8 rounded-full object-cover me-2.5"
                    onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(paper.author || 'User')}&background=4F46E5&color=fff&size=80`; }}
                  />
                  <span className="font-medium text-text-primary text-[15px]">{paper.author}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                   <Calendar size={13} className="opacity-60" /> {formattedDate}
                 </div>

                 {paper.contentType === 'google_doc' && (
                   <div className="flex items-center">
                     {paper.googleDocUrl ? (
                       <a
                         href={paper.googleDocUrl}
                         target="_blank"
                         rel="noreferrer"
                         className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                       >
                         {t('reader.openDocs')} <ExternalLink size={13} className="ms-1.5" />
                       </a>
                     ) : (
                       <button disabled className="flex items-center px-3 py-1.5 text-xs font-medium text-text-muted bg-bg-secondary border border-border-subtle rounded opacity-50 cursor-not-allowed">
                         {t('reader.openDocs')} <ExternalLink size={13} className="ms-1.5" />
                       </button>
                     )}
                   </div>
                  )}

                <div className="flex items-center gap-4 ms-auto text-xs text-text-muted">
                  <span className="flex items-center gap-1"><Clock size={12} className="opacity-60" /> {paper.readingTimeMinutes || 0} {t('reader.minRead')}</span>
                  {isMarkdown && (
                    <span className="flex items-center gap-1"><Activity size={12} className="opacity-60" /> {(paper.wordCount || 0).toLocaleString()} {t('reader.words')}</span>
                  )}
                  <span className="flex items-center gap-1"><Eye size={12} className="opacity-60" /> {(paper.views || 0).toLocaleString()}</span>
                </div>
              </div>
            </header>

            {paper.contentType === 'google_doc' ? (
              <div className="w-full aspect-[8.5/11] bg-white rounded-3xl overflow-hidden shadow-2xl border border-border-subtle">
                <iframe 
                  src={paper.googleDocUrl?.replace('/edit', '/preview') || `${paper.googleDocUrl}?embedded=true`} 
                  className="w-full h-full border-0" 
                  title="Google Doc Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
) : (
              <>
                <div 
                  className="reader-canvas markdown-body mx-auto px-6 py-10 md:px-16 md:py-12 lg:px-20"
                  style={{ 
                    '--reader-font': FONT_STACKS[fontFamily], 
                    '--reader-line-height': SPACING_VALUES[lineSpacing],
                    '--reader-font-size': FONT_SIZE_VALUES[fontSize],
                  } as React.CSSProperties}
                >
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]} 
                    rehypePlugins={[rehypeRaw, rehypeHeadingIds]}
                    components={{
                      table: ({ node, children, ...props }) => (
                        <div className="overflow-x-auto my-6">
                          <table {...props} className="min-w-full border border-border-subtle">{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {displayContent || '*Nothing to display*'}
                  </ReactMarkdown>
                </div>
                <div className="mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-border-subtle flex flex-col sm:flex-row justify-end gap-3">
                  <button onClick={handleCopyContent} className="flex items-center justify-center px-4 py-3 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-xl transition-colors min-h-[44px]">
                    <Copy size={16} className="me-2 text-accent-indigo" /> {t('reader.copyContent')}
                  </button>
                  <button onClick={handleExportTxt} className="flex items-center justify-center px-4 py-3 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-xl transition-colors min-h-[44px]">
                    <FileDown size={16} className="me-2 text-accent-cyan" /> {t('reader.exportTxt')}
                  </button>
                  <button onClick={handleExportMd} className="flex items-center justify-center px-4 py-3 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-xl transition-colors min-h-[44px]">
                    <Download size={16} className="me-2 text-success" /> {t('reader.exportMd')}
                  </button>
                </div>
              </>
            )}

            {/* Related Papers */}
            {relatedPapers.length > 0 && (
              <div className="mt-16">
                <h3 className="text-xl font-bold text-text-primary mb-6 flex items-center">
                  <Activity size={20} className="me-3 text-accent-indigo" />
                  {t('reader.related')}
                </h3>
                <div className="card-grid grid-cols-1 md:grid-cols-3 gap-4">
                  {relatedPapers.map((p, index) => {
                    const pTags = (p.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
                    return (
                      <button
                        key={p.id}
                        onClick={() => openPaper(p)}
                        className="text-start bg-bg-card border border-border-subtle hover:border-accent-indigo/50 rounded-2xl p-5 transition-all hover:shadow-lg cursor-pointer group card-hover animate-scale-in stagger-${Math.min(index + 1, 3)}"
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
                          <span className="flex items-center gap-1"><Eye size={11} /> {(p.views || 0).toLocaleString()}</span>
                          <span>{p.readingTimeMinutes || 0} {t('reader.minRead')}</span>
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
        <div className="md:hidden fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-72 h-full bg-bg-primary border-s border-border-subtle p-5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('reader.contents')}</h3>
              <button onClick={() => setShowOutline(false)} className="p-1.5 text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded transition-colors">
                <X size={16} />
              </button>
            </div>
            <nav className="space-y-0.5 text-sm">
              {headings.map((h, i) => (
                <li key={i} className={`${h.level === 1 ? 'ms-0 font-medium text-text-secondary' : h.level === 2 ? 'ms-3 text-text-muted' : 'ms-6 text-text-muted'}`}>
                  <button 
                    onClick={() => jumpToHeading(h.id)} 
                    className={`w-full text-start py-1.5 px-2.5 rounded transition-all duration-200 text-[13px] leading-snug ${
                      activeHeadingId === h.id 
                        ? 'text-text-primary font-semibold bg-accent-indigo/10 border-s-2 border-accent-indigo' 
                        : 'hover:text-text-primary hover:bg-bg-hover border-s-2 border-transparent'
                    }`}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Back to Top */}
      {showBackToTop && (
        <button
          onClick={() => scrollTo(0, true)}
          className="fixed bottom-6 end-4 z-40 p-3 bg-bg-card border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-full shadow-xl transition-all animate-fade-in hover:scale-110"
          title={t('reader.top')}
        >
          <ArrowUp size={20} />
        </button>
      )}

      {/* Citations Modal */}
      {showCitations && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-md" onClick={() => closeModal(setShowCitations)}>
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-md" onClick={() => closeModal(setShowShare)}>
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" onClick={() => setZoomedImg(null)}>
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
