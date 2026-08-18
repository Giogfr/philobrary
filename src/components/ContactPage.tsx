import { useEffect } from 'react';
import { Mail, Music2 } from 'lucide-react';
import { t } from '../i18n';
import { setSeo } from '../seo';

const CONTACT_EMAIL = 'giosemail0@gmail.com';
const TIKTOK_HANDLE = '@crypt0gio';
const TIKTOK_URL = 'https://www.tiktok.com/@crypt0gio';

export function ContactPage() {
  useEffect(() => {
    setSeo({
      title: t('contact.title'),
      description: t('contact.subtitle'),
      url: 'https://philobrary.vercel.app/contact',
      robots: 'index, follow',
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 animate-fade-in">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">{t('contact.title')}</h1>
        <p className="text-text-secondary mt-3 max-w-xl leading-relaxed">
          {t('contact.subtitle')}
        </p>
      </header>

      <div className="space-y-5">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="flex items-center gap-4 p-6 bg-bg-card border border-border-subtle rounded-3xl shadow-xl hover:border-accent-indigo/40 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-indigo/10 text-accent-indigo flex items-center justify-center group-hover:scale-110 transition-transform">
            <Mail size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-secondary mb-0.5">{t('contact.emailLabel')}</p>
            <p className="text-lg font-semibold text-text-primary truncate">{CONTACT_EMAIL}</p>
          </div>
        </a>

        <a
          href={TIKTOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-6 bg-bg-card border border-border-subtle rounded-3xl shadow-xl hover:border-accent-cyan/40 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 text-accent-cyan flex items-center justify-center group-hover:scale-110 transition-transform">
            <Music2 size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-secondary mb-0.5">{t('contact.tiktokLabel')}</p>
            <p className="text-lg font-semibold text-text-primary">{TIKTOK_HANDLE}</p>
          </div>
        </a>
      </div>

      <div className="mt-10 p-6 bg-bg-card border border-border-subtle rounded-3xl shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-3">{t('contact.messageTitle')}</h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-5">
          {t('contact.messageBody', undefined, { email: CONTACT_EMAIL })}
        </p>
      </div>
    </div>
  );
}
