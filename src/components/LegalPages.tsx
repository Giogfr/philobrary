import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
      title: isPrivacy ? 'Privacy Policy' : 'Terms of Service',
      description: isPrivacy
        ? 'How Philobrary collects, uses, and protects your information.'
        : 'The terms and conditions for using the Philobrary philosophy essay library.',
      url: window.location.href,
      robots: 'index, follow',
    });
  }, [isPrivacy]);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 animate-fade-in">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
          {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
        </h1>
        <p className="text-text-muted mt-2">Last updated: August 14, 2026</p>
      </header>

      {isPrivacy ? (
        <>
          <Section title="Overview">
            <P>
              Philobrary ("we", "us", or "the site") is a digital library of philosophy essays, thinkers,
              and original research. This Privacy Policy explains what information we collect when you use the
              site, how we use it, and the choices you have.
            </P>
            <P>
              By using the site, you agree to the practices described in this policy. If you do not agree,
              please do not use the site.
            </P>
          </Section>

          <Section title="Information We Collect">
            <P>We collect the following information:</P>
            <ul className="space-y-2">
              <LI>
                <strong className="text-text-primary">Account information.</strong> If you choose to sign in
                (for example, to bookmark essays), we receive your email address and display name from your
                sign-in provider (Google). Your bookmarked essays are stored and associated with your account.
              </LI>
            </ul>
          </Section>

          <Section title="How We Use Your Information">
            <ul className="space-y-2">
              <LI>To operate and personalize the site, including bookmarks, language preference, and reading history.</LI>
              <LI>To keep the site secure and to prevent abuse.</LI>
              <LI>To communicate with you if you contact us.</LI>
            </ul>
            <P>We do not sell your personal information to anyone.</P>
          </Section>

          <Section title="Cookies and Local Storage">
            <P>
              We use your browser's local storage to remember your preferences (such as theme and language)
              and your bookmarked essays. We may use cookies for essential functionality.
            </P>
          </Section>

          <Section title="Data Storage and Security">
            <P>
              Information is stored with our hosting and database providers (Google Firebase). We take
              reasonable measures to protect your data, but no method of transmission or storage is
              completely secure. You should use a strong password and protect your sign-in credentials.
            </P>
          </Section>

          <Section title="Third-Party Services">
            <P>
              We use third-party services that may process data on our behalf, including Google Firebase
              (authentication and database) and Google Fonts (typography). These providers have their own
              privacy policies.
            </P>
          </Section>

          <Section title="Your Rights">
            <P>
              Depending on where you live, you may have the right to access, correct, export, or delete the
              personal information we hold about you, and to object to certain processing. To exercise these
              rights, contact us using the details below.
            </P>
          </Section>

          <Section title="Children's Privacy">
            <P>
              The site is not directed to children under the age of 13, and we do not knowingly collect
              personal information from children.
            </P>
          </Section>

          <Section title="Changes to This Policy">
            <P>
              We may update this policy from time to time. The "Last updated" date at the top of this page
              indicates when it was last changed. Significant changes will be noted on the site.
            </P>
          </Section>

          <Section title="Contact">
            <P>
              If you have questions about this Privacy Policy or your data, please contact us through the
              <a href="/contact" className="text-accent-indigo hover:text-accent-cyan transition-colors"> contact page</a>.
            </P>
          </Section>
        </>
      ) : (
        <>
          <Section title="Acceptance of Terms">
            <P>
              These Terms of Service ("Terms") govern your use of the Philobrary website and any content,
              features, or services it provides. By accessing or using the site, you agree to be bound by
              these Terms. If you do not agree, please do not use the site.
            </P>
          </Section>

          <Section title="Description of the Service">
            <P>
              Philobrary is a digital library that publishes philosophy essays, thinkers, and original
              research, available in multiple languages. We may add, change, remove, or update content and
              features at any time without notice.
            </P>
          </Section>

          <Section title="User Accounts">
            <P>
              You may create an account to use certain features such as bookmarking essays. You are
              responsible for keeping your credentials secure and for all activity under your account.
              You must be at least 13 years old to create an account.
            </P>
          </Section>

          <Section title="Content Usage and Reuse">
            <P>
              The original essays and research published on this site belong to their respective authors and
              are protected by copyright law. We welcome citation and reuse of this work for personal,
              educational, and non-commercial purposes under the following terms:
            </P>
            <ul className="space-y-2">
              <LI>
                You may quote from the essays, including for academic papers, blog posts, videos, and social
                media, as long as you clearly credit the author and link back to the original essay on this
                website.
              </LI>
              <LI>
                When reusing content, please include the author's name and a visible link to the source page
                on Philobrary (or state the title and author if linking is not possible).
              </LI>
              <LI>
                You may not republish, reproduce, or distribute the full text of an essay, or sell the
                content in any form, without prior written permission from the author.
              </LI>
              <LI>
                If you are unsure whether your use is permitted, or you would like permission to republish
                the full text, please contact us before doing so.
              </LI>
            </ul>
          </Section>

          <Section title="Intellectual Property">
            <P>
              The original essays and research published on this site belong to their respective authors and
              are protected by copyright law. You may read and share links to the content for personal,
              non-commercial use, and you may quote and reuse portions with attribution as described in the
              "Content Usage and Reuse" section above. You may not republish, reproduce, or distribute the
              full text of essays without permission.
            </P>
          </Section>

          <Section title="Acceptable Use">
            <ul className="space-y-2">
              <LI>Do not use the site for any unlawful purpose.</LI>
              <LI>Do not attempt to disrupt, overload, or gain unauthorized access to the site or its systems.</LI>
              <LI>Do not scrape or bulk-copy content beyond reasonable personal use.</LI>
              <LI>Do not impersonate others or misrepresent your relationship with the site.</LI>
            </ul>
          </Section>

          <Section title="Disclaimer of Warranties">
            <P>
              The content on this site is provided for informational and educational purposes and does not
              constitute professional advice (legal, medical, financial, or otherwise). While we strive for
              accuracy, the site is provided "as is" and without warranties of any kind, express or implied.
            </P>
          </Section>

          <Section title="Limitation of Liability">
            <P>
              To the fullest extent permitted by law, Philobrary and its operators shall not be liable for
              any indirect, incidental, special, or consequential damages arising from your use of the site.
            </P>
          </Section>

          <Section title="Changes to These Terms">
            <P>
              We may update these Terms from time to time. Continued use of the site after changes are posted
              constitutes acceptance of the revised Terms.
            </P>
          </Section>

          <Section title="Contact">
            <P>
              If you have questions about these Terms, please contact us through the
              <a href="/contact" className="text-accent-indigo hover:text-accent-cyan transition-colors"> contact page</a>.
            </P>
          </Section>
        </>
      )}
    </div>
  );
}
