'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

type Step = 'INIT' | 'SET_PASS' | 'LOGIN';

const copy: Record<Step, { eyebrow: string; title: string; subtitle: (u: string) => string }> = {
  INIT: {
    eyebrow: 'Secure access',
    title: 'Enter your access key',
    subtitle: () => 'Paste the secure key from your invitation to continue.',
  },
  SET_PASS: {
    eyebrow: 'Almost there',
    title: 'Set your passphrase',
    subtitle: (u) => `Key accepted for ${u || 'your codename'}. Choose a passphrase to secure the account.`,
  },
  LOGIN: {
    eyebrow: 'Welcome back',
    title: 'Log in',
    subtitle: () => 'Enter your codename and passphrase to reconnect.',
  },
};

export default function AuthScreen() {
  const [step, setStep] = useState<Step>('INIT');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const api = (path: string) => `http://${window.location.hostname}:8080${path}`;

  const handleInitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(api('/api/auth/access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.status === 'REQUIRES_PASSPHRASE') {
        setUsername(data.username);
        setStep('SET_PASS');
      } else {
        throw new Error('Invalid access key');
      }
    } catch (err: any) {
      setError(err.message || 'Access denied');
    }
    setLoading(false);
  };

  const handleSetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(api('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, passphrase }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.status === 'AUTHENTICATED') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/chat');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
    setLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(api('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passphrase }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.status === 'AUTHENTICATED') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/chat');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  const goLogin = () => { setStep('LOGIN'); setError(''); setUsername(''); setPassphrase(''); };
  const goAccess = () => { setStep('INIT'); setError(''); setToken(''); setPassphrase(''); };

  const c = copy[step];
  const Spinner = () => (
    <span className="w-[15px] h-[15px] rounded-full border-2 border-white/35 border-t-white tk-spin" />
  );
  const ErrorLine = () =>
    error ? (
      <div className="flex items-center gap-1.5 mt-2.5 text-[12.5px] text-danger">
        <AlertCircle className="w-[13px] h-[13px] flex-none" />
        <span>{error}</span>
      </div>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="card relative w-[404px] max-w-full"
      style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)', padding: '34px 34px 30px' }}
    >
      {step === 'LOGIN' && (
        <button onClick={goAccess} aria-label="Back" className="icon-btn absolute top-[22px] left-5 w-[30px] h-[30px]">
          <ChevronLeft className="w-[15px] h-[15px]" />
        </button>
      )}
      <div className="absolute top-[18px] right-[18px]">
        <ThemeToggle />
      </div>

      {/* lockup */}
      <div className="flex items-center justify-center gap-2.5 mb-[26px]">
        <span className="tk-mark" style={{ width: 30, height: 30, borderRadius: 9 }}>
          <i style={{ width: 7, height: 7 }} />
          <b style={{ width: 2.5, height: 5 }} />
        </span>
        <span className="serif text-[21px] font-semibold text-t1">Taskis</span>
      </div>

      <div className="eyebrow text-center mb-2.5">{c.eyebrow}</div>
      <h1 className="serif text-center text-[23px] font-semibold text-t1 mb-[7px]">{c.title}</h1>
      <p className="text-center text-[13.5px] leading-[1.55] text-t2 mx-auto mb-6 max-w-[300px]">{c.subtitle(username)}</p>

      <AnimatePresence mode="wait">
        {step === 'INIT' && (
          <motion.form key="init" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleInitSubmit}>
            <input
              type="password"
              autoComplete="off"
              placeholder="Secure access key"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={`tk-input font-mono tracking-[0.04em] ${error ? 'is-error' : ''}`}
              required
            />
            <ErrorLine />
            <button type="submit" disabled={loading} className="btn-accent w-full mt-[18px] py-3 text-[14.5px]">
              {loading && <Spinner />}
              <span>{loading ? 'Verifying…' : 'Continue'}</span>
            </button>
            <button type="button" onClick={goLogin} className="block mx-auto mt-4 text-[13px] text-t2 hover:text-accent-text transition-colors">
              Already have a codename? <span className="text-accent-text font-medium">Log in</span>
            </button>
          </motion.form>
        )}

        {step === 'SET_PASS' && (
          <motion.form key="set" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} onSubmit={handleSetPassSubmit}>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Create a passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className={`tk-input ${error ? 'is-error' : ''}`}
              required
              autoFocus
            />
            <ErrorLine />
            <button type="submit" disabled={loading} className="btn-accent w-full mt-[18px] py-3 text-[14.5px]">
              {loading && <Spinner />}
              <span>{loading ? 'Setting…' : 'Create account'}</span>
            </button>
          </motion.form>
        )}

        {step === 'LOGIN' && (
          <motion.form key="login" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} onSubmit={handleLoginSubmit}>
            <div className="flex flex-col gap-2.5">
              <input
                type="text"
                autoComplete="username"
                placeholder="Codename"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="tk-input"
                required
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className={`tk-input ${error ? 'is-error' : ''}`}
                required
              />
            </div>
            <ErrorLine />
            <button type="submit" disabled={loading} className="btn-accent w-full mt-[18px] py-3 text-[14.5px]">
              {loading && <Spinner />}
              <span>{loading ? 'Authenticating…' : 'Log in'}</span>
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
