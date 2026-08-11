import React, { useState } from 'react';
import { X, User, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { t } from '../i18n';

interface AdminLoginProps {
  onClose: () => void;
  onLogin: (email: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useStore();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast('toast.accountCreated', 'success');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('toast.signedIn', 'success');
      }
      onLogin(auth.currentUser?.email || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('toast.signedInGoogle', 'success');
      onLogin(auth.currentUser?.email || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-md">
      <div className="relative w-full max-w-md p-8 bg-bg-card border border-border-subtle shadow-2xl rounded-3xl">
        <button 
          onClick={onClose}
          className="absolute top-4 end-4 p-2 text-text-secondary hover:text-text-primary transition-colors bg-bg-secondary hover:bg-bg-hover rounded-full"
        >
          <X size={20} />
        </button>
        
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-accent-indigo/10 text-accent-indigo shadow-lg shadow-accent-indigo/10">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">{isRegistering ? t('login.register') : t('login.title')}</h2>
          <p className="mt-2 text-text-secondary">{t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="p-4 mb-6 text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl flex items-start">
            <AlertTriangle size={18} className="me-2 shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <div>
            <label className="block mb-2 text-sm font-medium text-text-secondary">{t('login.email')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-4 text-text-muted">
                <User size={18} />
              </div>
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full py-3 ps-11 pe-4 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 focus:border-accent-indigo transition-all disabled:opacity-50"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block mb-2 text-sm font-medium text-text-secondary">{t('login.password')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-4 text-text-muted">
                <Lock size={18} />
              </div>
              <input 
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full py-3 ps-11 pe-4 bg-bg-secondary border border-border-subtle text-text-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 focus:border-accent-indigo transition-all disabled:opacity-50"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center w-full py-3.5 mt-2 font-medium text-white transition-all duration-300 ease-out bg-accent-indigo hover:bg-accent-cyan hover:shadow-lg hover:shadow-accent-indigo/20 rounded-2xl group disabled:opacity-50 disabled:bg-bg-hover disabled:shadow-none disabled:cursor-not-allowed"
          >
            {isRegistering ? t('login.register') : t('login.signin')}
            <ArrowRight size={18} className="ms-2 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-text-secondary">
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="hover:text-accent-indigo transition-colors"
          >
            {isRegistering ? t('login.toggleLogin') : t('login.toggleRegister')}
          </button>
        </div>

        <div className="my-6 flex items-center">
          <div className="flex-1 h-px bg-border-subtle"></div>
          <span className="px-3 text-sm text-text-muted">{t('login.or')}</span>
          <div className="flex-1 h-px bg-border-subtle"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex items-center justify-center w-full py-3.5 font-medium text-text-primary transition-all duration-300 ease-out bg-bg-secondary border border-border-subtle hover:bg-bg-hover rounded-2xl disabled:opacity-50"
        >
          <svg className="w-5 h-5 me-3" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t('login.google')}
        </button>
      </div>
    </div>
  );
};
