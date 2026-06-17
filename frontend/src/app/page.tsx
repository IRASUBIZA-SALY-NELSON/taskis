import React from 'react';
import AuthScreen from '../components/AuthScreen';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary glow-text">TASKIS</span>
          </h1>
          <p className="text-text-muted">Secure Comm Link v2.0</p>
        </div>

        <AuthScreen />
      </div>
    </main>
  );
}
