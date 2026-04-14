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
    href: 'incoming.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  },
  {
    id: 'outgoing',
    label: 'Outgoing',
    href: 'outgoing.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  },
  {
    id: 'tracking',
    label: 'Tracking & status',
    href: '#',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  },
  {
    id: 'settings',
    label: 'System Configuration',
    href: 'system_config.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><line x1="8" y1="7" x2="8" y2="7"/><line x1="16" y1="17" x2="16" y2="17"/></svg>',
  },
];

/**
 * @param {{ activeId?: string; onSelect?: (id: string) => void }} [options]
 */
export function createSidebar({ activeId = 'dashboard', onSelect } = {}) {
  const aside = document.createElement('aside');
  aside.className = 'admin-sidebar';
  aside.innerHTML = `
    <div class="admin-sidebar__head">
      <p class="admin-sidebar__eyebrow">Navigation</p>
      <p class="admin-sidebar__title">Admin</p>
    </div>
    <nav class="admin-sidebar__nav" aria-label="Main">
      <ul class="admin-sidebar__list">
        ${NAV_ITEMS.map(
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
