// js/router.js — Navegación entre páginas

const PAGES = ['dashboard', 'gastos', 'ingresos', 'deudas', 'metas', 'fijos', 'cuentas', 'ajustes'];

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  const nav = document.querySelector(`[data-page="${pageId}"]`);

  if (page) page.classList.add('active');
  if (nav) nav.classList.add('active');

  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav && nav) {
    bottomNav.scrollTo({
      left: nav.offsetLeft - bottomNav.offsetWidth / 2 + nav.offsetWidth / 2,
      behavior: 'smooth'
    });
  }

  if (window.lucide) {
    lucide.createIcons();
  }

  window.scrollTo(0, 0);
}

function renderNav() {
  const navItems = [
    { id: 'dashboard', icon: `<i data-lucide="layout-dashboard"></i>`, label: 'Inicio' },
    { id: 'gastos', icon: `<i data-lucide="clock"></i>`, label: 'Gastos' },
    { id: 'ingresos', icon: `<i data-lucide="trending-up"></i>`, label: 'Ingresos' },
    { id: 'deudas', icon: `<i data-lucide="credit-card"></i>`, label: 'Deudas' },
    { id: 'metas', icon: `<i data-lucide="target"></i>`, label: 'Metas' },
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

  if (window.lucide) {
    lucide.createIcons();
  }
}
