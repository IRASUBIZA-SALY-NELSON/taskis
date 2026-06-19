'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ size = 30 }: { size?: number }) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Light is the default; only an explicit 'dark' preference is dark.
    setIsLight(localStorage.getItem('theme') !== 'dark');
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

  const icon = size - 15;

  return (
    <button
      onClick={toggleTheme}
      className="icon-btn"
      style={{ width: size, height: size }}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label="Toggle theme"
    >
      {isLight ? <Moon style={{ width: icon, height: icon }} /> : <Sun style={{ width: icon, height: icon }} />}
    </button>
  );
}
