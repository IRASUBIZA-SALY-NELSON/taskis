'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Check initial state
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'light') {
      setIsLight(true);
    }
  }, []);

  const toggleTheme = () => {
    if (isLight) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setIsLight(false);
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
      setIsLight(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-surface-light border border-border hover:bg-bg-hover transition-colors text-text-muted hover:text-primary flex items-center justify-center"
      title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}
