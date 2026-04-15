import { createHeader } from '../header, footer, sidebar/header.js';
import { createSidebar } from '../header, footer, sidebar/sidebar.js';
import { apiUrl } from './api.js';
import { confirmAction, notify, showInfo } from './notifications.js';
import { hideLoading, showLoading } from './loading.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

const SYSTEM_CONFIG_DATA = {
  categories: {
    label: 'Document Type',
    columns: ['Document Code', 'Document Type', 'Description', 'Status'],
    endpoint: 'categories',
    idField: 'document_type_id',
    mapRow: (row) => [row.code || '-', row.name || '-', row.description || '-', row.status || '-'],
  },
  offices: {
    label: 'Offices and Departments',
    columns: ['Office Code', 'Office/Department', 'Head', 'Status'],
    endpoint: 'offices',
    idField: 'office_department_id',
    mapRow: (row) => [row.code || '-', row.name || '-', row.head || '-', row.status || '-'],
  },
  usersRoles: {
    label: 'Users and Roles',
    columns: ['Username', 'Full Name', 'Office', 'Role', 'Status'],
    endpoint: 'usersRoles',
    idField: 'user_role_id',
    mapRow: (row) => [row.username || '-', row.full_name || '-', row.office_department || '-', row.position_role || '-', row.status || '-'],
  },
};

const state = {
  activeTab: 'categories',
  rowsByTab: { categories: [], offices: [], usersRoles: [] },
  editRowByTab: { categories: null, offices: null, usersRoles: null },
};

function iconSvg(kind) {
  if (kind === 'view') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-5.5 0-9.5 5.1-10 6 .5.9 4.5 6 10 6s9.5-5.1 10-6c-.5-.9-4.5-6-10-6Zm0 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>';
  }
  if (kind === 'edit') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 17.25 9.81-9.82 2.76 2.76L5.76 20H3v-2.75ZM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0l-1.68 1.68 2.76 2.76 1.67-1.7Z"/></svg>';
  }
  if (kind === 'enable') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 16.2-3.9-3.9 1.4-1.4 2.5 2.5 8.1-8.1 1.4 1.4Z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.6 13.2-1.4 1.4L7.4 8.8l1.4-1.4Z"/></svg>';
}

function isDisabledRow(row) {
  return String(row?.status || '').toLowerCase() === 'disabled';
}

function getRowId(tabId, row) {
  const fieldName = SYSTEM_CONFIG_DATA[tabId]?.idField;
  const rawId = row?.id ?? (fieldName ? row?.[fieldName] : null);
  const numericId = Number(rawId);
  return Number.isFinite(numericId) ? numericId : null;
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
      <button type="button" class="sys-config-action-btn" data-action="view" data-id="${rowId}" title="View">${iconSvg('view')}</button>
      <button type="button" class="sys-config-action-btn" data-action="edit" data-id="${rowId}" title="Edit">${iconSvg('edit')}</button>
      <button type="button" class="sys-config-action-btn ${toggleModifier}" data-action="${toggleAction}" data-id="${rowId}" title="${toggleTitle}">${iconSvg(toggleAction)}</button>
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

  if (!title || !addNewButton || !theadRow || !tbody) return;

  title.textContent = dataset.label;
  addNewButton.setAttribute('data-tab', tabId);
  theadRow.innerHTML = [...dataset.columns, 'Actions'].map((column) => `<th scope="col">${column}</th>`).join('');
  tbody.innerHTML = state.rowsByTab[tabId]
    .map((row) => `<tr>${dataset.mapRow(row).map((value) => `<td>${value}</td>`).join('')}<td>${actionButtons(row)}</td></tr>`)
    .join('');
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
              <input id="user-password" type="password" autocomplete="new-password" />
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
    main.querySelectorAll('.sys-config-modal input, .sys-config-modal textarea').forEach((field) => {
      field.value = '';
    });
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

  const openModalForTab = async (tabId, row = null) => {
    if (tabId === 'categories') {
      openCategoryModal();
      state.editRowByTab[tabId] = row;
      if (row) fillForm(tabId, row);
      return;
    }
    if (tabId === 'offices') {
      openOfficeDepartmentModal();
      state.editRowByTab[tabId] = row;
      if (row) fillForm(tabId, row);
      return;
    }
    await openUsersRolesModal(row?.office_department || '');
    state.editRowByTab[tabId] = row;
    if (row) fillForm(tabId, row);
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
        await loadTabData(tabId);
        renderTable(main, tabId);
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
      const details = Object.entries(row)
        .map(([key, value]) => `<div><strong>${key}</strong>: ${value ?? '-'}</div>`)
        .join('');
      await showInfo({
        title: `${SYSTEM_CONFIG_DATA[state.activeTab]?.label || 'Record'} details`,
        html: details,
      });
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

  setActiveTab(main, 'categories');
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
