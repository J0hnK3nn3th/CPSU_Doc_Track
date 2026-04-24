import { initNavigationLoading, navigateWithLoading } from '../js/loading.js';
import { apiUrl } from '../js/api.js';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: 'cuser.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  },
  {
    id: 'incoming',
    label: 'Incoming',
    href: 'ucincoming.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  },
  {
    id: 'outgoing',
    label: 'Completed',
    href: 'ucoutgoing.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  },
  {
    id: 'reports',
    label: 'Reports',
    href: 'ucreports.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/></svg>',
  },
  {
    id: 'logs',
    label: 'Recent Logs',
    href: 'uclogs.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
  },
];

function getOfficeDepartmentLabel(user) {
  return String(
    user?.office_department ||
      user?.department ||
      user?.office_name ||
      user?.office ||
      '',
  ).trim();
}

async function loadCurrentUserOfficeDepartment() {
  try {
    const response = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
    if (!response.ok) return '';
    const user = await response.json();
    return getOfficeDepartmentLabel(user);
  } catch {
    return '';
  }
}

async function hydrateOfficeDepartment(aside, initialLabel = '') {
  const titleEl = aside.querySelector('.admin-sidebar__title');
  if (!titleEl) return;
  titleEl.textContent = initialLabel || 'Loading...';
  const fetched = await loadCurrentUserOfficeDepartment();
  titleEl.textContent = fetched || initialLabel || '';
}

/**
 * @param {{
 *   activeId?: string;
 *   onSelect?: (id: string) => void;
 *   isAdmin?: boolean;
 *   dashboardHref?: string;
 * }} [options]
 */
export function createSidebar({ activeId = 'dashboard', onSelect, isAdmin = true, dashboardHref = 'admin.html' } = {}) {
  initNavigationLoading();
  const visibleIds = isAdmin
    ? NAV_ITEMS.map((item) => item.id)
    : ['dashboard', 'incoming', 'outgoing', 'reports', 'logs'];
  const items = NAV_ITEMS
    .filter((item) => visibleIds.includes(item.id))
    .map((item) => {
      // Force navigation to only the allowed user pages.
      if (item.id === 'dashboard') return { ...item, href: 'cuser.html' };
      if (item.id === 'incoming') return { ...item, href: 'ucincoming.html' };
      if (item.id === 'outgoing') return { ...item, href: 'ucoutgoing.html' };
      if (item.id === 'reports') return { ...item, href: 'ucreports.html' };
      if (item.id === 'logs') return { ...item, href: 'uclogs.html' };
      return item;
    });

  const aside = document.createElement('aside');
  aside.className = 'admin-sidebar';
  const officeDepartmentLabel = isAdmin ? 'Admin' : '';
  aside.innerHTML = `
    <div class="admin-sidebar__head">
      <p class="admin-sidebar__eyebrow">Office/Department:</p>
      <p class="admin-sidebar__title">${officeDepartmentLabel}</p>
    </div>
    <nav class="admin-sidebar__nav" aria-label="Main">
      <ul class="admin-sidebar__list">
        ${items.map(
          (item) => `
          <li>
            <a
              class="admin-sidebar__link${item.id === activeId ? ' admin-sidebar__link--active' : ''}"
              href="${item.href}"
              data-nav="${item.id}"
            >
              <span class="admin-sidebar__icon">${item.icon}</span>
              <span class="admin-sidebar__label">${item.label}</span>
            </a>
          </li>
        `,
        ).join('')}
      </ul>
    </nav>
    <div class="admin-sidebar__foot">
      <p class="admin-sidebar__hint">CPSU Document Tracking System</p>
    </div>
  `;

  if (!isAdmin) {
    void hydrateOfficeDepartment(aside, officeDepartmentLabel);
  }

  aside.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const id = el.getAttribute('data-nav');
      if (!id) return;
      const href = el.getAttribute('href') || '#';
      const navigatesAway = href !== '#' && href !== '';
      if (navigatesAway) {
        e.preventDefault();
        onSelect?.(id);
        navigateWithLoading(href);
        return;
      }
      e.preventDefault();
      aside.querySelectorAll('.admin-sidebar__link').forEach((link) => {
        link.classList.toggle('admin-sidebar__link--active', link.getAttribute('data-nav') === id);
      });
      onSelect?.(id);
    });
  });

  return aside;
}
