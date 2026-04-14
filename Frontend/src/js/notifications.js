const SWEETALERT_ESM_URL = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

let swalLoader = null;
let stylesInjected = false;

function ensureSwalStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = 'cpsu-swal-theme';
  style.textContent = `
    .cpsu-swal-popup { border-radius: 12px; }
    .cpsu-swal-title { font-size: 1rem; }
    .cpsu-swal-text { color: #4d4d4d; }
    .cpsu-swal-confirm,
    .cpsu-swal-cancel {
      border: none;
      border-radius: 8px;
      color: #fff;
      font: inherit;
      font-weight: 600;
      padding: 0.5rem 1rem;
      cursor: pointer;
    }
    .cpsu-swal-confirm { background: #84b179; }
    .cpsu-swal-confirm:hover { background: #739b68; }
    .cpsu-swal-cancel { background: #9fa6b2; margin-left: 0.5rem; }
    .cpsu-swal-cancel:hover { background: #8c94a1; }
  `;
  document.head.append(style);
}

async function loadSwal() {
  if (window.Swal) return window.Swal;
  if (!swalLoader) {
    swalLoader = import(SWEETALERT_ESM_URL)
      .then((module) => module.default || module)
      .catch(() => null);
  }
  return swalLoader;
}

function baseOptions() {
  const path = String(window.location.pathname || '').toLowerCase();
  const isLoginPage = path === '/' || path.endsWith('/index.html');
  return {
    position: isLoginPage ? 'top-end' : 'center',
    buttonsStyling: false,
    customClass: {
      popup: 'cpsu-swal-popup',
      title: 'cpsu-swal-title',
      htmlContainer: 'cpsu-swal-text',
      confirmButton: 'cpsu-swal-confirm',
      cancelButton: 'cpsu-swal-cancel',
    },
  };
}

export async function notify({ icon = 'info', title = 'Notice', text = '', timer = 3000 } = {}) {
  const Swal = await loadSwal();
  if (!Swal) {
    window.alert(`${title}\n\n${text}`);
    return;
  }

  ensureSwalStyles();

  await Swal.fire({
    ...baseOptions(),
    toast: true,
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
    icon,
    title,
    text,
  });
}

export async function confirmAction({ icon = 'warning', title = 'Are you sure?', text = '' } = {}) {
  const Swal = await loadSwal();
  if (!Swal) return window.confirm(text || title);

  ensureSwalStyles();

  const result = await Swal.fire({
    ...baseOptions(),
    icon,
    title,
    text,
    toast: false,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: 'Yes',
    cancelButtonText: 'Cancel',
  });
  return Boolean(result.isConfirmed);
}

export async function showInfo({ title = 'Details', html = '' } = {}) {
  const Swal = await loadSwal();
  if (!Swal) {
    window.alert(title);
    return;
  }

  ensureSwalStyles();

  await Swal.fire({
    ...baseOptions(),
    icon: 'info',
    title,
    html,
    toast: false,
    showConfirmButton: true,
    confirmButtonText: 'Close',
  });
}
