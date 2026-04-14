const API_URL = String(globalThis.CPSU_API_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_URL ? `${API_URL}${normalizedPath}` : normalizedPath;
}
