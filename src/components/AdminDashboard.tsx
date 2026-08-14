import React, { useState, useEffect } from 'react';
import { Paper, Tag, PaperStatus } from '../types';
import { FileText, Eye, Edit3, Trash2, CheckCircle, Clock, Plus, BarChart2, Tag as TagIcon, LayoutDashboard, Archive, AlertCircle, X, Save, Sparkles, Activity, Bookmark, Copy, Download, Search, Star, ChevronUp, ChevronDown, MessageCircle, MonitorSmartphone, MapPin, Fingerprint } from 'lucide-react';
import { PaperEditor } from './PaperEditor';
import { t } from '../i18n';
import { useStore, PREMADE_TAGS } from '../store';
import { ref, set, onValue, remove } from 'firebase/database';
import { Visit } from '../types';

interface AdminDashboardProps {
  papers: Paper[];
  tags: Tag[];
  onAdd: (paper: Paper) => void;
  onUpdate: (paper: Paper) => void;
  onDelete: (id: string) => void;
  onAddTag: (tag: Tag) => void;
  onDeleteTag: (id: string) => void;
  onLogout: () => void;
}

const STATUS_STYLE: Record<PaperStatus, { bg: string; fg: string; border: string }> = {
  published: { bg: 'rgba(56,189,248,0.12)', fg: '#38BDF8', border: 'rgba(56,189,248,0.3)' },
  scheduled: { bg: 'rgba(129,140,248,0.12)', fg: '#818CF8', border: 'rgba(129,140,248,0.3)' },
  archived: { bg: 'rgba(148,163,184,0.12)', fg: '#94A3B8', border: 'rgba(148,163,184,0.3)' },
  draft: { bg: 'rgba(148,163,184,0.10)', fg: '#94A3B8', border: 'rgba(148,163,184,0.3)' },
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  papers, tags, onAdd, onUpdate, onDelete, onAddTag, onDeleteTag, onLogout 
}) => {
  const { setPaperStatus, showToast, db } = useStore();
  const [editingPaper, setEditingPaper] = useState<Paper | undefined>(undefined);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'papers' | 'analytics' | 'tags' | 'featured' | 'messages' | 'visitors'>('papers');
  
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#818CF8');

  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaperStatus>('all');
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [newFeaturedPaperId, setNewFeaturedPaperId] = useState('');
  const [sendMessageSubject, setSendMessageSubject] = useState('');
  const [sendMessageBody, setSendMessageBody] = useState('');
  const [recipients, setRecipients] = useState<'all' | 'selected'>('all');

  const [visits, setVisits] = useState<{ key: string; data: Visit }[]>([]);
  const [visitorSearch, setVisitorSearch] = useState('');

  useEffect(() => {
    const visitRef = ref(db, 'visits');
    const off = onValue(visitRef, (snap) => {
      const data = snap.val();
      if (!data || typeof data !== 'object') {
        setVisits([]);
        return;
      }
      setVisits(Object.keys(data).map((key) => ({ key, data: data[key] || {} })));
    }, (err) => {
      console.error('Visits listener error:', err);
      setVisits([]);
    });
    return off;
  }, [db]);

  const sendMessage = async () => {
    const subject = sendMessageSubject.trim();
    const body = sendMessageBody.trim();
    if (!subject || !body) {
      showToast('toast.saveFailed', 'error');
      return;
    }
    try {
      await set(ref(db, 'announcements/' + Date.now()), {
        title: subject,
        body,
        at: Date.now(),
        read: false,
      });
      showToast('toast.messageSent', 'success');
      setSendMessageSubject('');
      setSendMessageBody('');
    } catch {
      showToast('toast.saveFailed', 'error');
    }
  };
  
  const featuredPapers = papers
    .filter(p => p.featuredOrder !== undefined && p.featuredOrder > 0)
    .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
  const availableForFeatured = papers
    .filter(p => p.status === 'published' && !featuredPapers.some(fp => fp.id === p.id));

  const addFeatured = () => {
    if (!newFeaturedPaperId) return;
    const maxOrder = featuredPapers.length > 0 ? Math.max(...featuredPapers.map(fp => fp.featuredOrder || 0)) : 0;
    const paper = papers.find(p => p.id === newFeaturedPaperId);
    if (paper) {
      onUpdate({ ...paper, featuredOrder: maxOrder + 1, updatedAt: new Date().toISOString() });
    }
    setNewFeaturedPaperId('');
  };

  const removeFeatured = (id: string) => {
    const paper = papers.find(p => p.id === id);
    if (paper) {
      onUpdate({ ...paper, featuredOrder: undefined, updatedAt: new Date().toISOString() });
    }
  };

  const moveFeatured = (id: string, direction: 'up' | 'down') => {
    const fp = featuredPapers.find(f => f.id === id);
    if (!fp) return;
    const currentOrder = fp.featuredOrder || 0;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    if (targetOrder < 1) return;
    const targetFp = featuredPapers.find(f => (f.featuredOrder || 0) === targetOrder);
    if (targetFp) {
      onUpdate({ ...targetFp, featuredOrder: currentOrder, updatedAt: new Date().toISOString() });
    }
    const paper = papers.find(p => p.id === id);
    if (paper) {
      onUpdate({ ...paper, featuredOrder: targetOrder, updatedAt: new Date().toISOString() });
    }
  };

  const handleDuplicate = (paper: Paper) => {
    const copy: Paper = {
      ...paper,
      id: crypto.randomUUID(),
      title: `${paper.title} (Copy)`,
      slug: `${paper.slug}-copy-${Date.now().toString(36)}`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: undefined,
      views: 0,
      savedCount: 0,
    };
    onAdd(copy);
  };

  const handleExportJson = () => {
    const dump = {
      exportedAt: new Date().toISOString(),
      papers,
      tags,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `philobrary_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelectAll = () => {
    if (selectedPaperIds.size === filteredTablePapers.length) {
      setSelectedPaperIds(new Set());
    } else {
      setSelectedPaperIds(new Set(filteredTablePapers.map(p => p.id)));
    }
  };

  const toggleSelectPaper = (id: string) => {
    const next = new Set(selectedPaperIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPaperIds(next);
  };

  const handleBulkStatusChange = (status: PaperStatus) => {
    selectedPaperIds.forEach(id => setPaperStatus(id, status));
    setSelectedPaperIds(new Set());
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Delete ${selectedPaperIds.size} selected papers?`)) return;
    selectedPaperIds.forEach(id => onDelete(id));
    setSelectedPaperIds(new Set());
  };

  const handleOpenEditor = (paper?: Paper) => {
    setEditingPaper(paper);
    setIsEditorOpen(true);
  };

  const handleSave = (paper: Paper) => {
    if (editingPaper) onUpdate(paper);
    else onAdd(paper);
    setIsEditorOpen(false);
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;
    // Check for duplicate (case-insensitive)
    const isDuplicate = tags.some(t => t.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      showToast('admin.tags.duplicate', 'error');
      return;
    }
    // Auto-generate random color if using default
    const color = newTagColor === '#818CF8' 
      ? '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
      : newTagColor;
    onAddTag({ id: crypto.randomUUID(), name, color });
    setNewTagName('');
    setNewTagColor('#818CF8');
  };

  const filteredTablePapers = papers
    .filter(p => {
      const matchSearch = !tableSearch || p.title.toLowerCase().includes(tableSearch.toLowerCase()) || p.author.toLowerCase().includes(tableSearch.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const existingTagNames = new Set(tags.map(t => t.name.toLowerCase()));
  const missingPremade = PREMADE_TAGS.filter(t => !existingTagNames.has(t.name.toLowerCase()));

  const totalViews = papers.reduce((sum, p) => sum + p.views, 0);
  const totalSaves = papers.reduce((sum, p) => sum + (p.savedCount || 0), 0);
  const publishedCount = papers.filter(p => p.status === 'published').length;
  const draftCount = papers.filter(p => p.status === 'draft').length;
  const scheduledCount = papers.filter(p => p.status === 'scheduled').length;
  const totalWords = papers.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  const totalReadingTime = papers.reduce((sum, p) => sum + (p.readingTimeMinutes || 0), 0);
  const topViewed = [...papers].sort((a, b) => b.views - a.views).slice(0, 5);
  const maxViews = Math.max(...papers.map(p => p.views), 0);
  const tagCounts = tags
    .map(tag => ({ tag, count: papers.filter(p => (p.tags || []).includes(tag.id)).length }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const trend = (() => {
    const months: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString(undefined, { month: 'short' });
      months.push({ label, count: 0 });
    }
    papers.forEach(p => {
      const date = p.publishedAt ? new Date(p.publishedAt) : p.createdAt ? new Date(p.createdAt) : null;
      if (!date) return;
      const now2 = new Date();
      const monthsAgo = (now2.getFullYear() - date.getFullYear()) * 12 + (now2.getMonth() - date.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) months[5 - monthsAgo].count++;
    });
    return months;
  })();

  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-8 animate-fade-in">
      {isEditorOpen && (
        <PaperEditor 
          paper={editingPaper} 
          availableTags={tags}
          onSave={handleSave} 
          onClose={() => setIsEditorOpen(false)} 
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4 border-b border-border-subtle pb-8 animate-slide-up">
        <div className="animate-slide-in-left">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('admin.title')}</h1>
          <p className="text-text-secondary mt-1">{t('admin.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4 animate-slide-in-right">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportJson}
            className="flex items-center px-4 py-2.5 font-medium text-text-secondary bg-bg-card hover:bg-bg-hover hover:text-text-primary border border-border-subtle rounded-full transition-colors text-sm btn-press"
            title="Export JSON Backup"
          >
            <Download size={16} className="me-2 text-accent-cyan" /> Backup JSON
          </button>
          <button 
            onClick={() => handleOpenEditor()}
            className="flex items-center px-5 py-2.5 font-medium text-bg-primary bg-text-primary hover:bg-bg-hover rounded-full transition-colors btn-press"
          >
            <Plus size={18} className="me-2" /> {t('admin.new')}
          </button>
        </div>
        </div>
      </div>

      <div className="flex space-x-2 mb-8 bg-bg-card/50 p-1 rounded-full w-fit animate-slide-up">
        <button onClick={() => setActiveTab('papers')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors tab-btn ${activeTab === 'papers' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
          <FileText size={16} className="me-2" /> {t('admin.tab.content')}
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
          <BarChart2 size={16} className="me-2" /> {t('admin.tab.analytics')}
        </button>
        <button onClick={() => setActiveTab('featured')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'featured' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
          <Star size={16} className="me-2" /> {t('admin.tab.featured')}
        </button>
<button onClick={() => setActiveTab('messages')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'messages' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
              <MessageCircle size={16} className="me-2" /> {t('admin.messages')}
            </button>
        <button onClick={() => setActiveTab('visitors')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'visitors' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
          <MonitorSmartphone size={16} className="me-2" /> Visitors
        </button>
      </div>

      {activeTab === 'analytics' && (
        <>
          <div className="card-grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 bg-bg-card border border-border-subtle rounded-3xl flex items-center justify-between shadow-xl animate-scale-in stagger-1">
              <div>
                <p className="text-sm font-medium text-text-secondary mb-1">{t('admin.metric.publications')}</p>
                <p className="text-3xl font-bold text-text-primary">{papers.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent-indigo/10 text-accent-indigo flex items-center justify-center animate-float">
                <FileText size={24} />
              </div>
            </div>
            
            <div className="p-6 bg-bg-card border border-border-subtle rounded-3xl flex items-center justify-between shadow-xl animate-scale-in stagger-2">
              <div>
                <p className="text-sm font-medium text-text-secondary mb-1">{t('admin.metric.views')}</p>
                <p className="text-3xl font-bold text-text-primary">{totalViews.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-1">{Math.round(totalViews / Math.max(1, papers.length)).toLocaleString()} {t('admin.metric.avgViews')}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent-cyan/10 text-accent-cyan flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
                <Eye size={24} />
              </div>
            </div>
            
            <div className="p-6 bg-bg-card border border-border-subtle rounded-3xl flex items-center justify-between shadow-xl animate-scale-in stagger-3">
              <div>
                <p className="text-sm font-medium text-text-secondary mb-1">{t('admin.metric.words')}</p>
                <p className="text-3xl font-bold text-text-primary">{totalWords.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-1">{totalReadingTime} {t('admin.metric.reading')}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent-indigo/10 text-accent-indigo flex items-center justify-center">
                <Activity size={24} />
              </div>
            </div>

            <div className="p-6 bg-bg-card border border-border-subtle rounded-3xl flex items-center justify-between shadow-xl">
              <div>
                <p className="text-sm font-medium text-text-secondary mb-1">{t('admin.metric.saves')}</p>
                <p className="text-3xl font-bold text-text-primary">{totalSaves.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-1">{Math.round(totalSaves / Math.max(1, papers.length)).toLocaleString()} {t('admin.metric.avgSaves')}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent-cyan/10 text-accent-cyan flex items-center justify-center">
                <Bookmark size={24} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-2 bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center">
                <BarChart2 size={18} className="me-2 text-accent-cyan" /> {t('admin.analytics.topViews')}
              </h2>
              {topViewed.length === 0 ? (
                <p className="text-text-muted text-sm py-8 text-center">{t('admin.analytics.noData')}</p>
              ) : (
                <div className="space-y-4">
                  {topViewed.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-4 list-item stagger-${Math.min(i + 1, 10)}">
                      <span className={`w-6 text-center font-bold text-sm ${i < 3 ? 'text-accent-cyan' : 'text-text-muted'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-sm font-medium text-text-secondary truncate">{p.title}</span>
                          <span className="text-xs text-text-muted shrink-0 flex items-center gap-2">
                            <span className="flex items-center"><Eye size={11} className="me-1" />{p.views.toLocaleString()}</span>
                            <span className="flex items-center"><Bookmark size={11} className="me-1" />{(p.savedCount || 0).toLocaleString()}</span>
                          </span>
                        </div>
                        <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent-indigo to-accent-cyan rounded-full transition-all"
                            style={{ width: `${maxViews > 0 ? Math.max(4, (p.views / maxViews) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center">
                <TagIcon size={18} className="me-2 text-accent-indigo" /> {t('admin.analytics.byTag')}
              </h2>
              {tagCounts.length === 0 ? (
                <p className="text-text-muted text-sm py-8 text-center">{t('admin.analytics.noData')}</p>
              ) : (
                <div className="space-y-4">
                  {tagCounts.map(({ tag, count }) => (
                    <div key={tag.id} className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }}></span>
                      <span className="text-sm text-text-secondary truncate flex-1">{tag.name}</span>
                      <span className="text-xs font-medium text-text-muted shrink-0">{count} {t('admin.analytics.papers')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center">
              <Clock size={18} className="me-2 text-accent-indigo" /> {t('admin.analytics.trend')}
            </h2>
            {trend.length === 0 ? (
              <p className="text-text-muted text-sm py-8 text-center">{t('admin.analytics.noData')}</p>
            ) : (
              <div className="flex items-end gap-3 h-40">
                {trend.map((month, i) => {
                  const max = Math.max(...trend.map(m => m.count), 1);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                      <span className="text-xs text-text-muted">{month.count > 0 ? month.count : ''}</span>
                      <div className="w-full max-w-12 bg-bg-secondary rounded-t-xl overflow-hidden flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-accent-indigo to-accent-cyan transition-all"
                          style={{ height: `${Math.max(4, (month.count / max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-muted whitespace-nowrap">{month.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'messages' && (
      <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl max-w-2xl">
        <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
          <MessageCircle size={20} className="text-accent-cyan" /> {t('admin.messages')}
        </h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-text-secondary mb-2">{t('admin.message.recipients')}</label>
            <select value={recipients} onChange={e => setRecipients(e.target.value as 'all' | 'selected')} className="bg-bg-secondary border border-border-subtle rounded-2xl px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-indigo/50">
              <option value="all">{t('admin.message.recipientsAll')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">{t('admin.message.subject')}</label>
            <input type="text" value={sendMessageSubject} onChange={e => setSendMessageSubject(e.target.value)} className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50" placeholder={t('admin.message.subjectPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">{t('admin.message.body')}</label>
            <textarea value={sendMessageBody} onChange={e => setSendMessageBody(e.target.value)} rows={5} className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50" placeholder={t('admin.message.bodyPlaceholder')}></textarea>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={sendMessage} disabled={!sendMessageSubject.trim() || !sendMessageBody.trim()} className="px-6 py-3 bg-text-primary text-bg-primary font-medium rounded-2xl hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {t('admin.message.send')}
          </button>
        </div>
      </div>
    )}

      {activeTab === 'tags' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-text-primary mb-6">{t('admin.tags.create')}</h2>
          <form onSubmit={handleCreateTag} className="space-y-4">
              <div>
                <label className="text-sm text-text-secondary block mb-2">{t('admin.tags.name')}</label>
                <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50" required placeholder="e.g. Neuroscience" />
              </div>
              <div>
                <label className="text-sm text-text-secondary block mb-2">{t('admin.tags.color')}</label>
                <div className="flex items-center gap-4">
                  <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="w-12 h-12 bg-transparent border-0 cursor-pointer rounded-xl" />
                  <span className="text-text-primary font-mono">{newTagColor}</span>
                </div>
              </div>
              <button type="submit" className="w-full flex items-center justify-center py-3 bg-text-primary text-bg-primary font-medium rounded-2xl hover:bg-bg-hover transition-colors">
                <Plus size={16} className="me-2" /> {t('admin.tags.add')}
              </button>
            </form>
          </div>
          <div className="lg:col-span-2 space-y-6">
            {missingPremade.length > 0 && (
              <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary flex items-center">
                    <Sparkles size={18} className="me-2 text-accent-cyan" /> {t('admin.tags.quickAdd')}
                  </h2>
                  <button
                    onClick={() => missingPremade.forEach(t => onAddTag({ id: t.id, name: t.name, color: t.color }))}
                    className="text-xs font-medium px-4 py-2 bg-accent-indigo text-white rounded-full hover:bg-accent-cyan transition-colors"
                  >
                    {t('admin.tags.addAll')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
                  {missingPremade.map(t => (
                    <button
                      key={t.id}
                      onClick={() => onAddTag({ id: t.id, name: t.name, color: t.color })}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-all hover:scale-105"
                      style={{ color: t.color, borderColor: `${t.color}55`, backgroundColor: `${t.color}15` }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }}></span>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-text-primary mb-6">{t('admin.tags.existing')}</h2>
              <div className="flex flex-wrap gap-3">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center bg-bg-secondary border border-border-subtle rounded-full ps-3 pe-1 py-1">
                    <div className="w-2.5 h-2.5 rounded-full me-2" style={{ backgroundColor: tag.color }}></div>
                    <span className="text-sm font-medium text-text-secondary me-3">{tag.name}</span>
                    <button onClick={() => window.confirm(`Delete tag ${tag.name}?`) && onDeleteTag(tag.id)} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    {activeTab === 'papers' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-bg-card border border-border-subtle p-4 rounded-3xl shadow-lg">
            <div className="relative flex-1">
              <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search titles, authors..."
                className="w-full ps-11 pe-4 py-2.5 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
              />
              {tableSearch && (
                <button onClick={() => setTableSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-4 py-2.5 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="published">{t('admin.status.published')}</option>
                <option value="draft">{t('admin.status.draft')}</option>
                <option value="scheduled">{t('admin.status.scheduled')}</option>
                <option value="archived">{t('admin.status.archived')}</option>
              </select>

              <span className="text-xs text-text-muted px-2 font-mono">
                {filteredTablePapers.length} / {papers.length}
              </span>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedPaperIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-accent-indigo/10 border border-accent-indigo/30 p-4 rounded-2xl">
              <span className="text-sm font-medium text-accent-indigo">
                {selectedPaperIds.size} paper(s) selected
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleBulkStatusChange('published')} className="px-3 py-1.5 text-xs font-medium bg-success/20 text-success border border-success/30 rounded-full hover:bg-success/30 transition-colors">
                  Publish All
                </button>
                <button onClick={() => handleBulkStatusChange('draft')} className="px-3 py-1.5 text-xs font-medium bg-bg-card text-text-secondary border border-border-subtle rounded-full hover:bg-bg-hover transition-colors">
                  Set Draft
                </button>
                <button onClick={() => handleBulkStatusChange('archived')} className="px-3 py-1.5 text-xs font-medium bg-bg-card text-text-muted border border-border-subtle rounded-full hover:bg-bg-hover transition-colors">
                  Archive All
                </button>
<button onClick={handleBulkDelete} className="px-3 py-1.5 text-xs font-medium bg-danger/20 text-danger border border-danger/30 rounded-full hover:bg-danger/30 transition-colors">
                  Delete Selected
                </button>
              </div>
            </div>
            )}

          {/* Papers Table */}
          <div className="bg-bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm whitespace-nowrap">
                <thead className="bg-bg-secondary text-text-secondary">
                  <tr>
                    <th className="px-4 py-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedPaperIds.size > 0 && selectedPaperIds.size === filteredTablePapers.length}
                        onChange={toggleSelectAll}
                        className="rounded border-border-subtle text-accent-indigo focus:ring-accent-indigo"
                      />
                    </th>
                    <th className="px-6 py-4 font-medium text-start">{t('admin.table.title')}</th>
                    <th className="px-6 py-4 font-medium text-start">{t('admin.table.status')}</th>
                    <th className="px-6 py-4 font-medium text-start">{t('admin.table.type')}</th>
                    <th className="px-6 py-4 font-medium text-start">Tags</th>
                    <th className="px-6 py-4 font-medium text-start">Stats</th>
                    <th className="px-6 py-4 font-medium text-start">{t('admin.table.updated')}</th>
                    <th className="px-6 py-4 font-medium text-end">{t('admin.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredTablePapers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <LayoutDashboard size={48} className="mx-auto text-text-muted mb-4" />
                        <h3 className="text-xl font-medium text-text-primary mb-2">{t('admin.table.noResults')}</h3>
                        <p className="text-text-muted mb-6">{t('admin.table.noResultsHint')}</p>
                        <button onClick={() => { setTableSearch(''); setStatusFilter('all'); }} className="inline-flex items-center px-6 py-3 font-medium text-bg-primary bg-text-primary hover:bg-bg-hover rounded-full transition-colors">
                          {t('admin.table.clearFilters')}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredTablePapers.map((paper, index) => {
                      const paperTagObjs = (paper.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
                      return (
                        <tr key={paper.id} className={`hover:bg-bg-secondary/50 transition-colors list-item stagger-${Math.min(index + 1, 12)} ${selectedPaperIds.has(paper.id) ? 'bg-accent-indigo/5' : ''}`}>
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedPaperIds.has(paper.id)}
                              onChange={() => toggleSelectPaper(paper.id)}
                              className="rounded border-border-subtle text-accent-indigo focus:ring-accent-indigo"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-text-secondary truncate max-w-xs md:max-w-md">{paper.title}</div>
                            <div className="text-text-muted text-xs mt-1">
                              {paper.author} {paper.focusArea ? ` • ${paper.focusArea}` : ''} 
                              {paper.contentType === 'native_markdown' ? ` • ${paper.wordCount} ${t('admin.words')}` : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={paper.status}
                              onChange={e => setPaperStatus(paper.id, e.target.value as PaperStatus)}
                              style={{ backgroundColor: STATUS_STYLE[paper.status].bg, color: STATUS_STYLE[paper.status].fg, borderColor: STATUS_STYLE[paper.status].border }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border focus:outline-none cursor-pointer"
                            >
                              <option value="draft">{t('admin.status.draft')}</option>
                              <option value="scheduled">{t('admin.status.scheduled')}</option>
                              <option value="published">{t('admin.status.published')}</option>
                              <option value="archived">{t('admin.status.archived')}</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-text-muted text-xs uppercase bg-bg-secondary px-2 py-1 rounded-md border border-border-subtle">
                              {paper.contentType === 'google_doc' ? t('admin.type.gdoc') : t('admin.type.md')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {paperTagObjs.slice(0, 2).map(t => (
                                <span key={t.id} style={{ color: t.color, backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }} className="px-2 py-0.5 text-[10px] font-medium border rounded-full">
                                  {t.name}
                                </span>
                              ))}
                              {paperTagObjs.length > 2 && (
                                <span className="text-[10px] text-text-muted self-center">+{paperTagObjs.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-text-muted">
                            <div className="flex items-center gap-2">
                              <span title="Views" className="flex items-center gap-1"><Eye size={12} /> {paper.views}</span>
                              <span title="Saves" className="flex items-center gap-1"><Bookmark size={12} /> {paper.savedCount || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-text-muted text-xs">
                              {new Date(paper.updatedAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleDuplicate(paper)}
                                title="Duplicate Paper"
                                className="p-2 text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 rounded-full transition-colors"
                              >
                                <Copy size={15} />
                              </button>
                              <button 
                                onClick={() => handleOpenEditor(paper)}
                                title="Edit Paper"
                                className="p-2 text-text-secondary hover:text-accent-indigo hover:bg-accent-indigo/10 rounded-full transition-colors"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button 
                                onClick={() => window.confirm(`Are you sure you want to delete "${paper.title}"?`) && onDelete(paper.id)}
                                title="Delete Paper"
                                className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-full transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'featured' && (
        <div className="space-y-6">
          <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Star size={20} className="text-accent-cyan" /> {t('admin.featured.title')}
            </h2>
            <p className="text-text-secondary mb-6">{t('admin.featured.description')}</p>
            {featuredPapers.length === 0 ? (
              <div className="text-center py-12">
                <Star size={48} className="mx-auto text-text-muted mb-4" />
                <h3 className="text-xl font-medium text-text-primary mb-2">{t('admin.featured.empty.title')}</h3>
                <p className="text-text-muted mb-6">{t('admin.featured.empty.description')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {featuredPapers.map((fp, index) => (
                  <div key={fp.id} className="flex items-center gap-4 p-4 bg-bg-secondary border border-border-subtle rounded-2xl">
                    <span className="w-10 h-10 flex items-center justify-center bg-accent-indigo/20 text-accent-indigo rounded-xl font-bold text-lg">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">{fp.title}</p>
                      <p className="text-sm text-text-muted">{fp.author}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {featuredPapers.length > 1 && (
                        <>
                          <button onClick={() => moveFeatured(fp.id, 'up')} disabled={index === 0} className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <ChevronUp size={18} />
                          </button>
                          <button onClick={() => moveFeatured(fp.id, 'down')} disabled={index === featuredPapers.length - 1} className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <ChevronDown size={18} />
                          </button>
                        </>
                      )}
                      <button onClick={() => removeFeatured(fp.id)} className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text-primary mb-4">{t('admin.featured.addPaper')}</h2>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm text-text-secondary block mb-2">{t('admin.featured.selectPaper')}</label>
                <select
                  value={newFeaturedPaperId}
                  onChange={e => setNewFeaturedPaperId(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
                >
                  <option value="">{t('admin.featured.selectPlaceholder')}</option>
                  {availableForFeatured.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({p.author})</option>
                  ))}
                </select>
              </div>
              <button
                onClick={addFeatured}
                disabled={!newFeaturedPaperId}
                className="md:w-fit flex items-center gap-2 px-6 py-3 bg-text-primary text-bg-primary font-medium rounded-2xl hover:bg-bg-hover transition-colors disabled:opacity-50"
              >
                <Plus size={18} className="me-2" /> {t('admin.featured.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'visitors' && (() => {
        const flagEmoji = (cc?: string) =>
          cc && cc.length === 2
            ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)))
            : '🌐';
        const sorted = [...visits].sort((a, b) => {
          const ta = (a.data.at ?? a.data.t ?? 0) as number;
          const tb = (b.data.at ?? b.data.t ?? 0) as number;
          return tb - ta;
        });
        const q = visitorSearch.trim().toLowerCase();
        const filtered = q
          ? sorted.filter(({ data }) => [data.ip, data.city, data.region, data.country, data.isp, data.org, data.referrer, data.path, data.campaign, data.browser, data.os]
              .some((v) => String(v || '').toLowerCase().includes(q)))
          : sorted;
        const shown = filtered.slice(0, 250);
        const uniqueIps = new Set(visits.map((v) => v.data.ip).filter(Boolean));
        const countryCounts = new Map<string, number>();
        visits.forEach((v) => {
          const c = v.data.country || 'Unknown';
          countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
        });
        const topCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0];

        const copyText = async (text: string) => {
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            /* clipboard may be unavailable */
          }
        };

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-bg-card border border-border-subtle p-4 rounded-3xl shadow-lg">
              <div className="relative flex-1">
                <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  placeholder="Search IP, location, ISP, referrer, path..."
                  className="w-full ps-11 pe-4 py-2.5 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
                />
                {visitorSearch && (
                  <button onClick={() => setVisitorSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-text-muted font-mono px-2">{filtered.length} / {visits.length}</span>
                <button
                  onClick={() => window.confirm('Delete ALL visit logs? This cannot be undone.') && remove(ref(db, 'visits'))}
                  className="px-3 py-2 text-xs font-medium bg-danger/20 text-danger border border-danger/30 rounded-full hover:bg-danger/30 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 bg-bg-card border border-border-subtle rounded-3xl shadow-xl">
                <p className="text-xs font-medium text-text-secondary mb-1">Total visits</p>
                <p className="text-2xl font-bold text-text-primary">{visits.length.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-bg-card border border-border-subtle rounded-3xl shadow-xl">
                <p className="text-xs font-medium text-text-secondary mb-1">Unique IPs</p>
                <p className="text-2xl font-bold text-text-primary">{uniqueIps.size.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-bg-card border border-border-subtle rounded-3xl shadow-xl">
                <p className="text-xs font-medium text-text-secondary mb-1">Countries</p>
                <p className="text-2xl font-bold text-text-primary">{countryCounts.size}</p>
              </div>
              <div className="p-5 bg-bg-card border border-border-subtle rounded-3xl shadow-xl">
                <p className="text-xs font-medium text-text-secondary mb-1">Top country</p>
                <p className="text-2xl font-bold text-text-primary truncate" title={topCountry ? `${topCountry[0]} (${topCountry[1]})` : ''}>
                  {flagEmoji(visits.find((v) => v.data.country === topCountry?.[0])?.data.countryCode)} {topCountry ? `${topCountry[0]} · ${topCountry[1]}` : '—'}
                </p>
              </div>
            </div>

            <div className="bg-bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm whitespace-nowrap">
                  <thead className="bg-bg-secondary text-text-secondary">
                    <tr>
                      <th className="px-4 py-4 font-medium text-start"><Clock size={13} className="inline me-1" />Time</th>
                      <th className="px-4 py-4 font-medium text-start"><Fingerprint size={13} className="inline me-1" />IP</th>
                      <th className="px-4 py-4 font-medium text-start"><MapPin size={13} className="inline me-1" />Location</th>
                      <th className="px-4 py-4 font-medium text-start"><MonitorSmartphone size={13} className="inline me-1" />Device</th>
                      <th className="px-4 py-4 font-medium text-start">Source</th>
                      <th className="px-4 py-4 font-medium text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {shown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <MonitorSmartphone size={48} className="mx-auto text-text-muted mb-4" />
                          <h3 className="text-xl font-medium text-text-primary mb-2">No visits recorded</h3>
                          <p className="text-text-muted">Visitors will appear here after the tracking rules are deployed.</p>
                        </td>
                      </tr>
                    ) : (
                      shown.map(({ key, data }) => (
                        <tr key={key} className="hover:bg-bg-secondary/50 transition-colors align-top">
                          <td className="px-4 py-4 text-text-muted text-xs">
                            <div>{new Date((data.at ?? data.t ?? 0) as number).toLocaleString()}</div>
                            {data.campaign && <div className="text-accent-cyan mt-0.5">via {data.campaign}</div>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-text-secondary">{data.ip || '—'}</span>
                              {data.ip && (
                                <button onClick={() => copyText(data.ip)} title="Copy IP" className="p-1 text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 rounded-md transition-colors">
                                  <Copy size={12} />
                                </button>
                              )}
                            </div>
                            {data.isp && <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-[200px]">{data.isp}</div>}
                            {data.org && data.org !== data.isp && <div className="text-[11px] text-text-muted truncate max-w-[200px]">{data.org}</div>}
                          </td>
                          <td className="px-4 py-4 text-text-secondary text-xs">
                            <div className="flex items-center gap-1.5">
                              <span>{flagEmoji(data.countryCode)}</span>
                              <span className="font-medium">{data.country || 'Unknown'}</span>
                            </div>
                            {data.city && <div className="text-text-muted mt-0.5">{data.city}{data.region && `, ${data.region}`}</div>}
                            {data.timezone && <div className="text-text-muted mt-0.5">tz {data.timezone}</div>}
                          </td>
                          <td className="px-4 py-4 text-xs text-text-secondary">
                            <div>{data.browser || 'Unknown'}{data.browserVersion ? ` ${data.browserVersion}` : ''}</div>
                            <div className="text-text-muted mt-0.5">{data.os || ''}{data.device ? ` · ${data.device}` : ''}</div>
                            {data.screen && <div className="text-text-muted mt-0.5">{data.screen}{data.lang ? ` · ${data.lang}` : ''}</div>}
                          </td>
                          <td className="px-4 py-4 text-xs text-text-secondary max-w-[240px]">
                            {data.path && <div className="font-mono truncate" title={data.path}>{data.path}</div>}
                            {data.referrer ? (
                              <div className="text-text-muted mt-0.5 truncate" title={data.referrer}>
                                ref {(() => { try { return new URL(data.referrer).host; } catch { return data.referrer; } })()}
                              </div>
                            ) : (
                              <div className="text-text-muted mt-0.5">direct</div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-end">
                            <button
                              onClick={() => window.confirm('Delete this visit log?') && remove(ref(db, 'visits/' + key))}
                              title="Delete visit"
                              className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-full transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
