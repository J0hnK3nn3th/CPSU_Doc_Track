import { createHeader } from '../header, footer, sidebar/uheader.js';
import { createSidebar } from '../header, footer, sidebar/ucsidebar.js';
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
  if (!Number.isFinite(numeric)) return '0';
  return new Intl.NumberFormat().format(numeric);
}

function badgeClass(state) {
  const token = normalizeToken(state);
  if (token === 'completed') return 'admin-badge admin-badge--success';
  if (token === 'received') return 'admin-badge admin-badge--warning';
  if (token === 'forwarded') return 'admin-badge admin-badge--info';
  return 'admin-badge';
}

function getOfficeLabel(currentUser) {
  return String(currentUser?.office_department || '').trim();
}

function getReportCategory(row) {
  const state = normalizeToken(row?.document_state);
  if (state === 'forwarded') return 'forwarded';
  if (state === 'received') return 'processing';
  if (state === 'completed') return 'completed';
  return 'other';
}

function isDocumentInOffice(row, officeKey) {
  if (!officeKey) return false;
  const rowOffice = normalizeToken(row?.office_name);
  const sourceOffice = normalizeToken(row?.source_office);
  const recipientDept = normalizeToken(row?.recipient_department);
  if (rowOffice && rowOffice === officeKey) return true;
  if (sourceOffice && sourceOffice === officeKey) return true;
  if (recipientDept && recipientDept === officeKey) return true;
  return false;
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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
  if (category === 'forwarded') return parseTimestamp(row?.updated_at) || parseTimestamp(row?.received_at);
  if (category === 'completed') return parseTimestamp(row?.updated_at) || parseTimestamp(row?.received_at);
  return parseTimestamp(row?.updated_at) || parseTimestamp(row?.received_at);
}

function rowInDateRange(row, fromStr, toStr) {
  const fromTrim = String(fromStr || '').trim();
  const toTrim = String(toStr || '').trim();
  if (!fromTrim && !toTrim) return true;

  const timestamp = getReportTimestamp(row)?.getTime();
  if (!Number.isFinite(timestamp)) return false;

  if (fromTrim) {
    const start = localDayTimestamp(fromTrim);
    if (start == null || timestamp < start) return false;
  }
  if (toTrim) {
    const end = localDayTimestamp(toTrim, true);
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
  if (totalMinutes > 0) return `${minutes}m`;
  return 'Just now';
}

function getProcessDuration(row, now = Date.now()) {
  const category = getReportCategory(row);
  const receivedAt = parseTimestamp(row?.received_at);
  const updatedAt = parseTimestamp(row?.updated_at);

  if (category === 'processing' && receivedAt) {
    return {
      label: formatDuration(now - receivedAt.getTime()),
      hint: 'Being processed since received',
      sortMs: now - receivedAt.getTime(),
    };
  }

  if (category === 'forwarded') {
    const start = updatedAt || receivedAt;
    if (start) {
      return {
        label: formatDuration(now - start.getTime()),
        hint: 'Awaiting receipt at next office',
        sortMs: now - start.getTime(),
      };
    }
  }

  if (category === 'completed' && receivedAt && updatedAt) {
    return {
      label: formatDuration(Math.max(0, updatedAt.getTime() - receivedAt.getTime())),
      hint: 'Total time processed in office',
      sortMs: Math.max(0, updatedAt.getTime() - receivedAt.getTime()),
    };
  }

  if (receivedAt) {
    return {
      label: formatDuration(now - receivedAt.getTime()),
      hint: 'Since last received',
      sortMs: now - receivedAt.getTime(),
    };
  }

  return { label: DASH, hint: '', sortMs: -1 };
}

function applyReportFilters(rows, filters) {
  const statusFilter = normalizeToken(filters?.status);
  const queryFilter = normalizeToken(filters?.query);

  return rows.filter((row) => {
    if (!rowInDateRange(row, filters?.dateFrom, filters?.dateTo)) return false;

    const category = getReportCategory(row);
    if (statusFilter === 'forwarded' && category !== 'forwarded') return false;
    if (statusFilter === 'processing' && category !== 'processing') return false;
    if (statusFilter === 'completed' && category !== 'completed') return false;

    if (queryFilter) {
      const searchable = normalizeToken(
        `${row?.document_code || ''} ${row?.control_number || ''} ${row?.subject || ''} ${row?.office_name || ''} ${row?.source_office || ''} ${row?.recipient_department || ''} ${row?.received_by || ''} ${row?.prepared_by || ''}`,
      );
      if (!searchable.includes(queryFilter)) return false;
    }
    return true;
  });
}

function renderReportStats(main, rows) {
  const receivedEl = main.querySelector('#reports-stat-received');
  const forwardedEl = main.querySelector('#reports-stat-forwarded');
  const avgProcessEl = main.querySelector('#reports-stat-avg-process');
  if (!receivedEl || !forwardedEl || !avgProcessEl) return;

  const processingRows = rows.filter((row) => getReportCategory(row) === 'processing');
  const forwardedRows = rows.filter((row) => getReportCategory(row) === 'forwarded');
  const completedRows = rows.filter((row) => getReportCategory(row) === 'completed');
  const now = Date.now();

  const durationSamples = [...processingRows, ...completedRows]
    .map((row) => getProcessDuration(row, now).sortMs)
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const avgProcess =
    durationSamples.length > 0
      ? formatDuration(durationSamples.reduce((sum, ms) => sum + ms, 0) / durationSamples.length)
      : DASH;

  receivedEl.textContent = formatCount(processingRows.length);
  forwardedEl.textContent = formatCount(forwardedRows.length);
  avgProcessEl.textContent = avgProcess;
}

function renderReportRows(main, rows, officeLabel) {
  const tbody = main.querySelector('#reports-table-tbody');
  const countEl = main.querySelector('#reports-result-count');
  if (!tbody) return;

  if (countEl) {
    countEl.textContent = `${formatCount(rows.length)} document${rows.length === 1 ? '' : 's'}`;
  }

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">No documents found for ${escapeHtml(officeLabel || 'this office')}.</td>
      </tr>
    `;
    return;
  }

  const now = Date.now();
  const sorted = [...rows].sort((a, b) => getProcessDuration(b, now).sortMs - getProcessDuration(a, now).sortMs);

  tbody.innerHTML = sorted
    .map((row) => {
      const category = getReportCategory(row);
      const duration = getProcessDuration(row, now);
      const statusLabel = String(row.document_state || DASH).toUpperCase();
      const statusDisplay = category === 'processing' ? 'PROCESSING (RECEIVED)' : statusLabel;
      const office =
        row.office_name ||
        row.source_office ||
        row.recipient_department ||
        (category === 'forwarded' ? row.recipient_name : '') ||
        DASH;

      return `
        <tr>
          <td><strong>${escapeHtml(row.document_code || DASH)}</strong></td>
          <td>${escapeHtml(row.subject || DASH)}</td>
          <td><span class="${badgeClass(row.document_state)}">${escapeHtml(statusDisplay)}</span></td>
          <td>${escapeHtml(office)}</td>
          <td>${escapeHtml(row.received_by || DASH)}</td>
          <td>${escapeHtml(row.received_date || DASH)}</td>
          <td>
            <span class="reports-hold">${escapeHtml(duration.label)}</span>
            ${duration.hint ? `<span class="reports-hold__hint">${escapeHtml(duration.hint)}</span>` : ''}
          </td>
          <td>${escapeHtml(row.recipient_name || DASH)}</td>
        </tr>
      `;
    })
    .join('');
}

function refreshReportView(main) {
  const allRows = Array.isArray(main.__reportRows) ? main.__reportRows : [];
  const filters = main.__reportFilters || { status: '', query: '', dateFrom: '', dateTo: '' };
  const officeLabel = main.__officeLabel || '';
  const filtered = applyReportFilters(allRows, filters);
  renderReportStats(main, filtered);
  renderReportRows(main, filtered, officeLabel);
}

async function loadReports(main, currentUser) {
  const officeLabel = getOfficeLabel(currentUser);
  const officeKey = normalizeToken(officeLabel);
  main.__officeLabel = officeLabel;

  try {
    const res = await fetch(apiUrl('/api/outgoing-documents/'), { credentials: 'include' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status}).`);

    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const officeRows = rows.filter((row) => isDocumentInOffice(row, officeKey));

    main.__reportRows = officeRows;
    main.__reportError = '';
    main.__reportFilters = main.__reportFilters || { status: '', query: '', dateFrom: '', dateTo: '' };
    refreshReportView(main);
    return true;
  } catch (error) {
    console.warn('Reports: failed to load documents', error);
    main.__reportError = error instanceof Error ? error.message : 'Unknown request error.';
    main.__reportRows = [];
    main.__reportFilters = main.__reportFilters || { status: '', query: '', dateFrom: '', dateTo: '' };
    refreshReportView(main);
    return false;
  }
}

function wireReportFilters(main) {
  const statusSelect = main.querySelector('#reports-status-filter');
  const dateFromInput = main.querySelector('#reports-date-from');
  const dateToInput = main.querySelector('#reports-date-to');
  const generateBtn = main.querySelector('#reports-generate-report');

  main.__reportFilters = main.__reportFilters || { status: '', query: '', dateFrom: '', dateTo: '' };

  const syncTextFilters = () => {
    main.__reportFilters = {
      ...main.__reportFilters,
      status: statusSelect instanceof HTMLSelectElement ? statusSelect.value : '',
    };
    refreshReportView(main);
  };

  statusSelect?.addEventListener('change', syncTextFilters);
  generateBtn?.addEventListener('click', async () => {
    if (generateBtn instanceof HTMLButtonElement) generateBtn.disabled = true;

    const dateFrom = dateFromInput instanceof HTMLInputElement ? dateFromInput.value : '';
    const dateTo = dateToInput instanceof HTMLInputElement ? dateToInput.value : '';
    const status = statusSelect instanceof HTMLSelectElement ? statusSelect.value : '';
    const statusLabel =
      statusSelect instanceof HTMLSelectElement
        ? statusSelect.selectedOptions[0]?.textContent?.trim() || 'All'
        : 'All';
    const dateStatus = main.querySelector('#reports-date-status');

    if (dateFrom && dateTo && dateFrom > dateTo) {
      if (dateStatus) dateStatus.textContent = 'The start date cannot be after the end date.';
      if (generateBtn instanceof HTMLButtonElement) generateBtn.disabled = false;
      return;
    }

    main.__reportFilters = {
      ...main.__reportFilters,
      dateFrom,
      dateTo,
      status,
    };
    if (dateStatus) dateStatus.textContent = 'Loading the latest report data...';

    const loaded = await loadReports(main, main.__currentUser);
    if (dateStatus) {
      if (loaded) {
        const dateLabel = dateFrom || dateTo ? 'the selected date range' : 'all dates';
        dateStatus.textContent = `Report generated for ${dateLabel} — Status: ${statusLabel}.`;
      } else {
        dateStatus.textContent = `Unable to load report data: ${main.__reportError || 'Please try again.'}`;
      }
    }
    if (generateBtn instanceof HTMLButtonElement) generateBtn.disabled = false;
  });
}

function buildReportsMain() {
  const main = document.createElement('main');
  main.className = 'admin-main reports-main';
  main.innerHTML = `
    <header class="admin-main__head">
      <h1 class="admin-main__title">Office Reports</h1>
    </header>

    <section class="admin-stats reports-stats" aria-label="Office report summary">
      <article class="admin-stat">
        <span class="reports-stat__icon reports-stat__icon--received" aria-hidden="true"><i class="fa-solid fa-inbox"></i></span>
        <div class="reports-stat__content">
          <p class="admin-stat__label">Documents Received</p>
          <p class="admin-stat__value" id="reports-stat-received">0</p>
          <p class="admin-stat__hint">Received within the selected period</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="reports-stat__icon reports-stat__icon--forwarded" aria-hidden="true"><i class="fa-solid fa-share"></i></span>
        <div class="reports-stat__content">
          <p class="admin-stat__label">Documents Forwarded</p>
          <p class="admin-stat__value" id="reports-stat-forwarded">0</p>
          <p class="admin-stat__hint">Forwarded within the selected period</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="reports-stat__icon reports-stat__icon--hold" aria-hidden="true"><i class="fa-solid fa-hourglass-half"></i></span>
        <div class="reports-stat__content">
          <p class="admin-stat__label">Avg. Process Time</p>
          <p class="admin-stat__value" id="reports-stat-avg-process">${DASH}</p>
          <p class="admin-stat__hint">Among processing and completed</p>
        </div>
      </article>
    </section>

    <section class="admin-panel reports-panel" aria-labelledby="reports-heading">
      <div class="admin-panel__head">
        <h2 class="admin-panel__title" id="reports-heading">Office Document Report</h2>
        <span class="reports-result-count" id="reports-result-count">0 documents</span>
      </div>
      <div class="admin-panel__body">
        <div class="reports-toolbar" role="search" aria-label="Report filters">
          <div class="reports-filter-group" role="group" aria-labelledby="reports-filter-title">
            <h3 class="reports-filter-group__title" id="reports-filter-title">Report filters</h3>
            <div class="reports-filter-group__controls reports-filter-group__controls--combined">
              <span class="reports-filter-section-label">Report date range</span>
              <label class="reports-filter-field" for="reports-date-from">
                <span class="reports-toolbar__label">From</span>
                <input class="reports-toolbar__input" type="date" id="reports-date-from" name="dateFrom" />
              </label>
              <label class="reports-filter-field" for="reports-date-to">
                <span class="reports-toolbar__label">To</span>
                <input class="reports-toolbar__input" type="date" id="reports-date-to" name="dateTo" />
              </label>
              <span class="reports-filter-section-label">Filter by status</span>
              <label class="reports-filter-field" for="reports-status-filter">
                <span class="reports-toolbar__label">Status</span>
                <select class="reports-toolbar__select" id="reports-status-filter" name="status">
                  <option value="">All</option>
                  <option value="processing">Being Processed</option>
                  <option value="forwarded">Forwarded</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <button type="button" class="reports-toolbar__generate" id="reports-generate-report">Generate Report</button>
            </div>
          </div>
          <p class="reports-date-status" id="reports-date-status" aria-live="polite"></p>
        </div>

        <div class="admin-table-wrap reports-table-wrap">
          <table class="admin-table reports-table">
            <thead>
              <tr>
                <th scope="col">Doc No</th>
                <th scope="col">Subject</th>
                <th scope="col">Status</th>
                <th scope="col">Office</th>
                <th scope="col">Received By</th>
                <th scope="col">Received Date</th>
                <th scope="col">Process Time</th>
                <th scope="col">Current Recipient</th>
              </tr>
            </thead>
            <tbody id="reports-table-tbody">
              <tr>
                <td colspan="8">Loading office reports...</td>
              </tr>
            </tbody>
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
    if (res.ok) return res.json();
  } catch {
    // Network error - fall through.
  }
  window.location.replace('/');
  return null;
}

async function mountReports(root = document.querySelector('#app')) {
  if (!root) return;

  const currentUser = await requireAuth();
  if (!currentUser) return;

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
    isAdmin: false,
    dashboardHref: 'cuser.html',
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildReportsMain();
  main.__currentUser = currentUser;

  shell.append(header, main);
  layout.append(sidebar, backdrop, shell);
  root.append(layout);

  wireReportFilters(main);
  loadReports(main, currentUser);

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
