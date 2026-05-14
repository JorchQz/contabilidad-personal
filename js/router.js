// js/router.js — Navegación entre páginas (ES module)

const PAGES = ['dashboard', 'gastos', 'ingresos', 'deudas', 'metas', 'presupuestos', 'fijos', 'cuentas', 'ajustes'];

const PAGE_LOADERS = {
  dashboard:    'loadDashboard',
  gastos:       'loadGastos',
  ingresos:     'loadIngresos',
  cuentas:      'loadCuentas',
  deudas:       'loadDeudas',
  metas:        'loadMetas',
  presupuestos: 'loadPresupuestos',
  fijos:        'loadFijos',
  ajustes:      'loadAjustes',
};

export function showPage(pageId) {
  if (typeof window.closeModal === 'function') window.closeModal();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });

  const page = document.getElementById(`page-${pageId}`);
  const nav = document.querySelector(`[data-page="${pageId}"]`);

  if (page) page.classList.add('active');
  if (nav) { nav.classList.add('active'); nav.setAttribute('aria-current', 'page'); }

  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav && nav) {
    bottomNav.scrollTo({
      left: nav.offsetLeft - bottomNav.offsetWidth / 2 + nav.offsetWidth / 2,
      behavior: 'smooth'
    });
  }

  if (window.lucide) lucide.createIcons();
  if (typeof window.updateFab === 'function') window.updateFab(pageId);

  const loaderName = PAGE_LOADERS[pageId];
  if (loaderName && typeof window[loaderName] === 'function') window[loaderName]();

  window.scrollTo(0, 0);
}

export function renderNav() {
  const navItems = [
    { id: 'dashboard', icon: `<i data-lucide="layout-dashboard"></i>`, label: 'Inicio' },
    { id: 'gastos', icon: `<i data-lucide="receipt"></i>`, label: 'Gastos' },
    { id: 'ingresos', icon: `<i data-lucide="trending-up"></i>`, label: 'Ingresos' },
    { id: 'deudas', icon: `<i data-lucide="credit-card"></i>`, label: 'Deudas' },
    { id: 'metas', icon: `<i data-lucide="target"></i>`, label: 'Metas' },
    { id: 'presupuestos', icon: `<i data-lucide="pie-chart"></i>`, label: 'Presupuestos' },
    { id: 'fijos', icon: `<i data-lucide="pin"></i>`, label: 'Fijos' },
    { id: 'cuentas', icon: `<i data-lucide="wallet"></i>`, label: 'Cuentas' },
    { id: 'ajustes', icon: `<i data-lucide="settings"></i>`, label: 'Ajustes' }
  ];

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = navItems.map(item => `
    <button class="nav-item" data-page="${item.id}" onclick="showPage('${item.id}')">
      ${item.icon}
      <span>${item.label}</span>
    </button>
  `).join('');

  document.getElementById('app').appendChild(nav);
  if (window.lucide) lucide.createIcons();
}

let _swipeInitialized = false;

export function initSwipeNavigation() {
  if (_swipeInitialized) return;
  _swipeInitialized = true;

  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(dx) < 50) return;
    if (Math.abs(dy) > Math.abs(dx)) return;

    const target = e.target;
    if (target.closest('.bottom-nav')) return;
    if (target.closest('.category-grid')) return;
    if (target.closest('.modal-overlay')) return;
    if (target.closest('input, textarea, select')) return;

    const currentPage = document.querySelector('.page.active')?.id?.replace('page-', '');
    const currentIndex = PAGES.indexOf(currentPage);
    if (currentIndex === -1) return;

    if (dx < 0 && currentIndex < PAGES.length - 1) {
      showPage(PAGES[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      showPage(PAGES[currentIndex - 1]);
    }
  }, { passive: true });
}
