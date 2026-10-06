import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';
import { apiUrl } from './api.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';
const DASH = '—';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function formatCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat().format(numeric) : '0';
}

function badgeClass(state) {
  const token = normalizeToken(state);
  if (token === 'completed') return 'admin-badge admin-badge--success';
  if (token === 'received') return 'admin-badge admin-badge--warning';
  if (token === 'forwarded') return 'admin-badge admin-badge--info';
  return 'admin-badge';
}

function getReportCategory(row) {
  const state = normalizeToken(row?.document_state);
  if (state === 'forwarded') return 'forwarded';
  if (state === 'received') return 'processing';
  if (state === 'completed') return 'completed';
  return 'other';
}

function getOfficeName(row) {
  return String(row?.office_name || row?.source_office || row?.recipient_department || 'Unassigned').trim() || 'Unassigned';
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDayTimestamp(dateStr, endOfDay = false) {
  const parts = String(dateStr || '').trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const [year, month, day] = parts;
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

function getReportTimestamp(row) {
  const category = getReportCategory(row);
  if (category === 'processing') return parseTimestamp(row?.received_at) || parseTimestamp(row?.updated_at);
  return parseTimestamp(row?.updated_at) || parseTimestamp(row?.received_at);
}

function rowInDateRange(row, fromStr, toStr) {
  if (!fromStr && !toStr) return true;
  const timestamp = getReportTimestamp(row)?.getTime();
  if (!Number.isFinite(timestamp)) return false;
  if (fromStr) {
    const start = localDayTimestamp(fromStr);
    if (start == null || timestamp < start) return false;
  }
  if (toStr) {
    const end = localDayTimestamp(toStr, true);
    if (end == null || timestamp > end) return false;
  }
  return true;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return DASH;
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'Just now';
}

function getProcessDuration(row, now = Date.now()) {
  const category = getReportCategory(row);
  const receivedAt = parseTimestamp(row?.received_at);
  const updatedAt = parseTimestamp(row?.updated_at);

  if (category === 'processing' && receivedAt) {
    return { label: formatDuration(now - receivedAt.getTime()), hint: 'Being processed since received', sortMs: now - receivedAt.getTime() };
  }
  if (category === 'completed' && receivedAt && updatedAt) {
    const duration = Math.max(0, updatedAt.getTime() - receivedAt.getTime());
    return { label: formatDuration(duration), hint: 'Total time processed', sortMs: duration };
  }
  if (category === 'forwarded' && receivedAt && updatedAt) {
    const duration = Math.max(0, updatedAt.getTime() - receivedAt.getTime());
    return { label: formatDuration(duration), hint: 'Time before forwarding', sortMs: duration };
  }
  if (category === 'forwarded' && updatedAt) {
    return { label: formatDuration(now - updatedAt.getTime()), hint: 'Awaiting receipt at next office', sortMs: now - updatedAt.getTime() };
  }
  return { label: DASH, hint: '', sortMs: -1 };
}

function getProcessingIntervalMs(row, now = Date.now()) {
  const category = getReportCategory(row);
  const receivedAt = parseTimestamp(row?.received_at);
  const updatedAt = parseTimestamp(row?.updated_at);
  if (category === 'processing' && receivedAt) return Math.max(0, now - receivedAt.getTime());
  if ((category === 'completed' || category === 'forwarded') && receivedAt && updatedAt) {
    return Math.max(0, updatedAt.getTime() - receivedAt.getTime());
  }
  return null;
}

function applyReportFilters(rows, filters) {
  const statusFilter = normalizeToken(filters?.status);
  return rows.filter((row) => {
    if (!rowInDateRange(row, filters?.dateFrom, filters?.dateTo)) return false;
    const category = getReportCategory(row);
    if (statusFilter === 'processing' && category !== 'processing') return false;
    if (statusFilter === 'forwarded' && category !== 'forwarded') return false;
    if (statusFilter === 'completed' && category !== 'completed') return false;
    return true;
  });
}

function renderSummaryStats(main, rows) {
  const counters = {
    total: rows.length,
    processing: rows.filter((row) => getReportCategory(row) === 'processing').length,
    forwarded: rows.filter((row) => getReportCategory(row) === 'forwarded').length,
    completed: rows.filter((row) => getReportCategory(row) === 'completed').length,
  };
  const durations = rows
    .map((row) => getProcessingIntervalMs(row))
    .filter((duration) => Number.isFinite(duration));
  const average = durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : NaN;

  const values = {
    '#reports-stat-total': counters.total,
    '#reports-stat-received': counters.processing,
    '#reports-stat-forwarded': counters.forwarded,
    '#reports-stat-completed': counters.completed,
  };
  Object.entries(values).forEach(([selector, value]) => {
    const element = main.querySelector(selector);
    if (element) element.textContent = formatCount(value);
  });
  const averageElement = main.querySelector('#reports-stat-avg-process');
  if (averageElement) averageElement.textContent = Number.isFinite(average) ? formatDuration(average) : DASH;
}

function renderOfficeStats(main, rows, configuredOffices) {
  const tbody = main.querySelector('#reports-office-stats-tbody');
  if (!tbody) return;

  const byOffice = new Map();
  configuredOffices.forEach((office) => {
    const name = String(office?.name || '').trim();
    if (name) byOffice.set(normalizeToken(name), { name, rows: [] });
  });
  rows.forEach((row) => {
    const name = getOfficeName(row);
    const key = normalizeToken(name);
    if (!byOffice.has(key)) byOffice.set(key, { name, rows: [] });
    byOffice.get(key).rows.push(row);
  });

  const officeRows = [...byOffice.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (!officeRows.length) {
    tbody.innerHTML = '<tr><td colspan="7">No office data available.</td></tr>';
    return;
  }

  tbody.innerHTML = officeRows
    .map(({ name, rows: officeRowsForStats }) => {
      const received = officeRowsForStats.filter((row) => getReportCategory(row) === 'processing').length;
      const forwarded = officeRowsForStats.filter((row) => getReportCategory(row) === 'forwarded').length;
      const completed = officeRowsForStats.filter((row) => getReportCategory(row) === 'completed').length;
      const durations = officeRowsForStats
        .map((row) => getProcessingIntervalMs(row))
        .filter((duration) => Number.isFinite(duration));
      const average = durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : NaN;
      const interval = durations.length
        ? `${formatDuration(durations.reduce((minimum, duration) => Math.min(minimum, duration), Infinity))} – ${formatDuration(durations.reduce((maximum, duration) => Math.max(maximum, duration), -Infinity))}`
        : DASH;

      return `
        <tr>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td>${formatCount(received)}</td>
          <td>${formatCount(forwarded)}</td>
          <td>${formatCount(completed)}</td>
          <td>${escapeHtml(Number.isFinite(average) ? formatDuration(average) : DASH)}</td>
          <td>${escapeHtml(interval)}</td>
          <td>${formatCount(officeRowsForStats.length)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderReportRows(main, rows) {
  const tbody = main.querySelector('#reports-table-tbody');
  const count = main.querySelector('#reports-result-count');
  if (!tbody) return;
  if (count) count.textContent = `${formatCount(rows.length)} document${rows.length === 1 ? '' : 's'}`;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9">No documents match the selected report filters.</td></tr>';
    return;
  }

  const now = Date.now();
  const sorted = [...rows].sort((a, b) => getProcessDuration(b, now).sortMs - getProcessDuration(a, now).sortMs);
  tbody.innerHTML = sorted
    .map((row) => {
      const category = getReportCategory(row);
      const duration = getProcessDuration(row, now);
      const status = category === 'processing' ? 'PROCESSING (RECEIVED)' : String(row?.document_state || DASH).toUpperCase();
      return `
        <tr>
          <td><strong>${escapeHtml(row?.document_code || DASH)}</strong></td>
          <td>${escapeHtml(row?.subject || DASH)}</td>
          <td><span class="${badgeClass(row?.document_state)}">${escapeHtml(status)}</span></td>
          <td>${escapeHtml(getOfficeName(row))}</td>
          <td>${escapeHtml(row?.prepared_by || DASH)}</td>
          <td>${escapeHtml(row?.received_by || DASH)}</td>
          <td>${escapeHtml(row?.received_date || DASH)}</td>
          <td><span class="reports-hold">${escapeHtml(duration.label)}</span>${duration.hint ? `<span class="reports-hold__hint">${escapeHtml(duration.hint)}</span>` : ''}</td>
          <td>${escapeHtml(row?.recipient_name || DASH)}</td>
        </tr>
      `;
    })
    .join('');
}

function refreshReportView(main) {
  const rows = Array.isArray(main.__reportRows) ? main.__reportRows : [];
  const filters = main.__reportFilters || { status: '', dateFrom: '', dateTo: '' };
  const filtered = applyReportFilters(rows, filters);
  renderSummaryStats(main, filtered);
  renderOfficeStats(main, filtered, main.__configuredOffices || []);
  renderReportRows(main, filtered);
}

async function loadReports(main) {
  try {
    const [documentsRes, officesRes] = await Promise.all([
      fetch(apiUrl('/api/outgoing-documents/'), { credentials: 'include' }),
      fetch(apiUrl('/api/system-config/offices/'), { credentials: 'include' }),
    ]);
    const documentsPayload = await documentsRes.json().catch(() => ({}));
    const officesPayload = await officesRes.json().catch(() => ({}));
    if (!documentsRes.ok) throw new Error(documentsPayload?.error || `Document request failed (${documentsRes.status}).`);
    if (!officesRes.ok) throw new Error(officesPayload?.error || `Office request failed (${officesRes.status}).`);

    main.__reportRows = Array.isArray(documentsPayload?.rows) ? documentsPayload.rows : [];
    main.__configuredOffices = Array.isArray(officesPayload?.rows) ? officesPayload.rows : [];
    main.__reportError = '';
    refreshReportView(main);
    return true;
  } catch (error) {
    console.warn('Reports: failed to load data', error);
    main.__reportRows = [];
    main.__configuredOffices = [];
    main.__reportError = error instanceof Error ? error.message : 'Unknown request error.';
    const message = main.querySelector('#reports-date-status');
    if (message) message.textContent = `Unable to load report data: ${main.__reportError}`;
    refreshReportView(main);
    return false;
  }
}

function wireReportFilters(main) {
  const dateFromInput = main.querySelector('#reports-date-from');
  const dateToInput = main.querySelector('#reports-date-to');
  const statusSelect = main.querySelector('#reports-status-filter');
  const generateButton = main.querySelector('#reports-generate-report');
  main.__reportFilters = { status: '', dateFrom: '', dateTo: '' };

  statusSelect?.addEventListener('change', () => {
    main.__reportFilters.status = statusSelect.value;
    refreshReportView(main);
  });

  generateButton?.addEventListener('click', async () => {
    if (generateButton instanceof HTMLButtonElement) generateButton.disabled = true;
    const dateFrom = dateFromInput instanceof HTMLInputElement ? dateFromInput.value : '';
    const dateTo = dateToInput instanceof HTMLInputElement ? dateToInput.value : '';
    const status = statusSelect instanceof HTMLSelectElement ? statusSelect.value : '';
    const statusLabel = statusSelect instanceof HTMLSelectElement ? statusSelect.selectedOptions[0]?.textContent?.trim() || 'All' : 'All';
    const message = main.querySelector('#reports-date-status');

    if (dateFrom && dateTo && dateFrom > dateTo) {
      if (message) message.textContent = 'The start date cannot be after the end date.';
      if (generateButton instanceof HTMLButtonElement) generateButton.disabled = false;
      return;
    }

    main.__reportFilters = { status, dateFrom, dateTo };
    if (message) message.textContent = 'Loading the latest system report data...';
    const loaded = await loadReports(main);
    if (message) {
      message.textContent = loaded
        ? `Report generated for ${dateFrom || dateTo ? 'the selected date range' : 'all dates'} — Status: ${statusLabel}.`
        : `Unable to load report data: ${main.__reportError || 'Please try again.'}`;
    }
    if (generateButton instanceof HTMLButtonElement) generateButton.disabled = false;
  });
}

function buildReportsMain() {
  const main = document.createElement('main');
  main.className = 'admin-main reports-main';
  main.innerHTML = `
    <header class="admin-main__head">
      <h1 class="admin-main__title">System Reports</h1>
    </header>

    <section class="admin-stats reports-stats" aria-label="System report summary">
      <article class="admin-stat"><span class="reports-stat__icon reports-stat__icon--total" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span><div class="reports-stat__content"><p class="admin-stat__label">Total Documents</p><p class="admin-stat__value" id="reports-stat-total">0</p><p class="admin-stat__hint">All matching processes</p></div></article>
      <article class="admin-stat"><span class="reports-stat__icon reports-stat__icon--received" aria-hidden="true"><i class="fa-solid fa-inbox"></i></span><div class="reports-stat__content"><p class="admin-stat__label">Documents Received</p><p class="admin-stat__value" id="reports-stat-received">0</p><p class="admin-stat__hint">Currently being processed</p></div></article>
      <article class="admin-stat"><span class="reports-stat__icon reports-stat__icon--forwarded" aria-hidden="true"><i class="fa-solid fa-share"></i></span><div class="reports-stat__content"><p class="admin-stat__label">Documents Forwarded</p><p class="admin-stat__value" id="reports-stat-forwarded">0</p><p class="admin-stat__hint">Forwarded to another office</p></div></article>
      <article class="admin-stat"><span class="reports-stat__icon reports-stat__icon--completed" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></span><div class="reports-stat__content"><p class="admin-stat__label">Documents Completed</p><p class="admin-stat__value" id="reports-stat-completed">0</p><p class="admin-stat__hint">Completed processes</p></div></article>
      <article class="admin-stat"><span class="reports-stat__icon reports-stat__icon--hold" aria-hidden="true"><i class="fa-solid fa-hourglass-half"></i></span><div class="reports-stat__content"><p class="admin-stat__label">Avg. Process Time</p><p class="admin-stat__value" id="reports-stat-avg-process">${DASH}</p><p class="admin-stat__hint">Across all matching processes</p></div></article>
    </section>

    <section class="admin-panel reports-panel" aria-labelledby="reports-heading">
      <div class="admin-panel__head">
        <h2 class="admin-panel__title" id="reports-heading">All System Processes</h2>
        <span class="reports-result-count" id="reports-result-count">0 documents</span>
      </div>
      <div class="admin-panel__body">
        <div class="reports-toolbar" role="search" aria-label="System report filters">
          <div class="reports-filter-group" role="group" aria-labelledby="reports-filter-title">
            <h3 class="reports-filter-group__title" id="reports-filter-title">Report filters</h3>
            <div class="reports-filter-group__controls reports-filter-group__controls--combined">
              <span class="reports-filter-section-label">Report date range</span>
              <label class="reports-filter-field" for="reports-date-from"><span class="reports-toolbar__label">From</span><input class="reports-toolbar__input" type="date" id="reports-date-from" name="dateFrom" /></label>
              <label class="reports-filter-field" for="reports-date-to"><span class="reports-toolbar__label">To</span><input class="reports-toolbar__input" type="date" id="reports-date-to" name="dateTo" /></label>
              <span class="reports-filter-section-label">Filter by status</span>
              <label class="reports-filter-field" for="reports-status-filter"><span class="reports-toolbar__label">Status</span><select class="reports-toolbar__select" id="reports-status-filter" name="status"><option value="">All</option><option value="processing">Being Processed</option><option value="forwarded">Forwarded</option><option value="completed">Completed</option></select></label>
              <button type="button" class="reports-toolbar__generate" id="reports-generate-report">Generate Report</button>
            </div>
          </div>
          <p class="reports-date-status" id="reports-date-status" aria-live="polite"></p>
        </div>

        <div class="admin-table-wrap reports-table-wrap">
          <table class="admin-table reports-table">
            <thead><tr><th scope="col">Doc No</th><th scope="col">Subject</th><th scope="col">Status</th><th scope="col">Office/Department</th><th scope="col">Prepared By</th><th scope="col">Received By</th><th scope="col">Received Date</th><th scope="col">Process Time</th><th scope="col">Current Recipient</th></tr></thead>
            <tbody id="reports-table-tbody"><tr><td colspan="9">Loading system reports...</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="admin-panel reports-panel reports-office-panel" aria-labelledby="reports-office-stats-heading">
      <div class="admin-panel__head"><h2 class="admin-panel__title" id="reports-office-stats-heading">Office Processing Statistics</h2></div>
      <div class="admin-panel__body">
        <div class="admin-table-wrap reports-table-wrap">
          <table class="admin-table reports-table reports-office-table">
            <thead><tr><th scope="col">Office/Department</th><th scope="col">Received</th><th scope="col">Forwarded</th><th scope="col">Completed</th><th scope="col">Average Process Time</th><th scope="col">Processing Time Interval</th><th scope="col">Total</th></tr></thead>
            <tbody id="reports-office-stats-tbody"><tr><td colspan="7">Loading office statistics...</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `;

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

async function mountReports(root = document.querySelector('#app')) {
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
    activeId: 'reports',
    onSelect: () => closeSidebar(),
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildReportsMain();

  shell.append(header, main);
  layout.append(sidebar, backdrop, shell);
  root.append(layout);

  wireReportFilters(main);
  loadReports(main);

  backdrop.addEventListener('click', closeSidebar);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') closeSidebar();
    },
    { passive: true },
  );
}

mountReports();
