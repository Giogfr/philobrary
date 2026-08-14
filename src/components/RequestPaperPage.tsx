import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { push, ref } from 'firebase/database';
import { CheckCircle2, PenLine } from 'lucide-react';
import { useStore } from '../store';
import { t } from '../i18n';
import { setSeo } from '../seo';

const COOLDOWN_KEY = 'pb_req_cooldown';
const COOLDOWN_MS = 5 * 60 * 1000;

export function RequestPaperPage() {
  const { db, language } = useStore();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    setSeo({
      title: t('request.title'),
      description: 'Request a philosophy paper. Suggest a topic and we may write it for Philobrary.',
      url: 'https://philobrary.vercel.app/request',
      robots: 'index, follow',
    });
  }, []);

  useEffect(() => {
    let last: number | null = null;
    try {
      last = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || 'null');
    } catch { /* ignore */ }
    if (last && Date.now() - last < COOLDOWN_MS) setCooldown(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown) return;
    if (!topic.trim()) {
      setError(t('request.reqTopic'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await push(ref(db, 'requests'), {
        topic: topic.trim(),
        details: details.trim(),
        name: name.trim(),
        email: email.trim(),
        locale: language,
        status: 'new',
        at: Date.now(),
      });
      try {
        localStorage.setItem(COOLDOWN_KEY, JSON.stringify(Date.now()));
      } catch { /* ignore */ }
      setSent(true);
    } catch {
      setError(t('request.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-20 animate-fade-in text-center">
        <div className="w-16 h-16 rounded-full bg-accent-cyan/10 text-accent-cyan flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-3">{t('request.successTitle')}</h1>
        <p className="text-text-secondary text-lg mb-10">{t('request.successText')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { setSent(false); setTopic(''); setDetails(''); setName(''); setEmail(''); }}
            className="px-6 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-full font-medium hover:bg-bg-hover transition-colors"
          >
            {t('request.another')}
          </button>
          <button onClick={() => navigate('/')} className="btn-gradient px-6 py-3 text-white rounded-full font-medium transition-all">
            {t('request.browse')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 animate-fade-in">
      <header className="mb-10">
        <div className="w-14 h-14 rounded-2xl bg-accent-indigo/10 text-accent-indigo flex items-center justify-center mb-5">
          <PenLine size={28} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">{t('request.title')}</h1>
        <p className="text-text-secondary mt-3 max-w-xl leading-relaxed">{t('request.subtitle')}</p>
      </header>

      {cooldown && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl text-sm">
          {t('request.cooldown')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-bg-card border border-border-subtle rounded-3xl p-6 md:p-8 shadow-xl">
        <div>
          <label htmlFor="req-topic" className="block text-sm font-medium text-text-secondary mb-2">{t('request.topicLabel')}</label>
          <input
            id="req-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('request.topicPlaceholder')}
            disabled={cooldown}
            className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
          />
        </div>

        <div>
          <label htmlFor="req-details" className="block text-sm font-medium text-text-secondary mb-2">{t('request.detailsLabel')}</label>
          <textarea
            id="req-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            placeholder={t('request.detailsPlaceholder')}
            disabled={cooldown}
            className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 resize-y"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="req-name" className="block text-sm font-medium text-text-secondary mb-2">{t('request.nameLabel')}</label>
            <input
              id="req-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('request.namePlaceholder')}
              disabled={cooldown}
              className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
            />
          </div>
          <div>
            <label htmlFor="req-email" className="block text-sm font-medium text-text-secondary mb-2">{t('request.emailLabel')}</label>
            <input
              id="req-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('request.emailPlaceholder')}
              disabled={cooldown}
              className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
            />
          </div>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || cooldown}
          className="btn-gradient w-full py-3.5 text-white rounded-full font-semibold transition-all disabled:opacity-50"
        >
          {submitting ? '…' : t('request.submit')}
        </button>
      </form>
    </div>
  );
}
