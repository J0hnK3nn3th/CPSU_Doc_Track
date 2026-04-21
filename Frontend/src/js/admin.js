import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';
import { apiUrl } from './api.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

const SAMPLE_ROWS = [
  {
    id: 'DOC-2026-0142',
    title: 'Faculty travel reimbursement',
    status: 'In transit',
    badge: 'info',
    updated: 'Apr 12, 2026',
  },
  {
    id: 'DOC-2026-0138',
    title: 'MOA — community extension',
    status: 'Pending review',
    badge: 'warning',
    updated: 'Apr 11, 2026',
  },
  {
    id: 'DOC-2026-0124',
    title: 'Procurement request (IT)',
    status: 'Released',
    badge: 'success',
    updated: 'Apr 10, 2026',
  },
  {
    id: 'DOC-2026-0119',
    title: 'Student records verification',
    status: 'In transit',
    badge: 'info',
    updated: 'Apr 9, 2026',
  },
];

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
        <p class="admin-stat__label">Total Documents</p>
        <p class="admin-stat__value" id="admin-stat-total-documents">0</p>
      </article>
      <article class="admin-stat">
        <p class="admin-stat__label">Total Offices/Departments</p>
        <p class="admin-stat__value" id="admin-stat-total-offices">0</p>
      </article>
      <article class="admin-stat">
        <p class="admin-stat__label">Total Users</p>
        <p class="admin-stat__value" id="admin-stat-total-users">0</p>
      </article>
      <article class="admin-stat">
        <p class="admin-stat__label">Total Completed Process</p>
        <p class="admin-stat__value" id="admin-stat-total-completed">0</p>
      </article>
    </section>

    <div class="admin-panels">
      <section class="admin-panel" aria-labelledby="recent-docs-heading">
        <div class="admin-panel__head">
          <h2 class="admin-panel__title" id="recent-docs-heading">Recent documents</h2>
          <a class="admin-panel__action" href="#">View all</a>
        </div>
        <div class="admin-panel__body">
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody id="admin-recent-tbody"></tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="admin-panel" aria-labelledby="quick-actions-heading">
        <div class="admin-panel__head">
          <h2 class="admin-panel__title" id="quick-actions-heading">Quick actions</h2>
        </div>
        <div class="admin-panel__body admin-quick">
          <button type="button" class="admin-quick__btn admin-quick__btn--primary" id="admin-action-register">
            Register new document
          </button>
          <button type="button" class="admin-quick__btn admin-quick__btn--secondary" id="admin-action-route">
            Assign routing slip
          </button>
          <button type="button" class="admin-quick__btn admin-quick__btn--secondary" id="admin-action-report">
            Export status report
          </button>
        </div>
      </section>
    </div>

    <p class="admin-footnote">
      CPSU Document Track · Admin console. Connect APIs to replace sample figures and table data.
    </p>
  `;

  const tbody = main.querySelector('#admin-recent-tbody');
  if (tbody) {
    tbody.innerHTML = SAMPLE_ROWS.map(
      (row) => `
      <tr>
        <td><strong>${row.id}</strong></td>
        <td>${row.title}</td>
        <td><span class="${badgeClass(row.badge)}">${row.status}</span></td>
        <td>${row.updated}</td>
      </tr>
    `,
    ).join('');
  }

  const logPlaceholder = (label) => {
    console.info(`Admin action: ${label} (wire to API when ready)`);
  };

  main.querySelector('#admin-action-register')?.addEventListener('click', () => logPlaceholder('Register new document'));
  main.querySelector('#admin-action-route')?.addEventListener('click', () => logPlaceholder('Assign routing slip'));
  main.querySelector('#admin-action-report')?.addEventListener('click', () => logPlaceholder('Export status report'));
  loadDashboardStats(main);

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
