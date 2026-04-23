import { apiUrl } from '../js/api.js';
import { initNavigationLoading, navigateWithLoading } from '../js/loading.js';
import { notify } from '../js/notifications.js';

const logoUrl = '/src/images/cpsu%20logo.png';

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

function showCenterNotification(message, icon = 'info') {
  void notify({
    icon,
    title: 'Notification',
    text: message,
    timer: 2500,
  });
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
      <button type="button" class="admin-header__icon-btn" aria-label="Notifications" title="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>
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

  loadCurrentUserProfile().then((profile) => {
    if (!profile) return;
    if (userNameEl) userNameEl.textContent = 'System Administrator';
    if (userAvatarEl) userAvatarEl.textContent = 'SA';
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
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDropdown();
        closeSettingsModal();
        closeUsernameModal();
        closePasswordModal();
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
