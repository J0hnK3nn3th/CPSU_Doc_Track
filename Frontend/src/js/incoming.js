import '../css/admin.css';

import '../css/incoming.css';

import { createHeader } from '../header, footer, sidebar/header.js';

import { createSidebar } from '../header, footer, sidebar/sidebar.js';



const PRIMARY = '#84B179';

const PRIMARY_LIGHT = '#A2CB8B';



const SAMPLE_INCOMING = [

  {

    docNo: 'INC-2026-0142',

    recipientState: 'Pending',

    receivedDate: 'Apr 12, 2026',

    source: 'CHED RO VI',

    category: 'Memorandum',

    docState: 'Open',

    dateCreated: 'Apr 12, 2026',

    remarksFromSender: 'For compliance filing',

    subject: 'Academic calendar advisory',

    receivedBy: 'J. Dela Cruz',

    forwardedTo: 'Registrar',

  },

  {

    docNo: 'INC-2026-0141',

    recipientState: 'Routed',

    receivedDate: 'Apr 11, 2026',

    source: 'ICT vendor pool',

    category: 'Quotation',

    docState: 'In review',

    dateCreated: 'Apr 11, 2026',

    remarksFromSender: 'Follow-up required',

    subject: 'Network switches — price quote',

    receivedBy: 'M. Reyes',

    forwardedTo: 'Procurement',

  },

  {

    docNo: 'INC-2026-0138',

    recipientState: 'Closed',

    receivedDate: 'Apr 10, 2026',

    source: 'LGU Talisay',

    category: 'Partnership',

    docState: 'Archived',

    dateCreated: 'Apr 10, 2026',

    remarksFromSender: 'MOA draft attached',

    subject: 'Extension partnership letter',

    receivedBy: 'A. Santos',

    forwardedTo: 'Extension office',

  },

  {

    docNo: 'INC-2026-0135',

    recipientState: 'Pending',

    receivedDate: 'Apr 9, 2026',

    source: 'DBM',

    category: 'Circular',

    docState: 'Open',

    dateCreated: 'Apr 9, 2026',

    remarksFromSender: '',

    subject: 'Budget circular FY 2026',

    receivedBy: 'J. Dela Cruz',

    forwardedTo: 'Budget office',

  },

];



const ICON_SEARCH =

  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';



function buildIncomingMain() {

  const main = document.createElement('main');

  main.className = 'admin-main incoming-main';



  main.innerHTML = `

    <header class="incoming-page-head">

      <h1 class="incoming-page-head__title">Incoming Documents</h1>

    </header>



    <div class="incoming-top-row">

      <div class="incoming-topbar__search" role="search" aria-labelledby="incoming-search-label">

        <span class="incoming-topbar__search-label" id="incoming-search-label">Search</span>

        <label class="incoming-topbar__field-label" for="incoming-year">Year :</label>

        <input

          class="incoming-topbar__year"

          type="text"

          id="incoming-year"

          name="year"

          inputmode="numeric"

          maxlength="4"

          placeholder=""

          autocomplete="off"

          aria-label="Filter by year"

        />

        <label class="incoming-topbar__field-label" for="incoming-doc-state">Doc State :</label>

        <select class="incoming-topbar__select" id="incoming-doc-state" name="docState">

          <option value="">All</option>

          <option value="open">Open</option>

          <option value="in-review">In review</option>

          <option value="archived">Archived</option>

        </select>

        <div class="incoming-topbar__search-field">

          <input

            class="incoming-topbar__input"

            type="search"

            id="incoming-search-query"

            name="q"

            placeholder="Search By Doc No/Subject. Example: 2023-ITS-% or %CONDUCT%"

            autocomplete="off"

          />

          <button type="button" class="incoming-topbar__icon-btn" id="incoming-search-icon" aria-label="Search">

            ${ICON_SEARCH}

          </button>

        </div>

      </div>

    </div>



    <section class="admin-panel incoming-table-panel" aria-label="Incoming documents list">

      <div class="admin-panel__body">

        <div class="admin-table-wrap incoming-table-wrap">

          <table class="admin-table incoming-table">

            <thead>

              <tr>

                <th scope="col">Doc No</th>

                <th scope="col">Recipient State</th>

                <th scope="col">Received Date</th>

                <th scope="col">Source</th>

                <th scope="col">Category</th>

                <th scope="col">Doc State</th>

                <th scope="col">Date Created</th>

                <th scope="col">Remarks from Sender</th>

                <th scope="col">Subject</th>

                <th scope="col">Received By</th>

                <th scope="col">Forwarded To</th>

              </tr>

            </thead>

            <tbody id="incoming-table-tbody"></tbody>

          </table>

        </div>

      </div>

    </section>

  `;



  const tbody = main.querySelector('#incoming-table-tbody');

  if (tbody) {

    tbody.innerHTML = SAMPLE_INCOMING.map(

      (row, index) => `

      <tr class="incoming-table__row" tabindex="0" data-row-index="${index}">

        <td>${row.docNo}</td>

        <td>${row.recipientState}</td>

        <td>${row.receivedDate}</td>

        <td>${row.source}</td>

        <td>${row.category}</td>

        <td>${row.docState}</td>

        <td>${row.dateCreated}</td>

        <td>${row.remarksFromSender || '—'}</td>

        <td>${row.subject}</td>

        <td>${row.receivedBy}</td>

        <td>${row.forwardedTo}</td>

      </tr>

    `,

    ).join('');

  }



  const logAction = (label) => console.info(`Incoming: ${label} (wire to API when ready)`);



  const runSearch = () => {

    const year = main.querySelector('#incoming-year')?.value?.trim();

    const state = main.querySelector('#incoming-doc-state')?.value;

    const q = main.querySelector('#incoming-search-query')?.value?.trim();

    logAction(`Search — year=${year || '(any)'}, docState=${state || 'all'}, query=${q || '(empty)'}`);

  };



  main.querySelector('#incoming-search-icon')?.addEventListener('click', runSearch);

  main.querySelector('#incoming-search-query')?.addEventListener('keydown', (e) => {

    if (e.key === 'Enter') {

      e.preventDefault();

      runSearch();

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



async function mountIncoming(root = document.querySelector('#app')) {

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

    activeId: 'incoming',

    onSelect: () => closeSidebar(),

  });



  const shell = document.createElement('div');

  shell.className = 'admin-shell';



  const header = createHeader({ onMenuToggle: toggleSidebar });

  const main = buildIncomingMain();



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



mountIncoming();

