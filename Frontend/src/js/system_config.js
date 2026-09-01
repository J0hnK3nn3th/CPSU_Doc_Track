import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';
import { apiUrl } from './api.js';
import { confirmAction, notify } from './notifications.js';
import { hideLoading, showLoading } from './loading.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

const SYSTEM_CONFIG_DATA = {
  categories: {
    label: 'Document Type',
    columns: ['Document Code', 'Document Type', 'Description', 'Status'],
    endpoint: 'categories',
    idField: 'document_type_id',
    viewFields: [
      { key: 'code', label: 'Document Code' },
      { key: 'name', label: 'Document Type' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status' },
    ],
    mapRow: (row) => [row.code || '-', row.name || '-', row.description || '-', row.status || '-'],
  },
  offices: {
    label: 'Offices and Departments',
    columns: ['Office Code', 'Office/Department', 'Head', 'Status'],
    endpoint: 'offices',
    idField: 'office_department_id',
    viewFields: [
      { key: 'code', label: 'Office Code' },
      { key: 'name', label: 'Office/Department' },
      { key: 'head', label: 'Office/Department Head' },
      { key: 'can_mark_complete', label: 'Can Mark Complete' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status' },
    ],
    mapRow: (row) => [row.code || '-', row.name || '-', row.head || '-', row.status || '-'],
  },
  usersRoles: {
    label: 'Users and Roles',
    columns: ['Username', 'Full Name', 'Office', 'Role', 'Status'],
    endpoint: 'usersRoles',
    idField: 'user_role_id',
    viewFields: [
      { key: 'full_name', label: 'Full Name' },
      { key: 'first_name', label: 'First Name' },
      { key: 'middle_name', label: 'Middle Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'name_extension', label: 'Name Extension' },
      { key: 'office_department', label: 'Office/Department' },
      { key: 'position_role', label: 'Position/Role' },
      { key: 'status', label: 'Status' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password' },
    ],
    hiddenViewFields: ['id', 'user_role_id'],
    mapRow: (row) => [row.username || '-', row.full_name || '-', row.office_department || '-', row.position_role || '-', row.status || '-'],
  },
};

const state = {
  activeTab: 'categories',
  rowsByTab: { categories: [], offices: [], usersRoles: [] },
  editRowByTab: { categories: null, offices: null, usersRoles: null },
};

function isDisabledRow(row) {
  return String(row?.status || '').toLowerCase() === 'disabled';
}

function getRowId(tabId, row) {
  const fieldName = SYSTEM_CONFIG_DATA[tabId]?.idField;
  const rawId = row?.id ?? (fieldName ? row?.[fieldName] : null);
  const numericId = Number(rawId);
  return Number.isFinite(numericId) ? numericId : null;
}

function applyButtonBackgrounds(main) {
  if (!main) return;

  main.querySelectorAll('.sys-config-content__add-btn, .sys-config-action-btn, .sys-config-modal__btn--primary').forEach((button) => {
    if (button instanceof HTMLElement) {
      button.style.backgroundColor = PRIMARY;
      button.style.color = '#FFFFFF';
    }
  });

  main.querySelectorAll('.sys-config-tabs__btn').forEach((button) => {
    if (button instanceof HTMLElement) {
      button.style.backgroundColor = '';
      button.style.color = '';
      button.style.border = `1px solid ${PRIMARY}`;
    }
  });

  main.querySelectorAll('.sys-config-modal__btn:not(.sys-config-modal__btn--primary)').forEach((button) => {
    if (button instanceof HTMLElement) {
      button.style.backgroundColor = PRIMARY_LIGHT;
      button.style.color = '#FFFFFF';
    }
  });
}

function actionButtons(row) {
  const rowId = getRowId(state.activeTab, row);
  if (!rowId) return '';
  const disabled = isDisabledRow(row);
  const toggleAction = disabled ? 'enable' : 'disable';
  const toggleTitle = disabled ? 'Enable' : 'Disable';
  const toggleModifier = disabled ? 'sys-config-action-btn--enable' : 'sys-config-action-btn--danger';

  return `
    <div class="sys-config-actions">
      <button type="button" class="sys-config-action-btn" data-action="view" data-id="${rowId}" title="View">View</button>
      <button type="button" class="sys-config-action-btn" data-action="edit" data-id="${rowId}" title="Edit">Edit</button>
      <button type="button" class="sys-config-action-btn ${toggleModifier}" data-action="${toggleAction}" data-id="${rowId}" title="${toggleTitle}">${toggleTitle}</button>
    </div>
  `;
}

async function requestJson(url, options = {}) {
  const res = await fetch(apiUrl(url), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function loadTabData(tabId) {
  const tab = SYSTEM_CONFIG_DATA[tabId];
  const data = await requestJson(`/api/system-config/${tab.endpoint}/`);
  state.rowsByTab[tabId] = Array.isArray(data.rows) ? data.rows : [];
}

function renderTable(main, tabId) {
  const dataset = SYSTEM_CONFIG_DATA[tabId];
  if (!dataset) return;

  const title = main.querySelector('#sys-config-table-title');
  const addNewButton = main.querySelector('#sys-config-add-new-btn');
  const theadRow = main.querySelector('#sys-config-table-head-row');
  const tbody = main.querySelector('#sys-config-table-body');
  const tableWrap = main.querySelector('.sys-config-table-wrap');

  if (!title || !addNewButton || !theadRow || !tbody || !tableWrap) return;

  title.textContent = dataset.label;
  addNewButton.setAttribute('data-tab', tabId);
  theadRow.innerHTML = [...dataset.columns, 'Actions'].map((column) => `<th scope="col">${column}</th>`).join('');
  tbody.innerHTML = state.rowsByTab[tabId]
    .map((row) => `<tr>${dataset.mapRow(row).map((value) => `<td>${value}</td>`).join('')}<td>${actionButtons(row)}</td></tr>`)
    .join('');
  tableWrap.classList.toggle('sys-config-table-wrap--scrollable', state.rowsByTab[tabId].length > 7);
  applyButtonBackgrounds(main);
}

async function setActiveTab(main, tabId) {
  state.activeTab = tabId;
  main.querySelectorAll('.sys-config-tabs__btn').forEach((button) => {
    const isActive = button.getAttribute('data-tab') === tabId;
    button.classList.toggle('sys-config-tabs__btn--active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  showLoading();
  try {
    // Ensure the spinner paints before starting data work.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await loadTabData(tabId);
    renderTable(main, tabId);
  } finally {
    hideLoading();
  }
}

function buildSystemConfigMain() {
  const main = document.createElement('main');
  main.className = 'admin-main sys-config-main';

  main.innerHTML = `
    <header class="sys-config-page-head">
      <h1 class="sys-config-page-head__title">System Configuration</h1>
    </header>

    <section class="admin-panel sys-config-panel" aria-label="System configuration tabs and table">
      <div class="admin-panel__body">
        <div class="sys-config-tabs" role="tablist" aria-label="System configuration sections">
          <button type="button" class="sys-config-tabs__btn sys-config-tabs__btn--active" data-tab="categories" role="tab" aria-selected="true">
            Document Type
          </button>
          <button type="button" class="sys-config-tabs__btn" data-tab="offices" role="tab" aria-selected="false" tabindex="-1">
            Offices and Departments
          </button>
          <button type="button" class="sys-config-tabs__btn" data-tab="usersRoles" role="tab" aria-selected="false" tabindex="-1">
            Users and Roles
          </button>
        </div>

        <div class="sys-config-content">
          <div class="sys-config-content__head">
            <h2 class="sys-config-content__title" id="sys-config-table-title">Document Type</h2>
            <button type="button" class="sys-config-content__add-btn" id="sys-config-add-new-btn" data-tab="categories">
              Add New
            </button>
          </div>
          <div class="admin-table-wrap sys-config-table-wrap">
            <table class="admin-table sys-config-table">
              <thead>
                <tr id="sys-config-table-head-row"></tr>
              </thead>
              <tbody id="sys-config-table-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <div class="sys-config-modal" id="doc-category-modal" role="dialog" aria-modal="true" aria-labelledby="doc-category-modal-title" hidden>
      <div class="sys-config-modal__backdrop" data-modal-close="true"></div>
      <div class="sys-config-modal__dialog">
        <header class="sys-config-modal__header">
          <h3 class="sys-config-modal__title" id="doc-category-modal-title">Add Document Type</h3>
        </header>
        <div class="sys-config-modal__body">
          <div class="sys-config-modal__field">
            <label for="doc-category-code">Document Code</label>
            <input id="doc-category-code" type="text" autocomplete="off" />
          </div>
          <div class="sys-config-modal__field">
            <label for="doc-category-name">Document Type</label>
            <input id="doc-category-name" type="text" autocomplete="off" />
          </div>
          <div class="sys-config-modal__field">
            <label for="doc-category-description">Description</label>
            <textarea id="doc-category-description" rows="4"></textarea>
          </div>
        </div>
        <footer class="sys-config-modal__footer">
          <button type="button" class="sys-config-modal__btn sys-config-modal__btn--primary" data-save-tab="categories">Save</button>
          <button type="button" class="sys-config-modal__btn" data-modal-close="true">Cancel</button>
        </footer>
      </div>
    </div>

    <div
      class="sys-config-modal"
      id="office-department-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="office-department-modal-title"
      hidden
    >
      <div class="sys-config-modal__backdrop" data-modal-close="true"></div>
      <div class="sys-config-modal__dialog">
        <header class="sys-config-modal__header">
          <h3 class="sys-config-modal__title" id="office-department-modal-title">Add Office/Department</h3>
        </header>
        <div class="sys-config-modal__body">
          <div class="sys-config-modal__field">
            <label for="office-department-id">Office/Department ID</label>
            <input id="office-department-id" type="text" autocomplete="off" />
          </div>
          <div class="sys-config-modal__field">
            <label for="office-department-name">Office/Department Name</label>
            <input id="office-department-name" type="text" autocomplete="off" />
          </div>
          <div class="sys-config-modal__field">
            <label for="office-department-head">Office/Department Head</label>
            <input id="office-department-head" type="text" autocomplete="off" />
          </div>
          <div class="sys-config-modal__field">
            <input id="office-department-can-mark-complete" type="checkbox" />
            <label for="office-department-can-mark-complete">Can mark complete</label>
          </div>
          <div class="sys-config-modal__field">
            <label for="office-department-description">Description</label>
            <textarea id="office-department-description" rows="4"></textarea>
          </div>
        </div>
        <footer class="sys-config-modal__footer">
          <button type="button" class="sys-config-modal__btn sys-config-modal__btn--primary" data-save-tab="offices">Save</button>
          <button type="button" class="sys-config-modal__btn" data-modal-close="true">Cancel</button>
        </footer>
      </div>
    </div>

    <div
      class="sys-config-modal"
      id="users-roles-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="users-roles-modal-title"
      hidden
    >
      <div class="sys-config-modal__backdrop" data-modal-close="true"></div>
      <div class="sys-config-modal__dialog">
        <header class="sys-config-modal__header">
          <h3 class="sys-config-modal__title" id="users-roles-modal-title">Add User and Role</h3>
        </header>
        <div class="sys-config-modal__body">
          <p class="sys-config-modal__section-title">User Information</p>
          <div class="sys-config-modal__row">
            <div class="sys-config-modal__field">
              <label for="user-first-name">First Name</label>
              <input id="user-first-name" type="text" autocomplete="off" />
            </div>
            <div class="sys-config-modal__field">
              <label for="user-last-name">Last Name</label>
              <input id="user-last-name" type="text" autocomplete="off" />
            </div>
          </div>
          <div class="sys-config-modal__row">
            <div class="sys-config-modal__field">
              <label for="user-middle-name">Middle Name</label>
              <input id="user-middle-name" type="text" autocomplete="off" />
            </div>
            <div class="sys-config-modal__field">
              <label for="user-name-extension">Name Extension</label>
              <input id="user-name-extension" type="text" autocomplete="off" />
            </div>
          </div>

          <p class="sys-config-modal__section-title">Designation</p>
          <div class="sys-config-modal__row">
            <div class="sys-config-modal__field">
              <label for="user-office-department">Office/Department</label>
              <select id="user-office-department">
                <option value="">Select Office/Department</option>
              </select>
            </div>
            <div class="sys-config-modal__field">
              <label for="user-position-role">Position/Role</label>
              <input id="user-position-role" type="text" autocomplete="off" />
            </div>
          </div>

          <p class="sys-config-modal__section-title">Credentials</p>
          <div class="sys-config-modal__row">
            <div class="sys-config-modal__field">
              <label for="user-username">User Name</label>
              <input id="user-username" type="text" autocomplete="off" />
            </div>
            <div class="sys-config-modal__field">
              <label for="user-password">Password</label>
              <input id="user-password" type="text" autocomplete="new-password" />
            </div>
          </div>
        </div>
        <footer class="sys-config-modal__footer">
          <button type="button" class="sys-config-modal__btn sys-config-modal__btn--primary" data-save-tab="usersRoles">Save</button>
          <button type="button" class="sys-config-modal__btn" data-modal-close="true">Cancel</button>
        </footer>
      </div>
    </div>

  `;

  applyButtonBackgrounds(main);

  main.querySelectorAll('.sys-config-tabs__btn').forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      if (!tabId) return;
      setActiveTab(main, tabId);
    });
  });

  const categoryModal = main.querySelector('#doc-category-modal');
  const officeDepartmentModal = main.querySelector('#office-department-modal');
  const usersRolesModal = main.querySelector('#users-roles-modal');
  const firstCategoryInput = main.querySelector('#doc-category-code');
  const firstOfficeDepartmentInput = main.querySelector('#office-department-id');
  const firstUsersRolesInput = main.querySelector('#user-first-name');

  const allModals = [categoryModal, officeDepartmentModal, usersRolesModal].filter(Boolean);
  const tabModalMap = {
    categories: categoryModal,
    offices: officeDepartmentModal,
    usersRoles: usersRolesModal,
  };

  const closeAllModals = () => {
    allModals.forEach((modal) => {
      modal.hidden = true;
    });
    state.editRowByTab.categories = null;
    state.editRowByTab.offices = null;
    state.editRowByTab.usersRoles = null;
    document.body.classList.remove('sys-config-modal-open');
  };

  const resetForms = () => {
    main.querySelectorAll('.sys-config-modal input, .sys-config-modal textarea, .sys-config-modal select').forEach((field) => {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
        field.checked = false;
        return;
      }
      field.value = '';
    });
  };

  const setModalMode = (tabId, mode) => {
    const modal = tabModalMap[tabId];
    if (!modal) return;
    const saveButton = modal.querySelector('.sys-config-modal__btn--primary');
    const closeButton = modal.querySelector('.sys-config-modal__footer .sys-config-modal__btn:not(.sys-config-modal__btn--primary)');
    const titleElement = modal.querySelector('.sys-config-modal__title');
    const fields = modal.querySelectorAll('input, textarea, select');
    const sectionLabel = SYSTEM_CONFIG_DATA[tabId]?.label || 'Record';
    const isView = mode === 'view';
    const isEdit = mode === 'edit';

    if (titleElement) {
      if (isView) titleElement.textContent = `View ${sectionLabel}`;
      else if (isEdit) titleElement.textContent = `Edit ${sectionLabel}`;
      else titleElement.textContent = `Add ${sectionLabel}`;
    }

    fields.forEach((field) => {
      if (field instanceof HTMLElement) {
        field.toggleAttribute('disabled', isView);
      }
    });

    if (saveButton instanceof HTMLButtonElement) {
      saveButton.hidden = isView;
      saveButton.disabled = isView;
    }
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.textContent = isView ? 'Close' : 'Cancel';
    }
  };

  const openCategoryModal = () => {
    if (!categoryModal) return;
    closeAllModals();
    categoryModal.hidden = false;
    document.body.classList.add('sys-config-modal-open');
    resetForms();
    firstCategoryInput?.focus();
  };

  const openOfficeDepartmentModal = () => {
    if (!officeDepartmentModal) return;
    closeAllModals();
    officeDepartmentModal.hidden = false;
    document.body.classList.add('sys-config-modal-open');
    resetForms();
    firstOfficeDepartmentInput?.focus();
  };

  const populateOfficeDepartmentOptions = async (selectedOffice = '') => {
    if (!state.rowsByTab.offices.length) {
      await loadTabData('offices');
    }
    const officeSelect = main.querySelector('#user-office-department');
    if (!officeSelect) return;

    const uniqueOfficeNames = [...new Set(state.rowsByTab.offices.map((office) => office.name).filter(Boolean))];
    officeSelect.innerHTML = [
      '<option value="">Select Office/Department</option>',
      ...uniqueOfficeNames.map((name) => `<option value="${name}">${name}</option>`),
    ].join('');
    officeSelect.value = selectedOffice || '';
  };

  const openUsersRolesModal = async (selectedOffice = '') => {
    if (!usersRolesModal) return;
    closeAllModals();
    usersRolesModal.hidden = false;
    document.body.classList.add('sys-config-modal-open');
    resetForms();
    await populateOfficeDepartmentOptions(selectedOffice);
    firstUsersRolesInput?.focus();
  };

  const collectPayload = (tabId) => {
    if (tabId === 'categories') {
      return {
        code: main.querySelector('#doc-category-code')?.value || '',
        name: main.querySelector('#doc-category-name')?.value || '',
        description: main.querySelector('#doc-category-description')?.value || '',
      };
    }
    if (tabId === 'offices') {
      return {
        code: main.querySelector('#office-department-id')?.value || '',
        name: main.querySelector('#office-department-name')?.value || '',
        head: main.querySelector('#office-department-head')?.value || '',
        description: main.querySelector('#office-department-description')?.value || '',
        can_mark_complete: main.querySelector('#office-department-can-mark-complete')?.checked || false,
      };
    }
    return {
      first_name: main.querySelector('#user-first-name')?.value || '',
      last_name: main.querySelector('#user-last-name')?.value || '',
      middle_name: main.querySelector('#user-middle-name')?.value || '',
      name_extension: main.querySelector('#user-name-extension')?.value || '',
      office_department: main.querySelector('#user-office-department')?.value || '',
      position_role: main.querySelector('#user-position-role')?.value || '',
      username: main.querySelector('#user-username')?.value || '',
      password: main.querySelector('#user-password')?.value || '',
    };
  };

  const fillForm = (tabId, row) => {
    if (tabId === 'categories') {
      main.querySelector('#doc-category-code').value = row.code || '';
      main.querySelector('#doc-category-name').value = row.name || '';
      main.querySelector('#doc-category-description').value = row.description || '';
      return;
    }
    if (tabId === 'offices') {
      main.querySelector('#office-department-id').value = row.code || '';
      main.querySelector('#office-department-name').value = row.name || '';
      main.querySelector('#office-department-head').value = row.head || '';
      main.querySelector('#office-department-description').value = row.description || '';
      main.querySelector('#office-department-can-mark-complete').checked = Boolean(row.can_mark_complete);
      return;
    }
    main.querySelector('#user-first-name').value = row.first_name || '';
    main.querySelector('#user-last-name').value = row.last_name || '';
    main.querySelector('#user-middle-name').value = row.middle_name || '';
    main.querySelector('#user-name-extension').value = row.name_extension || '';
    main.querySelector('#user-office-department').value = row.office_department || '';
    main.querySelector('#user-position-role').value = row.position_role || '';
    main.querySelector('#user-username').value = row.username || '';
    main.querySelector('#user-password').value = row.password || '';
  };

  const openModalForTab = async (tabId, row = null, mode = null) => {
    const resolvedMode = mode || (row ? 'edit' : 'create');
    if (tabId === 'categories') {
      openCategoryModal();
      state.editRowByTab[tabId] = resolvedMode === 'edit' ? row : null;
      if (row) fillForm(tabId, row);
      setModalMode(tabId, resolvedMode);
      return;
    }
    if (tabId === 'offices') {
      openOfficeDepartmentModal();
      state.editRowByTab[tabId] = resolvedMode === 'edit' ? row : null;
      if (row) fillForm(tabId, row);
      setModalMode(tabId, resolvedMode);
      return;
    }
    await openUsersRolesModal(row?.office_department || '');
    state.editRowByTab[tabId] = resolvedMode === 'edit' ? row : null;
    if (row) fillForm(tabId, row);
    setModalMode(tabId, resolvedMode);
  };

  main.querySelector('#sys-config-add-new-btn')?.addEventListener('click', () => {
    const activeTab = main.querySelector('#sys-config-add-new-btn')?.getAttribute('data-tab') || 'categories';
    if (activeTab === 'categories') {
      openModalForTab('categories');
      return;
    }
    if (activeTab === 'offices') {
      openModalForTab('offices');
      return;
    }
    if (activeTab === 'usersRoles') {
      openModalForTab('usersRoles');
      return;
    }
    const activeLabel = SYSTEM_CONFIG_DATA[activeTab]?.label || 'current section';
    console.info(`System Configuration: Add New clicked for ${activeLabel} (modal not wired yet)`);
  });

  main.querySelectorAll('.sys-config-modal__btn--primary').forEach((button) => {
    button.addEventListener('click', async () => {
      const tabId = button.getAttribute('data-save-tab');
      if (!tabId) return;
      const editingRow = state.editRowByTab[tabId];
      const editingId = getRowId(tabId, editingRow);
      const payload = collectPayload(tabId);
      try {
        if (editingId) {
          await requestJson(`/api/system-config/${tabId}/${editingId}/`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await requestJson(`/api/system-config/${tabId}/`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        // Keep the user on the same configuration section after saving.
        await setActiveTab(main, tabId);
        closeAllModals();
        await notify({
          icon: 'success',
          title: 'Saved',
          text: `${SYSTEM_CONFIG_DATA[tabId]?.label || 'Record'} updated successfully.`,
        });
      } catch (error) {
        await notify({
          icon: 'error',
          title: 'Save failed',
          text: error.message || 'Failed to save data.',
        });
      }
    });
  });

  main.querySelector('#sys-config-table-body')?.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.sys-config-action-btn');
    if (!button) return;

    const action = button.getAttribute('data-action');
    const itemId = Number(button.getAttribute('data-id'));
    const rows = state.rowsByTab[state.activeTab];
    const row = rows.find((item) => getRowId(state.activeTab, item) === itemId);
    if (!row) return;

    if (action === 'view') {
      openModalForTab(state.activeTab, row, 'view');
      return;
    }
    if (action === 'edit') {
      openModalForTab(state.activeTab, row);
      return;
    }
    if (action === 'disable' || action === 'enable') {
      const enabling = action === 'enable';
      const confirmed = await confirmAction({
        title: `${enabling ? 'Enable' : 'Disable'} this record?`,
        text: enabling
          ? 'This record will become active again.'
          : 'You can re-enable it later from the system configuration data.',
      });
      if (!confirmed) return;
      try {
        await requestJson(`/api/system-config/${state.activeTab}/${itemId}/${action}/`, { method: 'PATCH' });
        await loadTabData(state.activeTab);
        renderTable(main, state.activeTab);
        await notify({
          icon: 'success',
          title: `Record ${enabling ? 'enabled' : 'disabled'}`,
          text: `The selected record has been ${enabling ? 'enabled' : 'disabled'}.`,
        });
      } catch (error) {
        await notify({
          icon: 'error',
          title: `${enabling ? 'Enable' : 'Disable'} failed`,
          text: error.message || `Failed to ${enabling ? 'enable' : 'disable'} record.`,
        });
      }
    }
  });

  allModals.forEach((modal) => {
    modal.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-modal-close="true"]')) {
        closeAllModals();
      }
    });
  });

  main.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const hasOpenModal = allModals.some((modal) => !modal.hidden);
    if (hasOpenModal) {
      closeAllModals();
    }
  });

  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  const initialTab = Object.prototype.hasOwnProperty.call(SYSTEM_CONFIG_DATA, requestedTab) ? requestedTab : 'categories';
  setActiveTab(main, initialTab);
  return main;
}

async function requireAuth() {
  try {
    const res = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
    if (res.ok) return true;
  } catch {
    /* network error - fall through */
  }
  window.location.replace('/');
  return false;
}

async function mountSystemConfig(root = document.querySelector('#app')) {
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
    activeId: 'settings',
    onSelect: () => closeSidebar(),
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildSystemConfigMain();

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

mountSystemConfig();
