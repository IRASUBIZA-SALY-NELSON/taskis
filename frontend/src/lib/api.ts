/** API origin. HTTPS pages stay same-origin so the browser does not block mixed content. */
export function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE;
  if (env) return env.replace(/\/$/, '');
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'https:') return '';
  return `http://${window.location.hostname}:8080`;
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase()}${p}`;
}

export function wsUrl(): string {
  const env = process.env.NEXT_PUBLIC_WS_BASE || process.env.NEXT_PUBLIC_API_BASE;
  if (env) return `${env.replace(/\/$/, '')}/ws`;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `${window.location.protocol}//${window.location.host}/ws`;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:8080/ws`;
}
