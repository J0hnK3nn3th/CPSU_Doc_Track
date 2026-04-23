import { createHeader } from '../header, footer, sidebar/uheader.js';
import { createSidebar } from '../header, footer, sidebar/ucsidebar.js';
import { apiUrl } from './api.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';
const DASH = '-';

function badgeClass(kind) {
  if (kind === 'success') return 'admin-badge admin-badge--success';
  if (kind === 'warning') return 'admin-badge admin-badge--warning';
  return 'admin-badge admin-badge--info';
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
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

function buildCurrentUserAliases(user) {
  const firstName = String(user?.first_name || '').trim();
  const middleName = String(user?.middle_name || '').trim();
  const lastName = String(user?.last_name || '').trim();
  const middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';
  const aliases = new Set([
    normalizeToken(user?.username),
    normalizeToken(user?.full_name),
    normalizeToken(`${firstName} ${lastName}`),
    normalizeToken(`${firstName} ${middleName} ${lastName}`),
    normalizeToken(`${firstName} ${middleInitial}. ${lastName}`),
  ]);
  aliases.delete('');
  return aliases;
}

function isRowForCurrentUser(row, aliases) {
  const actorFullName = normalizeToken(row?.actor_full_name);
  const actorUsername = normalizeToken(row?.actor_username);
  return aliases.has(actorFullName) || aliases.has(actorUsername);
}

function renderRecentLogs(main, rows) {
  const tbody = main.querySelector('#user-recent-tbody');
  const tableWrap = main.querySelector('.user-logs-panel .admin-table-wrap');
  if (!tbody) return;
  if (tableWrap) {
    tableWrap.classList.toggle('admin-table-wrap--scroll', rows.length > 5);
  }
  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">No recent logs found for your account.</td>
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
        <td><span class="${badgeClass(activityBadge(row.action))}">${row.action_display || row.action || DASH}</span></td>
        <td>${formatDateTime(row.created_at)}</td>
      </tr>
    `,
    )
    .join('');
}

async function loadRecentLogs(main, currentUser) {
  try {
    const res = await fetch(apiUrl('/api/activity-logs/'), { credentials: 'include' });
    if (!res.ok) {
      renderRecentLogs(main, []);
      return;
    }
    const payload = await res.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const aliases = buildCurrentUserAliases(currentUser);
    const userRows = rows.filter((row) => isRowForCurrentUser(row, aliases)).slice(0, 5);
    renderRecentLogs(main, userRows);
  } catch {
    renderRecentLogs(main, []);
  }
}

async function requireAuth() {
  try {
    const res = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
    if (res.ok) return res.json();
  } catch {
    /* network error - fall through */
  }
  window.location.replace('/');
  return null;
}

function buildUserMain() {
  const main = document.createElement('main');
  main.className = 'admin-main user-main';
  main.innerHTML = `
    <header class="admin-main__head">
      <h1 class="admin-main__title">Dashboard</h1>
    </header>

    <section class="admin-stats user-stats" aria-label="Your document statistics">
      <article class="admin-stat">
        <span class="user-stat__icon" aria-hidden="true"><i class="fa-solid fa-inbox"></i></span>
        <div class="user-stat__content">
          <p class="admin-stat__label">Incoming Documents</p>
          <p class="admin-stat__value" id="user-stat-incoming">0</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="user-stat__icon" aria-hidden="true"><i class="fa-solid fa-paper-plane"></i></span>
        <div class="user-stat__content">
          <p class="admin-stat__label">Outgoing Documents</p>
          <p class="admin-stat__value" id="user-stat-outgoing">0</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="user-stat__icon" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></span>
        <div class="user-stat__content">
          <p class="admin-stat__label">Completed Process</p>
          <p class="admin-stat__value" id="user-stat-completed">0</p>
        </div>
      </article>
      <article class="admin-stat">
        <span class="user-stat__icon" aria-hidden="true"><i class="fa-solid fa-hourglass-half"></i></span>
        <div class="user-stat__content">
          <p class="admin-stat__label">Unforwarded Documents</p>
          <p class="admin-stat__value" id="user-stat-unforwarded">0</p>
        </div>
      </article>
    </section>

    <div class="admin-panels user-panels">
      <section class="admin-panel user-logs-panel" aria-labelledby="user-recent-logs-heading">
        <div class="admin-panel__head">
          <h2 class="admin-panel__title" id="user-recent-logs-heading">Your Recent Logs</h2>
          <a class="admin-panel__action" href="uclogs.html">View all</a>
        </div>
        <div class="admin-panel__body">
          <div class="admin-table-wrap user-recent-logs-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Full Name</th>
                  <th scope="col">Action</th>
                  <th scope="col">Timestamp</th>
                </tr>
              </thead>
              <tbody id="user-recent-tbody">
                <tr>
                  <td colspan="4">Loading logs...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="admin-panel user-main__panel" aria-label="User actions">
        <div class="admin-panel__head">
          <h2 class="admin-panel__title">Quick Links</h2>
        </div>
        <div class="admin-panel__body admin-quick user-main__body">
          <a class="user-main__link" href="ucincoming.html">Go to Incoming</a>
          <a class="user-main__link" href="ucoutgoing.html">Go to Outgoing</a>
        </div>
      </section>
    </div>
  `;
  return main;
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return new Intl.NumberFormat().format(numeric);
}

function buildRecipientAliases(currentUser) {
  const firstName = String(currentUser?.first_name || '').trim();
  const middleName = String(currentUser?.middle_name || '').trim();
  const lastName = String(currentUser?.last_name || '').trim();
  const middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';
  const aliases = new Set([
    normalizeToken(currentUser?.username),
    normalizeToken(`${firstName} ${lastName}`),
    normalizeToken(`${firstName} ${middleName} ${lastName}`),
    normalizeToken(`${firstName} ${middleInitial}. ${lastName}`),
  ]);
  aliases.delete('');
  return aliases;
}

function isForwardedToCurrentUser(row, recipientAliases, currentUser) {
  const recipientDepartment = normalizeToken(row?.recipient_department);
  const userDepartment = normalizeToken(currentUser?.office_department);
  if (recipientDepartment && userDepartment) return recipientDepartment === userDepartment;
  const recipient = normalizeToken(row?.recipient_name);
  if (!recipient) return false;
  return recipientAliases.has(recipient);
}

function getPreparedByFromUser(currentUser) {
  const firstName = String(currentUser?.first_name || '').trim();
  const middleName = String(currentUser?.middle_name || '').trim();
  const lastName = String(currentUser?.last_name || '').trim();
  const middleInitial = middleName ? `${middleName.charAt(0).toUpperCase()}.` : '';
  const fullName = [firstName, middleInitial, lastName].filter(Boolean).join(' ').trim();
  return fullName || String(currentUser?.username || '').trim();
}

function parseForwarderHistory(value) {
  return String(value || '')
    .split('\n')
    .map((token) => normalizeToken(token))
    .filter(Boolean);
}

function isOutgoingVisibleToCurrentUser(row, currentUser) {
  const preparedByNameKey = normalizeToken(getPreparedByFromUser(currentUser));
  const usernameKey = normalizeToken(currentUser?.username);
  const rowPreparedByKey = normalizeToken(row?.prepared_by);
  const rowReceivedByKey = normalizeToken(row?.received_by);
  const rowForwarders = parseForwarderHistory(row?.forwarder_history);
  const stateKey = normalizeToken(row?.document_state);
  const isSender =
    rowPreparedByKey && (rowPreparedByKey === preparedByNameKey || rowPreparedByKey === usernameKey);
  const isForwarder = rowForwarders.includes(preparedByNameKey) || rowForwarders.includes(usernameKey);
  const isReceiver =
    rowReceivedByKey && (rowReceivedByKey === preparedByNameKey || rowReceivedByKey === usernameKey);

  if (stateKey === 'received') {
    return Boolean(isSender) && !isReceiver;
  }
  if (isSender) return true;
  if (!isForwarder) return false;
  return stateKey !== 'received';
}

function isReceivedButNotForwardedByCurrentUser(row, currentUser, recipientAliases) {
  const preparedByNameKey = normalizeToken(getPreparedByFromUser(currentUser));
  const usernameKey = normalizeToken(currentUser?.username);
  const rowReceivedByKey = normalizeToken(row?.received_by);
  const stateKey = normalizeToken(row?.document_state);
  const rowForwarders = parseForwarderHistory(row?.forwarder_history);
  const isReceiverByName =
    rowReceivedByKey && (rowReceivedByKey === preparedByNameKey || rowReceivedByKey === usernameKey);
  const isReceiverByTarget = isForwardedToCurrentUser(row, recipientAliases, currentUser);
  const isForwardedByCurrentUser =
    rowForwarders.includes(preparedByNameKey) || rowForwarders.includes(usernameKey);

  if (stateKey !== 'received') return false;
  if (!isReceiverByName && !isReceiverByTarget) return false;
  return !isForwardedByCurrentUser;
}

async function loadUserStats(main, currentUser) {
  const incomingEl = main.querySelector('#user-stat-incoming');
  const outgoingEl = main.querySelector('#user-stat-outgoing');
  const completedEl = main.querySelector('#user-stat-completed');
  const unforwardedEl = main.querySelector('#user-stat-unforwarded');
  if (!incomingEl || !outgoingEl || !completedEl || !unforwardedEl) return;

  try {
    const res = await fetch(apiUrl('/api/outgoing-documents/'), { credentials: 'include' });
    if (!res.ok) return;
    const payload = await res.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const recipientAliases = buildRecipientAliases(currentUser);

    const incomingRows = rows.filter((row) => {
      if (normalizeToken(row?.document_state) === 'completed') return false;
      return isForwardedToCurrentUser(row, recipientAliases, currentUser);
    });
    const outgoingRows = rows.filter((row) => isOutgoingVisibleToCurrentUser(row, currentUser));
    const unforwardedRows = rows.filter((row) =>
      isReceivedButNotForwardedByCurrentUser(row, currentUser, recipientAliases),
    );
    const completedCount = rows.filter((row) => {
      if (normalizeToken(row?.document_state) !== 'completed') return false;
      return (
        isForwardedToCurrentUser(row, recipientAliases, currentUser) ||
        isOutgoingVisibleToCurrentUser(row, currentUser)
      );
    }).length;

    incomingEl.textContent = formatCount(incomingRows.length);
    outgoingEl.textContent = formatCount(outgoingRows.length);
    completedEl.textContent = formatCount(completedCount);
    unforwardedEl.textContent = formatCount(unforwardedRows.length);
  } catch {
    incomingEl.textContent = DASH;
    outgoingEl.textContent = DASH;
    completedEl.textContent = DASH;
    unforwardedEl.textContent = DASH;
  }
}

async function mountUserPage(root = document.querySelector('#app')) {
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
    activeId: 'dashboard',
    onSelect: () => closeSidebar(),
    isAdmin: false,
    dashboardHref: 'cuser.html',
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildUserMain();

  shell.append(header, main);
  layout.append(sidebar, backdrop, shell);
  root.append(layout);
  loadUserStats(main, currentUser);
  loadRecentLogs(main, currentUser);

  backdrop.addEventListener('click', closeSidebar);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') closeSidebar();
    },
    { passive: true },
  );
}

mountUserPage();
