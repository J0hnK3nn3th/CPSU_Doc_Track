const API_URL = "https://cpsu-doc-track-1.onrender.com";

export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}
