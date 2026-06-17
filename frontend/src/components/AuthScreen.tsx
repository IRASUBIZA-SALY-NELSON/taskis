'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Lock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

export default function AuthScreen() {
  const [step, setStep] = useState('INIT'); // INIT, SET_PASS, LOGIN
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleInitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`http://${window.location.hostname}:8080/api/auth/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data.status === 'REQUIRES_PASSPHRASE') {
         setUsername(data.username);
         setStep('SET_PASS');
      } else {
         throw new Error('Invalid Access Token');
      }
    } catch (err: any) {
      setError(err.message || 'Access Denied');
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
      const res = await fetch(`http://${window.location.hostname}:8080/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, passphrase })
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
      const res = await fetch(`http://${window.location.hostname}:8080/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passphrase })
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-8 rounded-2xl w-full"
    >
      <div className="flex items-center justify-between mb-6 border-b border-primary/20 pb-4">
        <div className="w-8"></div>
        <h2 className="text-xl font-bold tracking-widest text-primary glow-text uppercase">TERMINAL ACCESS</h2>
        <div className="w-8 flex justify-end"><ThemeToggle /></div>
      </div>

      {error && <div className="mb-4 text-red-400 text-sm text-center font-bold bg-red-500/10 p-2 rounded">{error}</div>}

      <AnimatePresence mode="wait">

      {step === 'INIT' && (
        <motion.form key="init" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onSubmit={handleInitSubmit} className="space-y-5">
          <div className="text-sm text-text-muted mb-4 text-center">Enter your 128-bit Secure Key to access the terminal.</div>
          <div className="relative group">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-colors" />
            <input
              type="password"
              placeholder="Secure Access Key"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-surface-light/50 border border-border rounded-lg py-3 pl-10 pr-4 text-text placeholder-text-muted focus:outline-none glow-border transition-all"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg btn-primary text-surface font-bold tracking-wider mt-4 disabled:opacity-50">
            {loading ? 'PROCESSING...' : 'ACCESS SECURE LINK'}
          </button>

          <div className="text-center mt-6">
            <button type="button" onClick={() => { setStep('LOGIN'); setError(''); setUsername(''); setPassphrase(''); }} className="text-sm text-text-muted hover:text-primary transition-colors underline decoration-white/20 underline-offset-4">
              login
            </button>
          </div>
        </motion.form>
      )}

      {step === 'SET_PASS' && (
        <motion.form key="set_pass" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} onSubmit={handleSetPassSubmit} className="space-y-5">
          <div className="text-sm text-text-muted mb-4 text-center">Key accepted for <strong className="text-primary">{username}</strong>. Set your secure passphrase.</div>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-colors" />
            <input
              type="password"
              placeholder="Setup Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full bg-surface-light/50 border border-border rounded-lg py-3 pl-10 pr-4 text-text placeholder-text-muted focus:outline-none glow-border transition-all"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg btn-primary text-surface font-bold tracking-wider mt-4 disabled:opacity-50">
            {loading ? 'SETTING...' : 'FINALIZE REGISTRATION'}
          </button>
        </motion.form>
      )}

      {step === 'LOGIN' && (
        <motion.form key="login" initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:20}} onSubmit={handleLoginSubmit} className="space-y-5">
          <div className="text-sm text-text-muted mb-4 text-center">Enter your Codename and Passphrase to reconnect.</div>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Codename"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-light/50 border border-border rounded-lg py-3 pl-10 pr-4 text-text placeholder-text-muted focus:outline-none glow-border transition-all"
              required
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-colors" />
            <input
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full bg-surface-light/50 border border-border rounded-lg py-3 pl-10 pr-4 text-text placeholder-text-muted focus:outline-none glow-border transition-all"
              required
            />
          </div>
          <div className="flex gap-3">
             <button type="button" onClick={() => { setStep('INIT'); setError(''); setToken(''); }} className="py-3 px-4 rounded-lg bg-surface-light text-text-muted font-bold tracking-wider hover:text-text transition-colors border border-border">BACK</button>
             <button type="submit" disabled={loading} className="flex-1 py-3 rounded-lg btn-primary text-surface font-bold tracking-wider disabled:opacity-50">
               {loading ? 'AUTHENTICATING...' : 'ACCESS'}
             </button>
          </div>
        </motion.form>
      )}

      </AnimatePresence>
    </motion.div>
  );
}
