import React, { useState } from 'react';
import { Paper, Tag, PaperStatus } from '../types';
import { FileText, Eye, Edit3, Trash2, CheckCircle, Clock, Plus, BarChart2, Tag as TagIcon, LayoutDashboard, Archive, AlertCircle, X, Save, Sparkles } from 'lucide-react';
import { PaperEditor } from './PaperEditor';
import { t } from '../i18n';
import { useStore, PREMADE_TAGS } from '../store';

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
  const { setPaperStatus } = useStore();
  const [editingPaper, setEditingPaper] = useState<Paper | undefined>(undefined);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'papers' | 'analytics' | 'tags'>('papers');
  
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#818CF8');

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
    if (!newTagName) return;
    onAddTag({ id: crypto.randomUUID(), name: newTagName, color: newTagColor });
    setNewTagName('');
  };

  const existingTagNames = new Set(tags.map(t => t.name.toLowerCase()));
  const missingPremade = PREMADE_TAGS.filter(t => !existingTagNames.has(t.name.toLowerCase()));

  const totalViews = papers.reduce((sum, p) => sum + p.views, 0);
  const publishedCount = papers.filter(p => p.status === 'published').length;
  const draftCount = papers.filter(p => p.status === 'draft').length;
  const scheduledCount = papers.filter(p => p.status === 'scheduled').length;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-8">
      {isEditorOpen && (
        <PaperEditor 
          paper={editingPaper} 
          availableTags={tags}
          onSave={handleSave} 
          onClose={() => setIsEditorOpen(false)} 
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4 border-b border-border-subtle pb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('admin.title')}</h1>
          <p className="text-text-secondary mt-1">{t('admin.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => handleOpenEditor()}
            className="flex items-center px-5 py-2.5 font-medium text-bg-primary bg-text-primary hover:bg-bg-hover rounded-full transition-colors"
          >
            <Plus size={18} className="me-2" />
            {t('admin.new')}
          </button>
        </div>
      </div>

      <div className="flex space-x-2 mb-8 bg-bg-card/50 p-1 rounded-full w-fit">
        <button onClick={() => setActiveTab('papers')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'papers' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
          <FileText size={16} className="me-2" /> {t('admin.tab.content')}
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
          <BarChart2 size={16} className="me-2" /> {t('admin.tab.analytics')}
        </button>
        <button onClick={() => setActiveTab('tags')} className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'tags' ? 'bg-bg-card text-text-primary shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}>
          <TagIcon size={16} className="me-2" /> {t('admin.tab.tags')}
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 bg-bg-card border border-border-subtle rounded-3xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-sm font-medium text-text-secondary mb-1">{t('admin.metric.publications')}</p>
              <p className="text-3xl font-bold text-text-primary">{papers.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-accent-indigo/10 text-accent-indigo flex items-center justify-center">
              <FileText size={24} />
            </div>
          </div>
          
          <div className="p-6 bg-bg-card border border-border-subtle rounded-3xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-sm font-medium text-text-secondary mb-1">{t('admin.metric.views')}</p>
              <p className="text-3xl font-bold text-text-primary">{totalViews.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-accent-cyan/10 text-accent-cyan flex items-center justify-center">
              <Eye size={24} />
            </div>
          </div>
          
          <div className="p-6 bg-bg-card border border-border-subtle rounded-3xl flex flex-col justify-center shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-secondary">{t('admin.metric.status')}</p>
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-accent-cyan me-2"></div><span className="text-sm text-text-secondary">{publishedCount} {t('admin.status.pub')}</span></div>
              <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-text-muted me-2"></div><span className="text-sm text-text-secondary">{draftCount} {t('admin.status.draftShort')}</span></div>
              <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-accent-indigo me-2"></div><span className="text-sm text-text-secondary">{scheduledCount} {t('admin.status.scheduledShort')}</span></div>
            </div>
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
        <div className="bg-bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm whitespace-nowrap">
              <thead className="bg-bg-secondary text-text-secondary">
                <tr>
                  <th className="px-6 py-4 font-medium text-start">{t('admin.table.title')}</th>
                  <th className="px-6 py-4 font-medium text-start">{t('admin.table.status')}</th>
                  <th className="px-6 py-4 font-medium text-start">{t('admin.table.type')}</th>
                  <th className="px-6 py-4 font-medium text-start">{t('admin.table.updated')}</th>
                  <th className="px-6 py-4 font-medium text-end">{t('admin.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {papers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <LayoutDashboard size={48} className="mx-auto text-text-muted mb-4" />
                      <h3 className="text-xl font-medium text-text-primary mb-2">{t('admin.table.empty.title')}</h3>
                      <p className="text-text-muted mb-6">{t('admin.table.empty.desc')}</p>
                      <button onClick={() => handleOpenEditor()} className="inline-flex items-center px-6 py-3 font-medium text-bg-primary bg-text-primary hover:bg-bg-hover rounded-full transition-colors">
                        {t('admin.table.empty.cta')}
                      </button>
                    </td>
                  </tr>
                ) : (
                  papers.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(paper => (
                    <tr key={paper.id} className="hover:bg-bg-secondary/50 transition-colors">
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
                        <span className="text-text-muted">
                          {new Date(paper.updatedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEditor(paper)}
                            className="p-2 text-text-secondary hover:text-accent-indigo hover:bg-accent-indigo/10 rounded-full transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => window.confirm(`Are you sure you want to delete "${paper.title}"?`) && onDelete(paper.id)}
                            className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-full transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
