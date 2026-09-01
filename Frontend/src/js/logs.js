import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';
import { apiUrl } from './api.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

function badgeClass(kind) {
  if (kind === 'success') return 'admin-badge admin-badge--success';
  if (kind === 'warning') return 'admin-badge admin-badge--warning';
  return 'admin-badge admin-badge--info';
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
  if (
    token.includes('success') ||
    token.includes('create') ||
    token.includes('forward') ||
    token.includes('receive') ||
    token.includes('complete') ||
    token.includes('enable') ||
    token.includes('update')
  ) {
    return 'success';
  }
  return 'info';
}

function renderLogsTable(tbody, rows, emptyMessage = 'No recent logs match the current filters.') {
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">${emptyMessage}</td>
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

function localDayTimestamp(dateStr, endOfDay) {
  const parts = String(dateStr).trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  if (endOfDay) {
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function rowInCalendarRange(row, fromStr, toStr) {
  const fromTrim = String(fromStr || '').trim();
  const toTrim = String(toStr || '').trim();
  if (!fromTrim && !toTrim) return true;
  const t = new Date(row.created_at).getTime();
  if (Number.isNaN(t)) return false;
  if (fromTrim) {
    const start = localDayTimestamp(fromTrim, false);
    if (start == null || t < start) return false;
  }
  if (toTrim) {
    const end = localDayTimestamp(toTrim, true);
    if (end == null || t > end) return false;
  }
  return true;
}

function rowMatchesLogFilters(row, main) {
  const roleVal = main.querySelector('#logs-filter-role')?.value ?? '';
  const nameVal = main.querySelector('#logs-filter-name')?.value ?? '';
  const actionSel = main.querySelector('#logs-filter-action')?.value ?? '';
  const fromD = main.querySelector('#logs-filter-date-from')?.value ?? '';
  const toD = main.querySelector('#logs-filter-date-to')?.value ?? '';

  if (roleVal && (row.actor_role || 'System') !== roleVal) return false;
  if (nameVal && (row.actor_full_name || 'System') !== nameVal) return false;
  if (actionSel !== '') {
    const want = actionSel === '__empty_action__' ? '' : actionSel;
    if (String(row.action ?? '') !== want) return false;
  }
  if (!rowInCalendarRange(row, fromD, toD)) return false;
  return true;
}

function filtersAreActive(main) {
  return [
    '#logs-filter-role',
    '#logs-filter-name',
    '#logs-filter-action',
    '#logs-filter-date-from',
    '#logs-filter-date-to',
  ].some((sel) => String(main.querySelector(sel)?.value || '').trim());
}

function fallbackFilterOptionsFromRows(rows) {
  const roles = [...new Set(rows.map((r) => r.actor_role || 'System'))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  const full_names = [...new Set(rows.map((r) => r.actor_full_name || 'System'))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  const map = new Map();
  rows.forEach((r) => {
    const code = String(r.action ?? '');
    const label = r.action_display || r.action || '-';
    map.set(code, label);
  });
  const actions = [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return { roles, full_names, actions };
}

function fillStringSelect(sel, placeholder, items) {
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholder;
  sel.appendChild(ph);
  items.forEach((v) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function encodeActionOptionValue(code) {
  const c = code == null ? '' : String(code);
  return c === '' ? '__empty_action__' : c;
}

function fillActionSelect(sel, actions) {
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'All actions';
  sel.appendChild(ph);
  actions.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = encodeActionOptionValue(value);
    o.textContent = label;
    sel.appendChild(o);
  });
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function populateLogFilterSelects(main, payload) {
  const rows = Array.isArray(main.logsAllRows) ? main.logsAllRows : [];
  let roles = Array.isArray(payload?.roles) ? payload.roles : null;
  let fullNames = Array.isArray(payload?.full_names) ? payload.full_names : null;
  let actions = Array.isArray(payload?.actions) ? payload.actions : null;
  if (!roles || !fullNames || !actions) {
    const fb = fallbackFilterOptionsFromRows(rows);
    roles = roles || fb.roles;
    fullNames = fullNames || fb.full_names;
    actions = actions || fb.actions;
  }
  fillStringSelect(main.querySelector('#logs-filter-role'), 'All roles', roles);
  fillStringSelect(main.querySelector('#logs-filter-name'), 'All names', fullNames);
  fillActionSelect(main.querySelector('#logs-filter-action'), actions);
}

function applyLogFilters(main) {
  const tbody = main.querySelector('#logs-tbody');
  const countEl = main.querySelector('#logs-count');
  const tableWrap = main.querySelector('.admin-table-wrap');
  const all = Array.isArray(main.logsAllRows) ? main.logsAllRows : [];
  const filtered = all.filter((row) => rowMatchesLogFilters(row, main));
  if (!filtered.length) {
    if (!all.length) {
      renderLogsTable(tbody, [], 'No entries yet.');
    } else {
      renderLogsTable(tbody, []);
    }
  } else {
    renderLogsTable(tbody, filtered);
  }
  if (tableWrap) {
    tableWrap.classList.toggle('logs-table-wrap--scroll', filtered.length >= 7);
  }
  if (!countEl) return;
  if (!all.length) {
    countEl.textContent = 'No entries yet.';
    return;
  }
  const active = filtersAreActive(main);
  if (!active) {
    countEl.textContent = `Showing ${all.length} entr${all.length === 1 ? 'y' : 'ies'}.`;
    return;
  }
  countEl.textContent = `Showing ${filtered.length} of ${all.length} entr${all.length === 1 ? 'y' : 'ies'} (filters on).`;
}

function wireLogFilters(main) {
  const onChange = () => applyLogFilters(main);
  ['#logs-filter-role', '#logs-filter-name', '#logs-filter-action'].forEach((sel) => {
    main.querySelector(sel)?.addEventListener('change', onChange);
  });
  ['#logs-filter-date-from', '#logs-filter-date-to'].forEach((sel) => {
    const el = main.querySelector(sel);
    if (!el) return;
    el.addEventListener('change', onChange);
    el.addEventListener('input', onChange);
  });
  main.querySelector('#logs-filters-clear')?.addEventListener('click', () => {
    const ids = [
      '#logs-filter-role',
      '#logs-filter-name',
      '#logs-filter-action',
      '#logs-filter-date-from',
      '#logs-filter-date-to',
    ];
    ids.forEach((sel) => {
      const el = main.querySelector(sel);
      if (el) el.value = '';
    });
    applyLogFilters(main);
    main.querySelector('#logs-filter-role')?.focus();
  });
}

function buildLogsMain() {
  const main = document.createElement('main');
  main.className = 'admin-main logs-main';
  main.innerHTML = `
    <header class="admin-main__head">
      <h1 class="admin-main__title">Recent Logs</h1>
     
    </header>

    <section class="admin-panel logs-panel" aria-labelledby="logs-heading">
      <div class="admin-panel__head">
        <h2 class="admin-panel__title" id="logs-heading">System Recent Activities</h2>
      </div>
      <div class="admin-panel__body">
        <div class="logs-filters" role="search" aria-label="Filter recent logs">
          <div class="logs-filters__grid">
            <label class="logs-filters__field">
              <span class="logs-filters__label">Role</span>
              <select class="logs-filters__input logs-filters__select" id="logs-filter-role">
                <option value="">All roles</option>
              </select>
            </label>
            <label class="logs-filters__field">
              <span class="logs-filters__label">Full name</span>
              <select class="logs-filters__input logs-filters__select" id="logs-filter-name">
                <option value="">All names</option>
              </select>
            </label>
            <label class="logs-filters__field">
              <span class="logs-filters__label">Action</span>
              <select class="logs-filters__input logs-filters__select" id="logs-filter-action">
                <option value="">All actions</option>
              </select>
            </label>
            <label class="logs-filters__field">
              <span class="logs-filters__label">From date</span>
              <input type="date" class="logs-filters__input logs-filters__date" id="logs-filter-date-from" />
            </label>
            <label class="logs-filters__field">
              <span class="logs-filters__label">To date</span>
              <input type="date" class="logs-filters__input logs-filters__date" id="logs-filter-date-to" />
            </label>
          </div>
          <button type="button" class="logs-filters__clear" id="logs-filters-clear">Clear filters</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Full name</th>
                <th scope="col">Action</th>
                <th scope="col">Timestamp</th>
              </tr>
            </thead>
            <tbody id="logs-tbody"></tbody>
          </table>
        </div>
        <p class="logs-footnote" id="logs-count" aria-live="polite"></p>
      </div>
    </section>
  `;

  return main;
}

async function loadActivityLogs(main) {
  const tbody = main.querySelector('#logs-tbody');
  const countEl = main.querySelector('#logs-count');
  try {
    const res = await fetch(apiUrl('/api/activity-logs/'), { credentials: 'include' });
    if (!res.ok) {
      main.logsAllRows = [];
      populateLogFilterSelects(main, {});
      renderLogsTable(tbody, [], 'Unable to load logs.');
      if (countEl) countEl.textContent = 'Unable to load logs.';
      return;
    }
    const payload = await res.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    main.logsAllRows = rows;
    populateLogFilterSelects(main, payload);
    applyLogFilters(main);
  } catch {
    main.logsAllRows = [];
    populateLogFilterSelects(main, {});
    renderLogsTable(tbody, [], 'Unable to load logs.');
    if (countEl) countEl.textContent = 'Unable to load logs.';
  }
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

async function mountLogs(root = document.querySelector('#app')) {
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
    activeId: 'logs',
    onSelect: () => closeSidebar(),
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildLogsMain();

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

  wireLogFilters(main);
  await loadActivityLogs(main);
}

mountLogs();
