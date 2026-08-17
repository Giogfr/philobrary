import React, { useState, useEffect } from 'react';
import { Paper, Tag, PaperStatus, PaperContentType, Revision } from '../types';
import { X, Save, Link as LinkIcon, Edit2, Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code, Table, CheckSquare, Search, Sparkles, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { generateSlug, extractGoogleDocId, htmlToText } from '../utils';
import { parseGoogleDocPaste } from '../googleDocPaste';
import { t } from '../i18n';
import { BASE_URL } from '../seo';
import { useStore } from '../store';

const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','in','on','at','to','for','with','by','from','as',
  'is','are','was','were','be','been','being','this','that','these','those','it','its',
  'we','our','you','your','they','their','he','she','his','her','i','me','my','not','no',
  'so','if','then','than','about','into','over','under','out','up','down','do','does','did',
  'has','have','had','will','would','can','could','should','may','might','what','which','who',
  'whom','when','where','why','how','all','any','each','few','more','most','other','some',
  'such','only','own','same','too','very','just','also','because','between','through','during',
  'before','after','above','below','again','further','once','here','there','essay','about',
  'the','philosophy','philosophical'
]);

function buildSeoSuggestions(title: string, author: string, focusArea: string, content: string) {
  const cleanContent = htmlToText(content);
  const source = [title, focusArea, cleanContent.split(/\s+/).slice(0, 80).join(' ')].join(' ');
  const words = source
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !STOPWORDS.has(w));

  const counts: Record<string, number> = {};
  words.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
  const keywords = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w)
    .join(', ');

  // Pull the description from the actual prose, leading with the title.
  const plain = cleanContent;

  let lead = title;
  if (focusArea && !lead.toLowerCase().includes(focusArea.toLowerCase())) {
    lead = `${title}: ${focusArea}`;
  }

  let desc = lead;
  if (plain) {
    const excerpt = plain.slice(0, 320);
    const end = excerpt.search(/[.!?]\s/);
    const firstSentence = plain.slice(0, end > 0 ? end + 1 : 240).trim();
    if (firstSentence && !lead.toLowerCase().includes(firstSentence.toLowerCase().slice(0, 40))) {
      desc += `. ${firstSentence}`;
    }
  }
  if (author && !desc.includes(`by ${author}`)) {
    desc += ` By ${author}.`;
  }
  desc = desc.slice(0, 320).trim();
  if (!desc) desc = title;

  return { metaDescription: desc, keywords };
}

interface PaperEditorProps {
  paper?: Paper;
  initialTitle?: string;
  availableTags: Tag[];
  onSave: (paper: Paper) => void;
  onClose: () => void;
}

export const PaperEditor: React.FC<PaperEditorProps> = ({ paper, initialTitle, availableTags, onSave, onClose }) => {
  const { user } = useStore();
  const [title, setTitle] = useState(initialTitle || paper?.title || '');
  const [author, setAuthor] = useState(paper?.author || user.displayName || 'Sheikh Gio');
  const [focusArea, setFocusArea] = useState(paper?.focusArea || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(paper?.tags || []);
  const [contentType, setContentType] = useState<PaperContentType>(paper?.contentType || 'google_doc');
  const [content, setContent] = useState(paper?.content || '');
  const [googleDocUrl, setGoogleDocUrl] = useState(paper?.googleDocUrl || '');
  const [status, setStatus] = useState<PaperStatus>(paper?.status || 'draft');
  const [scheduledFor, setScheduledFor] = useState<string>(() => {
    if (!paper?.scheduledFor) return '';
    const d = new Date(paper.scheduledFor);
    if (isNaN(d.getTime())) return '';
    // datetime-local expects local time — build it from the local components.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [metaDescription, setMetaDescription] = useState(paper?.metaDescription || '');
  const [keywords, setKeywords] = useState(paper?.keywords || '');
  const [ogImage, setOgImage] = useState(paper?.ogImage || '');
  
  const [revisionNote, setRevisionNote] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  // Auto-suggest SEO from title, author, focus area, and content.
  useEffect(() => {
    const { metaDescription: d, keywords: k } = buildSeoSuggestions(title, author, focusArea, content);
    if (!d) return;
    if (!metaDescription) setMetaDescription(d);
    if (!keywords) setKeywords(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, author, focusArea, content]);

  const generateSeo = () => {
    const { metaDescription: d, keywords: k } = buildSeoSuggestions(title, author, focusArea, content);
    if (d) setMetaDescription(d);
    if (k) setKeywords(k);
  };

  const toggleTag = (id: string) => {
    if (selectedTagIds.includes(id)) {
      setSelectedTagIds(selectedTagIds.filter(t => t !== id));
    } else {
      setSelectedTagIds([...selectedTagIds, id]);
    }
  };

  // Live word count & reading time for native markdown
  const wordCount = contentType === 'native_markdown' ? content.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
  const characterCount = contentType === 'native_markdown' ? content.length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const handleFormat = (type: string) => {
    const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    let newText = text;
    let newCursorPos = end;

    switch(type) {
      case 'bold':
        newText = text.substring(0, start) + '**' + selectedText + '**' + text.substring(end);
        newCursorPos = end + 4;
        break;
      case 'italic':
        newText = text.substring(0, start) + '*' + selectedText + '*' + text.substring(end);
        newCursorPos = end + 2;
        break;
      case 'strike':
        newText = text.substring(0, start) + '~~' + selectedText + '~~' + text.substring(end);
        newCursorPos = end + 4;
        break;
      case 'h1':
        newText = text.substring(0, start) + '# ' + selectedText + text.substring(end);
        newCursorPos = end + 2;
        break;
      case 'h2':
        newText = text.substring(0, start) + '## ' + selectedText + text.substring(end);
        newCursorPos = end + 3;
        break;
      case 'h3':
        newText = text.substring(0, start) + '### ' + selectedText + text.substring(end);
        newCursorPos = end + 4;
        break;
      case 'ul':
        newText = text.substring(0, start) + '- ' + selectedText + text.substring(end);
        newCursorPos = end + 2;
        break;
      case 'ol':
        newText = text.substring(0, start) + '1. ' + selectedText + text.substring(end);
        newCursorPos = end + 3;
        break;
      case 'task':
        newText = text.substring(0, start) + '- [ ] ' + selectedText + text.substring(end);
        newCursorPos = end + 6;
        break;
      case 'quote':
        newText = text.substring(0, start) + '> ' + selectedText + text.substring(end);
        newCursorPos = end + 2;
        break;
      case 'code':
        newText = text.substring(0, start) + '```\n' + selectedText + '\n```' + text.substring(end);
        newCursorPos = end + 4;
        break;
      case 'table':
        const tableTemplate = '\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n';
        newText = text.substring(0, start) + tableTemplate + text.substring(end);
        newCursorPos = start + tableTemplate.length;
        break;
    }

    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !author) return;
    if (contentType === 'native_markdown' && !content) return;
    
    // Auto-extract ID if full URL pasted
    let finalUrl = googleDocUrl;
    if (contentType === 'google_doc' && googleDocUrl) {
      const extracted = extractGoogleDocId(googleDocUrl);
      if (extracted) {
        finalUrl = `https://docs.google.com/document/d/${extracted}/edit`;
      }
    }

    if (contentType === 'google_doc' && !finalUrl) return;

    const now = new Date().toISOString();
    
    let revisions = paper?.revisions || [];
    if (paper && revisionNote) {
      revisions = [...revisions, { timestamp: now, note: revisionNote, author }];
    }

    const newPaper: Paper = {
      id: paper?.id || crypto.randomUUID(),
      title,
      slug: generateSlug(title),
      author,
      focusArea,
      tags: selectedTagIds,
      status,
      contentType,
      content,
      googleDocUrl: finalUrl,
      createdAt: paper?.createdAt || now,
      updatedAt: now,
      publishedAt: status === 'published' && paper?.status !== 'published' ? now : paper?.publishedAt,
      scheduledFor: status === 'scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      views: paper?.views || 0,
      savedCount: paper?.savedCount || 0,
      wordCount,
      characterCount,
      readingTimeMinutes,
      revisions,
      metaDescription: metaDescription.trim() || undefined,
      keywords: keywords.trim() || undefined,
      ogImage: ogImage.trim() || undefined,
    };

    onSave(newPaper);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg-primary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-md">
        <div className="flex items-center">
          <button 
            onClick={onClose}
            className="p-2 me-4 text-text-secondary hover:text-text-primary bg-bg-card hover:bg-bg-hover rounded-full transition-all duration-300 ease-out"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold text-text-primary">
            {paper ? t('editor.edit') : t('editor.new')}
          </h2>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="hidden md:inline-flex items-center text-xs text-text-muted bg-bg-card border border-border-subtle px-3 py-1.5 rounded-full font-mono">
            {wordCount.toLocaleString()} words • ~{readingTimeMinutes} min read
          </span>

          <select 
            value={status}
            onChange={e => setStatus(e.target.value as PaperStatus)}
            className="px-4 py-2 bg-bg-card border border-border-subtle text-text-primary rounded-full focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
          >
            <option value="draft">{t('admin.status.draft')}</option>
            <option value="scheduled">{t('admin.status.scheduled')}</option>
            <option value="published">{t('admin.status.published')}</option>
            <option value="archived">{t('admin.status.archived')}</option>
          </select>
          
          <button 
            onClick={handleSubmit}
            disabled={!title || !author || (contentType === 'native_markdown' ? !content : !googleDocUrl)}
            className="flex items-center px-5 py-2.5 font-medium text-white transition-all duration-300 ease-out bg-accent-indigo hover:bg-accent-cyan hover:shadow-lg hover:shadow-accent-indigo/20 rounded-full disabled:opacity-50 disabled:bg-bg-hover disabled:shadow-none disabled:cursor-not-allowed"
          >
            <Save size={18} className="me-2" />
            {t('editor.save')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col w-full max-w-6xl mx-auto p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <input 
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('editor.title')}
                className="w-full px-5 py-4 text-2xl md:text-3xl font-bold bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 focus:border-accent-indigo transition-all"
                required
              />
            </div>
            
  <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary mb-1">{t('editor.author')}</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={author}
                    readOnly
                    placeholder={t('editor.author')}
                    className="w-full px-4 py-3 pr-10 bg-bg-card/60 border border-border-subtle text-text-secondary rounded-2xl cursor-not-allowed opacity-70 focus:outline-none"
                    required
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/50" />
                </div>
                <p className="text-xs text-text-secondary/60 mt-1">{t('editor.authorLocked')}</p>
              </div>

            <div className="space-y-1.5">
              <input 
                type="text"
                value={focusArea}
                onChange={e => setFocusArea(e.target.value)}
                placeholder={t('editor.focusArea')}
                className="w-full px-4 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all"
              />
            </div>
            
            {status === 'scheduled' && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-text-secondary">{t('editor.scheduledLabel')}</label>
                <input 
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={e => setScheduledFor(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">{t('editor.tags')}</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  style={{ 
                    backgroundColor: selectedTagIds.includes(tag.id) ? `${tag.color}20` : 'transparent',
                    borderColor: selectedTagIds.includes(tag.id) ? tag.color : 'var(--border-subtle)',
                    color: selectedTagIds.includes(tag.id) ? tag.color : 'var(--text-secondary)'
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border transition-all hover:bg-bg-hover"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-bg-secondary border border-border-subtle rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-accent-cyan" />
                <h3 className="text-base font-semibold text-text-primary">{t('editor.seo.title')}</h3>
              </div>
              <button
                type="button"
                onClick={generateSeo}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 bg-accent-indigo text-white rounded-full hover:bg-accent-cyan transition-colors"
              >
                <Sparkles size={14} /> {t('editor.seo.generate')}
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">{t('editor.seo.description')}</label>
              <textarea
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value)}
                rows={3}
                maxLength={320}
                placeholder={t('editor.seo.descriptionHint')}
                className="w-full px-4 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all resize-none"
              />
              <p className={`text-xs ${metaDescription.length > 300 ? 'text-danger' : 'text-text-muted'}`}>
                {metaDescription.length}/320 {t('editor.seo.charCount')}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">{t('editor.seo.keywords')}</label>
              <input
                type="text"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder={t('editor.seo.keywordsHint')}
                className="w-full px-4 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">{t('editor.seo.ogImage')}</label>
              <input
                type="url"
                value={ogImage}
                onChange={e => setOgImage(e.target.value)}
                placeholder={`${BASE_URL}/assets/logo-512.png`}
                className="w-full px-4 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-bg-card rounded-full w-fit border border-border-subtle">
            <button
              onClick={() => setContentType('google_doc')}
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${contentType === 'google_doc' ? 'bg-accent-indigo text-white shadow-md shadow-accent-indigo/20' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <LinkIcon size={16} className="me-2" /> {t('editor.type.googleDoc')}
            </button>
            <button
              onClick={() => setContentType('native_markdown')}
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${contentType === 'native_markdown' ? 'bg-accent-indigo text-white shadow-md shadow-accent-indigo/20' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Edit2 size={16} className="me-2" /> {t('editor.type.richText')}
            </button>
          </div>
          
          {contentType === 'google_doc' ? (
            <div className="space-y-1.5 flex-1 bg-bg-secondary p-6 rounded-3xl border border-border-subtle">
              <label className="text-sm font-medium text-text-secondary">{t('editor.gdoc.urlLabel')}</label>
              <input 
                type="url"
                value={googleDocUrl}
                onChange={e => setGoogleDocUrl(e.target.value)}
                placeholder={t('editor.gdoc.placeholder')}
                className="w-full px-4 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all"
                required
              />
              <p className="text-xs text-text-muted mt-2">{t('editor.gdoc.help')}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-4 min-h-[500px]">
              <div className="flex items-center justify-between border border-border-subtle bg-bg-card p-2 rounded-2xl">
                <div className="flex items-center gap-1 flex-wrap">
                  <button type="button" onClick={() => handleFormat('h1')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors font-semibold">H1</button>
                  <button type="button" onClick={() => handleFormat('h2')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors font-semibold">H2</button>
                  <button type="button" onClick={() => handleFormat('h3')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors font-semibold">H3</button>
                  <div className="w-px h-5 bg-border-subtle mx-1"></div>
                  <button type="button" onClick={() => handleFormat('bold')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Bold"><Bold size={16} /></button>
                  <button type="button" onClick={() => handleFormat('italic')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Italic"><Italic size={16} /></button>
                  <button type="button" onClick={() => handleFormat('strike')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Strikethrough"><Strikethrough size={16} /></button>
                  <div className="w-px h-5 bg-border-subtle mx-1"></div>
                  <button type="button" onClick={() => handleFormat('ul')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Bullet List"><List size={16} /></button>
                  <button type="button" onClick={() => handleFormat('ol')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Numbered List"><ListOrdered size={16} /></button>
                  <button type="button" onClick={() => handleFormat('task')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Task List"><CheckSquare size={16} /></button>
                  <div className="w-px h-5 bg-border-subtle mx-1"></div>
                  <button type="button" onClick={() => handleFormat('quote')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Blockquote"><Quote size={16} /></button>
                  <button type="button" onClick={() => handleFormat('code')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Code Block"><Code size={16} /></button>
                  <button type="button" onClick={() => handleFormat('table')} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors" title="Table"><Table size={16} /></button>
                </div>
                <button 
                  type="button" 
                  onClick={() => setPreviewMode(!previewMode)}
                  className="text-xs font-medium text-accent-cyan bg-accent-cyan/10 px-4 py-2 rounded-full hover:bg-accent-cyan/20 transition-colors"
                >
                  {previewMode ? t('editor.write') : t('editor.preview')}
                </button>
              </div>
              
              {previewMode ? (
                <div className="flex-1 bg-bg-secondary p-8 rounded-3xl border border-border-subtle overflow-y-auto markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content || '*Nothing to preview*'}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  id="markdown-editor"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onPaste={e => {
                    const html = e.clipboardData.getData('text/html');
                    if (html) {
                      e.preventDefault();
                      const markdown = parseGoogleDocPaste(html);
                      
                      const textarea = e.currentTarget;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const newText = content.substring(0, start) + markdown + content.substring(end);
                      
                      setContent(newText);
                      setTimeout(() => {
                        textarea.focus();
                        const newCursorPos = start + markdown.length;
                        textarea.setSelectionRange(newCursorPos, newCursorPos);
                      }, 0);
                    }
                  }}
                  placeholder={t('editor.pasteHint')}
                  className="flex-1 w-full p-6 font-mono text-sm leading-relaxed bg-bg-secondary border border-border-subtle text-text-primary rounded-3xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all resize-none shadow-inner"
                  required
                />
              )}
            </div>
          )}

          {paper && (
            <div className="space-y-1.5 pb-8 pt-4 border-t border-border-subtle mt-4">
              <label className="text-sm font-medium text-text-secondary">{t('editor.revision.label')}</label>
              <input 
                type="text"
                value={revisionNote}
                onChange={e => setRevisionNote(e.target.value)}
                placeholder={t('editor.revision.placeholder')}
                className="w-full px-4 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-all"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
