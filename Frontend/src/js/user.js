import '../css/admin.css';
import '../css/user.css';
import { createHeader } from '../header, footer, sidebar/uheader.js';
import { createSidebar } from '../header, footer, sidebar/usidebar.js';

const PRIMARY = '#84B179';
const PRIMARY_LIGHT = '#A2CB8B';

async function requireAuth() {
  try {
    const res = await fetch('/api/auth/me/', { credentials: 'include' });
    if (res.ok) return true;
  } catch {
    /* network error - fall through */
  }
  window.location.replace('/');
  return false;
}

function buildUserMain() {
  const main = document.createElement('main');
  main.className = 'admin-main user-main';
  main.innerHTML = `
    <header class="user-main__head">
      <h1 class="user-main__title">User Page</h1>
      <p class="user-main__subtitle">Manage your document actions from one place.</p>
    </header>

    <section class="admin-panel user-main__panel" aria-label="User actions">
      <div class="admin-panel__head">
        <h2 class="admin-panel__title">Quick Access</h2>
      </div>
      <div class="admin-panel__body user-main__body">
        <a class="user-main__link" href="incoming.html">Go to Incoming</a>
        <a class="user-main__link" href="outgoing.html">Go to Outgoing</a>
      </div>
    </section>
  `;
  return main;
}

async function mountUserPage(root = document.querySelector('#app')) {
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
    activeId: 'dashboard',
    onSelect: () => closeSidebar(),
    isAdmin: false,
    dashboardHref: 'user.html',
  });

  const shell = document.createElement('div');
  shell.className = 'admin-shell';

  const header = createHeader({ onMenuToggle: toggleSidebar });
  const main = buildUserMain();

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

mountUserPage();
