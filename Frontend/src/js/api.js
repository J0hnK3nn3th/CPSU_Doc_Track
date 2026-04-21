const API_URL = String(globalThis.CPSU_API_URL || '')
  .trim()
  .replace(/\/+$/, '');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let fetchWrapped = false;

export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_URL ? `${API_URL}${normalizedPath}` : normalizedPath;
}

function shouldAttachLogHeaders(url, options = {}) {
  const method = String(options?.method || 'GET').toUpperCase();
  if (!MUTATING_METHODS.has(method)) return false;
  return typeof url === 'string' && url.includes('/api/');
}

function extractActionName(url, options = {}) {
  const method = String(options?.method || 'GET').toUpperCase();
  const route = String(url || '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/\?.*$/, '');
  return `${method} ${route}`.slice(0, 120);
}

export function initializeApiLogging() {
  if (fetchWrapped || typeof globalThis.fetch !== 'function') return;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init = {}) => {
    const nextInit = { ...init };
    const requestUrl = typeof input === 'string' ? input : String(input?.url || '');
    if (shouldAttachLogHeaders(requestUrl, nextInit)) {
      const headers = new Headers(nextInit.headers || {});
      headers.set('X-Activity-Action', extractActionName(requestUrl, nextInit));
      headers.set('X-Activity-Source', 'FRONTEND');
      nextInit.headers = headers;
    }
    return originalFetch(input, nextInit);
  };
  fetchWrapped = true;
}

initializeApiLogging();
