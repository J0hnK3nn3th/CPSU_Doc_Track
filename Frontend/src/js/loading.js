const OVERLAY_ID = 'app-loading-overlay';
let initialized = false;

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
  window.addEventListener('pageshow', hideLoading);
}
