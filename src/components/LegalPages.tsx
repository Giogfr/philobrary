import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import { setSeo } from '../seo';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-text-primary mb-3">{title}</h2>
      <div className="space-y-3 text-text-secondary leading-relaxed">{children}</div>
    </section>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
const LI = ({ children }: { children: React.ReactNode }) => <li className="ms-5 list-disc">{children}</li>;

export function LegalPage() {
  const { pathname } = useLocation();
  const isPrivacy = pathname === '/privacy';

  useEffect(() => {
    setSeo({
      title: t(isPrivacy ? 'legal.privacy.seoTitle' : 'legal.terms.seoTitle'),
      description: t(isPrivacy ? 'legal.privacy.seoDesc' : 'legal.terms.seoDesc'),
      url: window.location.href,
      robots: 'index, follow',
    });
  }, [isPrivacy]);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 animate-fade-in">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
          {t(isPrivacy ? 'legal.privacy.title' : 'legal.terms.title')}
        </h1>
        <p className="text-text-muted mt-2">{t('legal.updated')}</p>
      </header>

      {isPrivacy ? (
        <>
          <Section title={t('legal.privacy.overview.title')}>
            <P>{t('legal.privacy.overview.p1')}</P>
            <P>{t('legal.privacy.overview.p2')}</P>
          </Section>

          <Section title={t('legal.privacy.collect.title')}>
            <P>{t('legal.privacy.collect.intro')}</P>
            <ul className="space-y-2">
              <LI>
                <strong className="text-text-primary">{t('legal.privacy.collect.account')}</strong>
              </LI>
            </ul>
          </Section>

          <Section title={t('legal.privacy.use.title')}>
            <ul className="space-y-2">
              <LI>{t('legal.privacy.use.l1')}</LI>
              <LI>{t('legal.privacy.use.l2')}</LI>
              <LI>{t('legal.privacy.use.l3')}</LI>
            </ul>
            <P>{t('legal.privacy.use.p1')}</P>
          </Section>

          <Section title={t('legal.privacy.cookies.title')}>
            <P>{t('legal.privacy.cookies.p1')}</P>
          </Section>

          <Section title={t('legal.privacy.security.title')}>
            <P>{t('legal.privacy.security.p1')}</P>
          </Section>

          <Section title={t('legal.privacy.thirdparty.title')}>
            <P>{t('legal.privacy.thirdparty.p1')}</P>
          </Section>

          <Section title={t('legal.privacy.rights.title')}>
            <P>{t('legal.privacy.rights.p1')}</P>
          </Section>

          <Section title={t('legal.privacy.children.title')}>
            <P>{t('legal.privacy.children.p1')}</P>
          </Section>

          <Section title={t('legal.privacy.changes.title')}>
            <P>{t('legal.privacy.changes.p1')}</P>
          </Section>

          <Section title={t('legal.privacy.contact.title')}>
            <P>
              {t('legal.privacy.contact.p1')}{' '}
              <Link to="/contact" className="text-accent-indigo hover:text-accent-cyan transition-colors">{t('legal.privacy.contact.link')}</Link>.
            </P>
          </Section>
        </>
      ) : (
        <>
          <Section title={t('legal.terms.acceptance.title')}>
            <P>{t('legal.terms.acceptance.p1')}</P>
          </Section>

          <Section title={t('legal.terms.service.title')}>
            <P>{t('legal.terms.service.p1')}</P>
          </Section>

          <Section title={t('legal.terms.accounts.title')}>
            <P>{t('legal.terms.accounts.p1')}</P>
          </Section>

          <Section title={t('legal.terms.reuse.title')}>
            <P>{t('legal.terms.reuse.p1')}</P>
            <ul className="space-y-2">
              <LI>{t('legal.terms.reuse.l1')}</LI>
              <LI>{t('legal.terms.reuse.l2')}</LI>
              <LI>{t('legal.terms.reuse.l3')}</LI>
              <LI>{t('legal.terms.reuse.l4')}</LI>
            </ul>
          </Section>

          <Section title={t('legal.terms.ip.title')}>
            <P>{t('legal.terms.ip.p1')}</P>
          </Section>

          <Section title={t('legal.terms.acceptable.title')}>
            <ul className="space-y-2">
              <LI>{t('legal.terms.acceptable.l1')}</LI>
              <LI>{t('legal.terms.acceptable.l2')}</LI>
              <LI>{t('legal.terms.acceptable.l3')}</LI>
              <LI>{t('legal.terms.acceptable.l4')}</LI>
            </ul>
          </Section>

          <Section title={t('legal.terms.disclaimer.title')}>
            <P>{t('legal.terms.disclaimer.p1')}</P>
          </Section>

          <Section title={t('legal.terms.liability.title')}>
            <P>{t('legal.terms.liability.p1')}</P>
          </Section>

          <Section title={t('legal.terms.changes.title')}>
            <P>{t('legal.terms.changes.p1')}</P>
          </Section>

          <Section title={t('legal.terms.contact.title')}>
            <P>
              {t('legal.terms.contact.p1')}{' '}
              <Link to="/contact" className="text-accent-indigo hover:text-accent-cyan transition-colors">{t('legal.terms.contact.link')}</Link>.
            </P>
          </Section>
        </>
      )}
    </div>
  );
}
