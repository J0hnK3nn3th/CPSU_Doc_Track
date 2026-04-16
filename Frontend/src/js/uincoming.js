import { createHeader } from '../header, footer, sidebar/uheader.js';
import { createSidebar } from '../header, footer, sidebar/usidebar.js';
import { apiUrl } from './api.js';
import { notify } from './notifications.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';
const TABLE_HEAD_COLOR = PRIMARY;

const ICON_SEARCH =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

function escapeHtmlIncomingCell(value) {
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

function isReceivedState(value) {
  return normalizeToken(value) === 'received';
}

function getUserDisplayName(currentUser) {
  const firstName = String(currentUser?.first_name || '').trim();
  const middleName = String(currentUser?.middle_name || '').trim();
  const lastName = String(currentUser?.last_name || '').trim();
  const middleInitial = middleName ? `${middleName.charAt(0).toUpperCase()}.` : '';
  const fullName = [firstName, middleInitial, lastName].filter(Boolean).join(' ').trim();
  return fullName || String(currentUser?.username || '').trim();
}

function getViewButtonStyle() {
  return `background-color: ${TABLE_HEAD_COLOR}; border-color: ${TABLE_HEAD_COLOR}; color: #fff;`;
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

function isForwardedToCurrentUser(row, recipientAliases) {
  const recipient = normalizeToken(row?.recipient_name);
  if (!recipient) return false;
  return recipientAliases.has(recipient);
}

function renderIncomingRows(main, rows, currentUser) {
  const tbody = main.querySelector('#incoming-table-tbody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">No incoming documents found for your account.</td>
      </tr>
    `;
    return;
  }

  const receivedBy = getUserDisplayName(currentUser) || '—';
  tbody.innerHTML = rows
    .map(
      (row, index) => `
      <tr class="incoming-table__row" tabindex="0" data-row-index="${index}">
        <td>${escapeHtmlIncomingCell(row.document_code || '—')}</td>
        <td>${escapeHtmlIncomingCell(row.document_state || '—')}</td>
        <td>${escapeHtmlIncomingCell(isReceivedState(row.document_state) ? (row.received_date || row.date_created || '—') : '—')}</td>
        <td>${escapeHtmlIncomingCell(row.prepared_by || '—')}</td>
        <td>${escapeHtmlIncomingCell(row.category || '—')}</td>
        <td>${escapeHtmlIncomingCell(row.subject || '—')}</td>
        <td class="incoming-table__actions">
          <button type="button" class="incoming-table__view-btn" data-id="${Number(row.id)}" aria-label="View document" style="${getViewButtonStyle()}">View</button>
        </td>
      </tr>
    `,
    )
    .join('');
}

function applyIncomingFilters(rows, filters) {
  const yearFilter = normalizeToken(filters?.year);
  const stateFilter = normalizeToken(filters?.state);
  const queryFilter = normalizeToken(filters?.query);

  return rows.filter((row) => {
    const rowDocState = normalizeToken(row?.document_state);
    const rowDate = String(row?.date_created || '');
    const rowYear = (rowDate.match(/\b(19|20)\d{2}\b/) || [''])[0];
    const searchableText = normalizeToken(
      `${row?.document_code || ''} ${row?.subject || ''} ${row?.remarks || ''}`,
    );

    if (yearFilter && rowYear !== yearFilter) return false;
    if (stateFilter && rowDocState !== stateFilter) return false;
    if (queryFilter && !searchableText.includes(queryFilter)) return false;
    return true;
  });
}

async function loadIncomingDocuments(main, currentUser) {
  try {
    const res = await fetch(apiUrl('/api/outgoing-documents/'), { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load incoming documents.');

    const payload = await res.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const recipientAliases = buildRecipientAliases(currentUser);
    const incomingForUser = rows.filter((row) => isForwardedToCurrentUser(row, recipientAliases));

    main.__incomingRows = incomingForUser;
    main.__incomingFilters = { year: '', state: '', query: '' };
    renderIncomingRows(main, incomingForUser, currentUser);
  } catch (error) {
    console.warn('Incoming: failed to load documents', error);
    main.__incomingRows = [];
    main.__incomingFilters = { year: '', state: '', query: '' };
    renderIncomingRows(main, [], currentUser);
  }
}

function buildIncomingMain(currentUser) {
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
          <option value="new">NEW</option>
          <option value="processing">PROCESSING</option>
          <option value="released">RELEASED</option>
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
                <th scope="col">Subject</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody id="incoming-table-tbody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <div class="incoming-modal" id="incoming-view-modal" role="dialog" aria-modal="true" aria-labelledby="incoming-view-modal-title-main" hidden>
      <div class="incoming-modal__backdrop" data-modal-close="true"></div>
      <div class="incoming-modal__dialog">
        <h2 class="incoming-modal__title incoming-modal__title--row">
          <span class="incoming-modal__title-main" id="incoming-view-modal-title-main">VIEW INCOMING DOCUMENT</span>
          <span class="incoming-modal__control-inline">
            <span class="incoming-modal__control-label">Control Number. :</span>
            <span class="incoming-modal__control-value" id="incoming-modal-control-number" aria-live="polite"></span>
          </span>
        </h2>

        <div class="incoming-modal__content">
          <section class="incoming-modal__panel incoming-modal__panel--left" aria-label="Incoming document details">
            <div class="incoming-modal__row">
              <label class="incoming-modal__label" for="incoming-modal-date-created">Date Created :</label>
              <input class="incoming-modal__input" id="incoming-modal-date-created" type="text" readonly />
            </div>
            <div class="incoming-modal__row">
              <label class="incoming-modal__label" for="incoming-modal-doc-code">Document Code :</label>
              <input class="incoming-modal__input" id="incoming-modal-doc-code" type="text" readonly />
            </div>
            <div class="incoming-modal__row">
              <label class="incoming-modal__label" for="incoming-modal-doc-state">Document State :</label>
              <input class="incoming-modal__input" id="incoming-modal-doc-state" type="text" readonly />
            </div>
            <div class="incoming-modal__row">
              <label class="incoming-modal__label" for="incoming-modal-category">Category :</label>
              <input class="incoming-modal__input" id="incoming-modal-category" type="text" readonly />
            </div>
            <div class="incoming-modal__row">
              <label class="incoming-modal__label" for="incoming-modal-subject">Subject :</label>
              <input class="incoming-modal__input" id="incoming-modal-subject" type="text" readonly />
            </div>
            <div class="incoming-modal__row">
              <label class="incoming-modal__label" for="incoming-modal-description">Description :</label>
              <input class="incoming-modal__input" id="incoming-modal-description" type="text" readonly />
            </div>
            <h3 class="incoming-modal__subhead">ATTACHMENTS</h3>
            <div class="incoming-modal__list-wrap">
              <table class="incoming-modal__list-table">
                <thead>
                  <tr><th>FILE NAME</th></tr>
                </thead>
                <tbody>
                  <tr><td>&nbsp;</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="incoming-modal__panel incoming-modal__panel--right" aria-label="Incoming document routing details">
            <div class="incoming-modal__row incoming-modal__row--compact">
              <label class="incoming-modal__label" for="incoming-modal-source">Received From :</label>
              <input class="incoming-modal__input" id="incoming-modal-source" type="text" readonly />
            </div>
            <div class="incoming-modal__row incoming-modal__row--compact incoming-modal__received-only" id="incoming-modal-row-forwarded-to">
              <label class="incoming-modal__label" for="incoming-modal-forwarded-to">Forwarded To :</label>
              <input class="incoming-modal__input" id="incoming-modal-forwarded-to" type="text" readonly />
            </div>
            <div class="incoming-modal__row incoming-modal__row--compact">
              <label class="incoming-modal__label" for="incoming-modal-forwarded-to-dept">Forwarded Dept. :</label>
              <input class="incoming-modal__input" id="incoming-modal-forwarded-to-dept" type="text" readonly />
            </div>
            <div class="incoming-modal__row incoming-modal__row--compact">
              <label class="incoming-modal__label" for="incoming-modal-carrier">Carrier :</label>
              <input class="incoming-modal__input" id="incoming-modal-carrier" type="text" readonly />
            </div>
            <div class="incoming-modal__row incoming-modal__row--compact">
              <label class="incoming-modal__label" for="incoming-modal-remarks">Remarks from Sender :</label>
              <input class="incoming-modal__input" id="incoming-modal-remarks" type="text" readonly />
            </div>
            <div
              class="incoming-modal__row incoming-modal__row--compact incoming-modal__row--field-spacer incoming-modal__received-only"
              aria-hidden="true"
            ></div>
            <div class="incoming-modal__row incoming-modal__row--compact incoming-modal__received-only" id="incoming-modal-row-received-date">
              <label class="incoming-modal__label" for="incoming-modal-received-date">Received Date :</label>
              <input class="incoming-modal__input" id="incoming-modal-received-date" type="text" readonly />
            </div>
            <div class="incoming-modal__row incoming-modal__row--compact incoming-modal__received-only" id="incoming-modal-row-received-by">
              <label class="incoming-modal__label" for="incoming-modal-received-by">Received By :</label>
              <input class="incoming-modal__input" id="incoming-modal-received-by" type="text" readonly />
            </div>
          </section>
        </div>

        <section class="incoming-modal__flow" aria-label="Document flow">
          <h3 class="incoming-modal__subhead">DOCUMENT FLOW</h3>
          <div class="incoming-modal__flow-wrap">
            <table class="incoming-modal__flow-table">
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
              <tbody id="incoming-modal-flow-tbody">
                <tr>
                  <td colspan="9">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="incoming-modal__footer">
          <button type="button" class="incoming-modal__tool-btn" id="incoming-modal-receive-btn" data-action="receive" aria-label="Receive document">
            RECEIVE
          </button>
          <button type="button" class="incoming-modal__tool-btn" data-modal-close="true" aria-label="Close view document modal">
            CLOSE
          </button>
        </div>
      </div>
    </div>

    <div
      class="outgoing-modal outgoing-modal--view"
      id="incoming-forward-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-fwd-modal-title-main"
      hidden
    >
      <div class="outgoing-modal__backdrop" data-forward-modal-close="true"></div>
      <div class="outgoing-modal__dialog">
        <h2 class="outgoing-modal__title outgoing-modal__title--row">
          <span class="outgoing-modal__title-main" id="incoming-fwd-modal-title-main">FORWARD OUTGOING DOCUMENT</span>
          <span class="outgoing-modal__control-inline">
            <span class="outgoing-modal__control-label">Control Number. :</span>
            <span class="outgoing-modal__control-value" id="incoming-fwd-modal-control-number" aria-live="polite"></span>
          </span>
        </h2>

        <div class="outgoing-modal__content">
          <section class="outgoing-modal__panel outgoing-modal__panel--left" aria-label="Document details">
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-date-created">Date Created :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-date-created" type="text" readonly />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-doc-state">Document State :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-doc-state" type="text" readonly />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-doc-no">Document Code :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-doc-no" type="text" readonly autocomplete="off" />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-category">Document Category :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-category" type="text" readonly />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-subject">Subject :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-subject" type="text" readonly />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--textarea">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-description">Description :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-description" type="text" readonly />
            </div>
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
          </section>

          <section class="outgoing-modal__panel outgoing-modal__panel--right" aria-label="Document routing details">
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-prepared-by">Prepared by :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-prepared-by" type="text" readonly />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-recipient">Recipient Name :</label>
              <input
                class="outgoing-modal__input outgoing-modal__input--editable"
                id="incoming-fwd-modal-recipient"
                type="text"
                value=""
                list="incoming-fwd-recipient-suggestions"
                autocomplete="off"
              />
              <datalist id="incoming-fwd-recipient-suggestions"></datalist>
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-recipient-dept">Recipient Dept. :</label>
              <input
                class="outgoing-modal__input outgoing-modal__input--editable"
                id="incoming-fwd-modal-recipient-dept"
                type="text"
                value=""
              />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-carrier">Carrier :</label>
              <input
                class="outgoing-modal__input outgoing-modal__input--editable"
                id="incoming-fwd-modal-carrier"
                type="text"
                value=""
              />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-remarks">Remarks :</label>
              <input class="outgoing-modal__input" id="incoming-fwd-modal-remarks" type="text" readonly value="" />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact outgoing-modal__row--after-remarks-gap">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-received-date">Received Date :</label>
              <input
                class="outgoing-modal__input"
                id="incoming-fwd-modal-received-date"
                type="text"
                readonly
                value=""
                aria-readonly="true"
              />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="incoming-fwd-modal-received-by">Received By :</label>
              <input
                class="outgoing-modal__input"
                id="incoming-fwd-modal-received-by"
                type="text"
                readonly
                value=""
                aria-readonly="true"
              />
            </div>
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
              <tbody id="incoming-fwd-modal-flow-tbody">
                <tr>
                  <td colspan="9">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="outgoing-modal__footer">
          <button type="button" class="outgoing-modal__tool-btn" id="incoming-fwd-modal-forward-btn" aria-label="Forward document">
            FORWARD
          </button>
          <button
            type="button"
            class="outgoing-modal__tool-btn incoming-fwd-modal__cancel"
            id="incoming-fwd-modal-cancel-btn"
            data-forward-modal-close="true"
            aria-label="Cancel and close"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  `;

  const modal = main.querySelector('#incoming-view-modal');
  const forwardModal = main.querySelector('#incoming-forward-modal');
  const forwardModalControlNumber = main.querySelector('#incoming-fwd-modal-control-number');
  const modalControlNumber = main.querySelector('#incoming-modal-control-number');
  const receiveBtn = main.querySelector('#incoming-modal-receive-btn');
  const receivedOnlyRows = Array.from(main.querySelectorAll('.incoming-modal__received-only'));
  const fwdRecipientInput = main.querySelector('#incoming-fwd-modal-recipient');
  const fwdRecipientDeptInput = main.querySelector('#incoming-fwd-modal-recipient-dept');
  const fwdRecipientSuggestions = main.querySelector('#incoming-fwd-recipient-suggestions');
  const fwdRecipientSuggestionCache = new Map();
  const fwdDepartmentByRecipientName = new Map();
  let fwdRecipientSuggestionsAbortController = null;
  let fetchFwdRecipientSuggestionsTimer = null;

  const setControlNumberDisplay = (value) => {
    if (!(modalControlNumber instanceof HTMLElement)) return;
    modalControlNumber.textContent = String(value ?? '').trim();
  };

  const setModalField = (selector, value) => {
    const el = main.querySelector(selector);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = value || '';
    }
  };

  const setForwardField = (selector, value) => {
    const el = main.querySelector(selector);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = value ?? '';
    }
  };

  const setForwardControlNumberDisplay = (value) => {
    if (!(forwardModalControlNumber instanceof HTMLElement)) return;
    forwardModalControlNumber.textContent = String(value ?? '').trim();
  };

  const renderForwardModalFlow = (row) => {
    const flowTbody = main.querySelector('#incoming-fwd-modal-flow-tbody');
    if (!flowTbody || !row) return;
    const dash = '—';
    const date = escapeHtmlIncomingCell(row.date_created || '');
    const recipient = escapeHtmlIncomingCell(row.recipient_name || '');
    const receivedFrom = escapeHtmlIncomingCell(row.prepared_by || '');
    const status = escapeHtmlIncomingCell(row.document_state || '');
    const receivedByOffice = (row.office_name || '').trim();
    const receivedBy = receivedByOffice ? escapeHtmlIncomingCell(receivedByOffice) : dash;
    const fwdRaw = (row.recipient_department || '').trim() || (row.recipient_name || '').trim();
    const forwardedTo = fwdRaw ? escapeHtmlIncomingCell(fwdRaw) : dash;
    const forwardDate = date;
    const carrierRaw = (row.carrier || '').trim();
    const carrier = carrierRaw ? escapeHtmlIncomingCell(carrierRaw) : dash;
    const remarks = (row.remarks || '').trim() ? escapeHtmlIncomingCell(row.remarks) : dash;
    flowTbody.innerHTML = `
      <tr>
        <td>${date}</td>
        <td>${recipient}</td>
        <td>${receivedFrom}</td>
        <td>${status}</td>
        <td>${receivedBy}</td>
        <td>${forwardedTo}</td>
        <td>${forwardDate}</td>
        <td>${carrier}</td>
        <td>${remarks}</td>
      </tr>
    `;
  };

  const renderFwdRecipientSuggestions = (rows) => {
    if (!(fwdRecipientSuggestions instanceof HTMLDataListElement)) return;
    fwdRecipientSuggestions.innerHTML = rows
      .map((row) => {
        const fullName = escapeHtmlIncomingCell(
          row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        );
        const label = escapeHtmlIncomingCell(
          [row.office_department, row.position_role].filter(Boolean).join(' · ') || row.username || '',
        );
        return `<option value="${fullName}" label="${label}"></option>`;
      })
      .join('');
  };

  const fetchFwdRecipientSuggestions = async (query) => {
    const normalizedQuery = normalizeToken(query);
    if (!normalizedQuery) {
      renderFwdRecipientSuggestions([]);
      return [];
    }

    if (fwdRecipientSuggestionCache.has(normalizedQuery)) {
      const cachedRows = fwdRecipientSuggestionCache.get(normalizedQuery);
      renderFwdRecipientSuggestions(cachedRows);
      return cachedRows;
    }

    if (fwdRecipientSuggestionsAbortController) fwdRecipientSuggestionsAbortController.abort();
    fwdRecipientSuggestionsAbortController = new AbortController();

    try {
      const response = await fetch(apiUrl('/api/system-config/usersRoles/'), {
        credentials: 'include',
        signal: fwdRecipientSuggestionsAbortController.signal,
      });
      if (!response.ok) return [];

      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const activeRows = rows.filter((row) => String(row?.status || '').toLowerCase() === 'active');
      activeRows.forEach((row) => {
        const displayName =
          row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
        if (displayName) {
          fwdDepartmentByRecipientName.set(
            normalizeToken(displayName),
            row.office_department || '',
          );
        }
      });
      const matches = activeRows
        .filter((row) => {
          const fn = normalizeToken(row?.first_name);
          const ln = normalizeToken(row?.last_name);
          const mn = normalizeToken(row?.middle_name);
          const full = normalizeToken(row?.full_name);
          const un = normalizeToken(row?.username);
          return (
            fn.includes(normalizedQuery) ||
            ln.includes(normalizedQuery) ||
            mn.includes(normalizedQuery) ||
            full.includes(normalizedQuery) ||
            un.includes(normalizedQuery)
          );
        })
        .slice(0, 12);

      fwdRecipientSuggestionCache.set(normalizedQuery, matches);
      renderFwdRecipientSuggestions(matches);
      return matches;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Incoming: failed to load recipient suggestions', error);
      }
      return [];
    }
  };

  const fillFwdRecipientDeptFromName = async (recipientName) => {
    if (!(fwdRecipientDeptInput instanceof HTMLInputElement)) return;
    const key = normalizeToken(recipientName);
    if (!key) {
      fwdRecipientDeptInput.value = '';
      return;
    }

    if (!fwdDepartmentByRecipientName.has(key)) {
      await fetchFwdRecipientSuggestions(recipientName);
    }

    const dept = fwdDepartmentByRecipientName.get(key);
    fwdRecipientDeptInput.value = dept ?? '';
  };

  const populateForwardModal = (row) => {
    const prepared = getUserDisplayName(currentUser);
    setForwardField('#incoming-fwd-modal-date-created', row?.date_created || '');
    setForwardField('#incoming-fwd-modal-doc-state', row?.document_state || '');
    setForwardField('#incoming-fwd-modal-doc-no', row?.document_code || '');
    setForwardField('#incoming-fwd-modal-category', row?.category || '');
    setForwardField('#incoming-fwd-modal-subject', row?.subject || '');
    setForwardField('#incoming-fwd-modal-description', row?.description || '');
    setForwardField('#incoming-fwd-modal-prepared-by', prepared);
    setForwardField('#incoming-fwd-modal-recipient', '');
    setForwardField('#incoming-fwd-modal-recipient-dept', '');
    setForwardField('#incoming-fwd-modal-carrier', '');
    setForwardField('#incoming-fwd-modal-remarks', row?.remarks || '');
    setForwardField('#incoming-fwd-modal-received-date', '');
    setForwardField('#incoming-fwd-modal-received-by', '');
    setForwardControlNumberDisplay(row?.control_number);
    renderForwardModalFlow(row);
    renderFwdRecipientSuggestions([]);
  };

  const closeForwardModal = () => {
    if (!forwardModal) return;
    if (fetchFwdRecipientSuggestionsTimer) clearTimeout(fetchFwdRecipientSuggestionsTimer);
    if (fwdRecipientSuggestionsAbortController) fwdRecipientSuggestionsAbortController.abort();
    forwardModal.hidden = true;
    document.body.classList.remove('outgoing-modal-open');
  };

  const openForwardModal = async () => {
    const docId = Number(main.__activeIncomingDocumentId);
    if (!docId || !forwardModal) return;
    try {
      const res = await fetch(apiUrl(`/api/outgoing-documents/${docId}/`), {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load document.');
      if (!data.row) throw new Error('Document not found.');
      populateForwardModal(data.row);
      if (modal) modal.hidden = true;
      document.body.classList.remove('incoming-modal-open');
      forwardModal.hidden = false;
      document.body.classList.add('outgoing-modal-open');
    } catch (error) {
      console.warn('Incoming: failed to open forward modal', error);
    }
  };

  const submitForwardDocument = async () => {
    const docId = Number(main.__activeIncomingDocumentId);
    if (!docId) return;
    const recipientName = main.querySelector('#incoming-fwd-modal-recipient')?.value?.trim() || '';
    if (!recipientName) {
      await notify({
        icon: 'warning',
        title: 'Required',
        text: 'Please enter a recipient name.',
      });
      return;
    }
    const forwardActionBtn = main.querySelector('#incoming-fwd-modal-forward-btn');
    if (forwardActionBtn instanceof HTMLButtonElement) forwardActionBtn.disabled = true;
    try {
      const res = await fetch(apiUrl(`/api/outgoing-documents/${docId}/`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'forward',
          recipient_name: recipientName,
          recipient_department: main.querySelector('#incoming-fwd-modal-recipient-dept')?.value?.trim() || '',
          carrier: main.querySelector('#incoming-fwd-modal-carrier')?.value?.trim() || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not forward document.');
      await notify({
        icon: 'success',
        title: 'Forwarded',
        text: 'The document was sent to the next recipient.',
      });
      closeForwardModal();
      main.__activeIncomingDocumentId = null;
      await loadIncomingDocuments(main, currentUser);
    } catch (error) {
      await notify({
        icon: 'error',
        title: 'Forward failed',
        text: error.message || 'Could not forward document.',
      });
    } finally {
      const btn = main.querySelector('#incoming-fwd-modal-forward-btn');
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
    }
  };

  if (fwdRecipientInput instanceof HTMLInputElement) {
    fwdRecipientInput.addEventListener('input', () => {
      if (!fwdRecipientInput.value.trim() && fwdRecipientDeptInput instanceof HTMLInputElement) {
        fwdRecipientDeptInput.value = '';
      }
      if (fetchFwdRecipientSuggestionsTimer) clearTimeout(fetchFwdRecipientSuggestionsTimer);
      fetchFwdRecipientSuggestionsTimer = setTimeout(() => {
        fetchFwdRecipientSuggestions(fwdRecipientInput.value);
      }, 250);
    });

    fwdRecipientInput.addEventListener('change', () => {
      fillFwdRecipientDeptFromName(fwdRecipientInput.value);
    });

    fwdRecipientInput.addEventListener('blur', () => {
      fillFwdRecipientDeptFromName(fwdRecipientInput.value);
    });
  }

  const toggleReceivedFields = (row) => {
    const isReceived = isReceivedState(row?.document_state);
    receivedOnlyRows.forEach((rowEl) => {
      rowEl.hidden = !isReceived;
    });
    const flowSection = main.querySelector('.incoming-modal__flow');
    if (flowSection instanceof HTMLElement) {
      flowSection.hidden = !isReceived;
    }
    if (receiveBtn instanceof HTMLButtonElement) {
      receiveBtn.hidden = false;
      if (isReceived) {
        receiveBtn.textContent = 'FORWARD';
        receiveBtn.dataset.action = 'forward';
        receiveBtn.setAttribute('aria-label', 'Forward document');
        receiveBtn.disabled = false;
      } else {
        receiveBtn.textContent = 'RECEIVE';
        receiveBtn.dataset.action = 'receive';
        receiveBtn.setAttribute('aria-label', 'Receive document');
        receiveBtn.disabled = false;
      }
    }
  };

  const populateViewModal = (row) => {
    const receivedBy = getUserDisplayName(currentUser);
    const dash = '—';
    const date = row?.received_date || row?.date_created || '';
    const forwardedTo = row?.recipient_name || '';
    const source = row?.prepared_by || '';
    const status = row?.document_state || '';
    const remarks = row?.remarks || '';
    const carrierRaw = String(row?.carrier || '').trim();
    const carrierCell = carrierRaw ? escapeHtmlIncomingCell(carrierRaw) : dash;

    setModalField('#incoming-modal-doc-code', row?.document_code || '');
    setModalField('#incoming-modal-doc-state', row?.document_state || '');
    setModalField('#incoming-modal-date-created', row?.date_created || '');
    setModalField('#incoming-modal-source', row?.prepared_by || '');
    setModalField('#incoming-modal-category', row?.category || '');
    setModalField('#incoming-modal-subject', row?.subject || '');
    setModalField('#incoming-modal-description', row?.description || '');
    setModalField('#incoming-modal-remarks', row?.remarks || '');
    setModalField('#incoming-modal-forwarded-to', row?.recipient_name || '');
    setModalField('#incoming-modal-forwarded-to-dept', row?.recipient_department || '');
    setModalField('#incoming-modal-carrier', row?.carrier || '');
    setModalField('#incoming-modal-received-date', row?.received_date || '');
    setModalField('#incoming-modal-received-by', row?.received_by || '');
    toggleReceivedFields(row);
    setControlNumberDisplay(row?.control_number);

    const flowTbody = main.querySelector('#incoming-modal-flow-tbody');
    if (flowTbody) {
      flowTbody.innerHTML = `
        <tr>
          <td>${escapeHtmlIncomingCell(date || dash)}</td>
          <td>${escapeHtmlIncomingCell(forwardedTo || dash)}</td>
          <td>${escapeHtmlIncomingCell(source || dash)}</td>
          <td>${escapeHtmlIncomingCell(status || dash)}</td>
          <td>${escapeHtmlIncomingCell(row?.received_by || receivedBy || dash)}</td>
          <td>${escapeHtmlIncomingCell(forwardedTo || dash)}</td>
          <td>${escapeHtmlIncomingCell(date || dash)}</td>
          <td>${carrierCell}</td>
          <td>${escapeHtmlIncomingCell(remarks || dash)}</td>
        </tr>
      `;
    }
  };

  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('incoming-modal-open');
    main.__activeIncomingDocumentId = null;
    setControlNumberDisplay('');
  };

  const openViewModal = async (id) => {
    const docId = Number(id);
    if (!docId || !modal) return;
    try {
      const res = await fetch(apiUrl(`/api/outgoing-documents/${docId}/`), {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load document.');
      if (!data.row) throw new Error('Document not found.');

      main.__activeIncomingDocumentId = docId;
      populateViewModal(data.row);
      modal.hidden = false;
      document.body.classList.add('incoming-modal-open');
    } catch (error) {
      console.warn('Incoming: failed to open document view', error);
    }
  };

  const applyCurrentFilters = () => {
    const allRows = Array.isArray(main.__incomingRows) ? main.__incomingRows : [];
    const filters = main.__incomingFilters || { year: '', state: '', query: '' };
    renderIncomingRows(main, applyIncomingFilters(allRows, filters), currentUser);
  };

  const markDocumentAsReceived = async () => {
    const docId = Number(main.__activeIncomingDocumentId);
    if (!docId || !(receiveBtn instanceof HTMLButtonElement)) return;
    receiveBtn.disabled = true;
    try {
      const res = await fetch(apiUrl(`/api/outgoing-documents/${docId}/`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_state: 'RECEIVED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to mark document as received.');
      if (!data.row) throw new Error('Invalid response from server.');

      if (Array.isArray(main.__incomingRows)) {
        main.__incomingRows = main.__incomingRows.map((row) => (
          Number(row?.id) === docId ? data.row : row
        ));
      }
      populateViewModal(data.row);
      applyCurrentFilters();
    } catch (error) {
      console.warn('Incoming: failed to receive document', error);
    } finally {
      if (receiveBtn instanceof HTMLButtonElement && receiveBtn.dataset.action === 'receive') {
        receiveBtn.disabled = false;
      }
    }
  };

  const runSearch = () => {
    const year = main.querySelector('#incoming-year')?.value?.trim();
    const state = main.querySelector('#incoming-doc-state')?.value;
    const q = main.querySelector('#incoming-search-query')?.value?.trim();
    const allRows = Array.isArray(main.__incomingRows) ? main.__incomingRows : [];

    main.__incomingFilters = { year: year || '', state: state || '', query: q || '' };
    const visibleRows = applyIncomingFilters(allRows, main.__incomingFilters);
    renderIncomingRows(main, visibleRows, currentUser);
  };

  main.querySelector('#incoming-search-icon')?.addEventListener('click', runSearch);
  main.querySelector('#incoming-search-query')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  });
  main.querySelector('#incoming-table-tbody')?.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('.incoming-table__view-btn');
    if (btn) {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      e.preventDefault();
      await openViewModal(id);
      return;
    }
    const rowEl = target.closest('.incoming-table__row');
    if (!(rowEl instanceof HTMLElement)) return;
    const index = Number(rowEl.getAttribute('data-row-index'));
    if (!Number.isInteger(index) || index < 0) return;
    const allRows = Array.isArray(main.__incomingRows) ? main.__incomingRows : [];
    const filters = main.__incomingFilters || { year: '', state: '', query: '' };
    const visibleRows = applyIncomingFilters(allRows, filters);
    const selectedRow = visibleRows[index];
    const id = selectedRow?.id ? String(selectedRow.id) : '';
    if (!id) return;
    e.preventDefault();
    await openViewModal(id);
  });
  modal?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-modal-close="true"]')) closeModal();
  });
  receiveBtn?.addEventListener('click', () => {
    if (receiveBtn instanceof HTMLButtonElement && receiveBtn.dataset.action === 'forward') {
      openForwardModal();
      return;
    }
    markDocumentAsReceived();
  });
  forwardModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#incoming-fwd-modal-forward-btn')) {
      e.preventDefault();
      submitForwardDocument();
      return;
    }
    if (target.closest('[data-forward-modal-close="true"]')) closeForwardModal();
  });
  main.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (forwardModal && !forwardModal.hidden) {
      closeForwardModal();
      return;
    }
    if (modal && !modal.hidden) {
      closeModal();
    }
  });

  main.openIncomingById = openViewModal;
  return main;
}

function getRequestedIncomingDocId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const docId = Number(params.get('docId'));
    if (!Number.isInteger(docId) || docId <= 0) return null;
    return docId;
  } catch {
    return null;
  }
}

function clearRequestedIncomingDocId() {
  try {
    const current = new URL(window.location.href);
    if (!current.searchParams.has('docId')) return;
    current.searchParams.delete('docId');
    window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
  } catch {
    // no-op
  }
}

async function requireAuth() {
  try {
    const res = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
    if (res.ok) return res.json();
  } catch {
    /* network error — fall through */
  }
  window.location.replace('/');
  return null;
}

async function mountIncoming(root = document.querySelector('#app')) {
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
    activeId: 'incoming',
    onSelect: () => closeSidebar(),
    isAdmin: false,
    dashboardHref: 'user.html',
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildIncomingMain(currentUser);

  shell.append(header, main);
  layout.append(sidebar, backdrop, shell);
  root.append(layout);

  await loadIncomingDocuments(main, currentUser);
  const requestedDocId = getRequestedIncomingDocId();
  if (requestedDocId && typeof main.openIncomingById === 'function') {
    await main.openIncomingById(requestedDocId);
    clearRequestedIncomingDocId();
  }

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
