'use client';

import { useEffect, RefObject } from 'react';

const SELECTOR = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

/** Trap Tab focus within `ref` while `active`, and restore focus on close. */
export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const prev = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );

    const id = setTimeout(() => {
      const f = focusables();
      (f[0] || root).focus?.();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    root.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      root.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [active, ref]);
}
