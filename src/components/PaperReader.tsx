import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Paper, Tag } from '../types';
import { X, Link as LinkIcon, Check, Clock, Calendar, ChevronLeft, List, ExternalLink, Download, Bookmark, Quote, Activity, FileDown, History, Type, AlignLeft, Sparkles } from 'lucide-react';
import { getRelativeTime } from '../utils';
import { useStore } from '../store';
import { t } from '../i18n';
import { BASE_URL } from '../seo';

interface PaperReaderProps {
  paper: Paper;
  tags: Tag[];
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

export const PaperReader: React.FC<PaperReaderProps> = ({ paper, tags, isBookmarked, onToggleBookmark, onClose }) => {
  const { language, translatedTitle, translatedContent, translatedFocusArea, translatedTagName, ensureContentTranslation, pendingTranslations } = useStore();
  const [copied, setCopied] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showFormatting, setShowFormatting] = useState(true);
  const [headings, setHeadings] = useState<{id: string, text: string, level: number}[]>([]);
  const [readingProgress, setReadingProgress] = useState(0);
  const [fontSize, setFontSize] = useState<FontSize>('lg');
  const [fontFamily, setFontFamily] = useState<FontFamily>('Inter');
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('normal');

  const isMarkdown = paper.contentType === 'native_markdown';
  const isTranslating = pendingTranslations.has(`content:${paper.id}:${language}`);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    if (isMarkdown) {
      const extractedHeadings: {id: string, text: string, level: number}[] = [];
      const lines = paper.content.split('\n');
      lines.forEach(line => {
        const match = line.match(/^(#{1,3})\s+(.+)$/);
        if (match) {
          const level = match[1].length;
          const text = match[2];
          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          extractedHeadings.push({ id, text, level });
        }
      });
      setHeadings(extractedHeadings);
    }

    const handleScroll = () => {
      const el = document.getElementById('reader-main');
      if (el) {
        const scrollHeight = el.scrollHeight - el.clientHeight;
        const progress = scrollHeight > 0 ? (el.scrollTop / scrollHeight) * 100 : 0;
        setReadingProgress(progress);
      }
    };

    const mainEl = document.getElementById('reader-main');
    if (mainEl) mainEl.addEventListener('scroll', handleScroll);
    return () => { if (mainEl) mainEl.removeEventListener('scroll', handleScroll); };
  }, [paper, isMarkdown]);

  useEffect(() => {
    if (isMarkdown) {
      ensureContentTranslation(paper, language);
    }
  }, [paper, language, isMarkdown, ensureContentTranslation]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayTitle = translatedTitle(paper);
  const displayContent = translatedContent(paper);

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

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg-primary overflow-hidden">
      {/* Progress Bar */}
      <div className="absolute top-0 start-0 h-1 bg-accent-indigo transition-all duration-150 z-50" style={{ width: `${readingProgress}%` }} />
      
      <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-bg-primary/80 backdrop-blur-md border-b border-border-subtle z-10 shrink-0 gap-3">
        <button 
          onClick={onClose}
          className="flex items-center px-4 py-2 text-sm font-medium text-text-secondary bg-bg-card hover:bg-bg-hover hover:text-text-primary rounded-full transition-colors"
        >
          <ChevronLeft size={16} className="me-2 rtl:rotate-180" />
          {t('reader.back')}
        </button>

        <div className="flex items-center gap-2">
          {isMarkdown && (
            <div className="flex items-center bg-bg-card rounded-full p-1 border border-border-subtle me-2">
              <button onClick={() => setFontSize('base')} className={`px-2.5 py-1 text-xs rounded-full transition-colors ${fontSize === 'base' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`}>A</button>
              <button onClick={() => setFontSize('lg')} className={`px-2.5 py-1 text-sm rounded-full transition-colors ${fontSize === 'lg' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`}>A</button>
              <button onClick={() => setFontSize('xl')} className={`px-2.5 py-1 text-base rounded-full transition-colors ${fontSize === 'xl' ? 'bg-bg-hover text-text-primary' : 'text-text-muted'}`}>A</button>
            </div>
          )}
          
          <button onClick={() => onToggleBookmark(paper.id)} className={`p-2.5 rounded-full transition-colors ${isBookmarked ? 'bg-accent-indigo/20 text-accent-indigo' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`} title={t('reader.bookmark')}>
            <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
          </button>
          
          <button onClick={() => setShowCitations(true)} className="p-2.5 bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded-full transition-colors" title={t('reader.citations')}>
            <Quote size={18} />
          </button>
          
          {isMarkdown && (
            <button onClick={() => setShowOutline(!showOutline)} className={`p-2.5 rounded-full transition-colors ${showOutline ? 'bg-accent-cyan text-bg-primary' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`} title={t('reader.outline')}>
              <List size={18} />
            </button>
          )}

          {isMarkdown && (
            <button onClick={() => setShowFormatting(!showFormatting)} className={`p-2.5 rounded-full transition-colors ${showFormatting ? 'bg-accent-indigo text-white' : 'bg-bg-card text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`} title={t('reader.format.title')}>
              <Type size={18} />
            </button>
          )}

          <button onClick={handleCopyLink} className="flex items-center px-4 py-2 text-sm font-medium text-bg-primary bg-text-primary hover:bg-bg-hover rounded-full transition-colors">
            {copied ? <Check size={16} className="me-2" /> : <LinkIcon size={16} className="me-2" />}
            {copied ? t('reader.copied') : t('reader.share')}
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
                  <a href={`#${h.id}`} className="hover:text-accent-cyan transition-colors block py-1">{h.text}</a>
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
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary mb-6 leading-tight tracking-tight">
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
                  <div className="flex items-center justify-end"><Clock size={14} className="me-2 opacity-70" /> {paper.readingTimeMinutes} {t('reader.minRead')}</div>
                  {isMarkdown && (
                    <div className="flex items-center justify-end text-xs text-text-muted"><Activity size={12} className="me-1" /> {paper.wordCount.toLocaleString()} {t('reader.words')}</div>
                  )}
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
                    h1: ({node, ...props}) => { const id = props.children?.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-'); return <h1 id={id} {...props} /> },
                    h2: ({node, ...props}) => { const id = props.children?.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-'); return <h2 id={id} {...props} /> },
                    h3: ({node, ...props}) => { const id = props.children?.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-'); return <h3 id={id} {...props} /> }
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
                
                <div className="mt-16 pt-8 border-t border-border-subtle flex justify-end gap-3">
                  <button onClick={handleExportTxt} className="flex items-center px-4 py-2 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-full transition-colors">
                    <FileDown size={16} className="me-2 text-accent-cyan" /> {t('reader.exportTxt')}
                  </button>
                  <button onClick={handleExportMd} className="flex items-center px-4 py-2 text-sm text-text-secondary bg-bg-card hover:text-text-primary hover:bg-bg-hover rounded-full transition-colors">
                    <Download size={16} className="me-2 text-success" /> {t('reader.exportMd')}
                  </button>
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

      {/* Floating Formatting Bar */}
      {isMarkdown && showFormatting && (
        <div className="absolute bottom-5 inset-x-0 flex justify-center z-40 pointer-events-none px-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 bg-bg-card/95 backdrop-blur-md border border-border-subtle rounded-2xl px-4 py-3 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-2">
              <AlignLeft size={16} className="text-accent-indigo shrink-0" />
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
            <div className="w-px h-6 bg-border-subtle"></div>
            <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-full">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg p-8 bg-bg-card border border-border-subtle shadow-2xl rounded-3xl">
            <button onClick={() => setShowCitations(false)} className="absolute top-4 end-4 p-2 text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-full transition-colors">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-bold text-text-primary mb-6">{t('reader.citeTitle')}</h2>
            <div className="space-y-5 text-sm">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent-indigo">APA</span>
                </div>
                <div className="p-4 bg-bg-secondary rounded-2xl border border-border-subtle text-text-secondary font-serif select-all leading-relaxed">{citationAPA}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent-cyan">MLA</span>
                </div>
                <div className="p-4 bg-bg-secondary rounded-2xl border border-border-subtle text-text-secondary font-serif select-all leading-relaxed">{citationMLA}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-success">Chicago</span>
                </div>
                <div className="p-4 bg-bg-secondary rounded-2xl border border-border-subtle text-text-secondary font-serif select-all leading-relaxed">{citationChicago}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
