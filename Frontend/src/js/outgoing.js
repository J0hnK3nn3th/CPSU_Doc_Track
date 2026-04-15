import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';
import { apiUrl } from './api.js';
import { notify } from './notifications.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

const SAMPLE_OUTGOING = [];

const ICON_SEARCH =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

function escapeHtmlOutgoingCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Office/department where the document is forwarded (recipient), with legacy fallback. */
function outgoingForwardOffice(row) {
  return (row?.recipient_department || row?.office_name || '').trim();
}

async function loadOutgoingDocuments(main) {
  const tbody = main.querySelector('#outgoing-table-tbody');
  if (!tbody) return;
  try {
    const res = await fetch(apiUrl('/api/outgoing-documents/'), { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];
    tbody.innerHTML = rows
      .map(
        (row) => `
      <tr>
        <td>${escapeHtmlOutgoingCell(row.document_code)}</td>
        <td>${escapeHtmlOutgoingCell(row.document_state)}</td>
        <td>${escapeHtmlOutgoingCell(outgoingForwardOffice(row))}</td>
        <td>${escapeHtmlOutgoingCell(row.date_created)}</td>
        <td>${escapeHtmlOutgoingCell(row.subject)}</td>
        <td>${escapeHtmlOutgoingCell(row.category)}</td>
        <td>${escapeHtmlOutgoingCell(row.prepared_by)}</td>
        <td class="outgoing-table__actions">
          <button type="button" class="outgoing-table__view-btn" data-id="${Number(row.id)}" aria-label="View document">View</button>
        </td>
      </tr>
    `,
      )
      .join('');
  } catch {
    /* ignore */
  }
}

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
        <label class="outgoing-topbar__field-label" for="outgoing-doc-state">Document State :</label>
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
            placeholder="Search By Document Code/Subject. Example: 2023-ITS-% or %CONDUCT%"
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
                <th scope="col">Document Code</th>
                <th scope="col">Document State</th>
                <th scope="col">Office/Department</th>
                <th scope="col">Date Created</th>
                <th scope="col">Subject</th>
                <th scope="col">Category</th>
                <th scope="col">Prepared by</th>
                <th scope="col">Actions</th>
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
              <label class="outgoing-modal__label" for="outgoing-modal-doc-state">Document State :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-doc-state" type="text" value="NEW" />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-doc-no">Document Code :</label>
              <input
                class="outgoing-modal__input"
                id="outgoing-modal-doc-no"
                type="text"
                list="outgoing-doc-code-suggestions"
                autocomplete="off"
              />
              <datalist id="outgoing-doc-code-suggestions"></datalist>
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-category">Document Category :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-category" type="text" />
            </div>
            <div class="outgoing-modal__row">
              <label class="outgoing-modal__label" for="outgoing-modal-subject">Subject :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-subject" type="text" />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--textarea">
              <label class="outgoing-modal__label" for="outgoing-modal-description">Description :</label>
              <textarea
                class="outgoing-modal__textarea"
                id="outgoing-modal-description"
                rows="3"
                spellcheck="true"
              ></textarea>
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
              <label class="outgoing-modal__label" for="outgoing-modal-recipient">Recipient Name :</label>
              <input
                class="outgoing-modal__input"
                id="outgoing-modal-recipient"
                type="text"
                list="outgoing-recipient-suggestions"
                autocomplete="off"
              />
              <datalist id="outgoing-recipient-suggestions"></datalist>
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="outgoing-modal-recipient-dept">Recipient Dept. :</label>
              <input
                class="outgoing-modal__input"
                id="outgoing-modal-recipient-dept"
                type="text"
                readonly
                aria-readonly="true"
              />
            </div>
            <div class="outgoing-modal__row outgoing-modal__row--compact">
              <label class="outgoing-modal__label" for="outgoing-modal-remarks">Remarks :</label>
              <input class="outgoing-modal__input" id="outgoing-modal-remarks" type="text" />
            </div>
            <button type="button" class="outgoing-modal__preview-btn" id="outgoing-modal-preview-btn">PREVIEW</button>
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
              <tbody id="outgoing-modal-flow-tbody">
                <tr>
                  <td colspan="9">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="outgoing-modal__footer">
          <button type="button" class="outgoing-modal__tool-btn" id="outgoing-modal-save-btn">
            SAVE
          </button>
          <button type="button" class="outgoing-modal__tool-btn" id="outgoing-modal-barcode-btn">
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
  const modalDocCodeInput = main.querySelector('#outgoing-modal-doc-no');
  const modalDocCategoryInput = main.querySelector('#outgoing-modal-category');
  const modalDocCodeSuggestions = main.querySelector('#outgoing-doc-code-suggestions');
  const modalRecipientInput = main.querySelector('#outgoing-modal-recipient');
  const modalRecipientDeptInput = main.querySelector('#outgoing-modal-recipient-dept');
  const modalRecipientSuggestions = main.querySelector('#outgoing-recipient-suggestions');
  const modalTitle = main.querySelector('#outgoing-modal-title');
  const saveBtn = main.querySelector('#outgoing-modal-save-btn');
  const barcodeBtn = main.querySelector('#outgoing-modal-barcode-btn');
  const previewBtn = main.querySelector('#outgoing-modal-preview-btn');
  const categoryByCode = new Map();
  const suggestionCache = new Map();
  const recipientSuggestionCache = new Map();
  const departmentByRecipientName = new Map();
  let fetchSuggestionsTimer = null;
  let suggestionsAbortController = null;
  let fetchRecipientSuggestionsTimer = null;
  let recipientSuggestionsAbortController = null;
  const getCurrentDate = () =>
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });

  const normalizeCode = (value) => (value || '').trim().toLowerCase();
  const normalizeNameToken = (value) => (value || '').trim().toLowerCase();
  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const renderCodeSuggestions = (rows) => {
    if (!(modalDocCodeSuggestions instanceof HTMLDataListElement)) return;
    modalDocCodeSuggestions.innerHTML = rows
      .map((row) => {
        const code = escapeHtml(row.code || '');
        const typeName = escapeHtml(row.name || '');
        return `<option value="${code}" label="${typeName}"></option>`;
      })
      .join('');
  };

  const renderRecipientSuggestions = (rows) => {
    if (!(modalRecipientSuggestions instanceof HTMLDataListElement)) return;
    modalRecipientSuggestions.innerHTML = rows
      .map((row) => {
        const fullName = escapeHtml(
          row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        );
        const label = escapeHtml(
          [row.office_department, row.position_role].filter(Boolean).join(' · ') || row.username || '',
        );
        return `<option value="${fullName}" label="${label}"></option>`;
      })
      .join('');
  };

  const fetchDocumentTypeSuggestions = async (query) => {
    const normalizedQuery = normalizeCode(query);
    if (!normalizedQuery) {
      renderCodeSuggestions([]);
      return [];
    }

    if (suggestionCache.has(normalizedQuery)) {
      const cachedRows = suggestionCache.get(normalizedQuery);
      renderCodeSuggestions(cachedRows);
      return cachedRows;
    }

    if (suggestionsAbortController) suggestionsAbortController.abort();
    suggestionsAbortController = new AbortController();

    try {
      const response = await fetch(apiUrl('/api/system-config/categories/'), {
        credentials: 'include',
        signal: suggestionsAbortController.signal,
      });
      if (!response.ok) return [];

      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const matches = rows
        .filter((row) => String(row?.status || '').toLowerCase() === 'active')
        .filter((row) => normalizeCode(row?.code).includes(normalizedQuery))
        .slice(0, 8);

      matches.forEach((row) => {
        categoryByCode.set(normalizeCode(row.code), row.name || '');
      });
      suggestionCache.set(normalizedQuery, matches);
      renderCodeSuggestions(matches);
      return matches;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Outgoing: failed to load document code suggestions', error);
      }
      return [];
    }
  };

  const fetchRecipientSuggestions = async (query) => {
    const normalizedQuery = normalizeNameToken(query);
    if (!normalizedQuery) {
      renderRecipientSuggestions([]);
      return [];
    }

    if (recipientSuggestionCache.has(normalizedQuery)) {
      const cachedRows = recipientSuggestionCache.get(normalizedQuery);
      renderRecipientSuggestions(cachedRows);
      return cachedRows;
    }

    if (recipientSuggestionsAbortController) recipientSuggestionsAbortController.abort();
    recipientSuggestionsAbortController = new AbortController();

    try {
      const response = await fetch(apiUrl('/api/system-config/usersRoles/'), {
        credentials: 'include',
        signal: recipientSuggestionsAbortController.signal,
      });
      if (!response.ok) return [];

      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const activeRows = rows.filter((row) => String(row?.status || '').toLowerCase() === 'active');
      activeRows.forEach((row) => {
        const displayName =
          row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
        if (displayName) {
          departmentByRecipientName.set(
            normalizeNameToken(displayName),
            row.office_department || '',
          );
        }
      });
      const matches = activeRows
        .filter((row) => {
          const fn = normalizeNameToken(row?.first_name);
          const ln = normalizeNameToken(row?.last_name);
          const mn = normalizeNameToken(row?.middle_name);
          const full = normalizeNameToken(row?.full_name);
          const un = normalizeNameToken(row?.username);
          return (
            fn.includes(normalizedQuery) ||
            ln.includes(normalizedQuery) ||
            mn.includes(normalizedQuery) ||
            full.includes(normalizedQuery) ||
            un.includes(normalizedQuery)
          );
        })
        .slice(0, 12);

      recipientSuggestionCache.set(normalizedQuery, matches);
      renderRecipientSuggestions(matches);
      return matches;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Outgoing: failed to load recipient suggestions', error);
      }
      return [];
    }
  };

  const fillRecipientDeptFromName = async (recipientName) => {
    if (!(modalRecipientDeptInput instanceof HTMLInputElement)) return;
    const key = normalizeNameToken(recipientName);
    if (!key) {
      modalRecipientDeptInput.value = '';
      return;
    }

    if (!departmentByRecipientName.has(key)) {
      await fetchRecipientSuggestions(recipientName);
    }

    const dept = departmentByRecipientName.get(key);
    modalRecipientDeptInput.value = dept ?? '';
  };

  const fillDocumentTypeFromCode = async (code) => {
    if (!(modalDocCategoryInput instanceof HTMLInputElement)) return;
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) return;

    if (!categoryByCode.has(normalizedCode)) {
      await fetchDocumentTypeSuggestions(code);
    }

    const documentType = categoryByCode.get(normalizedCode);
    if (documentType) {
      modalDocCategoryInput.value = documentType;
    }
  };

  if (modalDocCodeInput instanceof HTMLInputElement) {
    modalDocCodeInput.addEventListener('input', () => {
      if (fetchSuggestionsTimer) clearTimeout(fetchSuggestionsTimer);
      fetchSuggestionsTimer = setTimeout(() => {
        fetchDocumentTypeSuggestions(modalDocCodeInput.value);
      }, 250);
    });

    modalDocCodeInput.addEventListener('change', () => {
      fillDocumentTypeFromCode(modalDocCodeInput.value);
    });

    modalDocCodeInput.addEventListener('blur', () => {
      fillDocumentTypeFromCode(modalDocCodeInput.value);
    });
  }

  if (modalRecipientInput instanceof HTMLInputElement) {
    modalRecipientInput.addEventListener('input', () => {
      if (!modalRecipientInput.value.trim() && modalRecipientDeptInput instanceof HTMLInputElement) {
        modalRecipientDeptInput.value = '';
      }
      if (fetchRecipientSuggestionsTimer) clearTimeout(fetchRecipientSuggestionsTimer);
      fetchRecipientSuggestionsTimer = setTimeout(() => {
        fetchRecipientSuggestions(modalRecipientInput.value);
      }, 250);
    });

    modalRecipientInput.addEventListener('change', () => {
      fillRecipientDeptFromName(modalRecipientInput.value);
    });

    modalRecipientInput.addEventListener('blur', () => {
      fillRecipientDeptFromName(modalRecipientInput.value);
    });
  }

  const appendOutgoingTableRow = (row) => {
    const tbody = main.querySelector('#outgoing-table-tbody');
    if (!tbody || !row) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${escapeHtml(row.document_code)}</td>
        <td>${escapeHtml(row.document_state)}</td>
        <td>${escapeHtml(outgoingForwardOffice(row))}</td>
        <td>${escapeHtml(row.date_created)}</td>
        <td>${escapeHtml(row.subject)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${escapeHtml(row.prepared_by)}</td>
        <td class="outgoing-table__actions">
          <button type="button" class="outgoing-table__view-btn" data-id="${Number(row.id)}" aria-label="View document">View</button>
        </td>
      `;
    tbody.append(tr);
  };

  const clearModalDocumentFlow = () => {
    const flowTbody = main.querySelector('#outgoing-modal-flow-tbody');
    if (flowTbody) {
      flowTbody.innerHTML = '<tr><td colspan="9">&nbsp;</td></tr>';
    }
  };

  const renderModalDocumentFlow = (row) => {
    const flowTbody = main.querySelector('#outgoing-modal-flow-tbody');
    if (!flowTbody || !row) return;
    const dash = '—';
    const date = escapeHtml(row.date_created || '');
    const recipient = escapeHtml(row.recipient_name || '');
    const receivedFrom = escapeHtml(row.prepared_by || '');
    const status = escapeHtml(row.document_state || '');
    const receivedBy = (row.office_name || '').trim()
      ? escapeHtml(row.office_name)
      : dash;
    const fwdRaw = (row.recipient_department || '').trim() || (row.recipient_name || '').trim();
    const forwardedTo = fwdRaw ? escapeHtml(fwdRaw) : dash;
    const forwardDate = date;
    const carrier = dash;
    const remarks = (row.remarks || '').trim() ? escapeHtml(row.remarks) : dash;
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

  const setModalViewMode = (isView) => {
    if (!modal) return;
    modal.classList.toggle('outgoing-modal--view', isView);
    if (modalTitle) modalTitle.textContent = isView ? 'VIEW OUTGOING DOCUMENT' : 'OUTGOING DOCUMENT';
    [saveBtn, barcodeBtn, previewBtn].forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      btn.hidden = isView;
      btn.toggleAttribute('hidden', isView);
      if (isView) btn.setAttribute('aria-hidden', 'true');
      else btn.removeAttribute('aria-hidden');
    });
    const docState = main.querySelector('#outgoing-modal-doc-state');
    const subjectEl = main.querySelector('#outgoing-modal-subject');
    const descriptionEl = main.querySelector('#outgoing-modal-description');
    const preparedByEl = main.querySelector('#outgoing-modal-prepared-by');
    const remarksEl = main.querySelector('#outgoing-modal-remarks');
    const editable = [
      docState,
      modalDocCodeInput,
      modalDocCategoryInput,
      subjectEl,
      descriptionEl,
      preparedByEl,
      modalRecipientInput,
      remarksEl,
    ];
    editable.forEach((el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.readOnly = isView;
      }
    });
    if (modalRecipientDeptInput instanceof HTMLInputElement) modalRecipientDeptInput.readOnly = true;
    if (modalDateCreated instanceof HTMLInputElement) modalDateCreated.readOnly = true;
    if (modalDocCodeInput instanceof HTMLInputElement) {
      if (isView) modalDocCodeInput.removeAttribute('list');
      else modalDocCodeInput.setAttribute('list', 'outgoing-doc-code-suggestions');
    }
    if (modalRecipientInput instanceof HTMLInputElement) {
      if (isView) modalRecipientInput.removeAttribute('list');
      else modalRecipientInput.setAttribute('list', 'outgoing-recipient-suggestions');
    }
  };

  const populateModalFromRow = (row) => {
    if (modalDateCreated instanceof HTMLInputElement) modalDateCreated.value = row.date_created || '';
    const docState = main.querySelector('#outgoing-modal-doc-state');
    if (docState instanceof HTMLInputElement) docState.value = row.document_state || '';
    if (modalDocCodeInput instanceof HTMLInputElement) modalDocCodeInput.value = row.document_code || '';
    if (modalDocCategoryInput instanceof HTMLInputElement) modalDocCategoryInput.value = row.category || '';
    const subjectEl = main.querySelector('#outgoing-modal-subject');
    if (subjectEl instanceof HTMLInputElement) subjectEl.value = row.subject || '';
    const descriptionEl = main.querySelector('#outgoing-modal-description');
    if (descriptionEl instanceof HTMLTextAreaElement) descriptionEl.value = row.description || '';
    const preparedByEl = main.querySelector('#outgoing-modal-prepared-by');
    if (preparedByEl instanceof HTMLInputElement) preparedByEl.value = row.prepared_by || '';
    if (modalRecipientInput instanceof HTMLInputElement) modalRecipientInput.value = row.recipient_name || '';
    if (modalRecipientDeptInput instanceof HTMLInputElement) {
      modalRecipientDeptInput.value = row.recipient_department || '';
    }
    const remarksEl = main.querySelector('#outgoing-modal-remarks');
    if (remarksEl instanceof HTMLInputElement) remarksEl.value = row.remarks || '';
    renderModalDocumentFlow(row);
  };

  const openViewModal = async (id) => {
    const docId = Number(id);
    if (!docId) return;
    try {
      const res = await fetch(apiUrl(`/api/outgoing-documents/${docId}/`), {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load document.');
      if (!data.row) throw new Error('Document not found.');
      populateModalFromRow(data.row);
      setModalViewMode(true);
      if (modal) modal.hidden = false;
      document.body.classList.add('outgoing-modal-open');
      logAction('View outgoing document');
    } catch (err) {
      await notify({
        icon: 'error',
        title: 'Load failed',
        text: err.message || 'Could not open document.',
      });
    }
  };

  const resetNewDocumentForm = () => {
    if (modalDateCreated instanceof HTMLInputElement) modalDateCreated.value = getCurrentDate();
    const docState = main.querySelector('#outgoing-modal-doc-state');
    if (docState instanceof HTMLInputElement) docState.value = 'NEW';
    if (modalDocCodeInput instanceof HTMLInputElement) modalDocCodeInput.value = '';
    if (modalDocCategoryInput instanceof HTMLInputElement) modalDocCategoryInput.value = '';
    const subjectEl = main.querySelector('#outgoing-modal-subject');
    if (subjectEl instanceof HTMLInputElement) subjectEl.value = '';
    const descriptionEl = main.querySelector('#outgoing-modal-description');
    if (descriptionEl instanceof HTMLTextAreaElement) descriptionEl.value = '';
    const preparedByEl = main.querySelector('#outgoing-modal-prepared-by');
    if (preparedByEl instanceof HTMLInputElement) preparedByEl.value = '';
    if (modalRecipientInput instanceof HTMLInputElement) modalRecipientInput.value = '';
    if (modalRecipientDeptInput instanceof HTMLInputElement) modalRecipientDeptInput.value = '';
    const remarksEl = main.querySelector('#outgoing-modal-remarks');
    if (remarksEl instanceof HTMLInputElement) remarksEl.value = '';
    renderCodeSuggestions([]);
    clearModalDocumentFlow();
    setModalViewMode(false);
  };

  const openModal = () => {
    if (!modal) return;
    resetNewDocumentForm();
    modal.hidden = false;
    document.body.classList.add('outgoing-modal-open');
    modalFirstInput?.focus();
    logAction('Open New Document form');
  };

  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('outgoing-modal-open');
    setModalViewMode(false);
  };

  main.querySelector('#outgoing-modal-save-btn')?.addEventListener('click', async () => {
    const document_code = main.querySelector('#outgoing-modal-doc-no')?.value?.trim() || '';
    const subject = main.querySelector('#outgoing-modal-subject')?.value?.trim() || '';
    if (!document_code || !subject) {
      await notify({
        icon: 'warning',
        title: 'Required fields',
        text: 'Please enter document code and subject.',
      });
      return;
    }
    const payload = {
      document_code,
      document_state: main.querySelector('#outgoing-modal-doc-state')?.value?.trim() || 'NEW',
      category: main.querySelector('#outgoing-modal-category')?.value?.trim() || '',
      subject,
      description: main.querySelector('#outgoing-modal-description')?.value?.trim() || '',
      prepared_by: main.querySelector('#outgoing-modal-prepared-by')?.value?.trim() || '',
      recipient_name: main.querySelector('#outgoing-modal-recipient')?.value?.trim() || '',
      recipient_department: main.querySelector('#outgoing-modal-recipient-dept')?.value?.trim() || '',
      remarks: main.querySelector('#outgoing-modal-remarks')?.value?.trim() || '',
    };
    try {
      const res = await fetch(apiUrl('/api/outgoing-documents/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.row) {
        appendOutgoingTableRow(data.row);
        renderModalDocumentFlow(data.row);
      }
      await notify({
        icon: 'success',
        title: 'Saved',
        text: 'Outgoing document saved successfully.',
      });
    } catch (err) {
      await notify({
        icon: 'error',
        title: 'Save failed',
        text: err.message || 'Could not save document.',
      });
    }
  });

  main.querySelector('#outgoing-table-tbody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.outgoing-table__view-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    e.preventDefault();
    await openViewModal(id);
  });

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
    const res = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
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

  await loadOutgoingDocuments(main);

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
