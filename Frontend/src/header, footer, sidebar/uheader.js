import { apiUrl } from '../js/api.js';
import { initNavigationLoading, navigateWithLoading } from '../js/loading.js';
import { notify } from '../js/notifications.js';

const logoUrl = '/src/images/cpsulogo.png';

function getCookie(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

async function logoutUser() {
  await fetch(apiUrl('/api/auth/csrf/'), { credentials: 'include' }).catch(() => null);
  const csrfToken = getCookie('csrftoken');
  const response = await fetch(apiUrl('/api/auth/logout/'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
  }).catch(() => null);

  if (!response) {
    navigateWithLoading('/');
    return;
  }

  if (!response.ok && ![401, 403].includes(response.status)) {
    throw new Error(`Logout failed (${response.status})`);
  }

  // Treat unauthorized/forbidden as already logged out and redirect.
  if ([401, 403].includes(response.status)) {
    navigateWithLoading('/');
    return;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const redirectTarget =
    typeof payload.redirect === 'string' && payload.redirect ? payload.redirect : '/';
  navigateWithLoading(redirectTarget);
}

async function loadCurrentUserProfile() {
  try {
    const response = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload && payload.authenticated ? payload : null;
  } catch {
    return null;
  }
}

async function changeUsername({ currentUsername, newUsername, confirmUsername }) {
  await fetch(apiUrl('/api/auth/csrf/'), { credentials: 'include' }).catch(() => null);
  const csrfToken = getCookie('csrftoken');
  const response = await fetch(apiUrl('/api/auth/change-username/'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: JSON.stringify({
      current_username: currentUsername,
      new_username: newUsername,
      confirm_username: confirmUsername,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to update username.');
  }
  return payload;
}

async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  await fetch(apiUrl('/api/auth/csrf/'), { credentials: 'include' }).catch(() => null);
  const csrfToken = getCookie('csrftoken');
  const response = await fetch(apiUrl('/api/auth/change-password/'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to update password.');
  }
  return payload;
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function buildRecipientAliases(profile) {
  const firstName = String(profile?.first_name || '').trim();
  const middleName = String(profile?.middle_name || '').trim();
  const lastName = String(profile?.last_name || '').trim();
  const middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';

  const aliases = new Set([
    normalizeToken(profile?.username),
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

function isNewForwardedDocument(row) {
  return normalizeToken(row?.document_state) === 'new';
}

function createNotificationToast(message) {
  const toast = document.createElement('div');
  toast.className = 'admin-header__notify-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.append(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 180);
  }, 3200);
}

function showCenterNotification(message, icon = 'info') {
  void notify({
    icon,
    title: 'Notification',
    text: message,
    timer: 2500,
  });
}

function loadDismissedNotificationIds() {
  try {
    const raw = window.localStorage.getItem('uheader.dismissedNotificationIds');
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((value) => Number(value))
        .filter((id) => Number.isInteger(id) && id > 0),
    );
  } catch {
    return new Set();
  }
}

function persistDismissedNotificationIds(idsSet) {
  try {
    const ids = Array.from(idsSet)
      .map((value) => Number(value))
      .filter((id) => Number.isInteger(id) && id > 0);
    window.localStorage.setItem('uheader.dismissedNotificationIds', JSON.stringify(ids));
  } catch {
    // Ignore storage write errors.
  }
}

/**
 * @param {{ onMenuToggle?: () => void }} [options]
 */
export function createHeader({ onMenuToggle } = {}) {
  initNavigationLoading();
  const header = document.createElement('header');
  header.className = 'admin-header';
  header.innerHTML = `
    <button type="button" class="admin-header__menu" aria-label="Toggle navigation menu">
      <span class="admin-header__menu-bar" aria-hidden="true"></span>
      <span class="admin-header__menu-bar" aria-hidden="true"></span>
      <span class="admin-header__menu-bar" aria-hidden="true"></span>
    </button>
    <div class="admin-header__brand">
      <img
        class="admin-header__logo"
        src="${logoUrl}"
        alt="Carlos Hilado Memorial State University"
        width="40"
        height="40"
        decoding="async"
      />
      <div class="admin-header__titles">
        <span class="admin-header__app">CPSU Document Tracking System</span>
       
      </div>
    </div>
    <div class="admin-header__spacer" aria-hidden="true"></div>
    <div class="admin-header__actions">
      <div class="admin-header__notify-wrap">
        <button type="button" class="admin-header__icon-btn admin-header__notify-btn" aria-label="Notifications" title="Notifications" aria-haspopup="true" aria-expanded="false">
          <span class="admin-header__notify-badge" hidden>0</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
        <div class="admin-header__notify-panel" hidden>
          <h3 class="admin-header__notify-title">System Notifications</h3>
          <ul class="admin-header__notify-list"></ul>
          <p class="admin-header__notify-empty">No Notifications.</p>
        </div>
      </div>
      <div class="admin-header__user-dropdown">
        <button
          type="button"
          class="admin-header__user"
          aria-haspopup="true"
          aria-expanded="false"
          aria-label="User menu"
        >
          <span class="admin-header__user-avatar" aria-hidden="true">L</span>
          <span class="admin-header__user-name">Loading...</span>
        </button>
        <div class="admin-header__dropdown-menu" hidden>
          <button type="button" class="admin-header__dropdown-item" data-action="settings">Settings</button>
          <button type="button" class="admin-header__dropdown-item" data-action="logout">Log Out</button>
        </div>
        <div class="admin-header__settings-modal" role="dialog" aria-modal="true" aria-label="Account settings" hidden>
          <p class="admin-header__settings-title">Account Settings</p>
          <div class="admin-header__settings-actions">
            <button type="button" class="admin-header__settings-action" data-action="change-username">Change Username</button>
            <button type="button" class="admin-header__settings-action" data-action="change-password">Change Password</button>
          </div>
        </div>
        <div class="admin-header__username-modal" role="dialog" aria-modal="true" aria-label="Change username" hidden>
          <p class="admin-header__settings-title">Change Username</p>
          <form class="admin-header__settings-form" data-role="change-username-form">
            <label class="admin-header__field-label" for="current-username-input">Current Username</label>
            <input id="current-username-input" class="admin-header__field-input" name="currentUsername" type="text" autocomplete="username" required />
            <label class="admin-header__field-label" for="new-username-input">New Username</label>
            <input id="new-username-input" class="admin-header__field-input" name="newUsername" type="text" required />
            <label class="admin-header__field-label" for="confirm-username-input">Confirm Username</label>
            <input id="confirm-username-input" class="admin-header__field-input" name="confirmUsername" type="text" required />
            <div class="admin-header__settings-form-actions">
              <button type="button" class="admin-header__settings-secondary" data-action="cancel-username-change">Cancel</button>
              <button type="submit" class="admin-header__settings-primary">Save</button>
            </div>
          </form>
        </div>
        <div class="admin-header__password-modal admin-header__username-modal" role="dialog" aria-modal="true" aria-label="Change password" hidden>
          <p class="admin-header__settings-title">Change Password</p>
          <form class="admin-header__settings-form" data-role="change-password-form">
            <label class="admin-header__field-label" for="current-password-input">Current Password</label>
            <input id="current-password-input" class="admin-header__field-input" name="currentPassword" type="password" autocomplete="current-password" required />
            <label class="admin-header__field-label" for="new-password-input">New Password</label>
            <input id="new-password-input" class="admin-header__field-input" name="newPassword" type="password" autocomplete="new-password" required />
            <label class="admin-header__field-label" for="confirm-password-input">Confirm Password</label>
            <input id="confirm-password-input" class="admin-header__field-input" name="confirmPassword" type="password" autocomplete="new-password" required />
            <div class="admin-header__settings-form-actions">
              <button type="button" class="admin-header__settings-secondary" data-action="cancel-password-change">Cancel</button>
              <button type="submit" class="admin-header__settings-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const menuBtn = header.querySelector('.admin-header__menu');
  menuBtn?.addEventListener('click', () => onMenuToggle?.());

  const userDropdown = header.querySelector('.admin-header__user-dropdown');
  const userBtn = header.querySelector('.admin-header__user');
  const dropdownMenu = header.querySelector('.admin-header__dropdown-menu');
  const settingsBtn = header.querySelector('[data-action="settings"]');
  const logoutBtn = header.querySelector('[data-action="logout"]');
  const settingsModal = header.querySelector('.admin-header__settings-modal');
  const usernameModal = header.querySelector('.admin-header__username-modal');
  const passwordModal = header.querySelector('.admin-header__password-modal');
  const changeUsernameBtn = header.querySelector('[data-action="change-username"]');
  const changePasswordBtn = header.querySelector('[data-action="change-password"]');
  const changeUsernameForm = header.querySelector('[data-role="change-username-form"]');
  const changePasswordForm = header.querySelector('[data-role="change-password-form"]');
  const cancelUsernameChangeBtn = header.querySelector('[data-action="cancel-username-change"]');
  const cancelPasswordChangeBtn = header.querySelector('[data-action="cancel-password-change"]');
  const currentUsernameInput = header.querySelector('input[name="currentUsername"]');
  const newUsernameInput = header.querySelector('input[name="newUsername"]');
  const confirmUsernameInput = header.querySelector('input[name="confirmUsername"]');
  const currentPasswordInput = header.querySelector('input[name="currentPassword"]');
  const newPasswordInput = header.querySelector('input[name="newPassword"]');
  const confirmPasswordInput = header.querySelector('input[name="confirmPassword"]');
  const userNameEl = header.querySelector('.admin-header__user-name');
  const userAvatarEl = header.querySelector('.admin-header__user-avatar');
  const notifyBtn = header.querySelector('.admin-header__notify-btn');
  const notifyPanel = header.querySelector('.admin-header__notify-panel');
  const notifyList = header.querySelector('.admin-header__notify-list');
  const notifyEmpty = header.querySelector('.admin-header__notify-empty');
  const notifyBadge = header.querySelector('.admin-header__notify-badge');

  let recipientAliases = new Set();
  const baselineSeenDocumentIds = new Set();
  const shownNotificationDocumentIds = new Set();
  const dismissedNotificationDocumentIds = loadDismissedNotificationIds();
  let pollTimer = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const closeNotifyPanel = () => {
    if (!(notifyBtn instanceof HTMLButtonElement) || !(notifyPanel instanceof HTMLElement)) return;
    notifyBtn.setAttribute('aria-expanded', 'false');
    notifyPanel.hidden = true;
  };

  const updateNotificationUI = (forwardedRows) => {
    if (!(notifyList instanceof HTMLElement) || !(notifyEmpty instanceof HTMLElement) || !(notifyBadge instanceof HTMLElement)) return;

    const topRows = forwardedRows.slice(0, 8);
    if (!topRows.length) {
      notifyList.innerHTML = '';
      notifyEmpty.hidden = false;
      notifyBadge.hidden = true;
      notifyBadge.textContent = '0';
      return;
    }

    notifyList.innerHTML = topRows.map((row) => {
      const rowId = Number(row?.id);
      const docId = Number.isInteger(rowId) && rowId > 0 ? String(rowId) : '';
      return `
        <li class="admin-header__notify-item">
          <button type="button" class="admin-header__notify-link" data-doc-id="${docId}">
            <p class="admin-header__notify-code">${escapeHtml(row.document_code || 'No Doc Code')}</p>
            <p class="admin-header__notify-subject">${escapeHtml(row.subject || 'No Subject')}</p>
          </button>
        </li>
      `;
    }).join('');
    notifyEmpty.hidden = true;
    notifyBadge.hidden = false;
    notifyBadge.textContent = String(forwardedRows.length);
  };

  const pollForwardedNotifications = async ({ silent = false } = {}) => {
    if (!recipientAliases.size) return;
    try {
      const response = await fetch(apiUrl('/api/outgoing-documents/'), { credentials: 'include' });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const forwardedRows = rows.filter((row) => {
        if (!(isForwardedToCurrentUser(row, recipientAliases) && isNewForwardedDocument(row))) {
          return false;
        }
        const rowId = Number(row?.id);
        return !Number.isInteger(rowId) || rowId <= 0 || !dismissedNotificationDocumentIds.has(rowId);
      });

      updateNotificationUI(forwardedRows);

      const currentIds = new Set(
        forwardedRows
          .map((row) => Number(row?.id))
          .filter((id) => Number.isInteger(id) && id > 0),
      );

      if (!baselineSeenDocumentIds.size || silent) {
        currentIds.forEach((id) => baselineSeenDocumentIds.add(id));
        return;
      }

      const newlyForwardedRows = forwardedRows.filter((row) => {
        const rowId = Number(row?.id);
        return Number.isInteger(rowId) && rowId > 0 && !baselineSeenDocumentIds.has(rowId);
      });

      if (newlyForwardedRows.length) {
        newlyForwardedRows.forEach((row) => {
          const rowId = Number(row?.id);
          baselineSeenDocumentIds.add(rowId);
          if (shownNotificationDocumentIds.has(rowId)) return;
          shownNotificationDocumentIds.add(rowId);
          const docCode = String(row?.document_code || '').trim();
          createNotificationToast(
            docCode
              ? `New document forwarded to you: ${docCode}`
              : 'New document forwarded to you.',
          );
        });
      }
    } catch {
      // Ignore notification polling failures to keep header stable.
    }
  };

  const startNotificationPolling = () => {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => {
      pollForwardedNotifications();
    }, 30000);
  };

  const stopNotificationPolling = () => {
    if (!pollTimer) return;
    window.clearInterval(pollTimer);
    pollTimer = null;
  };

  loadCurrentUserProfile().then((profile) => {
    if (!profile) return;

    const firstName = String(profile.first_name || '').trim();
    const lastName = String(profile.last_name || '').trim();
    const username = String(profile.username || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || username || 'User';
    const initialsSource = `${firstName}${lastName}`.trim() || fullName;
    const avatarInitial = initialsSource.charAt(0).toUpperCase() || 'U';

    if (userNameEl) userNameEl.textContent = fullName;
    if (userAvatarEl) userAvatarEl.textContent = avatarInitial;
    recipientAliases = buildRecipientAliases(profile);
    pollForwardedNotifications({ silent: true });
    startNotificationPolling();
  });

  if (userDropdown && userBtn && dropdownMenu) {
    const closeDropdown = () => {
      userBtn.setAttribute('aria-expanded', 'false');
      dropdownMenu.hidden = true;
    };
    const closeSettingsModal = () => {
      if (!(settingsModal instanceof HTMLElement)) return;
      settingsModal.hidden = true;
    };
    const closeUsernameModal = () => {
      if (!(usernameModal instanceof HTMLElement)) return;
      usernameModal.hidden = true;
    };
    const closePasswordModal = () => {
      if (!(passwordModal instanceof HTMLElement)) return;
      passwordModal.hidden = true;
    };

    userBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = userBtn.getAttribute('aria-expanded') === 'true';
      userBtn.setAttribute('aria-expanded', String(!isOpen));
      dropdownMenu.hidden = isOpen;
    });

    dropdownMenu.addEventListener('click', (event) => event.stopPropagation());
    settingsModal?.addEventListener('click', (event) => event.stopPropagation());
    usernameModal?.addEventListener('click', (event) => event.stopPropagation());
    passwordModal?.addEventListener('click', (event) => event.stopPropagation());

    document.addEventListener('click', () => {
      closeDropdown();
      closeSettingsModal();
      closeUsernameModal();
      closePasswordModal();
      closeNotifyPanel();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDropdown();
        closeSettingsModal();
        closeUsernameModal();
        closePasswordModal();
        closeNotifyPanel();
      }
    });

    settingsBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!(settingsModal instanceof HTMLElement)) return;
      const isOpen = !settingsModal.hidden;
      settingsModal.hidden = isOpen;
      closeUsernameModal();
      closePasswordModal();
      closeDropdown();
    });

    cancelUsernameChangeBtn?.addEventListener('click', () => {
      closeUsernameModal();
      if (changeUsernameForm instanceof HTMLFormElement) {
        changeUsernameForm.reset();
      }
    });

    cancelPasswordChangeBtn?.addEventListener('click', () => {
      closePasswordModal();
      if (changePasswordForm instanceof HTMLFormElement) {
        changePasswordForm.reset();
      }
    });
  }

  notifyBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!(notifyBtn instanceof HTMLButtonElement) || !(notifyPanel instanceof HTMLElement)) return;
    const isOpen = notifyBtn.getAttribute('aria-expanded') === 'true';
    notifyBtn.setAttribute('aria-expanded', String(!isOpen));
    notifyPanel.hidden = isOpen;
  });

  notifyPanel?.addEventListener('click', (event) => event.stopPropagation());
  notifyList?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const linkBtn = target.closest('.admin-header__notify-link');
    if (!(linkBtn instanceof HTMLButtonElement)) return;
    const docId = Number(linkBtn.getAttribute('data-doc-id'));
    if (!Number.isInteger(docId) || docId <= 0) return;
    dismissedNotificationDocumentIds.add(docId);
    persistDismissedNotificationIds(dismissedNotificationDocumentIds);
    pollForwardedNotifications({ silent: true });
    closeNotifyPanel();
    navigateWithLoading(`uincoming.html?docId=${docId}`);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pollForwardedNotifications();
      startNotificationPolling();
      return;
    }
    stopNotificationPolling();
  });

  window.addEventListener('beforeunload', () => {
    stopNotificationPolling();
  });

  logoutBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await logoutUser();
    } catch {
      showCenterNotification('Unable to log out right now. Please try again.', 'error');
    }
  });

  changeUsernameBtn?.addEventListener('click', () => {
    if (
      !(settingsModal instanceof HTMLElement)
      || !(usernameModal instanceof HTMLElement)
      || !(passwordModal instanceof HTMLElement)
    ) return;
    settingsModal.hidden = true;
    usernameModal.hidden = false;
    passwordModal.hidden = true;
    if (currentUsernameInput instanceof HTMLInputElement) {
      currentUsernameInput.focus();
    }
  });

  changePasswordBtn?.addEventListener('click', () => {
    if (
      !(settingsModal instanceof HTMLElement)
      || !(usernameModal instanceof HTMLElement)
      || !(passwordModal instanceof HTMLElement)
    ) return;
    settingsModal.hidden = true;
    usernameModal.hidden = true;
    passwordModal.hidden = false;
    if (currentPasswordInput instanceof HTMLInputElement) {
      currentPasswordInput.focus();
    }
  });

  changeUsernameForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (
      !(currentUsernameInput instanceof HTMLInputElement)
      || !(newUsernameInput instanceof HTMLInputElement)
      || !(confirmUsernameInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const currentUsername = currentUsernameInput.value.trim();
    const newUsername = newUsernameInput.value.trim();
    const confirmUsername = confirmUsernameInput.value.trim();

    if (!currentUsername || !newUsername || !confirmUsername) {
      showCenterNotification('Please complete all username fields.', 'warning');
      return;
    }
    if (newUsername !== confirmUsername) {
      showCenterNotification('New Username and Confirm Username do not match.', 'warning');
      return;
    }
    try {
      await changeUsername({ currentUsername, newUsername, confirmUsername });
      showCenterNotification('Username updated successfully.', 'success');
    } catch (error) {
      showCenterNotification(error instanceof Error ? error.message : 'Unable to update username.', 'error');
      return;
    }
    if (changeUsernameForm instanceof HTMLFormElement) {
      changeUsernameForm.reset();
    }
    if (usernameModal instanceof HTMLElement) {
      usernameModal.hidden = true;
    }
  });

  changePasswordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (
      !(currentPasswordInput instanceof HTMLInputElement)
      || !(newPasswordInput instanceof HTMLInputElement)
      || !(confirmPasswordInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showCenterNotification('Please complete all password fields.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showCenterNotification('New Password and Confirm Password do not match.', 'warning');
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      showCenterNotification('Password updated successfully.', 'success');
    } catch (error) {
      showCenterNotification(error instanceof Error ? error.message : 'Unable to update password.', 'error');
      return;
    }
    if (changePasswordForm instanceof HTMLFormElement) {
      changePasswordForm.reset();
    }
    if (passwordModal instanceof HTMLElement) {
      passwordModal.hidden = true;
    }
  });

  return header;
}
