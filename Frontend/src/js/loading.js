const OVERLAY_ID = 'app-loading-overlay';
let initialized = false;
let authCheckInFlight = null;
const LOGOUT_LOCK_KEY = 'auth.logoutLock';

const PUBLIC_ROUTE_PATTERN = /(?:^\/$|\/index\.html$|\/login\.html$)/i;
const PROTECTED_ROUTE_PATTERN = /\/(?:admin|user|cuser|incoming|outgoing|logs|system_config|completed|uincoming|uoutgoing|ulogs|ucincoming|uclogs)\.html$/i;

function ensureStyles() {
  if (document.getElementById('app-loading-styles')) return;
  const style = document.createElement('style');
  style.id = 'app-loading-styles';
  style.textContent = `
    .app-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      background: transparent;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      opacity: 0;
      pointer-events: none;
    }

    .app-loading-overlay--visible {
      opacity: 1;
      pointer-events: auto;
    }

    .app-loading-overlay__spinner {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 3px solid #d8e8d3;
      border-top-color: #84b179;
      animation: app-loading-spin 0.78s linear infinite;
    }

    @keyframes app-loading-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.append(style);
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'app-loading-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <span class="app-loading-overlay__spinner" role="status" aria-live="polite" aria-label="Loading"></span>
  `;
  document.body.append(overlay);
  return overlay;
}

export function showLoading() {
  ensureStyles();
  const overlay = ensureOverlay();
  overlay.classList.add('app-loading-overlay--visible');
  overlay.setAttribute('aria-hidden', 'false');
}

export function hideLoading() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  overlay.classList.remove('app-loading-overlay--visible');
  overlay.setAttribute('aria-hidden', 'true');
}

export function navigateWithLoading(url) {
  if (!url) return;
  showLoading();
  // Let the browser paint the spinner before unloading the page.
  requestAnimationFrame(() => {
    window.location.assign(url);
  });
}

export function replaceWithLoading(url) {
  if (!url) return;
  showLoading();
  requestAnimationFrame(() => {
    window.location.replace(url);
  });
}

function isProtectedRoute(pathname = window.location.pathname) {
  if (PUBLIC_ROUTE_PATTERN.test(pathname)) return false;
  return PROTECTED_ROUTE_PATTERN.test(pathname);
}

async function redirectIfSessionExpired() {
  if (!isProtectedRoute()) return;
  if (authCheckInFlight) {
    await authCheckInFlight;
    return;
  }

  authCheckInFlight = (async () => {
    try {
      const res = await fetch('/api/auth/me/', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) return;
    } catch {
      // Network failures should not hard-redirect users.
      return;
    }
    try {
      window.sessionStorage.setItem(LOGOUT_LOCK_KEY, '1');
    } catch {
      // Ignore storage errors.
    }
    replaceWithLoading('/');
  })();

  try {
    await authCheckInFlight;
  } finally {
    authCheckInFlight = null;
  }
}

function shouldHandleLinkClick(event, link) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== '_self') return false;
  const href = link.getAttribute('href') || '';
  if (!href || href === '#') return false;
  if (href.startsWith('javascript:')) return false;
  return true;
}

export function initNavigationLoading() {
  if (initialized) return;
  initialized = true;

  ensureStyles();

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[href]');
    if (!link) return;
    if (!shouldHandleLinkClick(event, link)) return;
    showLoading();
  });

  window.addEventListener('load', hideLoading, { once: true });
  window.addEventListener('pageshow', () => {
    hideLoading();
    void redirectIfSessionExpired();
  });
  void redirectIfSessionExpired();
}
