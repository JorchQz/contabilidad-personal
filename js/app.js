// js/app.js — Inicialización y onboarding

// ---- ESTADO DEL ONBOARDING ----
let onboardingData = {
  nombre: '',
  cuentas: [],
  deudas: [],
  gastosFijos: [],
  metas: []
};

let currentStep = 1;
const TOTAL_STEPS = 5;

// ---- CATEGORÍAS DEFAULT ----
const CATEGORIAS_DEFAULT = [
  { nombre: 'Comida', emoji: '🥑', tipo: 'gasto' },
  { nombre: 'Transporte', emoji: '🚗', tipo: 'gasto' },
  { nombre: 'Ropa', emoji: '👗', tipo: 'gasto' },
  { nombre: 'Internet', emoji: '📶', tipo: 'gasto' },
  { nombre: 'Salud', emoji: '💊', tipo: 'gasto' },
  { nombre: 'Familia', emoji: '❤️', tipo: 'gasto' },
  { nombre: 'Entretenimiento', emoji: '🎬', tipo: 'gasto' },
  { nombre: 'Negocio', emoji: '🧢', tipo: 'gasto' },
  { nombre: 'Deuda', emoji: '💸', tipo: 'gasto' },
  { nombre: 'Ahorro', emoji: '🏦', tipo: 'gasto' },
  { nombre: 'Otros', emoji: '📦', tipo: 'gasto' },
  { nombre: 'Salario', emoji: '💼', tipo: 'ingreso' },
  { nombre: 'Beca', emoji: '🎓', tipo: 'ingreso' },
  { nombre: 'Extra', emoji: '⚡', tipo: 'ingreso' },
];

// ---- HELPERS ----
function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(amount);
}

function showSnackbar(msg, type = '') {
  let sb = document.getElementById('snackbar');
  if (!sb) {
    sb = document.createElement('div');
    sb.id = 'snackbar';
    sb.className = 'snackbar';
    document.body.appendChild(sb);
  }
  sb.textContent = msg;
  sb.className = `snackbar ${type} show`;
  setTimeout(() => sb.classList.remove('show'), 3000);
}

function getCuentaEmoji(tipo) {
  const cuentaEmoji = {
    efectivo: '💵',
    debito: '🏦',
    negocio: '🏪',
    otro: '💳'
  };

  return cuentaEmoji[tipo] || '💳';
}

function calcularCuentasConSaldo(cuentas = [], ingresosPorCuenta = [], gastosPorCuenta = [], pagosDeudaPorCuenta = []) {
  const sumasIngresosPorCuenta = ingresosPorCuenta.reduce((acc, mov) => {
    const cuentaId = mov.cuenta_id;
    if (!cuentaId) return acc;
    acc[cuentaId] = (acc[cuentaId] || 0) + Number(mov.monto || 0);
    return acc;
  }, {});

  const sumasGastosPorCuenta = gastosPorCuenta.reduce((acc, mov) => {
    const cuentaId = mov.cuenta_id;
    if (!cuentaId) return acc;
    acc[cuentaId] = (acc[cuentaId] || 0) + Number(mov.monto || 0);
    return acc;
  }, {});

  const sumasPagosDeudaPorCuenta = pagosDeudaPorCuenta.reduce((acc, mov) => {
    const cuentaId = mov.cuenta_id;
    if (!cuentaId) return acc;
    acc[cuentaId] = (acc[cuentaId] || 0) + Number(mov.monto || 0);
    return acc;
  }, {});

  const cuentasConSaldo = cuentas.map(cuenta => {
    const ingresosCuenta = sumasIngresosPorCuenta[cuenta.id] || 0;
    const gastosCuenta = sumasGastosPorCuenta[cuenta.id] || 0;
    const pagosDeudaCuenta = sumasPagosDeudaPorCuenta[cuenta.id] || 0;
    const saldoCuenta = Number(cuenta.saldo_inicial || 0) + ingresosCuenta - gastosCuenta - pagosDeudaCuenta;

    return {
      ...cuenta,
      saldoCalculado: saldoCuenta,
      emoji: getCuentaEmoji(cuenta.tipo)
    };
  });

  return {
    cuentasConSaldo,
    totalGeneralCuentas: cuentasConSaldo.reduce((acc, cuenta) => acc + cuenta.saldoCalculado, 0)
  };
}

// ---- INICIO ----
window.addEventListener('DOMContentLoaded', async () => {
  await new Promise(r => setTimeout(r, 1200)); // splash

  const usuarioId = getUsuarioId();
  if (usuarioId) {
    const { data } = await db.from('usuarios').select('onboarding_completo').eq('id', usuarioId).single();
    if (data?.onboarding_completo) {
      renderApp();
      return;
    }
  }
  renderOnboarding();
});

// ---- ONBOARDING ----
function renderOnboarding() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="onboarding" id="onboarding">
      <div class="onboarding-header">
        <div class="onboarding-step-indicator" id="step-indicator"></div>
        <div id="onboarding-header-content"></div>
      </div>
      <div class="onboarding-body" id="onboarding-body"></div>
      <div class="onboarding-footer" id="onboarding-footer"></div>
    </div>
  `;
  renderStep(1);
}

function renderStep(step) {
  currentStep = step;
  updateStepIndicator();

  const steps = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5
  };

  steps[step]?.();
}

function updateStepIndicator() {
  const indicator = document.getElementById('step-indicator');
  indicator.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) => {
    const n = i + 1;
    const cls = n < currentStep ? 'done' : n === currentStep ? 'active' : '';
    return `<div class="step-dot ${cls}"></div>`;
  }).join('');
}

function setHeader(title, subtitle) {
  document.getElementById('onboarding-header-content').innerHTML = `
    <h1 class="onboarding-title">${title}</h1>
    <p class="onboarding-subtitle">${subtitle}</p>
  `;
}

function setFooter(html) {
  document.getElementById('onboarding-footer').innerHTML = html;
}

// STEP 1: Nombre
function renderStep1() {
  setHeader('¡Hola! Soy JM Finance 👋', 'Vamos a configurar tu espacio financiero personal. Solo tomará unos minutos.');
  document.getElementById('onboarding-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">¿Cómo te llamas?</label>
      <input class="form-input" id="input-nombre" type="text" placeholder="Tu nombre" value="${onboardingData.nombre}" autocomplete="given-name" />
      <p class="form-hint">Lo usaremos para personalizar tu experiencia.</p>
    </div>
  `;
  setFooter(`<button class="btn btn-primary" onclick="nextStep1()">Continuar →</button>`);
  setTimeout(() => document.getElementById('input-nombre')?.focus(), 100);
}

function nextStep1() {
  const nombre = document.getElementById('input-nombre').value.trim();
  if (!nombre) { showSnackbar('Escribe tu nombre para continuar', 'error'); return; }
  onboardingData.nombre = nombre;
  renderStep(2);
}

// STEP 2: Cuentas
function renderStep2() {
  setHeader(`¿Dónde tienes tu dinero, ${onboardingData.nombre.split(' ')[0]}?`, 'Registra tus cuentas activas — efectivo, débito, lo que uses.');
  renderStep2Body();
  setFooter(`
    <button class="btn btn-primary" onclick="nextStep2()">Continuar →</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(1)">← Atrás</button>
  `);
}

function renderStep2Body(showForm = false) {
  const TIPOS = [
    { value: 'efectivo', label: 'Efectivo', emoji: '💵' },
    { value: 'debito', label: 'Débito / Banco', emoji: '🏦' },
    { value: 'negocio', label: 'Mercado Pago', emoji: '🏪' },
    { value: 'otro', label: 'Otro', emoji: '💳' },
  ];

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list" id="cuentas-list">
      ${onboardingData.cuentas.map((c, i) => `
        <div class="item-row">
          <div class="item-row-emoji">${TIPOS.find(t => t.value === c.tipo)?.emoji || '💳'}</div>
          <div class="item-row-info">
            <div class="item-row-name">${c.nombre}</div>
            <div class="item-row-detail">${TIPOS.find(t => t.value === c.tipo)?.label} · Saldo inicial: ${formatMXN(c.saldo_inicial)}</div>
          </div>
          <button class="item-row-delete" onclick="removeCuenta(${i})">✕</button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form" id="form-cuenta">
      <div class="mini-form-grid">
        <div class="mini-form-full">
          <input class="form-input" id="c-nombre" placeholder="Ej: Mercado Pago Negocio" />
        </div>
        <select class="form-select" id="c-tipo">
          ${TIPOS.map(t => `<option value="${t.value}">${t.emoji} ${t.label}</option>`).join('')}
        </select>
        <input class="form-input" id="c-saldo" type="number" placeholder="Saldo actual (0)" min="0" />
      </div>
      <button class="btn btn-secondary" onclick="addCuenta()">+ Agregar</button>
    </div>
    ` : `
    <button class="btn-add-item" onclick="renderStep2Body(true)">
      <span>+</span> Agregar cuenta
    </button>
    `}
  `;
}

function addCuenta() {
  const nombre = document.getElementById('c-nombre').value.trim();
  const tipo = document.getElementById('c-tipo').value;
  const saldo = parseFloat(document.getElementById('c-saldo').value) || 0;
  if (!nombre) { showSnackbar('Escribe el nombre de la cuenta', 'error'); return; }
  onboardingData.cuentas.push({ nombre, tipo, saldo_inicial: saldo });
  renderStep2Body(false);
}

function removeCuenta(i) {
  onboardingData.cuentas.splice(i, 1);
  renderStep2Body(false);
}

function nextStep2() {
  if (onboardingData.cuentas.length === 0) {
    showSnackbar('Agrega al menos una cuenta', 'error');
    return;
  }
  renderStep(3);
}

// STEP 3: Deudas
function renderStep3() {
  setHeader('¿Qué debes actualmente?', 'Registra tus deudas para tener el panorama completo y hacer un plan de pago.');
  renderStep3Body();
  setFooter(`
    <button class="btn btn-primary" onclick="nextStep3()">Continuar →</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(2)">← Atrás</button>
  `);
}

function renderStep3Body(showForm = false) {
  const FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'libre'];

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list" id="deudas-list">
      ${onboardingData.deudas.map((d, i) => `
        <div class="item-row">
          <div class="item-row-emoji">💸</div>
          <div class="item-row-info">
            <div class="item-row-name">${d.acreedor}</div>
            <div class="item-row-detail">${d.tipo_pago}${d.monto_pago ? ` · ${formatMXN(d.monto_pago)}/pago` : ''}</div>
          </div>
          <div class="item-row-amount">${formatMXN(d.monto_actual)}</div>
          <button class="item-row-delete" onclick="removeDeuda(${i})">✕</button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form">
      <div class="mini-form-grid">
        <div class="mini-form-full">
          <input class="form-input" id="d-acreedor" placeholder="¿A quién le debes? (ej: Caja Popular)" />
        </div>
        <input class="form-input" id="d-monto" type="number" placeholder="Monto total que debes" min="0" />
        <select class="form-select" id="d-frecuencia">
          ${FRECUENCIAS.map(f => `<option value="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}
        </select>
        <div class="mini-form-full">
          <input class="form-input" id="d-pago" type="number" placeholder="¿Cuánto pagas cada vez? (opcional)" min="0" />
        </div>
      </div>
      <button class="btn btn-secondary" onclick="addDeuda()">+ Agregar</button>
    </div>
    ` : `
    <button class="btn-add-item" onclick="renderStep3Body(true)">
      <span>+</span> Agregar deuda
    </button>
    `}
    <p class="form-hint mt-8" style="padding: 0 4px">Si no tienes deudas activas puedes continuar sin agregar ninguna.</p>
  `;
}

function addDeuda() {
  const acreedor = document.getElementById('d-acreedor').value.trim();
  const monto = parseFloat(document.getElementById('d-monto').value);
  const tipo_pago = document.getElementById('d-frecuencia').value;
  const monto_pago = parseFloat(document.getElementById('d-pago').value) || null;
  if (!acreedor || !monto) { showSnackbar('Completa acreedor y monto', 'error'); return; }
  onboardingData.deudas.push({ acreedor, monto_inicial: monto, monto_actual: monto, tipo_pago, monto_pago });
  renderStep3Body(false);
}

function removeDeuda(i) {
  onboardingData.deudas.splice(i, 1);
  renderStep3Body(false);
}

function nextStep3() {
  renderStep(4);
}

// STEP 4: Gastos fijos
function renderStep4() {
  setHeader('Tus gastos fijos 📅', 'Registra los pagos que tienes cada semana, quincena o mes. Te avisaremos cuando cobres.');
  renderStep4Body();
  setFooter(`
    <button class="btn btn-primary" onclick="nextStep4()">Continuar →</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(3)">← Atrás</button>
  `);
}

function renderStep4Body(showForm = false) {
  const FRECUENCIAS = ['semanal', 'quincenal', 'mensual'];

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list">
      ${onboardingData.gastosFijos.map((g, i) => `
        <div class="item-row">
          <div class="item-row-emoji">📌</div>
          <div class="item-row-info">
            <div class="item-row-name">${g.descripcion}</div>
            <div class="item-row-detail">${g.frecuencia}</div>
          </div>
          <div class="item-row-amount">${formatMXN(g.monto)}</div>
          <button class="item-row-delete" onclick="removeGastoFijo(${i})">✕</button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form">
      <div class="mini-form-grid">
        <div class="mini-form-full">
          <input class="form-input" id="gf-desc" placeholder="¿Qué pagas? (ej: Internet Izzi)" />
        </div>
        <input class="form-input" id="gf-monto" type="number" placeholder="Monto" min="0" />
        <select class="form-select" id="gf-freq">
          ${FRECUENCIAS.map(f => `<option value="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-secondary" onclick="addGastoFijo()">+ Agregar</button>
    </div>
    ` : `
    <button class="btn-add-item" onclick="renderStep4Body(true)">
      <span>+</span> Agregar gasto fijo
    </button>
    `}
    <p class="form-hint mt-8" style="padding: 0 4px">Puedes saltarte esto y agregar más después.</p>
  `;
}

function addGastoFijo() {
  const descripcion = document.getElementById('gf-desc').value.trim();
  const monto = parseFloat(document.getElementById('gf-monto').value);
  const frecuencia = document.getElementById('gf-freq').value;
  if (!descripcion || !monto) { showSnackbar('Completa descripción y monto', 'error'); return; }
  onboardingData.gastosFijos.push({ descripcion, monto, frecuencia });
  renderStep4Body(false);
}

function removeGastoFijo(i) {
  onboardingData.gastosFijos.splice(i, 1);
  renderStep4Body(false);
}

function nextStep4() {
  renderStep(5);
}

// STEP 5: Metas
function renderStep5() {
  setHeader('¿Para qué quieres ahorrar? 🎯', 'Define tus metas. Las iremos completando juntos poco a poco.');
  renderStep5Body();
  setFooter(`
    <button class="btn btn-success" id="btn-finish" onclick="finishOnboarding()">¡Listo, empecemos! 🚀</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(4)">← Atrás</button>
  `);
}

function renderStep5Body(showForm = false) {
  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list">
      ${onboardingData.metas.map((m, i) => `
        <div class="item-row">
          <div class="item-row-emoji">${m.emoji}</div>
          <div class="item-row-info">
            <div class="item-row-name">${m.nombre}</div>
            <div class="item-row-detail">Meta: ${formatMXN(m.monto_objetivo)}</div>
          </div>
          <button class="item-row-delete" onclick="removeMeta(${i})">✕</button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form">
      <div class="mini-form-grid">
        <input class="form-input" id="m-emoji" placeholder="Emoji (ej: 🚗)" style="max-width:80px" />
        <input class="form-input" id="m-nombre" placeholder="Nombre de la meta" />
        <div class="mini-form-full">
          <input class="form-input" id="m-monto" type="number" placeholder="¿Cuánto necesitas?" min="0" />
        </div>
      </div>
      <button class="btn btn-secondary" onclick="addMeta()">+ Agregar</button>
    </div>
    ` : `
    <button class="btn-add-item" onclick="renderStep5Body(true)">
      <span>+</span> Agregar meta
    </button>
    `}
    <p class="form-hint mt-8" style="padding: 0 4px">También puedes empezar sin metas y definirlas después.</p>
  `;
}

function addMeta() {
  const emoji = document.getElementById('m-emoji').value.trim() || '🎯';
  const nombre = document.getElementById('m-nombre').value.trim();
  const monto_objetivo = parseFloat(document.getElementById('m-monto').value);
  if (!nombre || !monto_objetivo) { showSnackbar('Completa nombre y monto', 'error'); return; }
  onboardingData.metas.push({ emoji, nombre, monto_objetivo });
  renderStep5Body(false);
}

function removeMeta(i) {
  onboardingData.metas.splice(i, 1);
  renderStep5Body(false);
}

// ---- GUARDAR ONBOARDING EN SUPABASE ----
async function finishOnboarding() {
  const btn = document.getElementById('btn-finish');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    // 1. Crear usuario
    const { data: usuario, error: errUsuario } = await db
      .from('usuarios')
      .insert({ nombre: onboardingData.nombre, onboarding_completo: true })
      .select()
      .single();

    if (errUsuario) throw errUsuario;
    setUsuarioId(usuario.id);

    // 2. Categorías default
    const cats = CATEGORIAS_DEFAULT.map(c => ({ ...c, usuario_id: usuario.id, es_default: true }));
    await db.from('categorias').insert(cats);

    // 3. Cuentas
    if (onboardingData.cuentas.length > 0) {
      const cuentas = onboardingData.cuentas.map(c => ({ ...c, usuario_id: usuario.id }));
      await db.from('cuentas').insert(cuentas);
    }

    // 4. Deudas
    if (onboardingData.deudas.length > 0) {
      const deudas = onboardingData.deudas.map(d => ({ ...d, usuario_id: usuario.id }));
      await db.from('deudas').insert(deudas);
    }

    // 5. Gastos fijos
    if (onboardingData.gastosFijos.length > 0) {
      const { data: catGasto } = await db
        .from('categorias')
        .select('id')
        .eq('usuario_id', usuario.id)
        .eq('nombre', 'Otros')
        .single();

      const fijos = onboardingData.gastosFijos.map(g => ({
        ...g,
        usuario_id: usuario.id,
        categoria_id: catGasto?.id || null
      }));
      await db.from('gastos_fijos').insert(fijos);
    }

    // 6. Metas
    if (onboardingData.metas.length > 0) {
      const metas = onboardingData.metas.map(m => ({ ...m, usuario_id: usuario.id }));
      await db.from('metas_ahorro').insert(metas);
    }

    showSnackbar('¡Todo listo! Bienvenido 🎉', 'success');
    setTimeout(() => renderApp(), 800);

  } catch (err) {
    console.error(err);
    showSnackbar('Error al guardar. Intenta de nuevo.', 'error');
    btn.textContent = '¡Listo, empecemos! 🚀';
    btn.disabled = false;
  }
}

// ---- RENDER APP PRINCIPAL ----
async function renderApp() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div id="page-dashboard" class="page active"></div>
    <div id="page-gastos" class="page"></div>
    <div id="page-cuentas" class="page"></div>
    <div id="page-deudas" class="page"></div>
    <div id="page-metas" class="page"></div>
    <div id="page-ajustes" class="page"></div>
  `;

  renderNav();
  await loadDashboard();
  await loadCuentas();
  await loadDeudas();
  await loadMetas();
  loadGastos();
  loadAjustes();
}

// ---- DASHBOARD ----
async function loadDashboard() {
  const uid = getUsuarioId();
  const [
    { data: usuario },
    { data: ingresos },
    { data: gastos },
    { data: deudas },
    { data: cuentas },
    { data: alertas }
  ] = await Promise.all([
    db.from('usuarios').select('nombre').eq('id', uid).single(),
    db.from('ingresos').select('monto').eq('usuario_id', uid),
    db.from('gastos').select('monto').eq('usuario_id', uid),
    db.from('deudas').select('monto_actual').eq('usuario_id', uid).eq('activa', true),
    db.from('cuentas').select('id, nombre, tipo, saldo_inicial').eq('usuario_id', uid).eq('activa', true),
    db.from('gastos_fijos').select('descripcion, monto, frecuencia').eq('usuario_id', uid).eq('activo', true)
  ]);

  const totalSaldoInicial = (cuentas || []).reduce((s, c) => s + Number(c.saldo_inicial), 0);
  const totalIngresos = (ingresos || []).reduce((s, i) => s + Number(i.monto), 0);
  const totalGastos = (gastos || []).reduce((s, g) => s + Number(g.monto), 0);
  const totalDeuda = (deudas || []).reduce((s, d) => s + Number(d.monto_actual), 0);
  const disponible = totalSaldoInicial + totalIngresos - totalGastos;

  const horaActual = new Date().getHours();
  const saludo = horaActual < 12 ? 'Buenos días' : horaActual < 19 ? 'Buenas tardes' : 'Buenas noches';

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header">
      <div>
        <p class="text-secondary" style="font-size:13px">${saludo} 👋</p>
        <h1 class="page-title">${usuario?.nombre?.split(' ')[0] || 'JM Finance'}</h1>
      </div>
    </div>

    <div class="balance-hero">
      <div class="balance-label">Disponible ahora</div>
      <div class="balance-amount">
        <span class="currency">$</span>${Math.abs(disponible).toLocaleString('es-MX')}
        ${disponible < 0 ? '<span style="font-size:14px;color:var(--red);margin-left:8px">⚠️ Negativo</span>' : ''}
      </div>
      <div class="balance-row">
        <div class="balance-stat">
          <span class="balance-stat-label">Ingresos</span>
          <span class="balance-stat-value income">${formatMXN(totalIngresos)}</span>
        </div>
        <div class="balance-stat">
          <span class="balance-stat-label">Gastos</span>
          <span class="balance-stat-value expense">${formatMXN(totalGastos)}</span>
        </div>
        <div class="balance-stat">
          <span class="balance-stat-label">Deuda total</span>
          <span class="balance-stat-value" style="color:var(--yellow)">${formatMXN(totalDeuda)}</span>
        </div>
      </div>
    </div>

    ${alertas && alertas.length > 0 ? `
    <div class="alert-banner">
      <div class="alert-icon">📌</div>
      <div class="alert-text">
        Tienes <strong>${alertas.length} gastos fijos</strong> comprometidos:
        ${alertas.slice(0, 3).map(a => `<br>· ${a.descripcion} — ${formatMXN(a.monto)} (${a.frecuencia})`).join('')}
        ${alertas.length > 3 ? `<br>· y ${alertas.length - 3} más...` : ''}
      </div>
    </div>
    ` : ''}

  `;

  // FAB con speed dial para registrar movimientos
  let fab = document.getElementById('fab-main');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'fab-main';
    fab.className = 'fab';
    document.getElementById('app').appendChild(fab);
  }

  closeFabMenu();
  fab.onclick = toggleFabMenu;
  setFabMainIcon(false);
}

function setFabMainIcon(isOpen) {
  const fab = document.getElementById('fab-main');
  if (!fab) return;

  fab.innerHTML = isOpen
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}

function openFabMenu() {
  if (document.getElementById('fab-menu')) return;

  const app = document.getElementById('app');
  if (!app) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'fab-menu-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:39;background:transparent;';
  backdrop.onclick = closeFabMenu;

  const menu = document.createElement('div');
  menu.id = 'fab-menu';
  menu.style.cssText = 'position:fixed;bottom:145px;right:calc(50% - 215px + 16px);z-index:40;display:flex;flex-direction:column;gap:10px;align-items:flex-end;opacity:0;transform:translateY(10px);transition:opacity 180ms ease,transform 180ms ease;';
  menu.innerHTML = `
    <button onclick="closeFabMenu(); openRegistrarGasto();" style="display:flex;align-items:center;gap:10px;width:180px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;color:var(--text-primary);font-size:15px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,0.12);cursor:pointer;font-family:var(--font-body)">
      <span style="font-size:20px;line-height:1">💸</span>
      <span>Registrar gasto</span>
    </button>
    <button onclick="closeFabMenu(); openRegistrarIngreso();" style="display:flex;align-items:center;gap:10px;width:180px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;color:var(--text-primary);font-size:15px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,0.12);cursor:pointer;font-family:var(--font-body)">
      <span style="font-size:20px;line-height:1">💰</span>
      <span>Registrar ingreso</span>
    </button>
  `;

  app.appendChild(backdrop);
  app.appendChild(menu);

  requestAnimationFrame(() => {
    menu.style.opacity = '1';
    menu.style.transform = 'translateY(0)';
  });

  setFabMainIcon(true);
}

function closeFabMenu() {
  const menu = document.getElementById('fab-menu');
  const backdrop = document.getElementById('fab-menu-backdrop');

  if (menu) {
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(10px)';
    setTimeout(() => menu.remove(), 180);
  }

  if (backdrop) backdrop.remove();
  setFabMainIcon(false);
}

function toggleFabMenu() {
  if (document.getElementById('fab-menu')) {
    closeFabMenu();
    return;
  }

  openFabMenu();
}

// ---- CUENTAS ----
async function loadCuentas() {
  const uid = getUsuarioId();
  const [
    { data: cuentas },
    { data: ingresosPorCuenta },
    { data: gastosPorCuenta },
    { data: pagosDeudaPorCuenta }
  ] = await Promise.all([
    db.from('cuentas').select('id, nombre, tipo, saldo_inicial').eq('usuario_id', uid).eq('activa', true),
    db.from('ingresos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('gastos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('pagos_deuda').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null)
  ]);

  const { cuentasConSaldo, totalGeneralCuentas } = calcularCuentasConSaldo(
    cuentas || [],
    ingresosPorCuenta || [],
    gastosPorCuenta || [],
    pagosDeudaPorCuenta || []
  );

  document.getElementById('page-cuentas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Cuentas</h1>
    </div>
    <div class="page-body" style="padding-top:0">
      ${!cuentasConSaldo.length ? `
        <div class="empty-state" style="margin-top:0">
          <div class="empty-icon">🏦</div>
          <p>No tienes cuentas activas.</p>
        </div>
      ` : `
        ${cuentasConSaldo.map(cuenta => `
          <div class="item-row" style="margin-bottom:8px">
            <div class="item-row-emoji">${cuenta.emoji}</div>
            <div class="item-row-info">
              <div class="item-row-name">${cuenta.nombre}</div>
            </div>
            <div class="item-row-amount">${formatMXN(cuenta.saldoCalculado)}</div>
          </div>
        `).join('')}
        <div class="card" style="margin-top:8px;background:var(--bg-elevated)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--text-secondary)">Total general</span>
            <span style="font-size:16px;font-weight:700;font-family:var(--font-display)">${formatMXN(totalGeneralCuentas)}</span>
          </div>
        </div>
      `}
    </div>
  `;
}

// ---- DEUDAS ----
async function loadDeudas() {
  const uid = getUsuarioId();
  const { data: deudas } = await db.from('deudas').select('*').eq('usuario_id', uid).eq('activa', true).order('created_at');

  document.getElementById('page-deudas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Mis deudas</h1>
      <button onclick="openAgregarDeuda()" style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-sm);padding:8px 14px;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nueva</button>
    </div>
    <div class="page-body">
      ${!deudas || deudas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <p>¡Sin deudas registradas!</p>
        </div>
      ` : deudas.map(d => {
        const pct = Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100);
        return `
          <div class="deuda-card">
            <div class="deuda-header">
              <span class="deuda-acreedor">💸 ${d.acreedor}</span>
              <span class="deuda-badge ${d.tipo_pago}">${d.tipo_pago}</span>
            </div>
            <div class="deuda-progress">
              <div class="deuda-progress-fill" style="width:${Math.max(pct, 2)}%"></div>
            </div>
            <div class="deuda-amounts">
              <span>Pagado ${pct}%</span>
              <span>Deuda: ${formatMXN(d.monto_actual)}</span>
            </div>
            ${d.monto_pago ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Pago ${d.tipo_pago}: ${formatMXN(d.monto_pago)}</div>` : ''}
            <button onclick="openPagarDeuda('${d.id}', '${d.acreedor}', ${d.monto_actual})" style="margin-top:12px;background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body);width:100%">
              Registrar pago
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ---- METAS ----
async function loadMetas() {
  const uid = getUsuarioId();
  const { data: metas } = await db.from('metas_ahorro').select('*').eq('usuario_id', uid).eq('activa', true);

  document.getElementById('page-metas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Metas de ahorro</h1>
      <button onclick="openAgregarMeta()" style="background:var(--green-soft);border:1px solid rgba(45,212,160,0.2);border-radius:var(--radius-sm);padding:8px 14px;color:var(--green);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nueva</button>
    </div>
    <div class="page-body">
      ${!metas || metas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p>Aún no tienes metas de ahorro.<br>¡Crea una para empezar!</p>
        </div>
      ` : metas.map(m => {
        const pct = Math.min(Math.round((m.monto_actual / m.monto_objetivo) * 100), 100);
        return `
          <div class="card">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <span style="font-size:28px">${m.emoji}</span>
              <div>
                <div style="font-weight:600;font-size:16px">${m.nombre}</div>
                <div style="font-size:13px;color:var(--text-secondary)">Meta: ${formatMXN(m.monto_objetivo)}</div>
              </div>
            </div>
            <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:8px">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--green));border-radius:4px;transition:width 0.6s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px">
              <span style="color:var(--text-secondary)">${pct}% completado</span>
              <span style="color:var(--green);font-weight:600">${formatMXN(m.monto_actual)} / ${formatMXN(m.monto_objetivo)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ---- GASTOS (historial) ----
async function loadGastos() {
  const uid = getUsuarioId();
  const { data: gastos } = await db
    .from('gastos')
    .select('*, categorias(nombre, emoji)')
    .eq('usuario_id', uid)
    .order('fecha', { ascending: false })
    .limit(50);

  document.getElementById('page-gastos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Mis gastos</h1>
    </div>
    <div class="page-body">
      ${!gastos || gastos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <p>No hay gastos registrados todavía.<br>Usa el botón + para agregar uno.</p>
        </div>
      ` : gastos.map(g => `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji">${g.categorias?.emoji || '📦'}</div>
          <div class="item-row-info">
            <div class="item-row-name">${g.descripcion}</div>
            <div class="item-row-detail">${g.categorias?.nombre || 'Sin categoría'} · ${g.fecha}</div>
          </div>
          <div class="item-row-amount">${formatMXN(g.monto)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- AJUSTES ----
function loadAjustes() {
  document.getElementById('page-ajustes').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Ajustes</h1>
    </div>
    <div class="page-body">
      <div class="card" style="margin-bottom:12px">
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:4px">Versión</div>
        <div style="font-weight:600">JM Finance v1.0</div>
      </div>
      <button class="btn btn-danger" onclick="resetApp()">Resetear datos (desarrollo)</button>
    </div>
  `;
}

function resetApp() {
  localStorage.removeItem('jmf_usuario_id');
  location.reload();
}

// ---- MODALES ----

// Registrar Ingreso
async function openRegistrarIngreso() {
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', getUsuarioId()).eq('activa', true);

  openModal('Registrar ingreso', `
    <div class="form-group">
      <label class="form-label">Monto</label>
      <input class="form-input" id="ri-monto" type="number" placeholder="$0.00" min="0" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select class="form-select" id="ri-tipo">
        <option value="salario">💼 Salario</option>
        <option value="beca">🎓 Beca</option>
        <option value="extra">⚡ Extra</option>
        <option value="otro">📦 Otro</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción (opcional)</label>
      <input class="form-input" id="ri-desc" type="text" placeholder="Ej: Pago semana 1" />
    </div>
    <div class="form-group">
      <label class="form-label">Cuenta</label>
      <select class="form-select" id="ri-cuenta">
        ${(cuentas || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input class="form-input" id="ri-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <button class="btn btn-primary" onclick="guardarIngreso()">Guardar ingreso</button>
  `);
}

async function guardarIngreso() {
  const monto = parseFloat(document.getElementById('ri-monto').value);
  const tipo = document.getElementById('ri-tipo').value;
  const descripcion = document.getElementById('ri-desc').value.trim();
  const cuenta_id = document.getElementById('ri-cuenta')?.value || null;
  const fecha = document.getElementById('ri-fecha').value;
  const usuario_id = getUsuarioId();
  if (!monto) { showSnackbar('Ingresa un monto', 'error'); return; }

  const { error } = await db.from('ingresos').insert({
    usuario_id,
    monto, tipo, descripcion, cuenta_id, fecha
  });

  if (error) { showSnackbar('Error al guardar', 'error'); return; }
  closeModal();

  const { data: gastosFijos, error: gastosFijosError } = await db
    .from('gastos_fijos')
    .select('descripcion, monto, frecuencia')
    .eq('usuario_id', usuario_id)
    .eq('activo', true);

  if (gastosFijosError) {
    console.error('Error consultando gastos_fijos tras guardar ingreso:', gastosFijosError);
  }

  const gastosAplicables = (gastosFijos || []).filter(gasto => gastoFijoAplicaPorFrecuencia(gasto.frecuencia, fecha));
  const totalComprometido = gastosAplicables.reduce((acc, gasto) => acc + Number(gasto.monto || 0), 0);
  const libre = monto - totalComprometido;

  console.log('Abriendo modal de dinero comprometido', { monto, fecha, gastosAplicables, totalComprometido, libre });

  openModal('💰 Dinero comprometido', `
    <div class="card" style="margin-bottom:12px;background:var(--bg-elevated)">
      <div style="font-size:12px;color:var(--text-secondary)">Ingreso recibido</div>
      <div style="font-family:var(--font-display);font-size:24px;font-weight:700;color:var(--green)">${formatMXN(monto)}</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:280px;overflow:auto">
      ${gastosAplicables.length === 0 ? `
        <div class="card" style="margin-bottom:0">
          <div style="font-size:14px;color:var(--text-secondary)">No hay gastos fijos comprometidos para este periodo.</div>
        </div>
      ` : gastosAplicables.map(gasto => `
        <div class="item-row" style="margin-bottom:0">
          <div class="item-row-emoji">📌</div>
          <div class="item-row-info">
            <div class="item-row-name">${gasto.descripcion}</div>
            <div class="item-row-detail">${gasto.frecuencia}</div>
          </div>
          <div class="item-row-amount">${formatMXN(gasto.monto)}</div>
        </div>
      `).join('')}
    </div>

    <div class="card" style="margin-bottom:16px;background:var(--bg-elevated)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;color:var(--text-secondary)">Total comprometido</span>
        <strong style="font-size:16px;color:var(--yellow)">${formatMXN(totalComprometido)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;color:var(--text-secondary)">Ingreso recibido</span>
        <strong style="font-size:16px">${formatMXN(monto)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border)">
        <span style="font-size:13px;color:var(--text-secondary)">Te queda libre</span>
        <strong style="font-size:18px;color:${libre >= 0 ? 'var(--green)' : 'var(--red)'}">${formatMXN(libre)}</strong>
      </div>
    </div>

    <button class="btn btn-primary" onclick="onEntendidoDineroComprometido()">Entendido</button>
  `);

  showSnackbar('Ingreso registrado ✓', 'success');
}

async function onEntendidoDineroComprometido() {
  closeModal();
  await loadDashboard();
  await loadCuentas();
}

function gastoFijoAplicaPorFrecuencia(frecuencia, fechaBase) {
  const fechaRef = fechaBase ? new Date(`${fechaBase}T00:00:00`) : new Date();
  const dia = fechaRef.getDate();

  if (frecuencia === 'semanal') return true;
  if (frecuencia === 'quincenal') return dia <= 15 || dia > 15;
  if (frecuencia === 'mensual') return true;

  return false;
}

// Registrar Gasto
async function openRegistrarGasto() {
  const { data: categorias } = await db.from('categorias').select('*').eq('usuario_id', getUsuarioId()).eq('tipo', 'gasto');
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', getUsuarioId()).eq('activa', true);

  openModal('Registrar gasto', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="rg-desc" type="text" placeholder="¿En qué gastaste?" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto</label>
      <input class="form-input" id="rg-monto" type="number" placeholder="$0.00" min="0" />
    </div>
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <select class="form-select" id="rg-cat">
        ${(categorias || []).map(c => `<option value="${c.id}">${c.emoji} ${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Cuenta</label>
      <select class="form-select" id="rg-cuenta">
        ${(cuentas || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input class="form-input" id="rg-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <button class="btn btn-primary" onclick="guardarGasto()">Guardar gasto</button>
  `);
}

async function guardarGasto() {
  const descripcion = document.getElementById('rg-desc').value.trim();
  const monto = parseFloat(document.getElementById('rg-monto').value);
  const categoria_id = document.getElementById('rg-cat').value;
  const cuenta_id = document.getElementById('rg-cuenta')?.value || null;
  const fecha = document.getElementById('rg-fecha').value;
  if (!descripcion || !monto) { showSnackbar('Completa descripción y monto', 'error'); return; }

  const gastoPayload = {
    usuario_id: getUsuarioId(),
    descripcion,
    monto,
    categoria_id,
    cuenta_id,
    fecha
  };

  const { error } = await db.from('gastos').insert(gastoPayload);

  if (error) { showSnackbar('Error al guardar', 'error'); return; }
  closeModal();
  showSnackbar('Gasto registrado ✓', 'success');
  await loadDashboard();
  loadGastos();
}

// Pagar Deuda
async function openPagarDeuda(deudaId, acreedor, montoActual) {
  const { data: cuentas, error } = await db
    .from('cuentas')
    .select('*')
    .eq('usuario_id', getUsuarioId())
    .eq('activa', true);

  if (error) {
    showSnackbar('No se pudieron cargar las cuentas', 'error');
    return;
  }

  openModal(`Pagar: ${acreedor}`, `
    <div class="card" style="margin-bottom:16px;background:var(--red-soft);border-color:rgba(240,93,110,0.2)">
      <div style="font-size:12px;color:var(--text-secondary)">Deuda actual</div>
      <div style="font-family:var(--font-display);font-size:24px;font-weight:700;color:var(--red)">${formatMXN(montoActual)}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Monto del pago</label>
      <input class="form-input" id="pd-monto" type="number" placeholder="$0.00" min="0" max="${montoActual}" />
    </div>
    <div class="form-group">
      <label class="form-label">Cuenta</label>
      <select class="form-select" id="pd-cuenta">
        ${(cuentas || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Nota (opcional)</label>
      <input class="form-input" id="pd-nota" type="text" placeholder="Ej: Abono quincenal" />
    </div>
    <button class="btn btn-primary" onclick="guardarPagoDeuda('${deudaId}', ${montoActual})">Registrar pago</button>
  `);
}

async function guardarPagoDeuda(deudaId, montoActual) {
  const monto = parseFloat(document.getElementById('pd-monto').value);
  const cuenta_id = document.getElementById('pd-cuenta')?.value || null;
  const nota = document.getElementById('pd-nota').value.trim();
  const usuarioId = getUsuarioId();
  if (!monto || monto <= 0) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (monto > montoActual) { showSnackbar('El pago no puede ser mayor a la deuda', 'error'); return; }
  if (!cuenta_id) { showSnackbar('Selecciona una cuenta', 'error'); return; }

  const [
    { data: cuenta, error: errorCuenta },
    { data: ingresosCuenta, error: errorIngresos },
    { data: gastosCuenta, error: errorGastos },
    { data: pagosDeudaCuenta, error: errorPagosDeuda }
  ] = await Promise.all([
    db.from('cuentas').select('saldo_inicial').eq('id', cuenta_id).eq('usuario_id', usuarioId).single(),
    db.from('ingresos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_id),
    db.from('gastos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_id),
    db.from('pagos_deuda').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_id)
  ]);

  if (errorCuenta || errorIngresos || errorGastos || errorPagosDeuda || !cuenta) {
    showSnackbar('No se pudo validar el saldo de la cuenta', 'error');
    return;
  }

  const totalIngresosCuenta = (ingresosCuenta || []).reduce((acc, mov) => acc + Number(mov.monto || 0), 0);
  const totalGastosCuenta = (gastosCuenta || []).reduce((acc, mov) => acc + Number(mov.monto || 0), 0);
  const totalPagosDeudaCuenta = (pagosDeudaCuenta || []).reduce((acc, mov) => acc + Number(mov.monto || 0), 0);
  const saldoDisponibleCuenta = Number(cuenta.saldo_inicial || 0) + totalIngresosCuenta - totalGastosCuenta - totalPagosDeudaCuenta;

  if (monto > saldoDisponibleCuenta) {
    showSnackbar('Saldo insuficiente en esa cuenta', 'error');
    return;
  }

  const nuevoMonto = montoActual - monto;

  await db.from('pagos_deuda').insert({
    deuda_id: deudaId,
    usuario_id: usuarioId,
    cuenta_id,
    monto, nota,
    fecha: new Date().toISOString().split('T')[0]
  });

  await db.from('deudas').update({
    monto_actual: nuevoMonto,
    activa: nuevoMonto > 0
  }).eq('id', deudaId);

  closeModal();
  showSnackbar(nuevoMonto === 0 ? '🎉 ¡Deuda saldada!' : 'Pago registrado ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

// Agregar Deuda nueva
function openAgregarDeuda() {
  openModal('Nueva deuda', `
    <div class="form-group">
      <label class="form-label">¿A quién le debes?</label>
      <input class="form-input" id="nd-acreedor" type="text" placeholder="Ej: Caja Popular, mamá, etc." />
    </div>
    <div class="form-group">
      <label class="form-label">Monto total</label>
      <input class="form-input" id="nd-monto" type="number" placeholder="$0.00" min="0" />
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="nd-freq">
        <option value="semanal">Semanal</option>
        <option value="quincenal">Quincenal</option>
        <option value="mensual">Mensual</option>
        <option value="libre">Sin fecha fija</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Pago por cuota (opcional)</label>
      <input class="form-input" id="nd-cuota" type="number" placeholder="$0.00" min="0" />
    </div>
    <button class="btn btn-primary" onclick="guardarNuevaDeuda()">Guardar deuda</button>
  `);
}

async function guardarNuevaDeuda() {
  const acreedor = document.getElementById('nd-acreedor').value.trim();
  const monto = parseFloat(document.getElementById('nd-monto').value);
  const tipo_pago = document.getElementById('nd-freq').value;
  const monto_pago = parseFloat(document.getElementById('nd-cuota').value) || null;
  if (!acreedor || !monto) { showSnackbar('Completa los campos requeridos', 'error'); return; }

  await db.from('deudas').insert({
    usuario_id: getUsuarioId(),
    acreedor, monto_inicial: monto, monto_actual: monto, tipo_pago, monto_pago
  });

  closeModal();
  showSnackbar('Deuda registrada ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

// Agregar Meta
function openAgregarMeta() {
  openModal('Nueva meta de ahorro', `
    <div class="form-group">
      <label class="form-label">Emoji</label>
      <input class="form-input" id="nm-emoji" type="text" placeholder="🎯" style="max-width:80px" />
    </div>
    <div class="form-group">
      <label class="form-label">Nombre de la meta</label>
      <input class="form-input" id="nm-nombre" type="text" placeholder="Ej: Capital para cachuchas" />
    </div>
    <div class="form-group">
      <label class="form-label">¿Cuánto necesitas?</label>
      <input class="form-input" id="nm-monto" type="number" placeholder="$0.00" min="0" />
    </div>
    <button class="btn btn-primary" onclick="guardarNuevaMeta()">Guardar meta</button>
  `);
}

async function guardarNuevaMeta() {
  const emoji = document.getElementById('nm-emoji').value.trim() || '🎯';
  const nombre = document.getElementById('nm-nombre').value.trim();
  const monto_objetivo = parseFloat(document.getElementById('nm-monto').value);
  if (!nombre || !monto_objetivo) { showSnackbar('Completa nombre y monto', 'error'); return; }

  await db.from('metas_ahorro').insert({
    usuario_id: getUsuarioId(),
    emoji, nombre, monto_objetivo
  });

  closeModal();
  showSnackbar('Meta creada ✓', 'success');
  await loadMetas();
}

// ---- MODAL BASE ----
function openModal(title, content) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    document.getElementById('app').appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">${title}</div>
      ${content}
    </div>
  `;

  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 300);
  }
}
