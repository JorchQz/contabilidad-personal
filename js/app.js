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
        <button class="btn ${action.danger ? 'btn-danger' : 'btn-secondary'}" onclick="${action.onClick}">${action.label}</button>
      `).join('')}
    </div>
  `);
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
  const usuarioId = getUsuarioId();
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

// ---- INICIO ----
window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
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
    { value: 'efectivo', label: 'Efectivo', icon: '<i data-lucide="banknote" style="width:18px;height:18px;stroke-width:1.75"></i>' },
    { value: 'debito', label: 'Débito / Banco', icon: '<i data-lucide="building-2" style="width:18px;height:18px;stroke-width:1.75"></i>' },
    { value: 'negocio', label: 'Mercado Pago', icon: '<i data-lucide="store" style="width:18px;height:18px;stroke-width:1.75"></i>' },
    { value: 'otro', label: 'Otro', icon: '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>' },
  ];

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list" id="cuentas-list">
        ${onboardingData.cuentas.map((c, i) => `
          <div class="item-row">
            <div class="item-row-emoji">${TIPOS.find(t => t.value === c.tipo)?.icon || '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>'}</div>
            <div class="item-row-info">
              <div class="item-row-name">${c.nombre}</div>
              <div class="item-row-detail">${TIPOS.find(t => t.value === c.tipo)?.label} · Saldo inicial: ${formatMXN(c.saldo_inicial)}</div>
            </div>
            <button class="item-row-delete" onclick="removeCuenta(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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
          ${TIPOS.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
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

  renderLucideIcons();
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
            <div class="item-row-emoji"><i data-lucide="trending-down" style="width:18px;height:18px;stroke-width:1.75"></i></div>
            <div class="item-row-info">
              <div class="item-row-name">${d.acreedor}</div>
              <div class="item-row-detail">${d.tipo_pago}${d.monto_pago ? ` · ${formatMXN(d.monto_pago)}/pago` : ''}</div>
            </div>
            <div class="item-row-amount">${formatMXN(d.monto_actual)}</div>
            <button class="item-row-delete" onclick="removeDeuda(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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

  renderLucideIcons();
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
            <div class="item-row-emoji"><i data-lucide="pin" style="width:18px;height:18px;stroke-width:1.75"></i></div>
            <div class="item-row-info">
              <div class="item-row-name">${g.descripcion}</div>
              <div class="item-row-detail">${g.frecuencia}</div>
            </div>
            <div class="item-row-amount">${formatMXN(g.monto)}</div>
            <button class="item-row-delete" onclick="removeGastoFijo(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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
        <select class="form-select" id="gf-freq" onchange="renderCamposFechaGastoFijo()">
          ${FRECUENCIAS.map(f => `<option value="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}
        </select>
        <div class="mini-form-full" id="gf-fecha-campos"></div>
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

  if (showForm) {
    renderCamposFechaGastoFijo();
  }

  renderLucideIcons();
}

function renderCamposFechaGastoFijo() {
  const frecuencia = document.getElementById('gf-freq')?.value;
  const campos = document.getElementById('gf-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Día del mes que pagas</label>
      <input class="form-input" id="gf-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="gf-dia-semana">
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
      <input class="form-input" id="gf-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

function addGastoFijo() {
  const descripcion = document.getElementById('gf-desc').value.trim();
  const monto = parseFloat(document.getElementById('gf-monto').value);
  const frecuencia = document.getElementById('gf-freq').value;
  let dia_pago = null;
  let dia_semana = null;

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('gf-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un día de la semana válido', 'error');
      return;
    }
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById('gf-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un día del mes entre 1 y 31', 'error');
      return;
    }
  } else if (frecuencia === 'quincenal') {
    dia_pago = parseInt(document.getElementById('gf-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un día de la quincena entre 1 y 15', 'error');
      return;
    }
  }

  if (!descripcion || !monto) { showSnackbar('Completa descripción y monto', 'error'); return; }
  onboardingData.gastosFijos.push({ descripcion, monto, frecuencia, dia_pago, dia_semana });
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
          <div class="item-row-emoji"><i data-lucide="target" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${m.nombre}</div>
            <div class="item-row-detail">Meta: ${formatMXN(m.monto_objetivo)}</div>
          </div>
          <button class="item-row-delete" onclick="removeMeta(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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

  renderLucideIcons();
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
        descripcion: g.descripcion,
        monto: g.monto,
        frecuencia: g.frecuencia,
        dia_pago: g.dia_pago ?? null,
        dia_semana: g.dia_semana ?? null,
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

    showSnackbar('¡Todo listo! Bienvenido', 'success');
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
    <div id="page-ingresos" class="page"></div>
    <div id="page-cuentas" class="page"></div>
    <div id="page-deudas" class="page"></div>
    <div id="page-metas" class="page"></div>
    <div id="page-fijos" class="page"></div>
    <div id="page-ajustes" class="page"></div>
  `;

  renderNav();
  await loadDashboard();
  await loadCuentas();
  await loadDeudas();
  await loadMetas();
  await loadFijos();
  loadGastos();
  await loadIngresos();
  await loadAjustes();
}

// ---- DASHBOARD ----
async function loadDashboard() {
  ensurePagosProximosStyles();

  const uid = getUsuarioId();
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
  const saludo = horaActual < 12 ? 'Buenos días' : horaActual < 19 ? 'Buenas tardes' : 'Buenas noches';

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header">
      <div>
        <p class="text-secondary" style="font-size:12px">${saludo} 👋</p>
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

  // FAB con speed dial para registrar movimientos
  let fab = document.getElementById('fab-main');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'fab-main';
    fab.className = 'fab';
    document.getElementById('app').appendChild(fab);
  }

  closeFabMenu();
  if (!fab.dataset.listenerSet) {
    fab.onclick = toggleFabMenu;
    fab.dataset.listenerSet = 'true';
  }
  setFabMainIcon(false);
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
    <button onclick="closeFabMenu(); openRegistrarGasto();" style="display:flex;align-items:center;gap:10px;width:180px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;color:var(--text-primary);font-size:14px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,0.12);cursor:pointer;font-family:var(--font-body)">
      <span style="font-size:20px;line-height:1"><i data-lucide="minus-circle" style="width:18px;height:18px;stroke-width:1.75"></i></span>
      <span>Registrar gasto</span>
    </button>
    <button onclick="closeFabMenu(); openRegistrarIngreso();" style="display:flex;align-items:center;gap:10px;width:180px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;color:var(--text-primary);font-size:14px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,0.12);cursor:pointer;font-family:var(--font-body)">
      <span style="font-size:20px;line-height:1"><i data-lucide="plus-circle" style="width:18px;height:18px;stroke-width:1.75"></i></span>
      <span>Registrar ingreso</span>
    </button>
    <button onclick="closeFabMenu(); openRegistrarTraspaso();" style="display:flex;align-items:center;gap:10px;width:180px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;color:var(--text-primary);font-size:14px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,0.12);cursor:pointer;font-family:var(--font-body)">
      <span style="font-size:20px;line-height:1"><i data-lucide="arrow-left-right" style="width:18px;height:18px;stroke-width:1.75"></i></span>
      <span>Traspaso</span>
    </button>
  `;

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
  const uid = getUsuarioId();
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
            <button class="item-row-delete" onclick="openMenuCuenta('${cuenta.id}')"><i data-lucide="more-vertical" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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
    { label: 'Eliminar', onClick: `confirmarEliminarCuenta('${cuentaId}')`, danger: true }
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
    .eq('usuario_id', getUsuarioId())
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
      <input class="form-input" id="ec-saldo" type="number" min="0" value="${Number(cuenta.saldo_inicial || 0)}" />
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
    .eq('usuario_id', getUsuarioId());

  if (error) {
    showSnackbar('No se pudo actualizar la cuenta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Cuenta actualizada ✓', 'success');
  await loadCuentas();
  await loadDashboard();
}

function confirmarEliminarCuenta(cuentaId) {
  openModal('Eliminar cuenta', `
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">Los movimientos de esta cuenta se conservan en el historial.</p>
    <button class="btn btn-danger" onclick="eliminarCuenta('${cuentaId}')">Eliminar cuenta</button>
  `);
}

async function eliminarCuenta(cuentaId) {
  const { error } = await db
    .from('cuentas')
    .update({ activa: false })
    .eq('id', cuentaId)
    .eq('usuario_id', getUsuarioId());

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
  const uid = getUsuarioId();
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
              <button class="item-row-delete" style="margin-left:0" onclick="openMenuDeuda('${d.id}')"><i data-lucide="more-vertical" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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
      <button onclick="openAgregarDeuda()" style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-sm);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nueva</button>
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
    { label: 'Eliminar', onClick: `confirmarEliminarDeuda('${deudaId}')`, danger: true }
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
    .eq('usuario_id', getUsuarioId())
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
      <input class="form-input" id="ed-monto" type="number" min="0" value="${Number(deuda.monto_actual || 0)}" />
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
      <input class="form-input" id="ed-monto-pago" type="number" min="0" value="${deuda.monto_pago ? Number(deuda.monto_pago) : ''}" placeholder="$0.00" />
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
    .eq('usuario_id', getUsuarioId());

  if (error) {
    showSnackbar('No se pudo actualizar la deuda', 'error');
    return;
  }

  closeModal();
  showSnackbar('Deuda actualizada ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

function confirmarEliminarDeuda(deudaId) {
  openModal('Eliminar deuda', `
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">¿Eliminar esta deuda?</p>
    <button class="btn btn-danger" onclick="eliminarDeuda('${deudaId}')">Confirmar</button>
  `);
}

async function eliminarDeuda(deudaId) {
  const { error } = await db
    .from('deudas')
    .update({ activa: false })
    .eq('id', deudaId)
    .eq('usuario_id', getUsuarioId());

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
  const uid = getUsuarioId();
  const { data: metas } = await db.from('metas_ahorro').select('*').eq('usuario_id', uid).eq('activa', true);

  document.getElementById('page-metas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Metas de ahorro</h1>
      <button onclick="openAgregarMeta()" style="background:var(--green-soft);border:1px solid rgba(45,212,160,0.2);border-radius:var(--radius-sm);padding:8px 14px;color:var(--green);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nueva</button>
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
                  <div style="font-size:12px;color:var(--text-secondary)">Meta: ${formatMXN(m.monto_objetivo)}</div>
                </div>
              </div>
              <button class="item-row-delete" onclick="openMenuMeta('${m.id}')"><i data-lucide="more-vertical" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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
    { label: 'Abonar', onClick: `openAbonarMeta('${metaId}')` },
    { label: 'Editar', onClick: `openEditarMeta('${metaId}')` },
    { label: 'Eliminar', onClick: `confirmarEliminarMeta('${metaId}')`, danger: true }
  ]);
}

function openMenuMeta(metaId) {
  openMetaActions(metaId);
}

async function openAbonarMeta(metaId) {
  const { data: meta, error } = await db
    .from('metas_ahorro')
    .select('id, nombre')
    .eq('id', metaId)
    .eq('usuario_id', getUsuarioId())
    .maybeSingle();

  if (error || !meta) {
    showSnackbar('No se pudo cargar la meta', 'error');
    return;
  }

  openModal(`Abonar a ${meta.nombre}`, `
    <div class="form-group">
      <label class="form-label">Monto del abono</label>
      <input class="form-input" id="ma-abono" type="number" min="0" placeholder="$0.00" />
    </div>
    <button class="btn btn-primary" onclick="guardarAbonoMeta('${meta.id}')">Guardar abono</button>
  `);
}

async function guardarAbonoMeta(metaId) {
  const abono = parseFloat(document.getElementById('ma-abono')?.value);

  if (!abono || abono <= 0) {
    showSnackbar('Ingresa un monto valido', 'error');
    return;
  }

  const usuarioId = getUsuarioId();
  const { data: meta, error: errorMeta } = await db
    .from('metas_ahorro')
    .select('monto_actual, nombre')
    .eq('id', metaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (errorMeta || !meta) {
    showSnackbar('No se pudo actualizar la meta', 'error');
    return;
  }

  const { error: errorSaldo, saldoDisponible } = await getSaldoDisponibleTotal(usuarioId);

  if (errorSaldo) {
    showSnackbar('No se pudo validar el saldo disponible', 'error');
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
    cuenta_id: null
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
}

async function openEditarMeta(metaId) {
  const { data: meta, error } = await db
    .from('metas_ahorro')
    .select('id, nombre, emoji, monto_objetivo')
    .eq('id', metaId)
    .eq('usuario_id', getUsuarioId())
    .maybeSingle();

  if (error || !meta) {
    showSnackbar('No se pudo cargar la meta', 'error');
    return;
  }

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
      <input class="form-input" id="em-monto" type="number" min="0" value="${Number(meta.monto_objetivo || 0)}" />
    </div>
    <button class="btn btn-primary" onclick="guardarEdicionMeta('${meta.id}')">Guardar cambios</button>
  `);
}

async function guardarEdicionMeta(metaId) {
  const emoji = document.getElementById('em-emoji')?.value.trim() || '🎯';
  const nombre = document.getElementById('em-nombre')?.value.trim();
  const monto_objetivo = parseFloat(document.getElementById('em-monto')?.value);

  if (!nombre || Number.isNaN(monto_objetivo) || monto_objetivo <= 0) {
    showSnackbar('Completa nombre y monto objetivo', 'error');
    return;
  }

  const { error } = await db
    .from('metas_ahorro')
    .update({ emoji, nombre, monto_objetivo })
    .eq('id', metaId)
    .eq('usuario_id', getUsuarioId());

  if (error) {
    showSnackbar('No se pudo actualizar la meta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Meta actualizada ✓', 'success');
  await loadMetas();
}

function confirmarEliminarMeta(metaId) {
  openModal('Eliminar meta', `
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">¿Eliminar esta meta?</p>
    <button class="btn btn-danger" onclick="eliminarMeta('${metaId}')">Eliminar</button>
  `);
}

async function eliminarMeta(metaId) {
  const { error } = await db
    .from('metas_ahorro')
    .update({ activa: false })
    .eq('id', metaId)
    .eq('usuario_id', getUsuarioId());

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
  const uid = getUsuarioId();
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
        <button onclick="openAgregarGastoFijo()" style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-sm);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nuevo</button>
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
      <button onclick="openAgregarGastoFijo()" style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-sm);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nuevo</button>
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
          <button class="item-row-delete" onclick="openMenuGastoFijo('${g.id}')"><i data-lucide="more-vertical" style="width:18px;height:18px;stroke-width:1.75"></i></button>
        </div>
      `).join('')}
    </div>
  `;

  renderLucideIcons();
}

function openGastoFijoActions(gastoFijoId) {
  openActionSheet('Opciones de gasto fijo', [
    { label: 'Editar', onClick: `openEditarGastoFijo('${gastoFijoId}')` },
    { label: 'Eliminar', onClick: `confirmarEliminarGastoFijo('${gastoFijoId}')`, danger: true }
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
    .eq('usuario_id', getUsuarioId())
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
      <input class="form-input" id="egf-monto" type="number" min="0" value="${Number(gasto.monto || 0)}" />
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
    .eq('usuario_id', getUsuarioId());

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
      <input class="form-input" id="fgf-monto" type="number" placeholder="$0.00" min="0" />
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
    usuario_id: getUsuarioId(),
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
  const { error } = await db.from('gastos_fijos').update({ activo: false }).eq('id', gastoFijoId);

  if (error) {
    showSnackbar('No se pudo eliminar el gasto fijo', 'error');
    return;
  }

  showSnackbar('Gasto fijo eliminado', 'success');
  await loadFijos();
}

function confirmarEliminarGastoFijo(gastoFijoId) {
  openModal('Eliminar gasto fijo', `
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">¿Eliminar este gasto fijo?</p>
    <button class="btn btn-danger" onclick="eliminarGastoFijo('${gastoFijoId}')">Eliminar</button>
  `);
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
          <button class="item-row-delete" onclick="confirmarEliminarGasto('${g.id}')"><i data-lucide="trash-2" style="width:18px;height:18px;stroke-width:1.75"></i></button>
        </div>
      `).join('')}
    </div>
  `;

  renderLucideIcons();
}

function confirmarEliminarGasto(gastoId) {
  openModal('Eliminar gasto', `
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">¿Eliminar este gasto del historial?</p>
    <button class="btn btn-danger" onclick="eliminarGasto('${gastoId}')">Eliminar</button>
  `);
}

async function eliminarGasto(gastoId) {
  const { error } = await db
    .from('gastos')
    .delete()
    .eq('id', gastoId)
    .eq('usuario_id', getUsuarioId());

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
  const uid = getUsuarioId();
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
          <button class="item-row-delete" onclick="openMenuIngresoProgramado('${i.id}')"><i data-lucide="more-vertical" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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
            <button class="item-row-delete" onclick="openMenuIngresoHistorial('${i.id}')"><i data-lucide="more-vertical" style="width:18px;height:18px;stroke-width:1.75"></i></button>
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
    .eq('usuario_id', getUsuarioId())
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
      <input class="form-input" id="eip-monto" type="number" min="0" value="${Number(ingresoProgramado.monto_estimado || 0)}" />
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
    .eq('usuario_id', getUsuarioId());

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
    { label: 'Eliminar', onClick: `confirmarEliminarIngreso('${ingresoId}')`, danger: true }
  ]);
}

function confirmarEliminarIngreso(ingresoId) {
  openModal('Eliminar ingreso', `
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">¿Eliminar este ingreso del historial?</p>
    <button class="btn btn-danger" onclick="eliminarIngreso('${ingresoId}')">Eliminar</button>
  `);
}

async function eliminarIngreso(ingresoId) {
  const { error } = await db
    .from('ingresos')
    .delete()
    .eq('id', ingresoId)
    .eq('usuario_id', getUsuarioId());

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
  document.getElementById('page-ajustes').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Ajustes</h1>
    </div>
    <div class="page-body">
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
      <input class="form-input" id="ip-monto" type="number" placeholder="$0.00" min="0" />
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
    usuario_id: getUsuarioId(),
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
  const { error } = await db
    .from('ingresos_programados')
    .update({ activo: false })
    .eq('id', ingresoProgramadoId)
    .eq('usuario_id', getUsuarioId());

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
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', getUsuarioId()).eq('activa', true);

  openModal('Registrar ingreso', `
    <div class="form-group">
      <label class="form-label">Monto</label>
      <input class="form-input" id="ri-monto" type="number" placeholder="$0.00" min="0" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select class="form-select" id="ri-tipo" onchange="toggleCamposPrestamo()">
        <option value="salario">Salario</option>
        <option value="beca">Beca</option>
        <option value="extra">Extra</option>
        <option value="otro">Otro</option>
        <option value="prestamo">🤝 Préstamo recibido</option>
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
  const usuario_id = getUsuarioId();
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
  const usuarioId = getUsuarioId();
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
    .eq('usuario_id', getUsuarioId())
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
    <button class="btn btn-primary" onclick="guardarPagoDeuda('${deudaId}', ${montoActual}, '${tipoDeuda}')">Registrar pago</button>
  `);
}

async function guardarPagoDeuda(deudaId, montoActual, tipoDeuda) {
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
      <input class="form-input" id="nd-monto" type="number" placeholder="$0.00" min="0" />
    </div>
  `;

  if (tipo === 'simple' || tipo === 'variable') {
    formContent += `
    <div class="form-group">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="nd-freq" onchange="renderCamposFechaDeuda()">
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
      <input class="form-input" id="nd-cuota" type="number" placeholder="$0.00" min="0" />
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

    if (tipo_pago === 'semanal') {
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
    usuario_id: getUsuarioId(),
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

  const usuarioId = getUsuarioId();
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
