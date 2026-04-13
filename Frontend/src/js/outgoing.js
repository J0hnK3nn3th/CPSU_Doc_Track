import '../css/admin.css';
import '../css/outgoing.css';
import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

const SAMPLE_OUTGOING = [
  {
    docNo: '2023-CCB-00068',
    docState: 'NEW',
    officeName: 'CITY COLLEGE OF BAYAWAN',
    dateCreated: '2023-04-13 11:18',
    subject: 'JAYMAR VILLOSO, ET AL.',
    category: 'OBLIGATION REQUEST (DISBURSEMENT V...)',
    preparedBy: 'LLUMANEGOS',
  },
  {
    docNo: '2023-ITS-00102',
    docState: 'PROCESSING',
    officeName: 'INFORMATION TECHNOLOGY SERVICES',
    dateCreated: '2023-04-12 09:45',
    subject: 'Network upgrade — conduct of bidding',
    category: 'IT SERVICES',
    preparedBy: 'MREYES',
  },
  {
    docNo: '2023-HR-00441',
    docState: 'NEW',
    officeName: 'HUMAN RESOURCE MANAGEMENT OFFICE',
    dateCreated: '2023-04-11 14:20',
    subject: 'Appointment papers — faculty pool',
    category: 'PERSONNEL MOVEMENT',
    preparedBy: 'JDCRUZ',
  },
  {
    docNo: '2023-ADMN-00987',
    docState: 'PROCESSING',
    officeName: 'ADMINISTRATION',
    dateCreated: '2023-04-10 08:05',
    subject: 'Memorandum — office hours FY 2023',
    category: 'GENERAL ADMINISTRATION',
    preparedBy: 'ASANTOS',
  },
];

const ICON_SEARCH =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

function buildOutgoingMain() {
  const main = document.createElement('main');
  main.className = 'admin-main outgoing-main';

  main.innerHTML = `
    <header class="outgoing-page-head">
      <h1 class="outgoing-page-head__title">Outgoing Documents</h1>
      <button type="button" class="outgoing-page-head__action-btn" id="outgoing-new-doc-btn">
        New Document
      </button>
    </header>

    <div class="outgoing-top-row">
      <div class="outgoing-topbar__search" role="search" aria-labelledby="outgoing-search-label">
        <span class="outgoing-topbar__search-label" id="outgoing-search-label">Search</span>
        <label class="outgoing-topbar__field-label" for="outgoing-year">Year :</label>
        <input
          class="outgoing-topbar__year"
          type="text"
          id="outgoing-year"
          name="year"
          inputmode="numeric"
          maxlength="4"
          placeholder=""
          autocomplete="off"
          aria-label="Filter by year"
        />
        <label class="outgoing-topbar__field-label" for="outgoing-doc-state">Doc State :</label>
        <select class="outgoing-topbar__select" id="outgoing-doc-state" name="docState">
          <option value="">All</option>
          <option value="new">NEW</option>
          <option value="processing">PROCESSING</option>
          <option value="released">RELEASED</option>
        </select>
        <div class="outgoing-topbar__search-field">
          <input
            class="outgoing-topbar__input"
            type="search"
            id="outgoing-search-query"
            name="q"
            placeholder="Search By Doc No/Subject. Example: 2023-ITS-% or %CONDUCT%"
            autocomplete="off"
          />
          <button type="button" class="outgoing-topbar__icon-btn" id="outgoing-search-icon" aria-label="Search">
            ${ICON_SEARCH}
          </button>
        </div>
      </div>
    </div>

    <section class="admin-panel outgoing-table-panel" aria-label="Outgoing documents list">
      <div class="admin-panel__body">
        <div class="admin-table-wrap outgoing-table-wrap">
          <table class="admin-table outgoing-table">
            <thead>
              <tr>
                <th scope="col">Doc No</th>
                <th scope="col">Doc State</th>
                <th scope="col">Office Name</th>
                <th scope="col">Date Created</th>
                <th scope="col">Subject</th>
                <th scope="col">Category</th>
                <th scope="col">Prepared by</th>
              </tr>
            </thead>
            <tbody id="outgoing-table-tbody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <div class="outgoing-modal" id="outgoing-new-doc-modal" role="dialog" aria-modal="true" aria-labelledby="outgoing-modal-title" hidden>
      <div class="outgoing-modal__backdrop" data-modal-close="true"></div>
      <div class="outgoing-modal__dialog">
        <h2 class="outgoing-modal__title" id="outgoing-modal-title">OUTGOING DOCUMENT</h2>

        <div class="outgoing-modal__content">
          <section class="outgoing-modal__panel outgoing-modal__panel--left" aria-label="Document details">
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-date-created">Date Created :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-date-created" type="text" readonly />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-doc-state">Doc State :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-doc-state" type="text" value="NEW" />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-doc-no">Doc No :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-doc-no" type="text" />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-subject">Subject :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-subject" type="text" />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-description">Description :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-description" type="text" />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-category">Document Category :</label>
              <div class="outgoing-modal__with-icon">
                <input class="outgoing-modal__input" id="outgoing-modal-category" type="text" />
                <button type="button" class="outgoing-modal__mini-btn" aria-label="Search document category">${ICON_SEARCH}</button>
              </div>
            </div>
          </section>

          <section class="outgoing-modal__panel outgoing-modal__panel--right" aria-label="Attachments">
            <h3 class="outgoing-modal__subhead">ATTACHMENTS</h3>
            <div class="outgoing-modal__list-wrap">
              <table class="outgoing-modal__list-table">
                <thead>
                  <tr><th>FILE NAME</th></tr>
                </thead>
                <tbody>
                  <tr><td>&nbsp;</td></tr>
                </tbody>
              </table>
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="outgoing-modal-prepared-by">Prepared by :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-prepared-by" type="text" />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="outgoing-modal-recipient">Recipient :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-recipient" type="text" />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="outgoing-modal-remarks">Remarks :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-remarks" type="text" />
            </div>
            <button type="button" class="outgoing-modal__preview-btn">PREVIEW</button>
          </section>
        </div>

        <section class="outgoing-modal__flow" aria-label="Document flow">
          <h3 class="outgoing-modal__subhead">DOCUMENT FLOW</h3>
          <div class="outgoing-modal__flow-wrap">
            <table class="outgoing-modal__flow-table">
              <thead>
                <tr>
                  <th>Date Received</th>
                  <th>Recipient</th>
                  <th>Received From</th>
                  <th>Status</th>
                  <th>Received By</th>
                  <th>Forwarded to</th>
                  <th>Forward Date</th>
                  <th>Carrier</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="9">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="outgoing-modal__footer">
          <button type="button" class="outgoing-modal__tool-btn">
            SAVE
          </button>
          <button type="button" class="outgoing-modal__tool-btn">
            BARCODE
          </button>
          <button
            type="button"
            class="outgoing-modal__tool-btn"
            data-modal-close="true"
            aria-label="Cancel new document form"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  `;

  const tbody = main.querySelector('#outgoing-table-tbody');
  if (tbody) {
    tbody.innerHTML = SAMPLE_OUTGOING.map(
      (row) => `
      <tr>
        <td>${row.docNo}</td>
        <td>${row.docState}</td>
        <td>${row.officeName}</td>
        <td>${row.dateCreated}</td>
        <td>${row.subject}</td>
        <td>${row.category}</td>
        <td>${row.preparedBy}</td>
      </tr>
    `,
    ).join('');
  }

  const logAction = (label) => console.info(`Outgoing: ${label} (wire to API when ready)`);

  const runSearch = () => {
    const year = main.querySelector('#outgoing-year')?.value?.trim();
    const state = main.querySelector('#outgoing-doc-state')?.value;
    const q = main.querySelector('#outgoing-search-query')?.value?.trim();
    logAction(`Search — year=${year || '(any)'}, docState=${state || 'all'}, query=${q || '(empty)'}`);
  };

  main.querySelector('#outgoing-search-icon')?.addEventListener('click', runSearch);
  main.querySelector('#outgoing-search-query')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  });
  const modal = main.querySelector('#outgoing-new-doc-modal');
  const modalDateCreated = main.querySelector('#outgoing-modal-date-created');
  const modalFirstInput = main.querySelector('#outgoing-modal-doc-no');
  const getCurrentDate = () =>
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  const openModal = () => {
    if (!modal) return;
    if (modalDateCreated instanceof HTMLInputElement) {
      modalDateCreated.value = getCurrentDate();
    }
    modal.hidden = false;
    document.body.classList.add('outgoing-modal-open');
    modalFirstInput?.focus();
    logAction('Open New Document form');
  };

  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('outgoing-modal-open');
  };

  main.querySelector('#outgoing-new-doc-btn')?.addEventListener('click', openModal);
  modal?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-modal-close="true"]')) closeModal();
  });

  main.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) {
      closeModal();
    }
  });

  return main;
}

async function requireAuth() {
  try {
    const res = await fetch('/api/auth/me/', { credentials: 'include' });
    if (res.ok) return true;
  } catch {
    /* network error — fall through */
  }
  window.location.replace('/');
  return false;
}

async function mountOutgoing(root = document.querySelector('#app')) {
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
    activeId: 'outgoing',
    onSelect: () => closeSidebar(),
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildOutgoingMain();

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

mountOutgoing();
