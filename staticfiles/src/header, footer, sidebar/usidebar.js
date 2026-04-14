const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: 'admin.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  },
  {
    id: 'incoming',
    label: 'Incoming',
    href: 'uincoming.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  },
  {
    id: 'outgoing',
    label: 'Outgoing',
    href: 'uoutgoing.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  },
];

/**
 * @param {{
 *   activeId?: string;
 *   onSelect?: (id: string) => void;
 *   isAdmin?: boolean;
 *   dashboardHref?: string;
 * }} [options]
 */
export function createSidebar({ activeId = 'dashboard', onSelect, isAdmin = true, dashboardHref = 'admin.html' } = {}) {
  const visibleIds = isAdmin
    ? NAV_ITEMS.map((item) => item.id)
    : ['dashboard', 'incoming', 'outgoing'];
  const items = NAV_ITEMS
    .filter((item) => visibleIds.includes(item.id))
    .map((item) => (item.id === 'dashboard' ? { ...item, href: dashboardHref } : item));

  const aside = document.createElement('aside');
  aside.className = 'admin-sidebar';
  aside.innerHTML = `
    <div class="admin-sidebar__head">
      <p class="admin-sidebar__eyebrow">Navigation</p>
      <p class="admin-sidebar__title">${isAdmin ? 'Admin' : 'User'}</p>
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
      <p class="admin-sidebar__hint">Document routing &amp; compliance</p>
    </div>
  `;

  aside.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const id = el.getAttribute('data-nav');
      if (!id) return;
      const href = el.getAttribute('href') || '#';
      const navigatesAway = href !== '#' && href !== '';
      if (navigatesAway) {
        onSelect?.(id);
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
