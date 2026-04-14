import { apiUrl } from './api.js';
import { notify } from './notifications.js';

const logoUrl = '/src/images/cpsu%20logo.png';

const ACCENT = '#84B179';

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

async function ensureCsrf() {
  await fetch(apiUrl('/api/auth/csrf/'), { credentials: 'include' });
}

function mountLogin(root = document.querySelector('#app')) {
  if (!root) return;

  root.innerHTML = `
    <main class="login-page">
      <div class="login-card">
        <header class="login-brand">
          <img
            class="login-logo"
            src="${logoUrl}"
            alt="Carlos Hilado Memorial State University"
            decoding="async"
          />
          <h1 class="login-title">CPSU Document Tracking System</h1>
          <p class="login-subtitle">Sign in to continue</p>
        </header>
        <form class="login-form" id="login-form" novalidate>
          <label class="field">
            <span class="field-label">Email or username</span>
            <input
              type="text"
              name="username"
              class="field-input"
              autocomplete="username"
              required
            />
          </label>
          <label class="field">
            <span class="field-label">Password</span>
            <input
              type="password"
              name="password"
              class="field-input"
              autocomplete="current-password"
              required
            />
          </label>
          <p class="login-error" id="login-error" hidden role="alert"></p>
          <button type="submit" class="btn-primary">Sign in</button>
        </form>
      </div>
    </main>
  `;

  document.documentElement.style.setProperty('--login-accent', ACCENT);

  const form = root.querySelector('#login-form');
  const submitBtn = form.querySelector('button[type="submit"]');

  ensureCsrf().catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');

    if (!username || !password) {
      await notify({
        icon: 'warning',
        title: 'Missing credentials',
        text: 'Please enter your username and password.',
      });
      return;
    }

    await ensureCsrf();
    const csrftoken = getCookie('csrftoken');
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    try {
      const res = await fetch(apiUrl('/api/auth/login/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
        },
        body: JSON.stringify({ username, password }),
      });

      const raw = await res.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }

      if (!res.ok) {
        let message = '';
        if (res.status === 403 && !payload.error) {
          message =
            'Access denied (403). If this persists, confirm you are using the Vite dev URL (port 5173) with Django on port 8000.';
        } else {
          message =
            typeof payload.error === 'string'
              ? payload.error
              : `Sign in failed (${res.status}). Please try again.`;
        }
        await notify({
          icon: 'error',
          title: 'Login failed',
          text: message,
        });
        return;
      }

      const target =
        typeof payload.redirect === 'string' && payload.redirect
          ? payload.redirect
          : '/admin.html';
      await notify({
        icon: 'success',
        title: 'Login successful',
        text: 'Redirecting to your dashboard...',
        timer: 1200,
      });
      window.location.assign(target);
    } catch {
      await notify({
        icon: 'error',
        title: 'Connection error',
        text: 'Could not reach the server. Is Django running on port 8000?',
      });
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
    }
  });
}

mountLogin();
