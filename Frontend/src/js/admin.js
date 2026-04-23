import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';
import { apiUrl } from './api.js';
import { navigateWithLoading } from './loading.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

function badgeClass(kind) {
  if (kind === 'success') return 'admin-badge admin-badge--success';
  if (kind === 'warning') return 'admin-badge admin-badge--warning';
  return 'admin-badge admin-badge--info';
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return new Intl.NumberFormat().format(numeric);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function activityBadge(action) {
  const token = String(action || '').toLowerCase();
  if (token.includes('failed') || token.includes('blocked') || token.includes('disable')) {
    return 'warning';
  }
  if (token.includes('success') || token.includes('create') || token.includes('forward') || token.includes('receive') || token.includes('complete') || token.includes('enable') || token.includes('update')) {
    return 'success';
  }
  return 'info';
}

function renderRecentLogs(main, rows) {
  const tbody = main.querySelector('#admin-recent-tbody');
  const tableWrap = main.querySelector('.admin-table-wrap');
  if (!tbody) return;
  if (tableWrap) {
    tableWrap.classList.toggle('admin-table-wrap--scroll', rows.length > 5);
  }
  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">No recent logs found.</td>
      </tr>
    `;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td><strong>${row.actor_role || 'System'}</strong></td>
        <td>${row.actor_full_name || 'System'}</td>
        <td><span class="${badgeClass(activityBadge(row.action))}">${row.action_display || row.action || '-'}</span></td>
        <td>${formatDateTime(row.created_at)}</td>
      </tr>
    `,
    )
    .join('');
}

async function loadRecentLogs(main) {
  try {
    const res = await fetch(apiUrl('/api/activity-logs/'), { credentials: 'include' });
    if (!res.ok) {
      renderRecentLogs(main, []);
      return;
    }
    const payload = await res.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows.slice(0, 20) : [];
    renderRecentLogs(main, rows);
  } catch {
    renderRecentLogs(main, []);
  }
}

async function loadDashboardStats(main) {
  const totalDocumentsEl = main.querySelector('#admin-stat-total-documents');
  const totalOfficesEl = main.querySelector('#admin-stat-total-offices');
  const totalUsersEl = main.querySelector('#admin-stat-total-users');
  const totalCompletedEl = main.querySelector('#admin-stat-total-completed');
  if (!totalDocumentsEl || !totalOfficesEl || !totalUsersEl || !totalCompletedEl) return;

  try {
    const [documentsRes, officesRes, usersRes] = await Promise.all([
      fetch(apiUrl('/api/outgoing-documents/'), { credentials: 'include' }),
      fetch(apiUrl('/api/system-config/offices/'), { credentials: 'include' }),
      fetch(apiUrl('/api/system-config/usersRoles/'), { credentials: 'include' }),
    ]);
    if (!documentsRes.ok || !officesRes.ok || !usersRes.ok) return;

    const [documentsData, officesData, usersData] = await Promise.all([
      documentsRes.json(),
      officesRes.json(),
      usersRes.json(),
    ]);
    const documents = Array.isArray(documentsData?.rows) ? documentsData.rows : [];
    const offices = Array.isArray(officesData?.rows) ? officesData.rows : [];
    const users = Array.isArray(usersData?.rows) ? usersData.rows : [];

    const completedCount = documents.filter(
      (row) => String(row?.document_state || '').trim().toLowerCase() === 'completed',
    ).length;

    totalDocumentsEl.textContent = formatCount(documents.length);
    totalOfficesEl.textContent = formatCount(offices.length);
    totalUsersEl.textContent = formatCount(users.length);
    totalCompletedEl.textContent = formatCount(completedCount);
  } catch {
    /* keep initial values if stats request fails */
  }
}

function buildDashboardMain() {
  const main = document.createElement('main');
  main.className = 'admin-main admin-dashboard-main';
  main.innerHTML = `
    <header class="admin-main__head">
      <h1 class="admin-main__title">Dashboard</h1>
      
    </header>

    <section class="admin-stats" aria-label="Summary statistics">
      <article class="admin-stat">
        <span class="admin-stat__icon" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
        <div class="admin-stat__content">
          <p class="admin-stat__label">Total Documents</p>
          <p class="admin-stat__value" id="admin-stat-total-documents">0</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="admin-stat__icon" aria-hidden="true"><i class="fa-solid fa-building"></i></span>
        <div class="admin-stat__content">
          <p class="admin-stat__label">Total Offices/Departments</p>
          <p class="admin-stat__value" id="admin-stat-total-offices">0</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="admin-stat__icon" aria-hidden="true"><i class="fa-solid fa-users"></i></span>
        <div class="admin-stat__content">
          <p class="admin-stat__label">Total Users</p>
          <p class="admin-stat__value" id="admin-stat-total-users">0</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="admin-stat__icon" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></span>
        <div class="admin-stat__content">
          <p class="admin-stat__label">Total Completed Process</p>
          <p class="admin-stat__value" id="admin-stat-total-completed">0</p>
        </div>
      </article>
    </section>

    <div class="admin-panels">
      <section class="admin-panel" aria-labelledby="recent-docs-heading">
        <div class="admin-panel__head">
          <h2 class="admin-panel__title" id="recent-docs-heading">Recents Logs</h2>
          <a class="admin-panel__action" href="logs.html">View all</a>
        </div>
        <div class="admin-panel__body">
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Full Name</th>
                  <th scope="col">Action</th>
                  <th scope="col">Timestamp</th>
                </tr>
              </thead>
              <tbody id="admin-recent-tbody"></tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="admin-panel" aria-labelledby="quick-actions-heading">
        <div class="admin-panel__head">
          <h2 class="admin-panel__title" id="quick-actions-heading">Quick Links</h2>
        </div>
        <div class="admin-panel__body admin-quick">
          <button type="button" class="admin-quick__btn admin-quick__btn--primary" id="admin-action-register">
            Add New Document
          </button>
          <button type="button" class="admin-quick__btn admin-quick__btn--secondary" id="admin-action-route">
            Add New Office/Department
          </button>
          <button type="button" class="admin-quick__btn admin-quick__btn--secondary" id="admin-action-report">
            Add New User and Role
          </button>
        </div>
      </section>
    </div>

  `;

  const logPlaceholder = (label) => {
    console.info(`Admin action: ${label} (wire to API when ready)`);
  };

  main.querySelector('#admin-action-register')?.addEventListener('click', () => navigateWithLoading('system_config.html?tab=categories'));
  main.querySelector('#admin-action-route')?.addEventListener('click', () => navigateWithLoading('system_config.html?tab=offices'));
  main.querySelector('#admin-action-report')?.addEventListener('click', () => navigateWithLoading('system_config.html?tab=usersRoles'));
  loadDashboardStats(main);
  loadRecentLogs(main);

  return main;
}

async function requireAuth() {
  try {
    const res = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
    if (res.ok) return true;
  } catch {
    /* network error — fall through */
  }
  window.location.replace('/');
  return false;
}

async function mountAdmin(root = document.querySelector('#app')) {
  if (!root) return;

  const ok = await requireAuth();
  if (!ok) return;

  document.documentElement.style.setProperty('--admin-primary', PRIMARY);
  document.documentElement.style.setProperty('--admin-primary-light', PRIMARY_LIGHT);

  root.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'admin-layout';

  const backdrop = document.createElement('div');
  backdrop.className = 'admin-sidebar-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const openClass = 'admin-layout--sidebar-open';
  const closeSidebar = () => layout.classList.remove(openClass);
  const toggleSidebar = () => layout.classList.toggle(openClass);

  const sidebar = createSidebar({
    activeId: 'dashboard',
    onSelect: () => closeSidebar(),
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildDashboardMain();

  shell.append(header, main);
  layout.append(sidebar, backdrop, shell);
  root.append(layout);

  backdrop.addEventListener('click', closeSidebar);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') closeSidebar();
    },
    { passive: true },
  );
}

mountAdmin();
