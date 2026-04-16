// js/app.js — Inicialización y onboarding

// NOTA PARA EL DESARROLLADOR — ejecutar en Supabase SQL Editor antes de usar pago único:
// ALTER TABLE deudas DROP CONSTRAINT IF EXISTS deudas_tipo_pago_check;
// ALTER TABLE deudas ADD CONSTRAINT deudas_tipo_pago_check
//   CHECK (tipo_pago = ANY (ARRAY['semanal','quincenal','mensual','libre','unico']));

// ---- ESTADO DEL ONBOARDING ----
let onboardingData = {
  nombre: '',
  tiposIngreso: [],
  categorias: [],
  cuentas: [],
  deudas: [],
  gastosFijos: [],
  metas: []
};

let currentStep = 1;
const TOTAL_STEPS = 5;

// ---- TEMA ----
const THEME_STORAGE_KEY = 'jmf_theme';

function applyTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';

  if (nextTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  updateThemeToggleUI();
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const preferredTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';

  applyTheme(savedTheme || preferredTheme);
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  applyTheme(isLight ? 'dark' : 'light');
}

function updateThemeToggleUI() {
  const label = document.getElementById('theme-label');
  const sw = document.getElementById('theme-switch');
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  if (label) {
    label.textContent = isLight ? '☀️  Modo claro' : '🌙  Modo oscuro';
  }

  if (sw) {
    sw.classList.toggle('on', isLight);
  }
}

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

function getCuentaIcon(tipo) {
  const cuentaIcon = {
    efectivo: '<i data-lucide="banknote" style="width:18px;height:18px;stroke-width:1.75"></i>',
    debito: '<i data-lucide="building-2" style="width:18px;height:18px;stroke-width:1.75"></i>',
    negocio: '<i data-lucide="store" style="width:18px;height:18px;stroke-width:1.75"></i>',
    otro: '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>'
  };

  return cuentaIcon[tipo] || '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>';
}

function getCategoriaGastoIcon(nombre) {
  const map = {
    Comida: 'utensils',
    Transporte: 'car',
    Ropa: 'shopping-bag',
    Internet: 'wifi',
    Salud: 'heart-pulse',
    Familia: 'users',
    Entretenimiento: 'tv',
    Negocio: 'briefcase',
    Deuda: 'trending-down',
    Ahorro: 'piggy-bank',
    Otros: 'package'
  };

  const iconName = map[nombre] || 'package';
  return `<i data-lucide="${iconName}" style="width:18px;height:18px;stroke-width:1.75"></i>`;
}

function renderLucideIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

function openActionSheet(title, actions) {
  openModal(title, `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${actions.map(action => `
        <button class="btn ${action.danger ? 'btn-danger' : 'btn-secondary'}" ${action.fullWidth ? 'style="width:100%"' : ''} onclick="${action.onClick}">
          ${action.icon ? `<i data-lucide="${action.icon}" style="width:16px;height:16px;pointer-events:none"></i>` : ''}
          <span>${action.label}</span>
        </button>
      `).join('')}
    </div>
  `);
}

const fabConfig = {
  dashboard: [
    { icon: 'minus-circle', label: 'Gasto', action: 'openRegistrarGasto()' },
    { icon: 'trending-up', label: 'Ingreso', action: 'openRegistrarIngreso()' },
    { icon: 'arrow-left-right', label: 'Traspaso', action: 'openRegistrarTraspaso()' }
  ],
  gastos: [
    { icon: 'plus', label: 'Nuevo gasto', action: 'openRegistrarGasto()' }
  ],
  ingresos: [
    { icon: 'plus', label: 'Nuevo ingreso', action: 'openRegistrarIngreso()' }
  ],
  deudas: [
    { icon: 'plus', label: 'Nueva deuda', action: 'openAgregarDeuda()' }
  ],
  metas: [
    { icon: 'plus', label: 'Nueva meta', action: 'openAgregarMeta()' }
  ],
  fijos: [
    { icon: 'plus', label: 'Nuevo fijo', action: 'openAgregarGastoFijo()' }
  ],
  cuentas: [
    { icon: 'wallet', label: 'Nueva cuenta', action: 'openAgregarCuenta()' },
    { icon: 'arrow-left-right', label: 'Traspaso', action: 'openRegistrarTraspaso()' }
  ],
  ajustes: null
};

let currentFabItems = [];

function runFabAction(action) {
  const functionName = action.replace(/\(\)$/, '');
  if (typeof window[functionName] === 'function') {
    window[functionName]();
  }
}

function updateFab(pageId) {
  let fab = document.getElementById('fab-main');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'fab-main';
    fab.className = 'fab';
    document.getElementById('app').appendChild(fab);
  }

  const items = fabConfig[pageId];
  closeFabMenu();
  fab.dataset.listenerSet = '';

  if (items === null) {
    fab.style.display = 'none';
    currentFabItems = [];
    renderLucideIcons();
    if (window.lucide) lucide.createIcons();
    return;
  }

  currentFabItems = items || [];
  fab.style.display = 'flex';

  if (currentFabItems.length === 1) {
    const item = currentFabItems[0];
    fab.innerHTML = `<i data-lucide="plus" style="width:22px;height:22px;pointer-events:none"></i>`;
    fab.onclick = () => runFabAction(item.action);
  } else {
    fab.onclick = toggleFabMenu;
    setFabMainIcon(false);
  }

  renderLucideIcons();
  if (window.lucide) lucide.createIcons();
}

let dashboardExpandedPagoId = null;

function ensurePagosProximosStyles() {
  if (document.getElementById('pagos-proximos-styles')) return;

  const style = document.createElement('style');
  style.id = 'pagos-proximos-styles';
  style.textContent = `
    .pago-pendiente-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-bottom: 8px;
      overflow: hidden;
      cursor: pointer;
    }
    .pago-pendiente-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px;
    }
    .pago-pendiente-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .pago-pendiente-extra {
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      transition: max-height 220ms ease, opacity 220ms ease;
      padding: 0 12px;
    }
    .pago-pendiente-card.expanded .pago-pendiente-extra {
      max-height: 90px;
      opacity: 1;
      padding: 0 12px 12px;
    }
    .pago-pendiente-chevron {
      transition: transform 220ms ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .pago-pendiente-card.expanded .pago-pendiente-chevron {
      transform: rotate(180deg);
    }
  `;

  document.head.appendChild(style);
}

function togglePagoPendienteExpand(itemId) {
  dashboardExpandedPagoId = dashboardExpandedPagoId === itemId ? null : itemId;
  loadDashboard();
}

function openMarcarPagoFijo(gastoFijoId) {
  openModal('Marcar como pagado', `
    <p class="form-hint" style="margin-bottom:12px">Se registrará este gasto fijo como pagado hoy.</p>
    <button class="btn btn-primary" onclick="confirmarMarcarPagoFijo('${gastoFijoId}')">Marcar como pagado</button>
  `);
}

async function confirmarMarcarPagoFijo(gastoFijoId) {
  const fechaHoy = new Date().toISOString().split('T')[0];
  const { error } = await db.from('gastos_fijos').update({ ultimo_pago: fechaHoy }).eq('id', gastoFijoId);

  if (error) {
    showSnackbar('No se pudo actualizar el gasto fijo', 'error');
    return;
  }

  closeModal();
  dashboardExpandedPagoId = null;
  showSnackbar('Pago registrado ✓', 'success');
  await loadDashboard();
  await loadFijos();
}

async function abrirPagoPendienteDeuda(deudaId) {
  const { data: deuda, error } = await db
    .from('deudas')
    .select('id, acreedor, monto_actual, tipo_deuda, monto_ultimo_pago')
    .eq('id', deudaId)
    .maybeSingle();

  if (error || !deuda) {
    showSnackbar('No se pudo cargar la deuda', 'error');
    return;
  }

  openPagarDeuda(deuda.id, deuda.acreedor, deuda.monto_actual, deuda.tipo_deuda, deuda.monto_ultimo_pago);
}

function calcularCuentasConSaldo(cuentas = [], ingresosPorCuenta = [], gastosPorCuenta = [], pagosDeudaPorCuenta = [], traspasosSalida = [], traspasosEntrada = []) {
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

  const sumasTraspasosSalidaPorCuenta = traspasosSalida.reduce((acc, mov) => {
    const cuentaId = mov.cuenta_origen_id;
    if (!cuentaId) return acc;
    acc[cuentaId] = (acc[cuentaId] || 0) + Number(mov.monto || 0);
    return acc;
  }, {});

  const sumasTraspasosEntradaPorCuenta = traspasosEntrada.reduce((acc, mov) => {
    const cuentaId = mov.cuenta_destino_id;
    if (!cuentaId) return acc;
    acc[cuentaId] = (acc[cuentaId] || 0) + Number(mov.monto || 0);
    return acc;
  }, {});

  const cuentasConSaldo = cuentas.map(cuenta => {
    const ingresosCuenta = sumasIngresosPorCuenta[cuenta.id] || 0;
    const gastosCuenta = sumasGastosPorCuenta[cuenta.id] || 0;
    const pagosDeudaCuenta = sumasPagosDeudaPorCuenta[cuenta.id] || 0;
    const traspasosSalidaCuenta = sumasTraspasosSalidaPorCuenta[cuenta.id] || 0;
    const traspasosEntradaCuenta = sumasTraspasosEntradaPorCuenta[cuenta.id] || 0;
    const saldoCuenta = Number(cuenta.saldo_inicial || 0) + ingresosCuenta - gastosCuenta - pagosDeudaCuenta - traspasosSalidaCuenta + traspasosEntradaCuenta;

    return {
      ...cuenta,
      saldoCalculado: saldoCuenta,
      emoji: getCuentaIcon(cuenta.tipo),
      tipoLabel: getCuentaTipos().find(t => t.value === cuenta.tipo)?.label || 'Otro'
    };
  });

  return {
    cuentasConSaldo,
    totalGeneralCuentas: cuentasConSaldo.reduce((acc, cuenta) => acc + cuenta.saldoCalculado, 0)
  };
}

async function getSaldoDisponibleTotal(usuarioId) {
  const [
    { data: cuentas, error: errorCuentas },
    { data: ingresos, error: errorIngresos },
    { data: gastos, error: errorGastos },
    { data: pagosDeuda, error: errorPagosDeuda }
  ] = await Promise.all([
    db.from('cuentas').select('saldo_inicial').eq('usuario_id', usuarioId).eq('activa', true),
    db.from('ingresos').select('monto').eq('usuario_id', usuarioId),
    db.from('gastos').select('monto').eq('usuario_id', usuarioId),
    db.from('pagos_deuda').select('monto').eq('usuario_id', usuarioId)
  ]);

  if (errorCuentas || errorIngresos || errorGastos || errorPagosDeuda) {
    return { error: true, saldoDisponible: null };
  }

  const totalSaldoInicial = (cuentas || []).reduce((acc, cuenta) => acc + Number(cuenta.saldo_inicial || 0), 0);
  const totalIngresos = (ingresos || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalGastos = (gastos || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalPagosDeuda = (pagosDeuda || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

  return {
    error: false,
    saldoDisponible: totalSaldoInicial + totalIngresos - totalGastos - totalPagosDeuda
  };
}

async function getSaldoCuentaEspecifica(usuarioId, cuentaId) {
  const [
    { data: cuenta, error: errorCuenta },
    { data: ingresos, error: errorIngresos },
    { data: gastos, error: errorGastos },
    { data: pagosDeuda, error: errorPagosDeuda },
    { data: traspasosSalida, error: errorTraspasosSalida },
    { data: traspasosEntrada, error: errorTraspasosEntrada }
  ] = await Promise.all([
    db.from('cuentas').select('saldo_inicial').eq('id', cuentaId).eq('usuario_id', usuarioId).eq('activa', true).maybeSingle(),
    db.from('ingresos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuentaId),
    db.from('gastos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuentaId),
    db.from('pagos_deuda').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuentaId),
    db.from('transferencias').select('monto').eq('usuario_id', usuarioId).eq('cuenta_origen_id', cuentaId),
    db.from('transferencias').select('monto').eq('usuario_id', usuarioId).eq('cuenta_destino_id', cuentaId)
  ]);

  if (errorCuenta || errorIngresos || errorGastos || errorPagosDeuda || errorTraspasosSalida || errorTraspasosEntrada || !cuenta) {
    return { error: true, saldoDisponible: null };
  }

  const totalIngresos = (ingresos || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalGastos = (gastos || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalPagosDeuda = (pagosDeuda || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalTraspasosSalida = (traspasosSalida || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalTraspasosEntrada = (traspasosEntrada || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

  return {
    error: false,
    saldoDisponible: Number(cuenta.saldo_inicial || 0) + totalIngresos - totalGastos - totalPagosDeuda - totalTraspasosSalida + totalTraspasosEntrada
  };
}

// ---- PAGOS PENDIENTES ----
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

function isSameMonth(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth();
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function isSameWeek(date1, date2) {
  const start1 = getWeekStart(date1);
  const start2 = getWeekStart(date2);
  return isSameDay(start1, start2);
}

function getQuincena(date) {
  return date.getDate() <= 15 ? 1 : 2;
}

function isSameQuincena(date1, date2) {
  return getQuincena(date1) === getQuincena(date2) && isSameMonth(date1, date2);
}

function getDayOfWeek(fechaStr) {
  const date = new Date(`${fechaStr}T00:00:00`);
  return date.getDay();
}

function getNextOccurrenceOfDayOfWeek(dayOfWeek) {
  const today = new Date();
  const currentDay = today.getDay();
  let daysAhead = dayOfWeek - currentDay;
  
  if (daysAhead <= 0) {
    daysAhead += 7;
  }
  
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
}

function getNextOccurrenceOfDayOfMonth(dayOfMonth) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  let date = new Date(year, month, dayOfMonth);
  
  if (date < today) {
    date = new Date(year, month + 1, dayOfMonth);
  }
  
  return date;
}

function getNextOccurrenceOfQuincena(dayOfQuincena) {
  const today = new Date();
  const currentDay = today.getDate();
  const currentQuincena = currentDay <= 15 ? 1 : 2;
  
  let targetDay;
  if (currentQuincena === 1) {
    targetDay = dayOfQuincena;
  } else {
    targetDay = 15 + dayOfQuincena;
  }
  
  if (currentDay >= targetDay) {
    if (currentQuincena === 1) {
      targetDay = 15 + dayOfQuincena;
    } else {
      targetDay = dayOfQuincena;
      const nextDate = new Date(today);
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(targetDay);
      return nextDate;
    }
  }
  
  const nextDate = new Date(today);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  nextDate.setDate(Math.min(targetDay, daysInMonth));
  return nextDate;
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isDateInRange(date, start, end) {
  const d = normalizeDate(date).getTime();
  const s = normalizeDate(start).getTime();
  const e = normalizeDate(end).getTime();
  return d >= s && d <= e;
}

function getNextWeeklyDate(dayOfWeek, fromDate) {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null;

  const base = normalizeDate(fromDate || new Date());
  const currentDay = base.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0) daysAhead += 7;

  const nextDate = new Date(base);
  nextDate.setDate(base.getDate() + daysAhead);
  return nextDate;
}

function getNextMonthlyDate(dayOfMonth, fromDate) {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;

  const base = normalizeDate(fromDate || new Date());
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (day <= dayOfMonth) {
    return new Date(year, month, Math.min(dayOfMonth, daysInMonth));
  }

  const nextMonthDays = new Date(year, month + 2, 0).getDate();
  return new Date(year, month + 1, Math.min(dayOfMonth, nextMonthDays));
}

function getNextQuincenalDate(dayOfQuincena, fromDate) {
  if (!Number.isInteger(dayOfQuincena) || dayOfQuincena < 1 || dayOfQuincena > 15) return null;

  const base = normalizeDate(fromDate || new Date());
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstHalf = new Date(year, month, Math.min(dayOfQuincena, daysInMonth));
  const secondHalf = new Date(year, month, Math.min(dayOfQuincena + 15, daysInMonth));

  if (firstHalf >= base) return firstHalf;
  if (secondHalf >= base) return secondHalf;

  const nextMonthDays = new Date(year, month + 2, 0).getDate();
  return new Date(year, month + 1, Math.min(dayOfQuincena, nextMonthDays));
}

function getProximaFechaCobro(ingresoProgramado, fechaBase) {
  const base = normalizeDate(fechaBase || new Date());

  if (!ingresoProgramado) return null;

  if (ingresoProgramado.frecuencia === 'semanal') {
    const diaSemana = ingresoProgramado.dia_semana;
    const currentDay = base.getDay();
    // Si hoy es el día de cobro, el próximo cobro es en 7 días
    // Si no, calculamos el próximo
    let daysAhead = diaSemana - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    const next = new Date(base);
    next.setDate(base.getDate() + daysAhead);
    return next;
  }

  if (ingresoProgramado.frecuencia === 'quincenal') {
    const year = base.getFullYear();
    const month = base.getMonth();
    const day = base.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Próxima quincena: día 1 o día 16
    if (day < 1) return new Date(year, month, 1);
    if (day < 16) return new Date(year, month, 16);
    // Pasó el 16, próximo es día 1 del siguiente mes
    return new Date(year, month + 1, 1);
  }

  if (ingresoProgramado.frecuencia === 'mensual') {
    return getNextMonthlyDate(ingresoProgramado.dia_pago, base);
  }

  return null;
}

async function getPagosPendientes() {
  const usuarioId = (await getUsuarioId());
  const hoy = normalizeDate(new Date());
  const pendientes = [];

  const { data: ingresosProgramados } = await db
    .from('ingresos_programados')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .order('created_at', { ascending: true })
    .limit(1);

  const ingresoBase = ingresosProgramados?.[0] || null;
  const proximaFechaCobro = getProximaFechaCobro(ingresoBase, hoy);

  // Si no hay ingreso programado, usamos 7 días adelante como ventana default
  const fechaLimite = proximaFechaCobro || (() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 7);
    return d;
  })();

  const [
    { data: gastosFijos },
    { data: deudas }
  ] = await Promise.all([
    db.from('gastos_fijos').select('*').eq('usuario_id', usuarioId).eq('activo', true),
    db.from('deudas').select('*').eq('usuario_id', usuarioId).eq('activa', true)
  ]);

  // Gastos fijos pendientes
  for (const gf of (gastosFijos || [])) {
    let fechaEsperada = null;

    if (gf.frecuencia === 'semanal' && Number.isInteger(gf.dia_semana)) {
      fechaEsperada = getNextWeeklyDate(gf.dia_semana, hoy);
    } else if (gf.frecuencia === 'mensual' && gf.dia_pago) {
      fechaEsperada = getNextMonthlyDate(gf.dia_pago, hoy);
    } else if (gf.frecuencia === 'quincenal' && gf.dia_pago) {
      fechaEsperada = getNextQuincenalDate(gf.dia_pago, hoy);
    }

    if (!fechaEsperada) continue;

    // Está dentro del período hoy → próximo cobro
    if (!isDateInRange(fechaEsperada, hoy, fechaLimite)) continue;

    // Ya se pagó en este período?
    if (gf.ultimo_pago) {
      const ultimoPago = normalizeDate(new Date(gf.ultimo_pago + 'T00:00:00'));
      if (isDateInRange(ultimoPago, hoy, fechaLimite)) continue;
    }

    pendientes.push({
      item_id: `fijo-${gf.id}`,
      gasto_fijo_id: gf.id,
      nombre: gf.descripcion,
      monto: Number(gf.monto || 0),
      fecha_esperada: fechaEsperada,
      tipo: 'fijo',
      urgente: true
    });
  }

  // Deudas pendientes
  for (const d of (deudas || [])) {
    // Deudas con tabla: usar próximo pago programado
    if (d.tipo_deuda === 'tabla') {
      const { data: proximoPago } = await db.from('pagos_programados')
        .select('fecha_vencimiento, monto_esperado')
        .eq('deuda_id', d.id)
        .eq('pagado', false)
        .order('fecha_vencimiento')
        .limit(1)
        .maybeSingle();

      if (proximoPago) {
        const fechaVenc = normalizeDate(new Date(proximoPago.fecha_vencimiento + 'T00:00:00'));
        if (isDateInRange(fechaVenc, hoy, fechaLimite)) {
          pendientes.push({
            item_id: `deuda-${d.id}`,
            deuda_id: d.id,
            tipo_deuda: d.tipo_deuda || 'simple',
            monto_actual: Number(d.monto_actual || 0),
            monto_ultimo_pago: Number(d.monto_ultimo_pago || 0),
            nombre: d.acreedor,
            monto: Number(proximoPago.monto_esperado || 0),
            fecha_esperada: fechaVenc,
            tipo: 'deuda',
            urgente: true
          });
        }
      }
      continue;
    }

    // Deudas simple/variable con frecuencia
    let fechaEsperada = null;
    if (d.tipo_pago === 'semanal' && Number.isInteger(d.dia_semana)) {
      fechaEsperada = getNextWeeklyDate(d.dia_semana, hoy);
    } else if (d.tipo_pago === 'mensual' && d.dia_pago) {
      fechaEsperada = getNextMonthlyDate(d.dia_pago, hoy);
    } else if (d.tipo_pago === 'quincenal' && d.dia_pago) {
      fechaEsperada = getNextQuincenalDate(d.dia_pago, hoy);
    }

    if (!fechaEsperada) continue;
    if (!isDateInRange(fechaEsperada, hoy, fechaLimite)) continue;

    // Ya se pagó en este período?
    if (d.ultimo_pago) {
      const ultimoPago = normalizeDate(new Date(d.ultimo_pago + 'T00:00:00'));
      if (isDateInRange(ultimoPago, hoy, fechaLimite)) continue;
    }

    pendientes.push({
      item_id: `deuda-${d.id}`,
      deuda_id: d.id,
      tipo_deuda: d.tipo_deuda || 'simple',
      monto_actual: Number(d.monto_actual || 0),
      monto_ultimo_pago: Number(d.monto_ultimo_pago || 0),
      nombre: d.acreedor,
      monto: Number(d.monto_pago || 0),
      fecha_esperada: fechaEsperada,
      tipo: 'deuda',
      urgente: true
    });
  }

  pendientes.sort((a, b) => a.fecha_esperada - b.fecha_esperada);
  pendientes.proxima_fecha_cobro = proximaFechaCobro;
  pendientes.total_periodo = pendientes.reduce((acc, p) => acc + Number(p.monto || 0), 0);
  return pendientes;
}

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
    1: renderStep2nuevo,  // Tipos de ingreso
    2: renderStep3nuevo,  // Categorías de gasto (+ gastos fijos)
    3: renderStep4,       // Cuentas
    4: renderStep5,       // Deudas
    5: renderStep6        // Metas
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
  const footer = document.getElementById('onboarding-footer');
  footer.innerHTML = html;
  // Re-inicializar touch events para todos los botones del footer
  footer.querySelectorAll('button, .btn').forEach(btn => {
    btn.style.touchAction = 'manipulation';
    btn.style.webkitTapHighlightColor = 'transparent';
  });
}

// ---- ICONOS PARA SELECTOR PERSONALIZADO ----
const ICONOS_PICKER = [
  'briefcase','home','zap','wifi','utensils','car','heart-pulse',
  'graduation-cap','shopping-bag','tv','users','credit-card',
  'piggy-bank','music','coffee','dog','baby','dumbbell','shirt','package'
];

// STEP 1 (ex-2): Tipos de ingreso
const TODOS_ICONOS = [
  'briefcase','laptop','store','clock','building-2','graduation-cap',
  'landmark','users','home','zap','droplets','flame','wifi','smartphone',
  'shopping-cart','utensils','coffee','package','fuel','bus','car',
  'wrench','stethoscope','pill','dumbbell','shield','book-open','pencil',
  'shirt','scissors','sparkles','tv','music','gamepad-2','baby','dog',
  'gift','heart-pulse','piggy-bank','credit-card','trending-up',
  'trending-down','wallet','banknote','coins','target','star','award',
  'tool','hammer','paint-bucket','camera','mic','headphones','plane',
  'ship','train','bike','footprints','moon','sun','cloud','umbrella',
  'flag','map-pin','globe','key','lock','bell','calendar','clock-3',
  'refresh-cw','check-circle','alert-circle','info','plus-circle',
  'minus-circle','arrow-right','arrow-left','percent','tag','box'
];

function renderStep2nuevo() {
  const TIPOS_INGRESO = [
    'Salario / Nómina',
    'Honorarios / Freelance',
    'Negocio propio',
    'Horas extra',
    'Renta de inmueble',
    'Beca / Apoyo gobierno',
    'Pensión / Retiro',
    'Mesada / Apoyo familiar',
  ];

  setHeader('¿Cómo recibes dinero?', 'Selecciona todas las que apliquen.');

  function render(showIconPanel = false, panelForIndex = null) {
    const customItems = onboardingData.tiposIngreso.filter(x => !TIPOS_INGRESO.includes(x.nombre));
    
    const itemsHtml = `
      <div class="income-list">
        ${TIPOS_INGRESO.map(nombre => {
          const selected = onboardingData.tiposIngreso.some(x => x.nombre === nombre);
          return `
            <div class="item-row${selected ? ' selected' : ''}" onclick="toggleTipoIngreso('${nombre}')">
              <span>${nombre}</span>
            </div>`;
        }).join('')}
        
        ${customItems.map((item, idx) => `
          <div class="item-row selected">
            <span>${item.nombre}</span>
            <button class="btn-remove" onclick="removeTipoIngresoCustom(${idx})" style="margin-left:auto">✕</button>
          </div>`).join('')}
      </div>
    `;

    const customFormHtml = `
      <div class="custom-form">
        <div class="custom-form-row">
          <button class="emoji-picker-btn" id="emoji-btn" onclick="toggleIconPanel()">
            <i data-lucide="${window._tipoIngresoSelectedIcono || 'plus'}"></i>
          </button>
          <input class="form-input" id="ti-nombre" placeholder="Nombre del ingreso" />
        </div>
        
        ${showIconPanel ? `
        <div class="icon-panel">
          <div class="icon-grid">
            ${TODOS_ICONOS.map(ic => `
              <div class="icon-grid-item${ic === window._tipoIngresoSelectedIcono ? ' selected' : ''}" onclick="selectIconoTipoIngreso('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
        </div>
        ` : ''}
        
        <button class="btn btn-secondary" style="margin-top:12px; width:100%" onclick="addTipoIngresoCustom()">+ Agregar</button>
      </div>
    `;

    document.getElementById('onboarding-body').innerHTML = `
      ${itemsHtml}
      <div style="margin-top:20px">
        ${window._showCustomForm ? customFormHtml : `
          <button class="btn-add-item" onclick="showCustomIngresoForm()">
            <span>+</span> Agregar personalizado
          </button>
        `}
      </div>
    `;
    
    lucide.createIcons();
  }

  window._renderStep2Body = render;
  window._showCustomForm = false;
  window._tipoIngresoSelectedIcono = 'plus';
  render();

  setFooter(`
    <button class="btn btn-primary" onclick="nextStep2nuevo()">Continuar →</button>
  `);
}

window.toggleTipoIngreso = function(nombre) {
  const idx = onboardingData.tiposIngreso.findIndex(x => x.nombre === nombre);
  if (idx >= 0) {
    onboardingData.tiposIngreso.splice(idx, 1);
  } else {
    onboardingData.tiposIngreso.push({ nombre, icono: 'briefcase' });
  }
  if (window._renderStep2Body) window._renderStep2Body();
};

window.showCustomIngresoForm = function() {
  window._showCustomForm = true;
  window._tipoIngresoSelectedIcono = 'plus';
  if (window._renderStep2Body) window._renderStep2Body(false);
};

window.toggleIconPanel = function() {
  const currentShow = window._showIconPanel || false;
  if (window._renderStep2Body) window._renderStep2Body(!currentShow);
  window._showIconPanel = !currentShow;
};

window.selectIconoTipoIngreso = function(icono) {
  window._tipoIngresoSelectedIcono = icono;
  window._showIconPanel = false;
  if (window._renderStep2Body) window._renderStep2Body(false);
};

window.addTipoIngresoCustom = function() {
  const nombre = document.getElementById('ti-nombre')?.value.trim();
  const icono = window._tipoIngresoSelectedIcono || 'plus';
  if (!nombre) { 
    showSnackbar('Escribe el nombre del ingreso', 'error'); 
    return; 
  }
  onboardingData.tiposIngreso.push({ nombre, icono });
  window._showCustomForm = false;
  window._tipoIngresoSelectedIcono = 'plus';
  if (window._renderStep2Body) window._renderStep2Body();
};

window.removeTipoIngresoCustom = function(index) {
  const customItems = onboardingData.tiposIngreso.filter(x => !['Salario / Nómina','Honorarios / Freelance','Negocio propio','Horas extra','Renta de inmueble','Beca / Apoyo gobierno','Pensión / Retiro','Mesada / Apoyo familiar'].includes(x.nombre));
  const itemToRemove = customItems[index];
  const idx = onboardingData.tiposIngreso.findIndex(x => x.nombre === itemToRemove.nombre && x.icono === itemToRemove.icono);
  if (idx >= 0) {
    onboardingData.tiposIngreso.splice(idx, 1);
  }
  if (window._renderStep2Body) window._renderStep2Body();
};

function nextStep2nuevo() {
  if (onboardingData.tiposIngreso.length < 1) {
    showSnackbar('Selecciona al menos un tipo de ingreso', 'error');
    return;
  }
  renderStep(2);
}

// STEP 3: Categorías de gasto
const CATEGORIA_ICONOS = {
  'Renta': 'home', 'Luz / CFE': 'zap', 'Agua': 'droplets', 'Gas': 'flame', 'Internet': 'wifi', 'Teléfono celular': 'smartphone',
  'Despensa': 'shopping-cart', 'Restaurantes': 'utensils', 'Antojitos / snacks': 'coffee', 'Delivery / pedidos': 'package',
  'Gasolina': 'fuel', 'Transporte público': 'bus', 'Uber / Didi': 'car', 'Mantenimiento auto': 'wrench',
  'Médico / consultas': 'stethoscope', 'Medicamentos': 'pill', 'Gimnasio': 'dumbbell', 'Seguro médico': 'shield',
  'Colegiatura': 'graduation-cap', 'Libros / cursos': 'book-open', 'Útiles escolares': 'pencil',
  'Ropa': 'shirt', 'Calzado': 'footprints', 'Corte de pelo': 'scissors', 'Cosméticos / higiene': 'sparkles',
  'Streaming': 'tv', 'Cine / teatro': 'tv', 'Salidas / fiestas': 'music', 'Videojuegos': 'gamepad-2',
  'Hijos': 'baby', 'Padres / familia': 'users', 'Mascotas': 'dog', 'Regalos': 'gift', 'Otros': 'package'
};

function renderStep3nuevo() {
  const GRUPOS = [
    { titulo: 'Hogar', items: ['Renta', 'Luz / CFE', 'Agua', 'Gas', 'Internet', 'Teléfono celular'] },
    { titulo: 'Alimentación', items: ['Despensa', 'Restaurantes', 'Antojitos / snacks', 'Delivery / pedidos'] },
    { titulo: 'Transporte', items: ['Gasolina', 'Transporte público', 'Uber / Didi', 'Mantenimiento auto'] },
    { titulo: 'Salud', items: ['Médico / consultas', 'Medicamentos', 'Gimnasio', 'Seguro médico'] },
    { titulo: 'Educación', items: ['Colegiatura', 'Libros / cursos', 'Útiles escolares'] },
    { titulo: 'Ropa y personal', items: ['Ropa', 'Calzado', 'Corte de pelo', 'Cosméticos / higiene'] },
    { titulo: 'Entretenimiento', items: ['Streaming', 'Cine / teatro', 'Salidas / fiestas', 'Videojuegos'] },
    { titulo: 'Familia y otros', items: ['Hijos', 'Padres / familia', 'Mascotas', 'Regalos', 'Otros'] },
  ];

  setHeader('¿En qué sueles gastar?', 'Elige categorías y define si alguna es gasto fijo.');

  window._fixedPanelOpen = null;
  window._showCustomCatForm = false;
  window._showCatIconPanel = false;
  window._selectedCatIcono = 'plus';
  window._customCatNombre = '';
  window._customCatEsFijo = false;
  window._customCatFrecuencia = 'mensual';
  window._customCatDiaPago = null;
  window._customCatDiaSemana = null;
  window._customCatMonto = null;

  function render() {
    const predefinedNames = GRUPOS.flatMap(g => g.items);
    const customCats = onboardingData.categorias.filter(x => !predefinedNames.includes(x.nombre));
    const fixedIdx = window._fixedPanelOpen;
    const fixedCat = Number.isInteger(fixedIdx) ? onboardingData.categorias[fixedIdx] : null;

    const fixedDateField = fixedCat && fixedCat.es_fijo
      ? (fixedCat.frecuencia === 'semanal'
        ? `
            <select class="form-select" id="fijo-dia-semana" onchange="updateCategoriaFijo(${fixedIdx})">
              <option value="0" ${fixedCat.dia_semana === 0 ? 'selected' : ''}>Domingo</option>
              <option value="1" ${fixedCat.dia_semana === 1 ? 'selected' : ''}>Lunes</option>
              <option value="2" ${fixedCat.dia_semana === 2 ? 'selected' : ''}>Martes</option>
              <option value="3" ${fixedCat.dia_semana === 3 ? 'selected' : ''}>Miércoles</option>
              <option value="4" ${fixedCat.dia_semana === 4 ? 'selected' : ''}>Jueves</option>
              <option value="5" ${fixedCat.dia_semana === 5 ? 'selected' : ''}>Viernes</option>
              <option value="6" ${fixedCat.dia_semana === 6 ? 'selected' : ''}>Sábado</option>
            </select>
          `
        : `
            <input
              class="form-input"
              id="fijo-dia-pago"
              type="number"
              min="1"
              max="${fixedCat.frecuencia === 'quincenal' ? 15 : 31}"
              value="${fixedCat.dia_pago ?? ''}"
              placeholder="${fixedCat.frecuencia === 'quincenal' ? 'Día (1-15)' : 'Día del mes (1-31)'}"
              onchange="updateCategoriaFijo(${fixedIdx})"
            />
          `)
      : '';

    const customDateField = window._customCatEsFijo
      ? (window._customCatFrecuencia === 'semanal'
        ? `
            <select class="form-select" id="custom-fijo-dia-semana" onchange="updateCustomFijoFields()">
              <option value="0" ${window._customCatDiaSemana === 0 ? 'selected' : ''}>Domingo</option>
              <option value="1" ${window._customCatDiaSemana === 1 ? 'selected' : ''}>Lunes</option>
              <option value="2" ${window._customCatDiaSemana === 2 ? 'selected' : ''}>Martes</option>
              <option value="3" ${window._customCatDiaSemana === 3 ? 'selected' : ''}>Miércoles</option>
              <option value="4" ${window._customCatDiaSemana === 4 ? 'selected' : ''}>Jueves</option>
              <option value="5" ${window._customCatDiaSemana === 5 ? 'selected' : ''}>Viernes</option>
              <option value="6" ${window._customCatDiaSemana === 6 ? 'selected' : ''}>Sábado</option>
            </select>
          `
        : `
            <input
              class="form-input"
              id="custom-fijo-dia-pago"
              type="number"
              min="1"
              max="${window._customCatFrecuencia === 'quincenal' ? 15 : 31}"
              value="${window._customCatDiaPago ?? ''}"
              placeholder="${window._customCatFrecuencia === 'quincenal' ? 'Día (1-15)' : 'Día del mes (1-31)'}"
              onchange="updateCustomFijoFields()"
            />
          `)
      : '';

    document.getElementById('onboarding-body').innerHTML = `
      <div class="category-list">
        ${GRUPOS.map(grupo => `
          <div class="category-group">
            <div class="category-group-title">${grupo.titulo}</div>
            <div class="category-grid">
              ${grupo.items.map(nombre => {
                const selected = onboardingData.categorias.some(x => x.nombre === nombre);
                return `
                  <div class="category-item${selected ? ' selected' : ''}" onclick="toggleCategoria3('${nombre}')">
                    <i data-lucide="${CATEGORIA_ICONOS[nombre] || 'package'}" class="cat-icon"></i>
                    <span class="cat-name">${nombre}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}

        ${customCats.length > 0 ? `
          <div class="category-group">
            <div class="category-group-title">Personalizadas</div>
            <div class="category-grid">
              ${customCats.map(cat => `
                <div class="category-item selected" onclick="toggleCategoria3('${cat.nombre}')">
                  <i data-lucide="${cat.icono}" class="cat-icon"></i>
                  <span class="cat-name">${cat.nombre}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      ${onboardingData.categorias.length > 0 ? `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-light)">
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:10px">Seleccionadas</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${onboardingData.categorias.map((cat, idx) => `
              <button class="category-chip${cat.es_fijo ? ' is-fixed' : ''}" onclick="toggleFixedPanel(${idx})">
                ${cat.nombre}${cat.es_fijo ? '<span style="font-size:11px;margin-left:6px">Fijo</span>' : ''}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${fixedCat ? `
        <div style="margin-top:16px;padding:16px;background:var(--accent-soft);border:1.5px solid var(--border);border-radius:var(--radius-sm)">
          <div style="font-weight:600;margin-bottom:12px">¿Es un gasto fijo?</div>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class="btn ${fixedCat.es_fijo ? 'btn-primary' : 'btn-ghost'}" onclick="setCategoriaFijo(${fixedIdx},true)">Sí</button>
            <button class="btn ${!fixedCat.es_fijo ? 'btn-primary' : 'btn-ghost'}" onclick="setCategoriaFijo(${fixedIdx},false)">No</button>
          </div>
          ${fixedCat.es_fijo ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <select class="form-select" id="fijo-freq" onchange="updateCategoriaFijo(${fixedIdx})">
                <option value="semanal" ${fixedCat.frecuencia === 'semanal' ? 'selected' : ''}>Semanal</option>
                <option value="quincenal" ${fixedCat.frecuencia === 'quincenal' ? 'selected' : ''}>Quincenal</option>
                <option value="mensual" ${fixedCat.frecuencia === 'mensual' ? 'selected' : ''}>Mensual</option>
              </select>
              ${fixedDateField}
              <div class="input-money-wrap" style="grid-column:1/-1">
                <span class="currency-prefix">$</span>
                <input class="form-input" id="fijo-monto" type="number" min="0" value="${fixedCat.monto_fijo ?? ''}" placeholder="Monto aproximado" onchange="updateCategoriaFijo(${fixedIdx})" />
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${window._showCustomCatForm ? `
        <div class="custom-form" style="margin-top:20px">
          <div class="custom-form-row">
            <button class="emoji-picker-btn" onclick="toggleCatIconPanel()">
              ${window._selectedCatIcono === 'plus' ? '+' : `<i data-lucide="${window._selectedCatIcono}"></i>`}
            </button>
            <input class="form-input" id="cat3-nombre" value="${window._customCatNombre || ''}" placeholder="Nombre de la categoría" style="margin:0" oninput="updateCustomCatName(this.value)" />
          </div>

          ${window._showCatIconPanel ? `
            <div class="icon-panel" style="margin-top:12px">
              <div class="icon-grid">
                ${TODOS_ICONOS.map(ic => `
                  <div class="icon-grid-item${ic === window._selectedCatIcono ? ' selected' : ''}" onclick="selectCatIcono('${ic}')">
                    <i data-lucide="${ic}"></i>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div style="font-weight:600;margin:12px 0 8px">¿Es gasto fijo?</div>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class="btn ${window._customCatEsFijo ? 'btn-primary' : 'btn-ghost'}" onclick="setCustomCatFijo(true)">Sí</button>
            <button class="btn ${!window._customCatEsFijo ? 'btn-primary' : 'btn-ghost'}" onclick="setCustomCatFijo(false)">No</button>
          </div>

          ${window._customCatEsFijo ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <select class="form-select" id="custom-fijo-freq" onchange="updateCustomFijoFields()">
                <option value="semanal" ${window._customCatFrecuencia === 'semanal' ? 'selected' : ''}>Semanal</option>
                <option value="quincenal" ${window._customCatFrecuencia === 'quincenal' ? 'selected' : ''}>Quincenal</option>
                <option value="mensual" ${window._customCatFrecuencia === 'mensual' ? 'selected' : ''}>Mensual</option>
              </select>
              ${customDateField}
              <div class="input-money-wrap" style="grid-column:1/-1">
                <span class="currency-prefix">$</span>
                <input class="form-input" id="custom-fijo-monto" type="number" min="0" value="${window._customCatMonto ?? ''}" placeholder="Monto aproximado" onchange="updateCustomFijoFields()" />
              </div>
            </div>
          ` : ''}

          <button class="btn btn-secondary" style="margin-top:12px;width:100%" onclick="addCategoria3Custom()">+ Agregar</button>
        </div>
      ` : `
        <button class="btn-add-item" style="margin-top:20px" onclick="showCustomCat3Form()">
          <span>+</span> Agregar categoría propia
        </button>
      `}
    `;

    lucide.createIcons();
  }

  window._renderStep3Body = render;
  render();

  setFooter(`
    <button class="btn btn-primary" onclick="nextStep3nuevo()">Continuar →</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(1)">← Atrás</button>
  `);
}

window.toggleCategoria3 = function(nombre) {
  const idx = onboardingData.categorias.findIndex(x => x.nombre === nombre);
  if (idx >= 0) {
    onboardingData.categorias.splice(idx, 1);
  } else {
    onboardingData.categorias.push({
      nombre,
      icono: CATEGORIA_ICONOS[nombre] || 'package',
      tipo: 'gasto',
      es_fijo: false,
      frecuencia: null,
      dia_pago: null,
      dia_semana: null,
      monto_fijo: null
    });
  }
  window._fixedPanelOpen = null;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.toggleFixedPanel = function(idx) {
  window._fixedPanelOpen = window._fixedPanelOpen === idx ? null : idx;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.setCategoriaFijo = function(idx, isFijo) {
  const cat = onboardingData.categorias[idx];
  if (!cat) return;
  cat.es_fijo = isFijo;
  if (isFijo && !cat.frecuencia) cat.frecuencia = 'mensual';
  if (!isFijo) {
    cat.frecuencia = null;
    cat.dia_pago = null;
    cat.dia_semana = null;
    cat.monto_fijo = null;
  }
  if (window._renderStep3Body) window._renderStep3Body();
};

window.updateCategoriaFijo = function(idx) {
  const cat = onboardingData.categorias[idx];
  if (!cat) return;

  const frecuencia = document.getElementById('fijo-freq')?.value || 'mensual';
  const monto = parseFloat(document.getElementById('fijo-monto')?.value);

  cat.frecuencia = frecuencia;
  cat.monto_fijo = Number.isFinite(monto) ? monto : null;

  if (frecuencia === 'semanal') {
    const diaSemana = parseInt(document.getElementById('fijo-dia-semana')?.value, 10);
    cat.dia_semana = Number.isInteger(diaSemana) ? diaSemana : null;
    cat.dia_pago = null;
  } else {
    const diaPago = parseInt(document.getElementById('fijo-dia-pago')?.value, 10);
    cat.dia_pago = Number.isInteger(diaPago) ? diaPago : null;
    cat.dia_semana = null;
  }

  if (window._renderStep3Body) window._renderStep3Body();
};

window.showCustomCat3Form = function() {
  window._showCustomCatForm = true;
  window._showCatIconPanel = false;
  window._selectedCatIcono = 'plus';
  window._customCatNombre = '';
  window._customCatEsFijo = false;
  window._customCatFrecuencia = 'mensual';
  window._customCatDiaPago = null;
  window._customCatDiaSemana = null;
  window._customCatMonto = null;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.toggleCatIconPanel = function() {
  window._showCatIconPanel = !window._showCatIconPanel;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.selectCatIcono = function(icono) {
  window._selectedCatIcono = icono;
  window._showCatIconPanel = false;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.updateCustomCatName = function(value) {
  window._customCatNombre = value;
};

window.setCustomCatFijo = function(isFijo) {
  window._customCatEsFijo = isFijo;
  if (!isFijo) {
    window._customCatDiaPago = null;
    window._customCatDiaSemana = null;
    window._customCatMonto = null;
  }
  if (window._renderStep3Body) window._renderStep3Body();
};

window.updateCustomFijoFields = function() {
  window._customCatFrecuencia = document.getElementById('custom-fijo-freq')?.value || 'mensual';

  const monto = parseFloat(document.getElementById('custom-fijo-monto')?.value);
  window._customCatMonto = Number.isFinite(monto) ? monto : null;

  if (window._customCatFrecuencia === 'semanal') {
    const diaSemana = parseInt(document.getElementById('custom-fijo-dia-semana')?.value, 10);
    window._customCatDiaSemana = Number.isInteger(diaSemana) ? diaSemana : null;
    window._customCatDiaPago = null;
  } else {
    const diaPago = parseInt(document.getElementById('custom-fijo-dia-pago')?.value, 10);
    window._customCatDiaPago = Number.isInteger(diaPago) ? diaPago : null;
    window._customCatDiaSemana = null;
  }

  if (window._renderStep3Body) window._renderStep3Body();
};

window.addCategoria3Custom = function() {
  const nombre = (window._customCatNombre || '').trim();
  const icono = window._selectedCatIcono === 'plus' ? 'package' : (window._selectedCatIcono || 'package');

  if (!nombre) {
    showSnackbar('Escribe el nombre de la categoría', 'error');
    return;
  }

  onboardingData.categorias.push({
    nombre,
    icono,
    tipo: 'gasto',
    es_fijo: window._customCatEsFijo,
    frecuencia: window._customCatEsFijo ? window._customCatFrecuencia : null,
    dia_pago: window._customCatEsFijo ? window._customCatDiaPago : null,
    dia_semana: window._customCatEsFijo ? window._customCatDiaSemana : null,
    monto_fijo: window._customCatEsFijo ? window._customCatMonto : null
  });

  window._showCustomCatForm = false;
  if (window._renderStep3Body) window._renderStep3Body();
};

function nextStep3nuevo() {
  if (onboardingData.categorias.length < 3) {
    showSnackbar('Selecciona al menos 3 categorías de gasto', 'error');
    return;
  }
  renderStep(3);
}

// ---- INSTITUCIONES PARA BUSCADOR DE CUENTAS ----
const INSTITUCIONES = [
  { nombre: 'Efectivo',              tipo: 'efectivo', icono: 'banknote' },
  { nombre: 'BBVA',                  tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Banamex / Citibanamex', tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Santander',             tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Banorte',               tipo: 'debito',   icono: 'building-2' },
  { nombre: 'HSBC',                  tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Scotiabank',            tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Inbursa',               tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Afirme',                tipo: 'debito',   icono: 'building-2' },
  { nombre: 'BanBajío',              tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Nu',                    tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Mercado Pago',          tipo: 'negocio',  icono: 'store' },
  { nombre: 'Hey Banco',             tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Klar',                  tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Spin by OXXO',          tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Stori',                 tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Vexi',                  tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Bitso',                 tipo: 'otro',     icono: 'coins' },
  { nombre: 'Otro banco',            tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Otro digital',          tipo: 'otro',     icono: 'smartphone' },
];

// STEP 3 (ex-4): Cuentas
function renderStep4() {
  const primerNombre = (window._regNombre || '').split(' ')[0];
  const headerTitle = primerNombre ? `¿Dónde tienes tu dinero, ${primerNombre}?` : '¿Dónde tienes tu dinero?';
  setHeader(headerTitle, 'Registra tus cuentas activas — efectivo, débito, lo que uses.');
  renderStep4Body();
  setFooter(`
    <button class="btn btn-primary" onclick="nextStep4()">Continuar →</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(2)">← Atrás</button>
  `);
}

function renderStep4Body() {
  const TIPO_LABELS = { efectivo: 'Efectivo', debito: 'Débito / Banco', negocio: 'Negocio/Digital', otro: 'Otro' };

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list" id="cuentas-list">
      ${onboardingData.cuentas.map((c, i) => `
        <div class="item-row">
          <div class="item-row-emoji"><i data-lucide="${c.icono || 'credit-card'}" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${c.nombre}</div>
            <div class="item-row-detail">${TIPO_LABELS[c.tipo] || 'Cuenta'} · Saldo: ${formatMXN(c.saldo_inicial)}</div>
          </div>
          <button class="item-row-delete" onclick="removeCuenta(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
        </div>
      `).join('')}
    </div>

    <div style="position:relative;margin-bottom:8px">
      <i data-lucide="search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-muted);pointer-events:none;z-index:1"></i>
      <input class="form-input" id="banco-search" style="padding-left:36px" placeholder="Buscar banco..." onfocus="mostrarInstituciones()" oninput="filtrarBancos(this.value)" autocomplete="off" />
    </div>

    <div id="banco-resultados" class="banco-resultados-list" style="display:none"></div>

    <div id="form-cuenta-banco" style="display:none">
      <div class="mini-form">
        <input class="form-input" id="c-nombre" placeholder="Nombre de la cuenta" style="margin-bottom:8px" />
        <div class="input-money-wrap" style="margin-bottom:8px">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="c-saldo" type="number" placeholder="Saldo actual (0)" min="0" />
        </div>
        <button class="btn btn-secondary" onclick="addCuenta()">+ Agregar</button>
      </div>
    </div>
  `;

  renderLucideIcons();
}

window._bancosFiltered = [];

function ordenarInstitucionesConEfectivoPrimero(items) {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (a.nombre === 'Efectivo') return -1;
    if (b.nombre === 'Efectivo') return 1;
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
  return sorted;
}

window.mostrarInstituciones = function() {
  window.filtrarBancos(document.getElementById('banco-search')?.value || '');
};

window.filtrarBancos = function(q) {
  const resultadosDiv = document.getElementById('banco-resultados');
  const formDiv = document.getElementById('form-cuenta-banco');
  const qRaw = (q || '').trim();
  const qNorm = qRaw.toLowerCase();

  formDiv.style.display = 'none';
  document.getElementById('c-nombre') && (document.getElementById('c-nombre').value = '');

  const filtered = qNorm
    ? INSTITUCIONES.filter(inst => inst.nombre.toLowerCase().includes(qNorm))
    : INSTITUCIONES;

  const ordered = ordenarInstitucionesConEfectivoPrimero(filtered);
  window._bancosFiltered = ordered;

  resultadosDiv.style.display = 'block';
  const exactMatch = ordered.find(f => f.nombre.toLowerCase() === qNorm);

  let html = ordered.map((inst, idx) => `
    <div class="banco-result-item ${inst.nombre === 'Efectivo' ? 'featured' : ''}" onclick="seleccionarBancoIdx(${idx})">
      <i data-lucide="${inst.icono}" style="width:16px;height:16px;color:var(--text-secondary);pointer-events:none"></i>
      <span>${inst.nombre}</span>
      ${inst.nombre === 'Efectivo' ? '<span class="banco-pill">Recomendado</span>' : ''}
    </div>`).join('');

  if (ordered.length === 0 && qNorm) {
    html += `<div class="banco-result-item accent" onclick="seleccionarBancoCustom()">
      <i data-lucide="plus" style="width:16px;height:16px;pointer-events:none"></i>
      <span>Agregar "${qRaw}" como cuenta</span>
    </div>`;
  }

  resultadosDiv.innerHTML = html;
  lucide.createIcons();
};

window.seleccionarBancoIdx = function(idx) {
  const inst = window._bancosFiltered[idx];
  if (!inst) return;
  window._selectedBancoTipo = inst.tipo;
  window._selectedBancoIcono = inst.icono;
  document.getElementById('banco-resultados').style.display = 'none';
  document.getElementById('form-cuenta-banco').style.display = 'block';
  document.getElementById('c-nombre').value = inst.nombre;
  document.getElementById('c-nombre').focus();
};

window.seleccionarBancoCustom = function() {
  const q = document.getElementById('banco-search')?.value.trim() || '';
  window._selectedBancoTipo = 'otro';
  window._selectedBancoIcono = 'credit-card';
  document.getElementById('banco-resultados').style.display = 'none';
  document.getElementById('form-cuenta-banco').style.display = 'block';
  document.getElementById('c-nombre').value = q;
  document.getElementById('c-nombre').focus();
};

function addCuenta() {
  const nombre = document.getElementById('c-nombre')?.value.trim();
  const tipo = window._selectedBancoTipo || 'otro';
  const icono = window._selectedBancoIcono || 'credit-card';
  const saldo = parseFloat(document.getElementById('c-saldo')?.value) || 0;
  if (!nombre) { showSnackbar('Escribe el nombre de la cuenta', 'error'); return; }
  onboardingData.cuentas.push({ nombre, tipo, icono, saldo_inicial: saldo });
  window._selectedBancoTipo = null;
  window._selectedBancoIcono = null;
  renderStep4Body();
}

function removeCuenta(i) {
  onboardingData.cuentas.splice(i, 1);
  renderStep4Body();
}

function nextStep4() {
  if (onboardingData.cuentas.length === 0) {
    showSnackbar('Agrega al menos una cuenta', 'error');
    return;
  }
  renderStep(4);
}

// STEP 4 (ex-5): Deudas
function renderStep5() {
  setHeader('¿Qué debes actualmente?', 'Registra tus deudas para tener el panorama completo y hacer un plan de pago.');
  renderStep5Body();
  setFooter(`
    <button class="btn btn-primary" onclick="nextStep5()">Continuar →</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(3)">← Atrás</button>
  `);
}

function renderStep5Body(showForm = false) {
  const tipoDeuda = window._onboardingTipoDeuda || null;

  const selectorTipoHtml = `
    <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:16px">
      <button onclick="selectTipoDeudaOnboarding('simple')" style="background:var(--bg-elevated);border:2px solid ${tipoDeuda === 'simple' ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <div style="font-size:20px;margin-bottom:6px">💳</div>
        <div style="font-weight:600;font-size:14px">Simple</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Monto fijo, fecha fija</div>
      </button>
      <button onclick="selectTipoDeudaOnboarding('variable')" style="background:var(--bg-elevated);border:2px solid ${tipoDeuda === 'variable' ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <div style="font-size:20px;margin-bottom:6px">📊</div>
        <div style="font-weight:600;font-size:14px">Variable</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Monto cambia cada pago</div>
      </button>
      <button onclick="selectTipoDeudaOnboarding('tabla')" style="background:var(--bg-elevated);border:2px solid ${tipoDeuda === 'tabla' ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <div style="font-size:20px;margin-bottom:6px">📋</div>
        <div style="font-weight:600;font-size:14px">Con tabla</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Pagos programados</div>
      </button>
    </div>
  `;

  const formularioSimpleVariable = `
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label">¿A quién le debes?</label>
      <input class="form-input" id="d-acreedor" type="text" placeholder="Ej: Caja Popular, mamá, etc." />
    </div>
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label">Monto total</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="d-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="d-freq" onchange="renderCamposDeudaOnboarding()">
        <option value="unico">Pago único</option>
        <option value="semanal">Semanal</option>
        <option value="quincenal">Quincenal</option>
        <option value="mensual">Mensual</option>
        <option value="libre">Sin fecha fija</option>
      </select>
    </div>
    <div class="form-group" id="d-fecha-campos" style="margin-bottom:8px"></div>
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label">Pago por cuota (opcional)</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="d-cuota" type="number" placeholder="0.00" min="0" /></div>
    </div>
  `;

  const formularioTabla = `
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label">¿A quién le debes?</label>
      <input class="form-input" id="d-acreedor" type="text" placeholder="Ej: Caja Popular, mamá, etc." />
    </div>
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label">Monto total</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="d-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <p class="form-hint" style="margin-bottom:8px">Podrás agregar los pagos programados después</p>
  `;

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list" id="deudas-list">
      ${onboardingData.deudas.map((d, i) => `
        <div class="item-row">
          <div class="item-row-emoji"><i data-lucide="trending-down" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${d.acreedor}</div>
            <div class="item-row-detail">${d.tipo_deuda === 'tabla' ? 'con tabla' : (d.tipo_pago || 'sin fecha fija')}${d.monto_pago ? ` · ${formatMXN(d.monto_pago)}/pago` : ''}</div>
          </div>
          <div class="item-row-amount">${formatMXN(d.monto_actual)}</div>
          <button class="item-row-delete" onclick="removeDeuda(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form">
      ${selectorTipoHtml}
      ${tipoDeuda ? (tipoDeuda === 'tabla' ? formularioTabla : formularioSimpleVariable) : `<p class="form-hint" style="margin-bottom:8px">Selecciona el tipo de deuda para continuar</p>`}
      ${tipoDeuda ? `<button class="btn btn-secondary" onclick="addDeuda()">+ Agregar</button>` : ''}
    </div>
    ` : `
    <button class="btn-add-item" onclick="openDeudaOnboardingForm()">
      <span>+</span> Agregar deuda
    </button>
    `}
    <p class="form-hint mt-8" style="padding: 0 4px">Si no tienes deudas activas puedes continuar sin agregar ninguna.</p>
  `;

  if (showForm && (tipoDeuda === 'simple' || tipoDeuda === 'variable')) {
    renderCamposDeudaOnboarding();
  }

  renderLucideIcons();
}

window.openDeudaOnboardingForm = function() {
  window._onboardingTipoDeuda = null;
  renderStep5Body(true);
};

window.selectTipoDeudaOnboarding = function(tipo) {
  window._onboardingTipoDeuda = tipo;
  renderStep5Body(true);
};

window.renderCamposDeudaOnboarding = function() {
  const tipo = document.getElementById('d-freq')?.value;
  const campos = document.getElementById('d-fecha-campos');
  if (!campos) return;

  if (tipo === 'unico') {
    campos.innerHTML = `
      <label class="form-label">Fecha de pago</label>
      <input class="form-input" id="d-fecha-pago" type="date" />
    `;
    return;
  }
  if (tipo === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="d-dia-semana">
        <option value="0">Domingo</option><option value="1">Lunes</option>
        <option value="2">Martes</option><option value="3">Miércoles</option>
        <option value="4">Jueves</option><option value="5">Viernes</option>
        <option value="6">Sábado</option>
      </select>`;
    return;
  }
  if (tipo === 'quincenal') {
    campos.innerHTML = `
      <label class="form-label">Quincena de pago</label>
      <input class="form-input" id="d-quincena" type="number" min="1" max="2" placeholder="1 o 2" />
      <p class="form-hint" style="margin-top:6px">Los pagos quincenales son el día 15 y último día del mes. Ingresa en qué quincena: 1 = cobra el 15, 2 = cobra el último día</p>`;
    return;
  }
  if (tipo === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Día del mes</label>
      <input class="form-input" id="d-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />`;
    return;
  }
  campos.innerHTML = '';
};

function addDeuda() {
  const tipo_deuda = window._onboardingTipoDeuda || 'simple';
  if (!window._onboardingTipoDeuda) {
    showSnackbar('Selecciona un tipo de deuda', 'error');
    return;
  }
  const acreedor = document.getElementById('d-acreedor')?.value.trim();
  const monto = parseFloat(document.getElementById('d-monto')?.value);
  let tipo_pago = null;
  let monto_pago = null;
  if (!acreedor || !monto) { showSnackbar('Completa acreedor y monto', 'error'); return; }

  let dia_pago = null;
  let dia_semana = null;

  if (tipo_deuda === 'simple' || tipo_deuda === 'variable') {
    tipo_pago = document.getElementById('d-freq')?.value || 'libre';
    monto_pago = parseFloat(document.getElementById('d-cuota')?.value) || null;

    if (tipo_pago === 'unico') {
      const fechaStr = document.getElementById('d-fecha-pago')?.value;
      if (fechaStr) dia_pago = new Date(fechaStr + 'T00:00:00').getDate();
    } else if (tipo_pago === 'semanal') {
      dia_semana = parseInt(document.getElementById('d-dia-semana')?.value, 10);
      if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
        showSnackbar('Selecciona un día de la semana válido', 'error');
        return;
      }
    } else if (tipo_pago === 'mensual') {
      dia_pago = parseInt(document.getElementById('d-dia-pago')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
        showSnackbar('Ingresa un día del mes entre 1 y 31', 'error');
        return;
      }
    } else if (tipo_pago === 'quincenal') {
      dia_pago = parseInt(document.getElementById('d-quincena')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 2) {
        showSnackbar('Ingresa 1 o 2 para la quincena', 'error');
        return;
      }
    }
  }

  onboardingData.deudas.push({
    acreedor,
    monto_inicial: monto,
    monto_actual: monto,
    tipo_pago,
    monto_pago,
    dia_pago,
    dia_semana,
    tipo_deuda
  });

  window._onboardingTipoDeuda = null;
  renderStep5Body(false);
}

function removeDeuda(i) {
  onboardingData.deudas.splice(i, 1);
  renderStep5Body(false);
}

function nextStep5() {
  renderStep(5);
}


function renderStep6() {
  setHeader('¿Para qué quieres ahorrar?', 'Define tus metas. Las iremos completando juntos poco a poco.');
  renderStep6Body();
  setFooter(`
    <button class="btn btn-success" id="btn-finish" onclick="finishOnboarding()">¡Listo, empecemos!</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(4)">← Atrás</button>
  `);
}

function renderStep6Body(showForm = false, selectedIcono = 'target') {
  const cuentasOptions = onboardingData.cuentas.map(c =>
    `<option value="${c.nombre}">${c.nombre}</option>`
  ).join('');

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list">
      ${onboardingData.metas.map((m, i) => `
        <div class="item-row">
          <div class="item-row-emoji"><i data-lucide="${m.icono || 'target'}" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${m.nombre}</div>
            <div class="item-row-detail">Meta: ${formatMXN(m.monto_objetivo)}${m.cuenta_nombre ? ` · ${m.cuenta_nombre}` : ''}</div>
          </div>
          <button class="item-row-delete" onclick="removeMeta(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
        <div>
          <div class="icon-picker-grid" id="m-icon-picker" style="width:140px">
            ${ICONOS_PICKER.map(ic => `
              <div class="icon-picker-item${selectedIcono === ic ? ' selected' : ''}" onclick="selectIconoMeta('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
          <input type="hidden" id="m-icono" value="${selectedIcono}" />
        </div>
        <div style="flex:1;min-width:0">
          <input class="form-input" id="m-nombre" placeholder="Nombre de la meta" style="margin-bottom:8px" />
        </div>
      </div>
      <div class="input-money-wrap" style="margin-bottom:8px">
        <span class="currency-prefix">$</span>
        <input class="form-input" id="m-monto" type="number" placeholder="¿Cuánto necesitas?" min="0" />
      </div>
      ${onboardingData.cuentas.length > 0 ? `
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">¿En qué cuenta ahorrarás?</label>
        <select class="form-select" id="m-cuenta-nombre">
          <option value="">Sin cuenta vinculada</option>
          ${cuentasOptions}
        </select>
      </div>` : ''}
      <button class="btn btn-secondary" onclick="addMeta()">+ Agregar</button>
    </div>
    ` : `
    <button class="btn-add-item" onclick="renderStep6Body(true)">
      <span>+</span> Agregar meta
    </button>
    `}
    <p class="form-hint mt-8" style="padding: 0 4px">También puedes empezar sin metas y definirlas después.</p>
  `;

  renderLucideIcons();
}

window.selectIconoMeta = function(icono) {
  renderStep6Body(true, icono);
};

function addMeta() {
  const icono = document.getElementById('m-icono')?.value || 'target';
  const nombre = document.getElementById('m-nombre')?.value.trim();
  const monto_objetivo = parseFloat(document.getElementById('m-monto')?.value);
  const cuenta_nombre = document.getElementById('m-cuenta-nombre')?.value || null;
  if (!nombre || !monto_objetivo) { showSnackbar('Completa nombre y monto', 'error'); return; }
  onboardingData.metas.push({ icono, nombre, monto_objetivo, cuenta_nombre });
  renderStep6Body(false);
}

function removeMeta(i) {
  onboardingData.metas.splice(i, 1);
  renderStep6Body(false);
}

// ---- GUARDAR ONBOARDING EN SUPABASE ----
async function finishOnboarding() {
  const btn = document.getElementById('btn-finish');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    // 1. Crear usuario (usando auth user id)
    const { data: { user } } = await db.auth.getUser();
    const userId = user.id;
    const nombre = window._regNombre || (user.email ? user.email.split('@')[0] : 'Usuario');

    const { error: errUsuario } = await db.from('usuarios').insert({
      id: userId,
      nombre: nombre,
      onboarding_completo: true
    });

    if (errUsuario) throw errUsuario;

    // 2. Insertar tipos de ingreso como categorías
    if (onboardingData.tiposIngreso.length > 0) {
      const cats_ingreso = onboardingData.tiposIngreso.map(t => ({
        nombre: t.nombre,
        emoji: t.icono,
        tipo: 'ingreso',
        usuario_id: userId,
        es_default: false
      }));
      await db.from('categorias').insert(cats_ingreso);
    }

    // 3. Insertar categorías de gasto
    if (onboardingData.categorias.length > 0) {
      const cats_gasto = onboardingData.categorias.map(c => ({
        nombre: c.nombre,
        emoji: c.icono,
        tipo: 'gasto',
        usuario_id: userId,
        es_default: false
      }));
      await db.from('categorias').insert(cats_gasto);
    }

    // Insertar gastos fijos desde categorías con es_fijo=true
    const categoriasConFijo = onboardingData.categorias.filter(c => c.es_fijo === true);
    if (categoriasConFijo.length > 0) {
      const fijos = categoriasConFijo.map(c => ({
        descripcion: c.nombre,
        monto: c.monto_fijo || 0,
        frecuencia: c.frecuencia || 'mensual',
        dia_pago: c.dia_pago ?? null,
        dia_semana: c.dia_semana ?? null,
        usuario_id: userId,
        categoria_id: null
      }));
      await db.from('gastos_fijos').insert(fijos);
    }

    // 4. Cuentas — obtenemos IDs para vincular metas
    let cuentaNombreAId = {};
    if (onboardingData.cuentas.length > 0) {
      const cuentasPayload = onboardingData.cuentas.map(c => ({
        nombre: c.nombre,
        tipo: c.tipo,
        saldo_inicial: c.saldo_inicial,
        activa: true,
        usuario_id: userId
      }));
      const { data: insertedCuentas } = await db.from('cuentas').insert(cuentasPayload).select();
      (insertedCuentas || []).forEach(c => { cuentaNombreAId[c.nombre] = c.id; });
    }

    // 5. Deudas
    if (onboardingData.deudas.length > 0) {
      const deudas = onboardingData.deudas.map(d => ({
        acreedor: d.acreedor,
        monto_inicial: d.monto_inicial,
        monto_actual: d.monto_actual,
        tipo_pago: d.tipo_pago ?? null,
        monto_pago: d.monto_pago ?? null,
        dia_pago: d.dia_pago ?? null,
        dia_semana: d.dia_semana ?? null,
        tipo_deuda: d.tipo_deuda || 'simple',
        usuario_id: userId
      }));
      await db.from('deudas').insert(deudas);
    }

    // 6. Metas — vinculamos cuenta_id desde el nombre elegido
    if (onboardingData.metas.length > 0) {
      const metas = onboardingData.metas.map(m => ({
        nombre: m.nombre,
        emoji: m.icono || 'target',
        monto_objetivo: m.monto_objetivo,
        monto_actual: 0,
        activa: true,
        cuenta_id: m.cuenta_nombre ? (cuentaNombreAId[m.cuenta_nombre] || null) : null,
        usuario_id: userId
      }));
      await db.from('metas_ahorro').insert(metas);
    }

    showSnackbar('¡Todo listo! Bienvenido', 'success');
    setTimeout(() => renderApp(), 800);

  } catch (err) {
    console.error(err);
    showSnackbar('Error al guardar. Intenta de nuevo.', 'error');
    btn.textContent = '¡Listo, empecemos!';
    btn.disabled = false;
  }
}

// ---- DASHBOARD ----
async function loadDashboard() {
  ensurePagosProximosStyles();

  const uid = (await getUsuarioId());
  const [
    { data: usuario },
    { data: ingresos },
    { data: gastos },
    { data: deudas },
    { data: cuentas },
    { data: ingresosPorCuenta },
    { data: gastosPorCuenta },
    { data: pagosDeudaPorCuenta },
    { data: traspasosSalida },
    { data: traspasosEntrada }
  ] = await Promise.all([
    db.from('usuarios').select('nombre').eq('id', uid).single(),
    db.from('ingresos').select('monto').eq('usuario_id', uid),
    db.from('gastos').select('monto').eq('usuario_id', uid),
    db.from('deudas').select('monto_actual').eq('usuario_id', uid).eq('activa', true),
    db.from('cuentas').select('id, nombre, tipo, saldo_inicial').eq('usuario_id', uid).eq('activa', true),
    db.from('ingresos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('gastos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('pagos_deuda').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('transferencias').select('cuenta_origen_id, monto').eq('usuario_id', uid).not('cuenta_origen_id', 'is', null),
    db.from('transferencias').select('cuenta_destino_id, monto').eq('usuario_id', uid).not('cuenta_destino_id', 'is', null)
  ]);

  const pagosPendientes = await getPagosPendientes();
  const proximaFechaCobro = pagosPendientes.proxima_fecha_cobro;
  const totalPendientePeriodo = pagosPendientes.total_periodo || 0;

  const { totalGeneralCuentas } = calcularCuentasConSaldo(
    cuentas || [],
    ingresosPorCuenta || [],
    gastosPorCuenta || [],
    pagosDeudaPorCuenta || [],
    traspasosSalida || [],
    traspasosEntrada || []
  );

  const totalIngresos = (ingresos || []).reduce((s, i) => s + Number(i.monto), 0);
  const totalGastos = (gastos || []).reduce((s, g) => s + Number(g.monto), 0);
  const totalDeuda = (deudas || []).reduce((s, d) => s + Number(d.monto_actual), 0);
  const disponible = totalGeneralCuentas;

  const horaActual = new Date().getHours();
  const saludo = (horaActual >= 5 && horaActual < 12) ? 'Buenos días'
    : (horaActual >= 12 && horaActual < 19) ? 'Buenas tardes'
    : 'Buenas noches';

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header">
      <div>
        <p class="text-secondary" style="font-size:12px">${saludo}</p>
        <h1 class="page-title">${usuario?.nombre?.split(' ')[0] || 'JM Finance'}</h1>
      </div>
    </div>

    <div class="balance-hero">
      <div class="balance-label">Disponible ahora</div>
      <div class="balance-amount">
        <span class="currency">$</span>${Math.abs(disponible).toLocaleString('es-MX')}
        ${disponible < 0 ? '<span style="font-size:14px;color:var(--red);margin-left:8px"><i data-lucide="alert-triangle" style="width:18px;height:18px;stroke-width:1.75"></i> Negativo</span>' : ''}
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

    <div style="padding: 0 16px; margin-bottom: 8px">
      <p class="section-title">Pagos próximos</p>
      ${proximaFechaCobro ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Para tu cobro del ${proximaFechaCobro.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</div>` : ''}
      ${!pagosPendientes || pagosPendientes.length === 0 ? `
        <div class="card" style="margin-bottom:0;display:flex;align-items:flex-start;gap:10px">
          <i data-lucide="check-circle" style="width:18px;height:18px;stroke-width:1.75"></i>
          <div>
            <div class="item-row-name">Todo al día</div>
            <div class="item-row-detail">Sin pagos pendientes hasta tu próximo cobro</div>
          </div>
        </div>
      ` : pagosPendientes.map(p => {
        const expanded = dashboardExpandedPagoId === p.item_id;
        const fechaTxt = p.fecha_esperada.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
        return `
          <div class="pago-pendiente-card ${expanded ? 'expanded' : ''}" onclick="togglePagoPendienteExpand('${p.item_id}')">
            <div class="pago-pendiente-main">
              <div class="pago-pendiente-left">
                ${p.tipo === 'fijo'
                  ? '<i data-lucide="pin" style="width:18px;height:18px;stroke-width:1.75"></i>'
                  : '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>'
                }
                <div>
                  <div class="item-row-name">${p.nombre}</div>
                  <div class="item-row-detail">${fechaTxt}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <div class="item-row-amount">${formatMXN(p.monto)}</div>
                <span class="pago-pendiente-chevron"><i data-lucide="chevron-down" style="width:18px;height:18px;stroke-width:1.75"></i></span>
              </div>
            </div>
            <div class="pago-pendiente-extra" onclick="event.stopPropagation()">
              ${p.tipo === 'deuda'
                ? `<button class="btn btn-primary" onclick="abrirPagoPendienteDeuda('${p.deuda_id}')">Registrar pago</button>`
                : `<button class="btn btn-primary" onclick="openMarcarPagoFijo('${p.gasto_fijo_id}')">Marcar como pagado</button>`
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>

  `;

  renderLucideIcons();
  if (window.lucide) lucide.createIcons();
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
  if (!currentFabItems || currentFabItems.length < 2) return;

  const app = document.getElementById('app');
  if (!app) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'fab-menu-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:39;background:transparent;';
  backdrop.onclick = closeFabMenu;

  const menu = document.createElement('div');
  menu.id = 'fab-menu';
  menu.style.cssText = 'position:fixed;bottom:145px;right:calc(50% - 215px + 16px);z-index:40;display:flex;flex-direction:column;gap:10px;align-items:flex-end;opacity:0;transform:translateY(10px);transition:opacity 180ms ease,transform 180ms ease;';
  menu.innerHTML = currentFabItems.map(item => `
    <button onclick="closeFabMenu(); ${item.action}" style="display:flex;align-items:center;gap:10px;width:180px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;color:var(--text-primary);font-size:14px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,0.12);cursor:pointer;font-family:var(--font-body)">
      <span style="font-size:20px;line-height:1"><i data-lucide="${item.icon}" style="width:18px;height:18px;stroke-width:1.75;pointer-events:none"></i></span>
      <span>${item.label}</span>
    </button>
  `).join('');

  app.appendChild(backdrop);
  app.appendChild(menu);

  requestAnimationFrame(() => {
    menu.style.opacity = '1';
    menu.style.transform = 'translateY(0)';
    renderLucideIcons();
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
  const uid = (await getUsuarioId());
  const [
    { data: cuentas },
    { data: ingresosPorCuenta },
    { data: gastosPorCuenta },
    { data: pagosDeudaPorCuenta },
    { data: traspasosSalida },
    { data: traspasosEntrada }
  ] = await Promise.all([
    db.from('cuentas').select('id, nombre, tipo, saldo_inicial').eq('usuario_id', uid).eq('activa', true),
    db.from('ingresos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('gastos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('pagos_deuda').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('transferencias').select('cuenta_origen_id, monto').eq('usuario_id', uid).not('cuenta_origen_id', 'is', null),
    db.from('transferencias').select('cuenta_destino_id, monto').eq('usuario_id', uid).not('cuenta_destino_id', 'is', null)
  ]);

  const { cuentasConSaldo, totalGeneralCuentas } = calcularCuentasConSaldo(
    cuentas || [],
    ingresosPorCuenta || [],
    gastosPorCuenta || [],
    pagosDeudaPorCuenta || [],
    traspasosSalida || [],
    traspasosEntrada || []
  );

  document.getElementById('page-cuentas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Cuentas</h1>
    </div>
    <div class="page-body" style="padding-top:0">
      ${!cuentasConSaldo.length ? `
        <div class="empty-state" style="margin-top:0">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No tienes cuentas activas.</p>
        </div>
      ` : `
        ${cuentasConSaldo.map(cuenta => `
          <div class="item-row" style="margin-bottom:8px">
            <div class="item-row-emoji">${cuenta.emoji}</div>
            <div class="item-row-info">
              <div class="item-row-name">${cuenta.nombre}</div>
              <div class="item-row-detail">${cuenta.tipoLabel}</div>
            </div>
            <div class="item-row-amount">${formatMXN(cuenta.saldoCalculado)}</div>
            <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuCuenta('${cuenta.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
          </div>
        `).join('')}
        <div class="card" style="margin-top:8px;background:var(--bg-elevated)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:var(--text-secondary)">Total general</span>
            <span style="font-size:15px;font-weight:700;font-family:var(--font-display)">${formatMXN(totalGeneralCuentas)}</span>
          </div>
        </div>
      `}
    </div>
  `;

  renderLucideIcons();
}

function getCuentaTipos() {
  return [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'debito', label: 'Debito / Banco' },
    { value: 'negocio', label: 'Mercado Pago' },
    { value: 'otro', label: 'Otro' }
  ];
}

function openCuentaActions(cuentaId) {
  openActionSheet('Opciones de cuenta', [
    { label: 'Editar', onClick: `openEditarCuenta('${cuentaId}')` },
    { label: 'Eliminar', onClick: `eliminarCuenta('${cuentaId}')`, danger: true }
  ]);
}

function openMenuCuenta(cuentaId) {
  openCuentaActions(cuentaId);
}

async function openEditarCuenta(cuentaId) {
  const { data: cuenta, error } = await db
    .from('cuentas')
    .select('id, nombre, tipo, saldo_inicial')
    .eq('id', cuentaId)
    .eq('usuario_id', (await getUsuarioId()))
    .maybeSingle();

  if (error || !cuenta) {
    showSnackbar('No se pudo cargar la cuenta', 'error');
    return;
  }

  const opciones = getCuentaTipos();

  openModal('Editar cuenta', `
    <div class="form-group">
      <label class="form-label">Nombre</label>
      <input class="form-input" id="ec-nombre" type="text" value="${cuenta.nombre || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select class="form-select" id="ec-tipo">
        ${opciones.map(op => `<option value="${op.value}" ${op.value === cuenta.tipo ? 'selected' : ''}>${op.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Saldo inicial</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ec-saldo" type="number" min="0" value="${Number(cuenta.saldo_inicial || 0)}" /></div>
    </div>
    <button class="btn btn-primary" onclick="guardarEdicionCuenta('${cuenta.id}')">Guardar cambios</button>
  `);
}

async function guardarEdicionCuenta(cuentaId) {
  const nombre = document.getElementById('ec-nombre')?.value.trim();
  const tipo = document.getElementById('ec-tipo')?.value;
  const saldo_inicial = parseFloat(document.getElementById('ec-saldo')?.value);

  if (!nombre || !tipo || Number.isNaN(saldo_inicial) || saldo_inicial < 0) {
    showSnackbar('Completa los campos correctamente', 'error');
    return;
  }

  const { error } = await db
    .from('cuentas')
    .update({ nombre, tipo, saldo_inicial })
    .eq('id', cuentaId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo actualizar la cuenta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Cuenta actualizada ✓', 'success');
  await loadCuentas();
  await loadDashboard();
}

async function eliminarCuenta(cuentaId) {
  if (!window.confirm('¿Eliminar esta cuenta?\n\nLos movimientos de esta cuenta se conservan en el historial.')) return;

  const { error } = await db
    .from('cuentas')
    .update({ activa: false })
    .eq('id', cuentaId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar la cuenta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Cuenta eliminada', 'success');
  await loadCuentas();
  await loadDashboard();
}

// ---- DEUDAS ----
async function loadDeudas() {
  const uid = (await getUsuarioId());
  const { data: deudas } = await db.from('deudas').select('*').eq('usuario_id', uid).eq('activa', true).order('created_at');

  const getBadgeDeuda = (tipo) => {
    const badges = {
      simple: '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>',
      variable: '<i data-lucide="chart-line" style="width:18px;height:18px;stroke-width:1.75"></i>',
      tabla: '<i data-lucide="table" style="width:18px;height:18px;stroke-width:1.75"></i>'
    };
    return badges[tipo] || '<i data-lucide="trending-down" style="width:18px;height:18px;stroke-width:1.75"></i>';
  };

  let deudaCardsHTML = '';
  if (!deudas || deudas.length === 0) {
    deudaCardsHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
        <p>¡Sin deudas registradas!</p>
      </div>
    `;
  } else {
    for (const d of deudas) {
      const pct = Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100);
      const badgeEmoji = getBadgeDeuda(d.tipo_deuda);

      let botonPagoHTML = '';
      if (d.tipo_deuda === 'tabla') {
        const { data: proximoPago } = await db.from('pagos_programados')
          .select('numero_pago, fecha_vencimiento, monto_esperado')
          .eq('deuda_id', d.id)
          .eq('pagado', false)
          .order('fecha_vencimiento')
          .limit(1)
          .maybeSingle();

        if (proximoPago) {
          botonPagoHTML = `
            <div style="margin-top:12px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm)">
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Próximo pago</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-weight:600">Cuota #${proximoPago.numero_pago}</span>
                <span style="font-weight:700;color:var(--accent)">${formatMXN(proximoPago.monto_esperado)}</span>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Vence: ${new Date(proximoPago.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX')}</div>
              <button onclick="openPagarDeuda('${d.id}', '${d.acreedor}', ${d.monto_actual}, '${d.tipo_deuda}', ${d.monto_ultimo_pago || null})" style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body);width:100%">
                Registrar pago
              </button>
            </div>
          `;
        }
      } else {
        botonPagoHTML = `
          <button onclick="openPagarDeuda('${d.id}', '${d.acreedor}', ${d.monto_actual}, '${d.tipo_deuda}', ${d.monto_ultimo_pago || null})" style="margin-top:12px;background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body);width:100%">
            Registrar pago
          </button>
        `;
      }

      deudaCardsHTML += `
        <div class="deuda-card">
          <div class="deuda-header">
            <span class="deuda-acreedor">${badgeEmoji} ${d.acreedor}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="deuda-badge ${d.tipo_pago}">${d.tipo_pago || d.tipo_deuda}</span>
              <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuDeuda('${d.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
            </div>
          </div>
          <div class="deuda-progress">
            <div class="deuda-progress-fill" style="width:${Math.max(pct, 2)}%"></div>
          </div>
          <div class="deuda-amounts">
            <span>Pagado ${pct}%</span>
            <span>Deuda: ${formatMXN(d.monto_actual)}</span>
          </div>
          ${d.monto_pago ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Pago ${d.tipo_pago}: ${formatMXN(d.monto_pago)}</div>` : ''}
          ${botonPagoHTML}
        </div>
      `;
    }
  }

  document.getElementById('page-deudas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Mis deudas</h1>
    </div>
    <div class="page-body">
      ${deudaCardsHTML}
    </div>
  `;

  renderLucideIcons();
}

function openDeudaActions(deudaId) {
  openActionSheet('Opciones de deuda', [
    { label: 'Editar', onClick: `openEditarDeuda('${deudaId}')` },
    { label: 'Eliminar', onClick: `eliminarDeuda('${deudaId}')`, danger: true }
  ]);
}

function openMenuDeuda(deudaId) {
  openDeudaActions(deudaId);
}

function renderCamposFechaEditarDeuda() {
  const frecuencia = document.getElementById('ed-freq')?.value;
  const campos = document.getElementById('ed-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Dia del mes que pagas</label>
      <input class="form-input" id="ed-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la semana</label>
      <select class="form-select" id="ed-dia-semana">
        <option value="0">Domingo</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miercoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sabado</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la quincena</label>
      <input class="form-input" id="ed-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

async function openEditarDeuda(deudaId) {
  const { data: deuda, error } = await db
    .from('deudas')
    .select('id, acreedor, monto_actual, tipo_pago, dia_pago, dia_semana, monto_pago')
    .eq('id', deudaId)
    .eq('usuario_id', (await getUsuarioId()))
    .maybeSingle();

  if (error || !deuda) {
    showSnackbar('No se pudo cargar la deuda', 'error');
    return;
  }

  const frecuenciaInicial = deuda.tipo_pago || 'libre';

  openModal('Editar deuda', `
    <div class="form-group">
      <label class="form-label">Acreedor</label>
      <input class="form-input" id="ed-acreedor" type="text" value="${deuda.acreedor || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto actual</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ed-monto" type="number" min="0" value="${Number(deuda.monto_actual || 0)}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="ed-freq" onchange="renderCamposFechaEditarDeuda()">
        <option value="semanal" ${frecuenciaInicial === 'semanal' ? 'selected' : ''}>Semanal</option>
        <option value="quincenal" ${frecuenciaInicial === 'quincenal' ? 'selected' : ''}>Quincenal</option>
        <option value="mensual" ${frecuenciaInicial === 'mensual' ? 'selected' : ''}>Mensual</option>
        <option value="libre" ${frecuenciaInicial === 'libre' ? 'selected' : ''}>Sin fecha fija</option>
      </select>
    </div>
    <div class="form-group" id="ed-fecha-campos"></div>
    <div class="form-group">
      <label class="form-label">Monto por pago</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ed-monto-pago" type="number" min="0" value="${deuda.monto_pago ? Number(deuda.monto_pago) : ''}" placeholder="0.00" /></div>
    </div>
    <button class="btn btn-primary" onclick="guardarEdicionDeuda('${deuda.id}')">Guardar cambios</button>
  `);

  renderCamposFechaEditarDeuda();

  if (frecuenciaInicial === 'semanal') {
    const inputSemana = document.getElementById('ed-dia-semana');
    if (inputSemana && deuda.dia_semana !== null && deuda.dia_semana !== undefined) {
      inputSemana.value = String(deuda.dia_semana);
    }
  } else if (frecuenciaInicial === 'mensual' || frecuenciaInicial === 'quincenal') {
    const inputDia = document.getElementById('ed-dia-pago');
    if (inputDia && deuda.dia_pago) {
      inputDia.value = String(deuda.dia_pago);
    }
  }

  renderLucideIcons();
}

async function guardarEdicionDeuda(deudaId) {
  const acreedor = document.getElementById('ed-acreedor')?.value.trim();
  const monto_actual = parseFloat(document.getElementById('ed-monto')?.value);
  const tipo_pago = document.getElementById('ed-freq')?.value || 'libre';
  const monto_pagoValor = document.getElementById('ed-monto-pago')?.value;
  const monto_pago = monto_pagoValor ? parseFloat(monto_pagoValor) : null;

  let dia_pago = null;
  let dia_semana = null;

  if (!acreedor || Number.isNaN(monto_actual) || monto_actual < 0) {
    showSnackbar('Completa los campos requeridos', 'error');
    return;
  }

  if (tipo_pago === 'semanal') {
    dia_semana = parseInt(document.getElementById('ed-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un dia de la semana valido', 'error');
      return;
    }
  } else if (tipo_pago === 'mensual') {
    dia_pago = parseInt(document.getElementById('ed-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un dia del mes entre 1 y 31', 'error');
      return;
    }
  } else if (tipo_pago === 'quincenal') {
    dia_pago = parseInt(document.getElementById('ed-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un dia de la quincena entre 1 y 15', 'error');
      return;
    }
  }

  if (monto_pago !== null && (Number.isNaN(monto_pago) || monto_pago < 0)) {
    showSnackbar('Monto por pago invalido', 'error');
    return;
  }

  const { error } = await db
    .from('deudas')
    .update({ acreedor, monto_actual, tipo_pago, dia_pago, dia_semana, monto_pago, activa: monto_actual > 0 })
    .eq('id', deudaId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo actualizar la deuda', 'error');
    return;
  }

  closeModal();
  showSnackbar('Deuda actualizada ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

async function eliminarDeuda(deudaId) {
  if (!window.confirm('¿Eliminar esta deuda?')) return;

  const { error } = await db
    .from('deudas')
    .update({ activa: false })
    .eq('id', deudaId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar la deuda', 'error');
    return;
  }

  closeModal();
  showSnackbar('Deuda eliminada', 'success');
  await loadDeudas();
  await loadDashboard();
}

// ---- METAS ----
async function loadMetas() {
  const uid = (await getUsuarioId());
  const [
    { data: metas },
    { data: cuentas }
  ] = await Promise.all([
    db.from('metas_ahorro').select('*').eq('usuario_id', uid).eq('activa', true),
    db.from('cuentas').select('id, nombre').eq('usuario_id', uid).eq('activa', true)
  ]);

  const cuentasPorId = Object.fromEntries((cuentas || []).map(cuenta => [cuenta.id, cuenta.nombre]));

  document.getElementById('page-metas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Metas de ahorro</h1>
    </div>
    <div class="page-body">
      ${!metas || metas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>Aún no tienes metas de ahorro.<br>¡Crea una para empezar!</p>
        </div>
      ` : metas.map(m => {
        const pct = Math.min(Math.round((m.monto_actual / m.monto_objetivo) * 100), 100);
        return `
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:12px">
                <span style="font-size:28px">${m.emoji || '<i data-lucide="target" style="width:18px;height:18px;stroke-width:1.75"></i>'}</span>
                <div>
                  <div style="font-weight:600;font-size:14px">${m.nombre}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${m.cuenta_id ? (cuentasPorId[m.cuenta_id] || 'Cuenta eliminada') : 'Sin cuenta vinculada'}</div>
                  <div style="font-size:12px;color:var(--text-secondary)">Meta: ${formatMXN(m.monto_objetivo)}</div>
                </div>
              </div>
              <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuMeta('${m.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
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

  renderLucideIcons();
}

function openMetaActions(metaId) {
  openActionSheet('Opciones de meta', [
    { label: 'Editar', icon: 'pencil', fullWidth: true, onClick: `openEditarMeta('${metaId}')` },
    { label: 'Eliminar', icon: 'trash-2', onClick: `eliminarMeta('${metaId}')`, danger: true }
  ]);
}

function openMenuMeta(metaId) {
  openMetaActions(metaId);
}

async function openAbonarMeta(metaId = null) {
  const { data: metas, error } = await db
    .from('metas_ahorro')
    .select('id, nombre, cuenta_id')
    .eq('usuario_id', (await getUsuarioId()))
    .eq('activa', true)
    .order('nombre', { ascending: true });

  if (error || !metas || metas.length === 0) {
    showSnackbar('No se pudieron cargar las metas', 'error');
    return;
  }

  openModal('Abonar a meta', `
    <div class="form-group">
      <label class="form-label">Meta</label>
      <select class="form-select" id="ma-meta-id" onchange="renderMetaAbonoHint()">
        ${metas.map(meta => `<option value="${meta.id}" ${metaId && meta.id === metaId ? 'selected' : ''}>${meta.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" id="ma-meta-hint" style="font-size:12px;color:var(--text-muted)"></div>
    <div class="form-group">
      <label class="form-label">Monto del abono</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ma-abono" type="number" min="0" placeholder="0.00" /></div>
    </div>
    <button class="btn btn-primary" onclick="guardarAbonoMeta(document.getElementById('ma-meta-id').value)">Guardar abono</button>
  `);

  window.__metasAbonoCache = metas;
  renderMetaAbonoHint();
}

function renderMetaAbonoHint() {
  const select = document.getElementById('ma-meta-id');
  const hint = document.getElementById('ma-meta-hint');
  if (!select || !hint) return;

  const meta = (window.__metasAbonoCache || []).find(item => item.id === select.value);
  hint.textContent = meta?.cuenta_id ? 'Se abonará usando la cuenta vinculada a esta meta.' : 'Configura una cuenta para esta meta primero';
}

async function guardarAbonoMeta(metaId) {
  const abono = parseFloat(document.getElementById('ma-abono')?.value);

  if (!abono || abono <= 0) {
    showSnackbar('Ingresa un monto valido', 'error');
    return;
  }

  const usuarioId = (await getUsuarioId());
  const { data: meta, error: errorMeta } = await db
    .from('metas_ahorro')
    .select('monto_actual, nombre, cuenta_id')
    .eq('id', metaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (errorMeta || !meta) {
    showSnackbar('No se pudo actualizar la meta', 'error');
    return;
  }

  if (!meta.cuenta_id) {
    showSnackbar('Configura una cuenta para esta meta primero', 'error');
    return;
  }

  const { error: errorSaldo, saldoDisponible } = await getSaldoCuentaEspecifica(usuarioId, meta.cuenta_id);

  if (errorSaldo) {
    showSnackbar('No se pudo validar el saldo disponible de la cuenta', 'error');
    return;
  }

  if (abono > saldoDisponible) {
    showSnackbar('Saldo insuficiente — disponible: ' + formatMXN(saldoDisponible), 'error');
    return;
  }

  const nuevoMonto = Number(meta.monto_actual || 0) + abono;
  const { error } = await db
    .from('metas_ahorro')
    .update({ monto_actual: nuevoMonto })
    .eq('id', metaId)
    .eq('usuario_id', usuarioId);

  if (error) {
    showSnackbar('No se pudo guardar el abono', 'error');
    return;
  }

  const { error: errorGasto } = await db.from('gastos').insert({
    descripcion: 'Abono a meta: ' + meta.nombre,
    monto: abono,
    usuario_id: usuarioId,
    fecha: new Date().toISOString().split('T')[0],
    cuenta_id: meta.cuenta_id
  });

  if (errorGasto) {
    showSnackbar('El abono se guardó, pero no se pudo registrar el gasto asociado', 'error');
    await loadMetas();
    await loadDashboard();
    closeModal();
    return;
  }

  closeModal();
  showSnackbar('Abono registrado ✓', 'success');
  await loadMetas();
  await loadDashboard();
  await loadCuentas();
}

async function openEditarMeta(metaId) {
  const [
    { data: meta, error },
    { data: cuentas }
  ] = await Promise.all([
    db
      .from('metas_ahorro')
      .select('id, nombre, emoji, monto_objetivo, cuenta_id')
      .eq('id', metaId)
      .eq('usuario_id', (await getUsuarioId()))
      .maybeSingle(),
    db.from('cuentas').select('id, nombre').eq('usuario_id', (await getUsuarioId())).eq('activa', true)
  ]);

  if (error || !meta) {
    showSnackbar('No se pudo cargar la meta', 'error');
    return;
  }

  const cuentasOptions = (cuentas || []).map(cuenta => `<option value="${cuenta.id}" ${cuenta.id === meta.cuenta_id ? 'selected' : ''}>${cuenta.nombre}</option>`).join('');

  openModal('Editar meta', `
    <div class="form-group">
      <label class="form-label">Emoji</label>
      <input class="form-input" id="em-emoji" type="text" value="${meta.emoji || ''}" style="max-width:80px" />
    </div>
    <div class="form-group">
      <label class="form-label">Nombre</label>
      <input class="form-input" id="em-nombre" type="text" value="${meta.nombre || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto objetivo</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="em-monto" type="number" min="0" value="${Number(meta.monto_objetivo || 0)}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">¿En qué cuenta ahorrarás?</label>
      <select class="form-select" id="meta-cuenta-id">
        ${cuentasOptions}
      </select>
    </div>
    <button class="btn btn-primary" onclick="guardarEdicionMeta('${meta.id}')">Guardar cambios</button>
  `);
}

async function guardarEdicionMeta(metaId) {
  const emoji = document.getElementById('em-emoji')?.value.trim() || '🎯';
  const nombre = document.getElementById('em-nombre')?.value.trim();
  const monto_objetivo = parseFloat(document.getElementById('em-monto')?.value);
  const cuenta_id = document.getElementById('meta-cuenta-id')?.value || null;

  if (!nombre || Number.isNaN(monto_objetivo) || monto_objetivo <= 0) {
    showSnackbar('Completa nombre y monto objetivo', 'error');
    return;
  }

  const { error } = await db
    .from('metas_ahorro')
    .update({ emoji, nombre, monto_objetivo, cuenta_id })
    .eq('id', metaId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo actualizar la meta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Meta actualizada ✓', 'success');
  await loadMetas();
}

async function eliminarMeta(metaId) {
  if (!window.confirm('¿Eliminar esta meta?')) return;

  const { error } = await db
    .from('metas_ahorro')
    .update({ activa: false })
    .eq('id', metaId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar la meta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Meta eliminada', 'success');
  await loadMetas();
}

// ---- GASTOS FIJOS ----
function formatearFrecuenciaGastoFijo(frecuencia, diaPago, diaSemana) {
  const diasSemana = ['domingos', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabados'];

  if (frecuencia === 'mensual') {
    return `Mensual${diaPago ? ` · dia ${diaPago}` : ''}`;
  }

  if (frecuencia === 'quincenal') {
    return `Quincenal${diaPago ? ` · dia ${diaPago}` : ''}`;
  }

  if (frecuencia === 'semanal') {
    const dia = Number.isInteger(diaSemana) && diaSemana >= 0 && diaSemana <= 6 ? diasSemana[diaSemana] : null;
    return `Semanal${dia ? ` · ${dia}` : ''}`;
  }

  return frecuencia || 'Sin frecuencia';
}

async function loadFijos() {
  const uid = (await getUsuarioId());
  const { data: fijos, error } = await db
    .from('gastos_fijos')
    .select('*')
    .eq('usuario_id', uid)
    .eq('activo', true)
    .order('descripcion', { ascending: true });

  if (error) {
    document.getElementById('page-fijos').innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Gastos fijos</h1>
      </div>
      <div class="page-body">
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No se pudieron cargar los gastos fijos.</p>
        </div>
      </div>
    `;
    renderLucideIcons();
    return;
  }

  document.getElementById('page-fijos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Gastos fijos</h1>
    </div>
    <div class="page-body">
      ${!fijos || fijos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No tienes gastos fijos registrados.<br>Agrega uno para empezar.</p>
        </div>
      ` : fijos.map(g => `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji"><i data-lucide="pin" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${g.descripcion}</div>
            <div class="item-row-detail">${formatearFrecuenciaGastoFijo(g.frecuencia, g.dia_pago, g.dia_semana)}</div>
          </div>
          <div class="item-row-amount" style="color:var(--red)">${formatMXN(g.monto)}</div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuGastoFijo('${g.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
        </div>
      `).join('')}
    </div>
  `;

  renderLucideIcons();
}

function openGastoFijoActions(gastoFijoId) {
  openActionSheet('Opciones de gasto fijo', [
    { label: 'Editar', onClick: `openEditarGastoFijo('${gastoFijoId}')` },
    { label: 'Eliminar', onClick: `eliminarGastoFijo('${gastoFijoId}')`, danger: true }
  ]);
}

function openMenuGastoFijo(gastoFijoId) {
  openGastoFijoActions(gastoFijoId);
}

function renderCamposFechaEditarGastoFijo() {
  const frecuencia = document.getElementById('egf-freq')?.value;
  const campos = document.getElementById('egf-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Dia del mes que pagas</label>
      <input class="form-input" id="egf-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la semana</label>
      <select class="form-select" id="egf-dia-semana">
        <option value="0">Domingo</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miercoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sabado</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la quincena</label>
      <input class="form-input" id="egf-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

async function openEditarGastoFijo(gastoFijoId) {
  const { data: gasto, error } = await db
    .from('gastos_fijos')
    .select('id, descripcion, monto, frecuencia, dia_pago, dia_semana')
    .eq('id', gastoFijoId)
    .eq('usuario_id', (await getUsuarioId()))
    .maybeSingle();

  if (error || !gasto) {
    showSnackbar('No se pudo cargar el gasto fijo', 'error');
    return;
  }

  openModal('Editar gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripcion</label>
      <input class="form-input" id="egf-desc" type="text" value="${gasto.descripcion || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="egf-monto" type="number" min="0" value="${Number(gasto.monto || 0)}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia</label>
      <select class="form-select" id="egf-freq" onchange="renderCamposFechaEditarGastoFijo()">
        <option value="semanal" ${gasto.frecuencia === 'semanal' ? 'selected' : ''}>Semanal</option>
        <option value="quincenal" ${gasto.frecuencia === 'quincenal' ? 'selected' : ''}>Quincenal</option>
        <option value="mensual" ${gasto.frecuencia === 'mensual' ? 'selected' : ''}>Mensual</option>
      </select>
    </div>
    <div class="form-group" id="egf-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarEdicionGastoFijo('${gasto.id}')">Guardar cambios</button>
  `);

  renderCamposFechaEditarGastoFijo();

  if (gasto.frecuencia === 'semanal') {
    const inputSemana = document.getElementById('egf-dia-semana');
    if (inputSemana && gasto.dia_semana !== null && gasto.dia_semana !== undefined) {
      inputSemana.value = String(gasto.dia_semana);
    }
  } else {
    const inputDia = document.getElementById('egf-dia-pago');
    if (inputDia && gasto.dia_pago) {
      inputDia.value = String(gasto.dia_pago);
    }
  }

  renderLucideIcons();
}

async function guardarEdicionGastoFijo(gastoFijoId) {
  const descripcion = document.getElementById('egf-desc')?.value.trim();
  const monto = parseFloat(document.getElementById('egf-monto')?.value);
  const frecuencia = document.getElementById('egf-freq')?.value;

  let dia_pago = null;
  let dia_semana = null;

  if (!descripcion || Number.isNaN(monto) || monto <= 0) {
    showSnackbar('Completa descripcion y monto', 'error');
    return;
  }

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('egf-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un dia de la semana valido', 'error');
      return;
    }
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById('egf-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un dia del mes entre 1 y 31', 'error');
      return;
    }
  } else if (frecuencia === 'quincenal') {
    dia_pago = parseInt(document.getElementById('egf-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un dia de la quincena entre 1 y 15', 'error');
      return;
    }
  }

  const { error } = await db
    .from('gastos_fijos')
    .update({ descripcion, monto, frecuencia, dia_pago, dia_semana })
    .eq('id', gastoFijoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo actualizar el gasto fijo', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto fijo actualizado ✓', 'success');
  await loadFijos();
  await loadDashboard();
}

function openAgregarGastoFijo() {
  openModal('Nuevo gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripcion</label>
      <input class="form-input" id="fgf-desc" type="text" placeholder="Ej: Internet, renta, gimnasio" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="fgf-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia</label>
      <select class="form-select" id="fgf-freq" onchange="renderCamposFechaGastoFijoModal()">
        <option value="semanal">Semanal</option>
        <option value="quincenal">Quincenal</option>
        <option value="mensual">Mensual</option>
      </select>
    </div>
    <div class="form-group" id="fgf-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarNuevoGastoFijo()">Guardar</button>
  `);

  renderCamposFechaGastoFijoModal();
}

function renderCamposFechaGastoFijoModal() {
  const frecuencia = document.getElementById('fgf-freq')?.value;
  const campos = document.getElementById('fgf-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Dia del mes que pagas</label>
      <input class="form-input" id="fgf-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la semana</label>
      <select class="form-select" id="fgf-dia-semana">
        <option value="0">Domingo</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miercoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sabado</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la quincena</label>
      <input class="form-input" id="fgf-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

async function guardarNuevoGastoFijo() {
  const descripcion = document.getElementById('fgf-desc')?.value.trim();
  const monto = parseFloat(document.getElementById('fgf-monto')?.value);
  const frecuencia = document.getElementById('fgf-freq')?.value;
  let dia_pago = null;
  let dia_semana = null;

  if (!descripcion || !monto) {
    showSnackbar('Completa descripcion y monto', 'error');
    return;
  }

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('fgf-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un dia de la semana valido', 'error');
      return;
    }
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById('fgf-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un dia del mes entre 1 y 31', 'error');
      return;
    }
  } else if (frecuencia === 'quincenal') {
    dia_pago = parseInt(document.getElementById('fgf-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un dia de la quincena entre 1 y 15', 'error');
      return;
    }
  }

  const { error } = await db.from('gastos_fijos').insert({
    usuario_id: (await getUsuarioId()),
    descripcion,
    monto,
    frecuencia,
    dia_pago,
    dia_semana,
    activo: true
  });

  if (error) {
    showSnackbar('No se pudo guardar el gasto fijo', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto fijo guardado ✓', 'success');
  await loadFijos();
}

async function eliminarGastoFijo(gastoFijoId) {
  if (!window.confirm('¿Eliminar este gasto fijo?')) return;

  const { error } = await db.from('gastos_fijos').update({ activo: false }).eq('id', gastoFijoId);

  if (error) {
    showSnackbar('No se pudo eliminar el gasto fijo', 'error');
    return;
  }

  showSnackbar('Gasto fijo eliminado', 'success');
  await loadFijos();
}

// ---- GASTOS (historial) ----
async function loadGastos() {
  const uid = (await getUsuarioId());
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
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No hay gastos registrados todavía.<br>Usa el botón + para agregar uno.</p>
        </div>
      ` : gastos.map(g => `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji">${getCategoriaGastoIcon(g.categorias?.nombre)}</div>
          <div class="item-row-info">
            <div class="item-row-name">${g.descripcion}</div>
            <div class="item-row-detail">${g.categorias?.nombre || 'Sin categoría'} · ${g.fecha}</div>
          </div>
          <div class="item-row-amount">${formatMXN(g.monto)}</div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuGasto('${g.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
        </div>
      `).join('')}
    </div>
  `;

  renderLucideIcons();
}

function openMenuGasto(gastoId) {
  openActionSheet('Opciones de gasto', [
    { label: 'Eliminar', onClick: `eliminarGasto('${gastoId}')`, danger: true }
  ]);
}

async function eliminarGasto(gastoId) {
  if (!window.confirm('¿Eliminar este gasto?')) return;

  const { error } = await db
    .from('gastos')
    .delete()
    .eq('id', gastoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar el gasto', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto eliminado', 'success');
  await loadGastos();
  await loadDashboard();
}

// ---- INGRESOS ----
function getIngresoTipoIcon(tipo) {
  const iconMap = {
    salario: 'briefcase',
    beca: 'graduation-cap',
    extra: 'zap',
    prestamo: 'handshake',
    otro: 'plus-circle'
  };

  const icon = iconMap[tipo] || 'plus-circle';
  return `<i data-lucide="${icon}" style="width:18px;height:18px;stroke-width:1.75"></i>`;
}

function formatIngresoTipo(tipo) {
  const labelMap = {
    salario: 'Salario',
    beca: 'Beca',
    extra: 'Extra',
    prestamo: 'Prestamo',
    otro: 'Otro'
  };

  return labelMap[tipo] || 'Ingreso';
}

async function loadIngresos() {
  const uid = (await getUsuarioId());
  const [
    { data: ingresosProgramados, error: errorProgramados },
    { data: ingresos, error: errorIngresos }
  ] = await Promise.all([
    db.from('ingresos_programados').select('*').eq('usuario_id', uid).eq('activo', true).order('created_at', { ascending: true }),
    db.from('ingresos').select('*').eq('usuario_id', uid).order('fecha', { ascending: false }).limit(50)
  ]);

  const programadosHTML = errorProgramados
    ? `
      <div class="empty-state" style="padding:20px 0">
        <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
        <p>No se pudieron cargar los ingresos programados.</p>
      </div>
    `
    : (!ingresosProgramados || ingresosProgramados.length === 0
      ? `
        <div class="empty-state" style="padding:20px 0">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>Sin ingresos programados.</p>
        </div>
      `
      : ingresosProgramados.map(i => `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji"><i data-lucide="calendar-days" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${i.descripcion}</div>
            <div class="item-row-detail">${formatearFrecuenciaIngresoProgramado(i.frecuencia, i.dia_pago, i.dia_semana)}</div>
          </div>
          <div class="item-row-amount" style="color:var(--green)">${formatMXN(i.monto_estimado)}</div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuIngresoProgramado('${i.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
        </div>
      `).join(''));

  const historialHTML = errorIngresos
    ? `
      <div class="empty-state" style="padding:20px 0">
        <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
        <p>No se pudo cargar el historial de ingresos.</p>
      </div>
    `
    : (!ingresos || ingresos.length === 0
      ? `
        <div class="empty-state" style="padding:20px 0">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>Sin ingresos registrados.</p>
        </div>
      `
      : ingresos.map(i => {
        const nombre = i.descripcion?.trim() || formatIngresoTipo(i.tipo);
        return `
          <div class="item-row" style="margin-bottom:8px">
            <div class="item-row-emoji">${getIngresoTipoIcon(i.tipo)}</div>
            <div class="item-row-info">
              <div class="item-row-name">${nombre}</div>
              <div class="item-row-detail">${i.fecha}</div>
            </div>
            <div class="item-row-amount" style="color:var(--green)">${formatMXN(i.monto)}</div>
            <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuIngresoHistorial('${i.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
          </div>
        `;
      }).join(''));

  document.getElementById('page-ingresos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Ingresos</h1>
      <button onclick="openRegistrarIngreso()" style="background:var(--green-soft);border:1px solid rgba(45,212,160,0.2);border-radius:var(--radius-sm);padding:8px 14px;color:var(--green);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nuevo</button>
    </div>
    <div class="page-body">
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:14px">Programados</div>
          <button onclick="openAgregarIngresoProgramado()" style="background:var(--green-soft);border:1px solid rgba(45,212,160,0.2);border-radius:var(--radius-sm);padding:8px 12px;color:var(--green);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Agregar</button>
        </div>
        ${programadosHTML}
      </div>

      <div class="card" style="margin-bottom:0">
        <div style="font-weight:700;font-size:14px;margin-bottom:12px">Historial</div>
        ${historialHTML}
      </div>
    </div>
  `;

  renderLucideIcons();
  if (window.lucide) {
    lucide.createIcons();
  }
}

function openMenuIngresoProgramado(ingresoProgramadoId) {
  openActionSheet('Opciones de ingreso programado', [
    { label: 'Editar', onClick: `openEditarIngresoProgramado('${ingresoProgramadoId}')` },
    { label: 'Eliminar', onClick: `eliminarIngresoProgramado('${ingresoProgramadoId}')`, danger: true }
  ]);
}

function renderCamposFechaEditarIngresoProgramado() {
  const frecuencia = document.getElementById('eip-freq')?.value;
  const campos = document.getElementById('eip-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Dia del mes</label>
      <input class="form-input" id="eip-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la semana</label>
      <select class="form-select" id="eip-dia-semana">
        <option value="0">Domingo</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miercoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sabado</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la quincena</label>
      <input class="form-input" id="eip-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

async function openEditarIngresoProgramado(ingresoProgramadoId) {
  const { data: ingresoProgramado, error } = await db
    .from('ingresos_programados')
    .select('id, descripcion, monto_estimado, frecuencia, dia_pago, dia_semana')
    .eq('id', ingresoProgramadoId)
    .eq('usuario_id', (await getUsuarioId()))
    .maybeSingle();

  if (error || !ingresoProgramado) {
    showSnackbar('No se pudo cargar el ingreso programado', 'error');
    return;
  }

  openModal('Editar ingreso programado', `
    <div class="form-group">
      <label class="form-label">Descripcion</label>
      <input class="form-input" id="eip-desc" type="text" value="${ingresoProgramado.descripcion || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto estimado</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="eip-monto" type="number" min="0" value="${Number(ingresoProgramado.monto_estimado || 0)}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia</label>
      <select class="form-select" id="eip-freq" onchange="renderCamposFechaEditarIngresoProgramado()">
        <option value="semanal" ${ingresoProgramado.frecuencia === 'semanal' ? 'selected' : ''}>Semanal</option>
        <option value="quincenal" ${ingresoProgramado.frecuencia === 'quincenal' ? 'selected' : ''}>Quincenal</option>
        <option value="mensual" ${ingresoProgramado.frecuencia === 'mensual' ? 'selected' : ''}>Mensual</option>
      </select>
    </div>
    <div class="form-group" id="eip-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarEdicionIngresoProgramado('${ingresoProgramado.id}')">Guardar cambios</button>
  `);

  renderCamposFechaEditarIngresoProgramado();

  if (ingresoProgramado.frecuencia === 'semanal') {
    const inputSemana = document.getElementById('eip-dia-semana');
    if (inputSemana && ingresoProgramado.dia_semana !== null && ingresoProgramado.dia_semana !== undefined) {
      inputSemana.value = String(ingresoProgramado.dia_semana);
    }
  } else {
    const inputDia = document.getElementById('eip-dia-pago');
    if (inputDia && ingresoProgramado.dia_pago) {
      inputDia.value = String(ingresoProgramado.dia_pago);
    }
  }

  renderLucideIcons();
}

async function guardarEdicionIngresoProgramado(ingresoProgramadoId) {
  const descripcion = document.getElementById('eip-desc')?.value.trim();
  const monto_estimado = parseFloat(document.getElementById('eip-monto')?.value);
  const frecuencia = document.getElementById('eip-freq')?.value;
  let dia_pago = null;
  let dia_semana = null;

  if (!descripcion || !monto_estimado) {
    showSnackbar('Completa descripcion y monto', 'error');
    return;
  }

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('eip-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un dia de la semana valido', 'error');
      return;
    }
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById('eip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un dia del mes entre 1 y 31', 'error');
      return;
    }
  } else if (frecuencia === 'quincenal') {
    dia_pago = parseInt(document.getElementById('eip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un dia de la quincena entre 1 y 15', 'error');
      return;
    }
  }

  const { error } = await db
    .from('ingresos_programados')
    .update({ descripcion, monto_estimado, frecuencia, dia_pago, dia_semana })
    .eq('id', ingresoProgramadoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo actualizar el ingreso programado', 'error');
    return;
  }

  closeModal();
  showSnackbar('Ingreso programado actualizado ✓', 'success');
  await loadIngresos();
}

function openMenuIngresoHistorial(ingresoId) {
  openActionSheet('Opciones del ingreso', [
    { label: 'Eliminar', onClick: `eliminarIngreso('${ingresoId}')`, danger: true }
  ]);
}

async function eliminarIngreso(ingresoId) {
  if (!window.confirm('¿Eliminar este ingreso del historial?')) return;

  const { error } = await db
    .from('ingresos')
    .delete()
    .eq('id', ingresoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar el ingreso', 'error');
    return;
  }

  closeModal();
  showSnackbar('Ingreso eliminado', 'success');
  await loadIngresos();
  await loadDashboard();
  await loadCuentas();
}

async function openRegistrarTraspaso() {
  const { data: cuentas, error } = await db
    .from('cuentas')
    .select('id, nombre')
    .eq('usuario_id', (await getUsuarioId()))
    .eq('activa', true)
    .order('nombre', { ascending: true });

  if (error || !cuentas || cuentas.length < 2) {
    showSnackbar('Necesitas al menos dos cuentas activas para traspasar', 'error');
    return;
  }

  openModal('Registrar traspaso', `
    <div class="form-group">
      <label class="form-label">De qué cuenta</label>
      <select class="form-select" id="tr-origen">
        ${cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">A qué cuenta</label>
      <select class="form-select" id="tr-destino">
        ${cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="tr-monto" type="number" min="0" placeholder="0.00" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input class="form-input" id="tr-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div class="form-group">
      <label class="form-label">Nota opcional</label>
      <input class="form-input" id="tr-nota" type="text" placeholder="Opcional" />
    </div>
    <button class="btn btn-primary" onclick="guardarTraspaso()">Registrar traspaso</button>
  `);
}

async function guardarTraspaso() {
  const usuarioId = (await getUsuarioId());
  const cuenta_origen_id = document.getElementById('tr-origen')?.value;
  const cuenta_destino_id = document.getElementById('tr-destino')?.value;
  const monto = parseFloat(document.getElementById('tr-monto')?.value);
  const fecha = document.getElementById('tr-fecha')?.value;
  const descripcion = document.getElementById('tr-nota')?.value.trim() || '';

  if (!cuenta_origen_id || !cuenta_destino_id || !monto || monto <= 0 || !fecha) {
    showSnackbar('Completa origen, destino, monto y fecha', 'error');
    return;
  }

  if (cuenta_origen_id === cuenta_destino_id) {
    showSnackbar('Elige cuentas distintas para el traspaso', 'error');
    return;
  }

  const [
    { data: cuentaOrigen, error: errorCuentaOrigen },
    { data: ingresosOrigen, error: errorIngresos },
    { data: gastosOrigen, error: errorGastos },
    { data: pagosDeudaOrigen, error: errorPagosDeuda },
    { data: traspasosSalidaOrigen, error: errorTraspasosSalida },
    { data: traspasosEntradaOrigen, error: errorTraspasosEntrada }
  ] = await Promise.all([
    db.from('cuentas').select('id, saldo_inicial').eq('id', cuenta_origen_id).eq('usuario_id', usuarioId).single(),
    db.from('ingresos').select('cuenta_id, monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_origen_id),
    db.from('gastos').select('cuenta_id, monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_origen_id),
    db.from('pagos_deuda').select('cuenta_id, monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_origen_id),
    db.from('transferencias').select('cuenta_origen_id, monto').eq('usuario_id', usuarioId).eq('cuenta_origen_id', cuenta_origen_id),
    db.from('transferencias').select('cuenta_destino_id, monto').eq('usuario_id', usuarioId).eq('cuenta_destino_id', cuenta_origen_id)
  ]);

  if (errorCuentaOrigen || errorIngresos || errorGastos || errorPagosDeuda || errorTraspasosSalida || errorTraspasosEntrada || !cuentaOrigen) {
    showSnackbar('No se pudo validar el saldo de la cuenta origen', 'error');
    return;
  }

  const { cuentasConSaldo } = calcularCuentasConSaldo(
    [cuentaOrigen],
    ingresosOrigen || [],
    gastosOrigen || [],
    pagosDeudaOrigen || [],
    traspasosSalidaOrigen || [],
    traspasosEntradaOrigen || []
  );
  const saldoOrigen = Number(cuentasConSaldo?.[0]?.saldoCalculado || 0);

  if (monto > saldoOrigen) {
    showSnackbar('Saldo insuficiente — disponible: ' + formatMXN(saldoOrigen), 'error');
    return;
  }

  const { error } = await db.from('transferencias').insert({
    usuario_id: usuarioId,
    cuenta_origen_id,
    cuenta_destino_id,
    monto,
    descripcion,
    fecha
  });

  if (error) {
    showSnackbar('No se pudo registrar el traspaso', 'error');
    return;
  }

  showSnackbar('Traspaso registrado ✓', 'success');
  closeModal();
  await loadDashboard();
  await loadCuentas();
}

async function openAgregarCuenta() {
  openModal('Nueva cuenta', `
    <div class="form-group">
      <label class="form-label">Nombre de la cuenta</label>
      <input class="form-input" id="nc-nombre" type="text" placeholder="Ej: Efectivo, banco, negocio" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select class="form-select" id="nc-tipo">
        <option value="efectivo">Efectivo</option>
        <option value="debito">Debito</option>
        <option value="negocio">Negocio</option>
        <option value="otro">Otro</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Saldo inicial</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nc-saldo" type="number" min="0" placeholder="0.00" /></div>
    </div>
    <button class="btn btn-primary" onclick="guardarNuevaCuenta()">Guardar cuenta</button>
  `);
}

async function guardarNuevaCuenta() {
  const nombre = document.getElementById('nc-nombre')?.value.trim();
  const tipo = document.getElementById('nc-tipo')?.value;
  const saldo_inicial = parseFloat(document.getElementById('nc-saldo')?.value) || 0;

  if (!nombre) {
    showSnackbar('Escribe el nombre de la cuenta', 'error');
    return;
  }

  const { error } = await db.from('cuentas').insert({
    usuario_id: (await getUsuarioId()),
    nombre,
    tipo,
    saldo_inicial,
    activa: true
  });

  if (error) {
    showSnackbar('No se pudo guardar la cuenta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Cuenta guardada ✓', 'success');
  await loadCuentas();
  await loadDashboard();
}

// ---- AJUSTES ----
function formatearFrecuenciaIngresoProgramado(frecuencia, diaPago, diaSemana) {
  const diasSemana = ['domingos', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabados'];

  if (frecuencia === 'mensual') {
    return `Mensual${diaPago ? ` · dia ${diaPago}` : ''}`;
  }

  if (frecuencia === 'quincenal') {
    return `Quincenal${diaPago ? ` · dia ${diaPago}` : ''}`;
  }

  if (frecuencia === 'semanal') {
    const dia = Number.isInteger(diaSemana) && diaSemana >= 0 && diaSemana <= 6 ? diasSemana[diaSemana] : null;
    return `Semanal${dia ? ` · ${dia}` : ''}`;
  }

  return frecuencia || 'Sin frecuencia';
}

async function loadAjustes() {
  const { data: { user } } = await db.auth.getUser();
  const email = user?.email || '';

  document.getElementById('page-ajustes').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Ajustes</h1>
    </div>
    <div class="page-body">
      <div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Cuenta</div>
        <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:12px">${email}</div>
        <button class="btn btn-danger" onclick="cerrarSesion()">Cerrar sesión</button>
      </div>

      <div class="theme-toggle" onclick="toggleTheme()" style="margin-bottom:12px">
        <div class="theme-toggle-label">
          <span id="theme-label">🌙  Modo oscuro</span>
        </div>
        <div class="toggle-switch" id="theme-switch">
          <div class="toggle-knob"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Version</div>
        <div style="font-weight:600">JM Finance v1.0</div>
      </div>

      <button class="btn btn-danger" onclick="resetApp()">Resetear datos (desarrollo)</button>
    </div>
  `;

  updateThemeToggleUI();
  renderLucideIcons();
}

function openAgregarIngresoProgramado() {
  openModal('Nuevo ingreso programado', `
    <div class="form-group">
      <label class="form-label">Descripcion</label>
      <input class="form-input" id="ip-desc" type="text" placeholder="Ej: Salario semanal" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto estimado</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ip-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia</label>
      <select class="form-select" id="ip-freq" onchange="renderCamposFechaIngresoProgramado()">
        <option value="semanal">Semanal</option>
        <option value="quincenal">Quincenal</option>
        <option value="mensual">Mensual</option>
      </select>
    </div>
    <div class="form-group" id="ip-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarIngresoProgramado()">Guardar ingreso programado</button>
  `);

  renderCamposFechaIngresoProgramado();
}

function renderCamposFechaIngresoProgramado() {
  const frecuencia = document.getElementById('ip-freq')?.value;
  const campos = document.getElementById('ip-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Dia del mes</label>
      <input class="form-input" id="ip-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la semana</label>
      <select class="form-select" id="ip-dia-semana">
        <option value="0">Domingo</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miercoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sabado</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `
      <label class="form-label">Dia de la quincena</label>
      <input class="form-input" id="ip-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

async function guardarIngresoProgramado() {
  const descripcion = document.getElementById('ip-desc')?.value.trim();
  const monto_estimado = parseFloat(document.getElementById('ip-monto')?.value);
  const frecuencia = document.getElementById('ip-freq')?.value;
  let dia_pago = null;
  let dia_semana = null;

  if (!descripcion || !monto_estimado) {
    showSnackbar('Completa descripcion y monto', 'error');
    return;
  }

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('ip-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un dia de la semana valido', 'error');
      return;
    }
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById('ip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un dia del mes entre 1 y 31', 'error');
      return;
    }
  } else if (frecuencia === 'quincenal') {
    dia_pago = parseInt(document.getElementById('ip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un dia de la quincena entre 1 y 15', 'error');
      return;
    }
  }

  const { error } = await db.from('ingresos_programados').insert({
    usuario_id: (await getUsuarioId()),
    descripcion,
    monto_estimado,
    frecuencia,
    dia_semana,
    dia_pago,
    activo: true
  });

  if (error) {
    showSnackbar('No se pudo guardar el ingreso programado', 'error');
    return;
  }

  closeModal();
  showSnackbar('Ingreso programado guardado ✓', 'success');
  await loadIngresos();
}

async function eliminarIngresoProgramado(ingresoProgramadoId) {
  if (!window.confirm('¿Eliminar este ingreso programado?')) return;

  const { error } = await db
    .from('ingresos_programados')
    .update({ activo: false })
    .eq('id', ingresoProgramadoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar el ingreso programado', 'error');
    return;
  }

  showSnackbar('Ingreso programado eliminado', 'success');
  await loadIngresos();
}

function resetApp() {
  localStorage.removeItem('jmf_usuario_id');
  location.reload();
}

// ---- MODALES ----

// Registrar Ingreso
async function openRegistrarIngreso() {
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', (await getUsuarioId())).eq('activa', true);

  openModal('Registrar ingreso', `
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ri-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select class="form-select" id="ri-tipo" onchange="toggleCamposPrestamo()">
        <option value="salario">Salario</option>
        <option value="beca">Beca</option>
        <option value="extra">Extra</option>
        <option value="otro">Otro</option>
        <option value="prestamo">Préstamo recibido</option>
      </select>
    </div>
    <div id="ri-prestamo-campos" style="display:none"></div>
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

  toggleCamposPrestamo();
}

function toggleCamposPrestamo() {
  const tipo = document.getElementById('ri-tipo')?.value;
  const contenedor = document.getElementById('ri-prestamo-campos');
  if (!contenedor) return;

  if (tipo === 'prestamo') {
    contenedor.style.display = 'block';
    contenedor.innerHTML = `
      <div class="form-group">
        <label class="form-label">Prestamista</label>
        <input class="form-input" id="ri-prestamista" type="text" placeholder="¿Quién te prestó?" />
      </div>
      <div class="form-group">
        <label class="form-label">Frecuencia de pago</label>
        <select class="form-select" id="ri-freq-prestamo">
          <option value="semanal">Semanal</option>
          <option value="quincenal">Quincenal</option>
          <option value="mensual">Mensual</option>
          <option value="libre">Libre</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Pago por cuota (opcional)</label>
        <input class="form-input" id="ri-pago-prestamo" type="number" placeholder="Pago por cuota (opcional)" min="0" />
      </div>
    `;
    return;
  }

  contenedor.style.display = 'none';
  contenedor.innerHTML = '';
}

async function guardarIngreso() {
  const monto = parseFloat(document.getElementById('ri-monto').value);
  const tipo = document.getElementById('ri-tipo').value;
  const descripcion = document.getElementById('ri-desc').value.trim();
  const cuenta_id = document.getElementById('ri-cuenta')?.value || null;
  const fecha = document.getElementById('ri-fecha').value;
  const usuario_id = (await getUsuarioId());
  const prestamista = document.getElementById('ri-prestamista')?.value?.trim() || '';
  const frecuenciaPrestamo = document.getElementById('ri-freq-prestamo')?.value || 'libre';
  const montoPagoPrestamo = parseFloat(document.getElementById('ri-pago-prestamo')?.value) || null;
  if (!monto) { showSnackbar('Ingresa un monto', 'error'); return; }
  if (tipo === 'prestamo' && !prestamista) { showSnackbar('Escribe quién te prestó', 'error'); return; }

  const { error } = await db.from('ingresos').insert({
    usuario_id,
    monto, tipo, descripcion, cuenta_id, fecha
  });

  if (error) { showSnackbar('Error al guardar', 'error'); return; }

  let mensajeExito = 'Ingreso registrado ✓';
  let recargarConDeudas = false;

  if (tipo === 'prestamo') {
    const { error: errorDeuda } = await db.from('deudas').insert({
      acreedor: prestamista,
      monto_inicial: monto,
      monto_actual: monto,
      tipo_pago: frecuenciaPrestamo,
      monto_pago: montoPagoPrestamo,
      usuario_id,
      tipo_deuda: 'simple'
    });

    if (errorDeuda) {
      showSnackbar('Ingreso guardado, pero no se pudo registrar la deuda', 'error');
    } else {
      mensajeExito = 'Ingreso y deuda registrados ✓';
      recargarConDeudas = true;
    }
  }

  closeModal();

  const pagosPendientes = await getPagosPendientes();

  const totalComprometido = pagosPendientes.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
  const libre = monto - totalComprometido;

  console.log('Abriendo modal de dinero comprometido', { monto, fecha, pagosPendientes, totalComprometido, libre });

  openModal('Dinero comprometido', `
    <div class="card" style="margin-bottom:12px;background:var(--bg-elevated)">
      <div style="font-size:12px;color:var(--text-secondary)">Ingreso recibido</div>
      <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--green)">${formatMXN(monto)}</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:280px;overflow:auto">
      ${pagosPendientes.length === 0 ? `
        <div class="card" style="margin-bottom:0">
          <div style="font-size:12px;color:var(--text-secondary)">No hay pagos pendientes en este momento.</div>
        </div>
      ` : pagosPendientes.map(pago => `
        <div class="item-row" style="margin-bottom:0">
          <div class="item-row-emoji">${pago.tipo === 'fijo' ? '<i data-lucide="pin" style="width:18px;height:18px;stroke-width:1.75"></i>' : '<i data-lucide="trending-down" style="width:18px;height:18px;stroke-width:1.75"></i>'}</div>
          <div class="item-row-info">
            <div class="item-row-name">${pago.nombre}</div>
            <div class="item-row-detail">${pago.tipo === 'fijo' ? 'Gasto fijo' : 'Deuda'}${pago.urgente ? ' · <i data-lucide="alert-triangle" style="width:18px;height:18px;stroke-width:1.75"></i> Urgente' : ''}</div>
          </div>
          <div class="item-row-amount">${formatMXN(pago.monto)}</div>
        </div>
      `).join('')}
    </div>

    <div class="card" style="margin-bottom:16px;background:var(--bg-elevated)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;color:var(--text-secondary)">Total comprometido</span>
        <strong style="font-size:15px;font-weight:700;color:var(--yellow)">${formatMXN(totalComprometido)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;color:var(--text-secondary)">Ingreso recibido</span>
        <strong style="font-size:15px;font-weight:700">${formatMXN(monto)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border)">
        <span style="font-size:12px;color:var(--text-secondary)">Te queda libre</span>
        <strong style="font-size:15px;font-weight:700;color:${libre >= 0 ? 'var(--green)' : 'var(--red)'}">${formatMXN(libre)}</strong>
      </div>
    </div>

    <button class="btn btn-primary" onclick="onEntendidoDineroComprometido()">Entendido</button>
  `);

  renderLucideIcons();

  showSnackbar(mensajeExito, 'success');

  if (recargarConDeudas) {
    await loadDashboard();
    await loadDeudas();
  }
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
  const { data: categorias } = await db.from('categorias').select('*').eq('usuario_id', (await getUsuarioId())).eq('tipo', 'gasto');
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', (await getUsuarioId())).eq('activa', true);

  openModal('Registrar gasto', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="rg-desc" type="text" placeholder="¿En qué gastaste?" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="rg-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <select class="form-select" id="rg-cat">
        ${(categorias || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
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
  const usuarioId = (await getUsuarioId());
  if (!descripcion || !monto) { showSnackbar('Completa descripción y monto', 'error'); return; }

  if (cuenta_id) {
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
    const saldoDisponible = Number(cuenta.saldo_inicial || 0) + totalIngresosCuenta - totalGastosCuenta - totalPagosDeudaCuenta;

    if (monto > saldoDisponible) {
      showSnackbar('Saldo insuficiente — disponible: ' + formatMXN(saldoDisponible), 'error');
      return;
    }
  }

  const gastoPayload = {
    usuario_id: usuarioId,
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
async function openPagarDeuda(deudaId, acreedor, montoActual, tipoDeuda, montoUltimoPago) {
  const { data: cuentas, error } = await db
    .from('cuentas')
    .select('*')
    .eq('usuario_id', (await getUsuarioId()))
    .eq('activa', true);

  if (error) {
    showSnackbar('No se pudieron cargar las cuentas', 'error');
    return;
  }

  let infoReferenciaHTML = '';
  if (tipoDeuda === 'variable' && montoUltimoPago) {
    infoReferenciaHTML = `
    <div class="card" style="margin-bottom:12px;background:var(--bg-elevated)">
      <div style="font-size:12px;color:var(--text-secondary)">Último pago</div>
      <div style="font-size:15px;font-weight:700">${formatMXN(montoUltimoPago)}</div>
    </div>
    `;
  }

  openModal(`Pagar: ${acreedor}`, `
    <div class="card" style="margin-bottom:16px;background:var(--red-soft);border-color:rgba(240,93,110,0.2)">
      <div style="font-size:12px;color:var(--text-secondary)">Deuda actual</div>
      <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--red)">${formatMXN(montoActual)}</div>
    </div>
    ${infoReferenciaHTML}
    <div class="form-group">
      <label class="form-label">Monto del pago</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="pd-monto" type="number" placeholder="0.00" min="0" max="${montoActual}" /></div>
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
    <button class="btn btn-primary" onclick="guardarPagoDeuda('${deudaId}', ${montoActual}, '${tipoDeuda}')">Registrar pago</button>
  `);
}

async function guardarPagoDeuda(deudaId, montoActual, tipoDeuda) {
  const monto = parseFloat(document.getElementById('pd-monto').value);
  const cuenta_id = document.getElementById('pd-cuenta')?.value || null;
  const nota = document.getElementById('pd-nota').value.trim();
  const usuarioId = (await getUsuarioId());
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
  const fechaHoy = new Date().toISOString().split('T')[0];

  await db.from('pagos_deuda').insert({
    deuda_id: deudaId,
    usuario_id: usuarioId,
    cuenta_id,
    monto, nota,
    fecha: fechaHoy
  });

  if (tipoDeuda === 'tabla') {
    const { data: proximoPago } = await db.from('pagos_programados')
      .select('id')
      .eq('deuda_id', deudaId)
      .eq('pagado', false)
      .order('fecha_vencimiento')
      .limit(1)
      .maybeSingle();

    if (proximoPago) {
      await db.from('pagos_programados').update({
        pagado: true,
        fecha_pago: fechaHoy,
        monto_pagado: monto
      }).eq('id', proximoPago.id);
    }
  }

  await db.from('deudas').update({
    monto_actual: nuevoMonto,
    activa: nuevoMonto > 0,
    ultimo_pago: fechaHoy,
    monto_ultimo_pago: monto
  }).eq('id', deudaId);

  closeModal();
  showSnackbar(nuevoMonto === 0 ? 'Deuda saldada' : 'Pago registrado ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

// Agregar Deuda nueva - Selector de tipo
function openAgregarDeuda() {
  openModal('Nueva deuda', `
    <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:16px">
      <button onclick="selectTipoDeuda('simple')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font-body);text-align:left;transition:all 180ms ease">
        <div style="font-size:20px;margin-bottom:6px"><i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i></div>
        <div style="font-weight:600;font-size:14px">Simple</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Monto fijo, fecha fija</div>
      </button>
      <button onclick="selectTipoDeuda('variable')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font-body);text-align:left;transition:all 180ms ease">
        <div style="font-size:20px;margin-bottom:6px"><i data-lucide="chart-line" style="width:18px;height:18px;stroke-width:1.75"></i></div>
        <div style="font-weight:600;font-size:14px">Variable</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Monto cambia cada pago</div>
      </button>
      <button onclick="selectTipoDeuda('tabla')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font-body);text-align:left;transition:all 180ms ease">
        <div style="font-size:20px;margin-bottom:6px"><i data-lucide="table" style="width:18px;height:18px;stroke-width:1.75"></i></div>
        <div style="font-weight:600;font-size:14px">Con tabla</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Pagos programados</div>
      </button>
    </div>
  `);

  renderLucideIcons();
}

let tipoDeudaSeleccionado = null;

function selectTipoDeuda(tipo) {
  tipoDeudaSeleccionado = tipo;
  openFormularioNuevaDeuda(tipo);
}

function openFormularioNuevaDeuda(tipo) {
  let formContent = `
    <div class="form-group">
      <label class="form-label">¿A quién le debes?</label>
      <input class="form-input" id="nd-acreedor" type="text" placeholder="Ej: Caja Popular, mamá, etc." />
    </div>
    <div class="form-group">
      <label class="form-label">Monto total</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nd-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
  `;

  if (tipo === 'simple' || tipo === 'variable') {
    formContent += `
    <div class="form-group">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="nd-freq" onchange="renderCamposFechaDeuda()">
        <option value="unico">Pago único</option>
        <option value="semanal">Semanal</option>
        <option value="quincenal">Quincenal</option>
        <option value="mensual">Mensual</option>
        <option value="libre">Sin fecha fija</option>
      </select>
    </div>
    <div class="form-group" id="nd-fecha-campos"></div>
    `;
  }

  if (tipo === 'simple' || tipo === 'variable') {
    formContent += `
    <div class="form-group">
      <label class="form-label">Pago por cuota (opcional)</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nd-cuota" type="number" placeholder="0.00" min="0" /></div>
    </div>
    `;
  }

  formContent += `
    <button class="btn btn-primary" onclick="guardarNuevaDeuda('${tipo}')">Guardar deuda</button>
  `;

  openModal('Nueva deuda', formContent);
  
  if (tipo === 'simple' || tipo === 'variable') {
    setTimeout(() => renderCamposFechaDeuda(), 100);
  }
}

function renderCamposFechaDeuda() {
  const frecuencia = document.getElementById('nd-freq')?.value;
  const campos = document.getElementById('nd-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'unico') {
    campos.innerHTML = `
      <label class="form-label">Fecha de pago</label>
      <input class="form-input" id="nd-fecha-pago" type="date" />
    `;
    return;
  }

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Día del mes que pagas</label>
      <input class="form-input" id="nd-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="nd-dia-semana">
        <option value="0">Domingo</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miércoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sábado</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `
      <label class="form-label">Día de la quincena</label>
      <input class="form-input" id="nd-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

async function guardarNuevaDeuda(tipo) {
  const acreedor = document.getElementById('nd-acreedor').value.trim();
  const monto = parseFloat(document.getElementById('nd-monto').value);
  let tipo_pago = null;
  let monto_pago = null;
  let dia_pago = null;
  let dia_semana = null;

  if (!acreedor || !monto) { showSnackbar('Completa los campos requeridos', 'error'); return; }

  if (tipo === 'simple' || tipo === 'variable') {
    tipo_pago = document.getElementById('nd-freq').value;
    monto_pago = parseFloat(document.getElementById('nd-cuota').value) || null;

    if (tipo_pago === 'unico') {
      const fechaStr = document.getElementById('nd-fecha-pago')?.value;
      if (fechaStr) dia_pago = new Date(fechaStr + 'T00:00:00').getDate();
    } else if (tipo_pago === 'semanal') {
      dia_semana = parseInt(document.getElementById('nd-dia-semana')?.value, 10);
      if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
        showSnackbar('Selecciona un día de la semana válido', 'error');
        return;
      }
    } else if (tipo_pago === 'mensual') {
      dia_pago = parseInt(document.getElementById('nd-dia-pago')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
        showSnackbar('Ingresa un día del mes entre 1 y 31', 'error');
        return;
      }
    } else if (tipo_pago === 'quincenal') {
      dia_pago = parseInt(document.getElementById('nd-dia-pago')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
        showSnackbar('Ingresa un día de la quincena entre 1 y 15', 'error');
        return;
      }
    }
  }

  const { data: deudaInsertada, error } = await db.from('deudas').insert({
    usuario_id: (await getUsuarioId()),
    acreedor, monto_inicial: monto, monto_actual: monto, tipo_pago, monto_pago, dia_pago, dia_semana, tipo_deuda: tipo
  }).select();

  if (error) {
    showSnackbar('Error al guardar deuda', 'error');
    return;
  }

  closeModal();
  showSnackbar('Deuda registrada ✓', 'success');

  if (tipo === 'tabla' && deudaInsertada && deudaInsertada.length > 0) {
    const deudaId = deudaInsertada[0].id;
    setTimeout(() => openAgregarPagosProgramados(deudaId, acreedor), 500);
  } else {
    await loadDeudas();
    await loadDashboard();
  }
}

function openAgregarPagosProgramados(deudaId, acreedor) {
  let filasHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;max-height:400px;overflow-y:auto" id="pagos-programados-lista">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <input class="form-input" id="pp-numero" type="number" placeholder="Pago #" min="1" />
      <input class="form-input" id="pp-fecha" type="date" />
      <input class="form-input" id="pp-monto" type="number" placeholder="Monto" min="0" />
    </div>
    <button class="btn btn-secondary" onclick="agregarFilaPago()">+ Agregar fila</button>
    <button class="btn btn-primary" onclick="guardarTablaPagesProgramados('${deudaId}')">Guardar tabla</button>
  `;

  openModal(`Pagos programados: ${acreedor}`, filasHTML);
  renderFilasPagos();
}

let filasPagesProgramados = [];

function agregarFilaPago() {
  const numero = document.getElementById('pp-numero')?.value || '';
  const fecha = document.getElementById('pp-fecha')?.value || '';
  const monto = document.getElementById('pp-monto')?.value || '';

  if (!numero || !fecha || !monto) {
    showSnackbar('Completa todos los campos', 'error');
    return;
  }

  filasPagesProgramados.push({
    numero: parseInt(numero),
    fecha_vencimiento: fecha,
    monto_esperado: parseFloat(monto)
  });

  document.getElementById('pp-numero').value = '';
  document.getElementById('pp-fecha').value = '';
  document.getElementById('pp-monto').value = '';

  renderFilasPagos();
}

function renderFilasPagos() {
  const lista = document.getElementById('pagos-programados-lista');
  if (!lista) return;

  lista.innerHTML = filasPagesProgramados.map((fila, i) => `
    <div class="item-row" style="margin-bottom:0;background:var(--bg-elevated);padding:12px;border-radius:var(--radius-sm)">
      <div class="item-row-info">
        <div class="item-row-name">Pago #${fila.numero}</div>
        <div class="item-row-detail">${new Date(fila.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX')}</div>
      </div>
      <div class="item-row-amount">${formatMXN(fila.monto_esperado)}</div>
      <button class="item-row-delete" onclick="eliminarFilaPago(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
    </div>
  `).join('');

  renderLucideIcons();
}

function eliminarFilaPago(index) {
  filasPagesProgramados.splice(index, 1);
  renderFilasPagos();
}

async function guardarTablaPagesProgramados(deudaId) {
  if (filasPagesProgramados.length === 0) {
    showSnackbar('Agrega al menos un pago programado', 'error');
    return;
  }

  const usuarioId = (await getUsuarioId());
  const filasAGuardar = filasPagesProgramados.map(fila => ({
    deuda_id: deudaId,
    usuario_id: usuarioId,
    numero_pago: fila.numero,
    fecha_vencimiento: fila.fecha_vencimiento,
    monto_esperado: fila.monto_esperado,
    pagado: false
  }));

  const { error } = await db.from('pagos_programados').insert(filasAGuardar);

  if (error) {
    showSnackbar('Error al guardar tabla de pagos', 'error');
    return;
  }

  closeModal();
  filasPagesProgramados = [];
  showSnackbar('Tabla de pagos guardada ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

// Agregar Meta
async function openAgregarMeta() {
  db.from('cuentas').select('id, nombre').eq('usuario_id', (await getUsuarioId())).eq('activa', true).then(({ data: cuentas }) => {
    const cuentasOptions = (cuentas || []).map(cuenta => `<option value="${cuenta.id}">${cuenta.nombre}</option>`).join('');

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
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nm-monto" type="number" placeholder="0.00" min="0" /></div>
      </div>
      <div class="form-group">
        <label class="form-label">¿En qué cuenta ahorrarás?</label>
        <select class="form-select" id="meta-cuenta-id">
          ${cuentasOptions}
        </select>
      </div>
      <button class="btn btn-primary" onclick="guardarNuevaMeta()">Guardar meta</button>
    `);
  });
}

async function guardarNuevaMeta() {
  const emoji = document.getElementById('nm-emoji').value.trim() || '🎯';
  const nombre = document.getElementById('nm-nombre').value.trim();
  const monto_objetivo = parseFloat(document.getElementById('nm-monto').value);
  const cuenta_id = document.getElementById('meta-cuenta-id')?.value || null;
  if (!nombre || !monto_objetivo) { showSnackbar('Completa nombre y monto', 'error'); return; }

  await db.from('metas_ahorro').insert({
    usuario_id: (await getUsuarioId()),
    emoji, nombre, monto_objetivo, cuenta_id
  });

  closeModal();
  showSnackbar('Meta creada ✓', 'success');
  await loadMetas();
}

// ---- SWIPE NAVIGATION ----
let _swipeInitialized = false;

function initSwipeNavigation() {
  if (_swipeInitialized) return;
  _swipeInitialized = true;

  const PAGES_ORDER = ['dashboard', 'gastos', 'ingresos', 'deudas', 'metas', 'fijos', 'cuentas', 'ajustes'];

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

    const currentPage = document.querySelector('.page.active')?.id?.replace('page-', '');
    const currentIndex = PAGES_ORDER.indexOf(currentPage);
    if (currentIndex === -1) return;

    if (dx < 0 && currentIndex < PAGES_ORDER.length - 1) {
      showPage(PAGES_ORDER[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      showPage(PAGES_ORDER[currentIndex - 1]);
    }
  }, { passive: true });
}

// ---- RENDER APP PRINCIPAL ----
async function renderApp() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div id="page-dashboard" class="page active"></div>
    <div id="page-gastos" class="page"></div>
    <div id="page-ingresos" class="page"></div>
    <div id="page-cuentas" class="page"></div>
    <div id="page-deudas" class="page"></div>
    <div id="page-metas" class="page"></div>
    <div id="page-fijos" class="page"></div>
    <div id="page-ajustes" class="page"></div>
  `;

  renderNav();
  showPage('dashboard');
  initSwipeNavigation();
  await loadDashboard();
  await loadCuentas();
  await loadDeudas();
  await loadMetas();
  await loadFijos();
  loadGastos();
  await loadIngresos();
  await loadAjustes();
  if (typeof updateFab === 'function') updateFab('dashboard');
}

// ---- MODAL BASE ----
let modalCloseTimeoutId = null;

function openModal(title, content) {
  if (modalCloseTimeoutId) {
    clearTimeout(modalCloseTimeoutId);
    modalCloseTimeoutId = null;
  }

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

  renderLucideIcons();

  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    modalCloseTimeoutId = setTimeout(() => {
      overlay.remove();
      modalCloseTimeoutId = null;
    }, 300);
  }
}

// ---- AUTH ----

function renderAuth() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo">
        <div class="logo-mark">JM</div>
        <div class="logo-text">
          <span class="logo-jm">JM Finance</span>
          <span class="logo-finance">Control de tus finanzas</span>
        </div>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" id="tab-login" onclick="switchAuthTab('login')">Iniciar sesión</button>
        <button class="auth-tab" id="tab-registro" onclick="switchAuthTab('registro')">Crear cuenta</button>
      </div>

      <div id="auth-error" class="auth-error" style="display:none;width:100%;max-width:360px"></div>

      <div id="auth-panel-login" class="auth-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="auth-email" type="email" placeholder="tu@email.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <div class="auth-password-wrap">
            <input class="form-input" id="auth-password" type="password" placeholder="••••••••" autocomplete="current-password" />
            <button class="auth-eye-btn" type="button" onclick="toggleAuthPassword('auth-password', this)">
              <i data-lucide="eye" style="width:16px;height:16px"></i>
            </button>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-login" onclick="loginUsuario()">Entrar</button>
      </div>

      <div id="auth-panel-registro" class="auth-form" style="display:none">
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="form-input" id="reg-nombre" type="text" placeholder="Tu nombre" autocomplete="name" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="reg-email" type="email" placeholder="tu@email.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <div class="auth-password-wrap">
            <input class="form-input" id="reg-password" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" oninput="updatePasswordStrength(this.value)" />
            <button class="auth-eye-btn" type="button" onclick="toggleAuthPassword('reg-password', this)">
              <i data-lucide="eye" style="width:16px;height:16px"></i>
            </button>
          </div>
          <div id="password-strength" class="password-strength" style="display:none">
            <div class="strength-bar"><div id="strength-fill" class="strength-fill"></div></div>
            <span id="strength-label" class="strength-label"></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar contraseña</label>
          <div class="auth-password-wrap">
            <input class="form-input" id="reg-password2" type="password" placeholder="Repite la contraseña" autocomplete="new-password" />
            <button class="auth-eye-btn" type="button" onclick="toggleAuthPassword('reg-password2', this)">
              <i data-lucide="eye" style="width:16px;height:16px"></i>
            </button>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-registro" onclick="registrarUsuario()">Crear cuenta</button>
      </div>
    </div>
  `;
  renderLucideIcons();
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-registro').classList.toggle('active', !isLogin);
  document.getElementById('auth-panel-login').style.display = isLogin ? 'block' : 'none';
  document.getElementById('auth-panel-registro').style.display = isLogin ? 'none' : 'block';
  const err = document.getElementById('auth-error');
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

function toggleAuthPassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.innerHTML = isPassword
    ? '<i data-lucide="eye-off" style="width:16px;height:16px"></i>'
    : '<i data-lucide="eye" style="width:16px;height:16px"></i>';
  renderLucideIcons();
}

function updatePasswordStrength(value) {
  const strengthEl = document.getElementById('password-strength');
  const fillEl = document.getElementById('strength-fill');
  const labelEl = document.getElementById('strength-label');
  if (!strengthEl) return;

  if (value.length === 0) { strengthEl.style.display = 'none'; return; }
  strengthEl.style.display = 'flex';

  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  let label, color, width;
  if (score <= 1) { label = 'Débil'; color = 'var(--red)'; width = '33%'; }
  else if (score <= 3) { label = 'Media'; color = 'var(--yellow)'; width = '66%'; }
  else { label = 'Fuerte'; color = 'var(--green)'; width = '100%'; }

  fillEl.style.width = width;
  fillEl.style.background = color;
  labelEl.textContent = label;
  labelEl.style.color = color;
}

function mostrarErrorAuth(msg) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

async function loginUsuario() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!email || !password) {
    mostrarErrorAuth('Completa todos los campos');
    return;
  }

  const btnLogin = document.getElementById('btn-login');
  btnLogin.textContent = 'Entrando...';
  btnLogin.disabled = true;

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    mostrarErrorAuth('Email o contraseña incorrectos');
    btnLogin.textContent = 'Entrar';
    btnLogin.disabled = false;
    return;
  }

  const userId = (await db.auth.getUser()).data.user.id;
  const { data: usuario } = await db.from('usuarios')
    .select('onboarding_completo')
    .eq('id', userId)
    .maybeSingle();

  if (usuario?.onboarding_completo) {
    renderApp();
  } else {
    renderOnboarding();
  }
}

async function registrarUsuario() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;

  if (!nombre || !email || !password || !password2) {
    mostrarErrorAuth('Completa todos los campos');
    return;
  }

  if (password !== password2) {
    mostrarErrorAuth('Las contraseñas no coinciden');
    return;
  }

  if (password.length < 6) {
    mostrarErrorAuth('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  const btnReg = document.getElementById('btn-registro');
  btnReg.textContent = 'Creando cuenta...';
  btnReg.disabled = true;

  const { error } = await db.auth.signUp({ email, password });

  if (error) {
    mostrarErrorAuth('Error al crear cuenta: ' + error.message);
    btnReg.textContent = 'Crear cuenta';
    btnReg.disabled = false;
    return;
  }

  window._regNombre = nombre;
  renderOnboarding();
}

async function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  await db.auth.signOut();
  localStorage.removeItem('jmf_usuario_id');
  location.reload();
}

// ---- INICIO ----
window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await new Promise(r => setTimeout(r, 1200)); // splash

  const { data: { session } } = await db.auth.getSession();

  if (session) {
    const userId = session.user.id;
    const { data: usuario } = await db.from('usuarios')
      .select('onboarding_completo')
      .eq('id', userId)
      .maybeSingle();

    if (usuario?.onboarding_completo) {
      renderApp();
    } else {
      renderOnboarding();
    }
  } else {
    renderAuth();
  }
});

