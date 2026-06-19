// Some browser libraries (e.g. sockjs-client) expect a Node-style `global`.
// This module must be imported BEFORE those libraries so the reference exists
// at their module-evaluation time (ES module imports run in source order).
if (typeof window !== 'undefined' && typeof (window as { global?: unknown }).global === 'undefined') {
  (window as unknown as { global: unknown }).global = window;
}

export {};
