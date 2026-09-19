import React from 'react';
import AuthScreen from '../components/AuthScreen';

/** Landing route: invite-key signup or login, then redirect into the app. */
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <AuthScreen />
    </main>
  );
}
