import './uheader.css';
import logoUrl from '../images/cpsu logo.png';
import { apiUrl } from '../js/api.js';

function getCookie(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

async function logoutUser() {
  await fetch(apiUrl('/api/auth/csrf/'), { credentials: 'include' }).catch(() => null);
  const csrfToken = getCookie('csrftoken');
  const response = await fetch(apiUrl('/api/auth/logout/'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
  }).catch(() => null);

  if (!response) {
    window.location.assign('/login.html');
    return;
  }

  if (!response.ok && ![401, 403].includes(response.status)) {
    throw new Error(`Logout failed (${response.status})`);
  }

  // Treat unauthorized/forbidden as already logged out and redirect.
  if ([401, 403].includes(response.status)) {
    window.location.assign('/login.html');
    return;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const redirectTarget =
    typeof payload.redirect === 'string' && payload.redirect ? payload.redirect : '/login.html';
  window.location.assign(redirectTarget);
}

async function loadCurrentUserProfile() {
  try {
    const response = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload && payload.authenticated ? payload : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ onMenuToggle?: () => void }} [options]
 */
export function createHeader({ onMenuToggle } = {}) {
  const header = document.createElement('header');
  header.className = 'admin-header';
  header.innerHTML = `
    <button type="button" class="admin-header__menu" aria-label="Toggle navigation menu">
      <span class="admin-header__menu-bar" aria-hidden="true"></span>
      <span class="admin-header__menu-bar" aria-hidden="true"></span>
      <span class="admin-header__menu-bar" aria-hidden="true"></span>
    </button>
    <div class="admin-header__brand">
      <img
        class="admin-header__logo"
        src="${logoUrl}"
        alt="Carlos Hilado Memorial State University"
        width="40"
        height="40"
        decoding="async"
      />
      <div class="admin-header__titles">
        <span class="admin-header__app">CPSU Document Track</span>
       
      </div>
    </div>
    <div class="admin-header__spacer" aria-hidden="true"></div>
    <div class="admin-header__actions">
      <button type="button" class="admin-header__icon-btn" aria-label="Notifications" title="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>
      <div class="admin-header__user-dropdown">
        <button
          type="button"
          class="admin-header__user"
          aria-haspopup="true"
          aria-expanded="false"
          aria-label="User menu"
        >
          <span class="admin-header__user-avatar" aria-hidden="true">A</span>
          <span class="admin-header__user-name">Admin</span>
        </button>
        <div class="admin-header__dropdown-menu" hidden>
          <button type="button" class="admin-header__dropdown-item" data-action="logout">Log Out</button>
        </div>
      </div>
    </div>
  `;

  const menuBtn = header.querySelector('.admin-header__menu');
  menuBtn?.addEventListener('click', () => onMenuToggle?.());

  const userDropdown = header.querySelector('.admin-header__user-dropdown');
  const userBtn = header.querySelector('.admin-header__user');
  const dropdownMenu = header.querySelector('.admin-header__dropdown-menu');
  const logoutBtn = header.querySelector('[data-action="logout"]');
  const userNameEl = header.querySelector('.admin-header__user-name');
  const userAvatarEl = header.querySelector('.admin-header__user-avatar');

  loadCurrentUserProfile().then((profile) => {
    if (!profile) return;

    const firstName = String(profile.first_name || '').trim();
    const lastName = String(profile.last_name || '').trim();
    const username = String(profile.username || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || username || 'User';
    const initialsSource = `${firstName}${lastName}`.trim() || fullName;
    const avatarInitial = initialsSource.charAt(0).toUpperCase() || 'U';

    if (userNameEl) userNameEl.textContent = fullName;
    if (userAvatarEl) userAvatarEl.textContent = avatarInitial;
  });

  if (userDropdown && userBtn && dropdownMenu) {
    const closeDropdown = () => {
      userBtn.setAttribute('aria-expanded', 'false');
      dropdownMenu.hidden = true;
    };

    userBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = userBtn.getAttribute('aria-expanded') === 'true';
      userBtn.setAttribute('aria-expanded', String(!isOpen));
      dropdownMenu.hidden = isOpen;
    });

    dropdownMenu.addEventListener('click', (event) => event.stopPropagation());

    document.addEventListener('click', () => closeDropdown());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    });
  }

  logoutBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await logoutUser();
    } catch {
      window.alert('Unable to log out right now. Please try again.');
    }
  });

  return header;
}
