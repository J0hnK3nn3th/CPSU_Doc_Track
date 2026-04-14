const API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_URL) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}
