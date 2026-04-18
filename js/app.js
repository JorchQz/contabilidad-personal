// js/app.js — Inicialización y onboarding
import { db, getUsuarioId } from './supabase.js';
import {
  calcularCuentasConSaldo,
  getCuentaIcon,
  getCuentaTipos,
  loadCuentas,
  openAgregarCuenta,
  openCuentaActions,
  openEditarCuenta,
  openMenuCuenta,
  eliminarCuenta,
  guardarEdicionCuenta,
  guardarNuevaCuenta
} from './cuentas.js';
import { renderAuth, initAuthEvents, cerrarSesion } from './auth.js';

// NOTA PARA EL DESARROLLADOR — ejecutar en Supabase SQL Editor antes de usar pago único:
// ALTER TABLE deudas DROP CONSTRAINT IF EXISTS deudas_tipo_pago_check;
// ALTER TABLE deudas ADD CONSTRAINT deudas_tipo_pago_check
//   CHECK (tipo_pago = ANY (ARRAY['semanal','quincenal','mensual','libre','unico']));

// NOTA — Migración para gastos fijos con monto variable + frecuencias extendidas:
// ALTER TABLE gastos_fijos ALTER COLUMN monto DROP NOT NULL;
// ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS monto_variable BOOLEAN DEFAULT false;
// ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS proximo_pago DATE;
// ALTER TABLE gastos_fijos DROP CONSTRAINT IF EXISTS gastos_fijos_frecuencia_check;
// ALTER TABLE gastos_fijos ADD CONSTRAINT gastos_fijos_frecuencia_check
//   CHECK (frecuencia = ANY (ARRAY['semanal','quincenal','mensual','bimestral','trimestral','semestral','anual']));

// ---- ESTADO DEL ONBOARDING ----
let onboardingData = {
  nombre: '',
  tiposIngreso: [],
  cuentas: [],
  deudas: [],
  gastosFijos: [],
  metas: []
};

let currentStep = 1;
const TOTAL_STEPS = 6;

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
export function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(amount);
}

export function showSnackbar(msg, type = '') {
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

// Renderiza un valor que puede ser un nombre de icono lucide (kebab-case) o un emoji literal
function renderEmojiOrIcon(value, fallbackIcon = 'package', size = 18) {
  const sty = `width:${size}px;height:${size}px;stroke-width:1.75`;
  if (!value) return `<i data-lucide="${fallbackIcon}" style="${sty}"></i>`;
  const isLucideName = /^[a-z][a-z0-9-]*$/.test(value);
  return isLucideName
    ? `<i data-lucide="${value}" style="${sty}"></i>`
    : value;
}

export function renderLucideIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

export function openActionSheet(title, actions) {
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

  const { data: gf } = await db.from('gastos_fijos')
    .select('frecuencia, proximo_pago')
    .eq('id', gastoFijoId)
    .maybeSingle();

  const update = { ultimo_pago: fechaHoy };

  if (gf?.proximo_pago) {
    const monthsByFreq = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
    const months = monthsByFreq[gf.frecuencia];
    const fecha = new Date(gf.proximo_pago + 'T00:00:00');
    if (gf.frecuencia === 'semanal') fecha.setDate(fecha.getDate() + 7);
    else if (gf.frecuencia === 'quincenal') fecha.setDate(fecha.getDate() + 15);
    else if (months) fecha.setMonth(fecha.getMonth() + months);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    update.proximo_pago = `${y}-${m}-${d}`;
  }

  const { error } = await db.from('gastos_fijos').update(update).eq('id', gastoFijoId);

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

function getNextFijoDate(gf, fromDate) {
  const base = normalizeDate(fromDate || new Date());

  if (gf.proximo_pago) {
    const fecha = normalizeDate(new Date(gf.proximo_pago + 'T00:00:00'));
    const monthsByFreq = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
    const months = monthsByFreq[gf.frecuencia];
    let guard = 0;
    while (fecha < base && guard++ < 120) {
      if (gf.frecuencia === 'semanal') {
        fecha.setDate(fecha.getDate() + 7);
      } else if (gf.frecuencia === 'quincenal') {
        fecha.setDate(fecha.getDate() + 15);
      } else if (months) {
        fecha.setMonth(fecha.getMonth() + months);
      } else {
        break;
      }
    }
    return fecha;
  }

  if (gf.frecuencia === 'semanal' && Number.isInteger(gf.dia_semana)) {
    return getNextWeeklyDate(gf.dia_semana, base);
  }
  if (gf.frecuencia === 'quincenal' && gf.dia_pago) {
    return getNextQuincenalDate(gf.dia_pago, base);
  }
  if (gf.dia_pago) {
    return getNextMonthlyDate(gf.dia_pago, base);
  }
  return null;
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
    const fechaEsperada = getNextFijoDate(gf, hoy);
    if (!fechaEsperada) continue;

    // Dentro del período hoy → próximo cobro
    if (!isDateInRange(fechaEsperada, hoy, fechaLimite)) continue;

    // Ya se pagó en este período?
    if (gf.ultimo_pago) {
      const ultimoPago = normalizeDate(new Date(gf.ultimo_pago + 'T00:00:00'));
      if (isDateInRange(ultimoPago, hoy, fechaLimite)) continue;
    }

    const esVariable = gf.monto_variable === true || gf.monto == null;
    pendientes.push({
      item_id: `fijo-${gf.id}`,
      gasto_fijo_id: gf.id,
      nombre: gf.descripcion,
      monto: Number(gf.monto || 0),
      monto_variable: esVariable,
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
export function renderOnboarding() {
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
    5: renderStep6,       // Metas
    6: renderStep6resumen // Resumen
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
    { nombre: 'Salario / Nómina', icono: 'briefcase' },
    { nombre: 'Honorarios / Freelance', icono: 'laptop' },
    { nombre: 'Negocio propio', icono: 'store' },
    { nombre: 'Horas extra', icono: 'clock' },
    { nombre: 'Renta de inmueble', icono: 'building-2' },
    { nombre: 'Beca / Apoyo gobierno', icono: 'graduation-cap' },
    { nombre: 'Pensión / Retiro', icono: 'landmark' },
    { nombre: 'Mesada / Apoyo familiar', icono: 'users' },
  ];

  setHeader('¿Cómo recibes dinero?', 'Selecciona todas las que apliquen.');

  function render(showIconPanel = false, panelForIndex = null) {
    const customItems = onboardingData.tiposIngreso.filter(x => !TIPOS_INGRESO.some(t => t.nombre === x.nombre));
    
    const itemsHtml = `
      <div class="income-list">
        ${TIPOS_INGRESO.map(item => {
          const selected = onboardingData.tiposIngreso.some(x => x.nombre === item.nombre);
          return `
            <div class="income-option${selected ? ' selected' : ''}" onclick="toggleTipoIngreso('${item.nombre}','${item.icono}', this)">
              <span>${item.nombre}</span>
            </div>`;
        }).join('')}
        
        ${customItems.map((item, idx) => `
          <div class="income-option selected">
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

window.toggleTipoIngreso = function(nombre, icono, elemento) {
  const index = onboardingData.tiposIngreso.findIndex(t => t.nombre === nombre);
  if (index === -1) {
    onboardingData.tiposIngreso.push({ nombre, icono });
    elemento.classList.add('selected');
  } else {
    onboardingData.tiposIngreso.splice(index, 1);
    elemento.classList.remove('selected');
  }
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

// ---- CATÁLOGO DE GASTOS FIJOS ----
// `montoVariable: true` = el usuario define monto en cada pago (luz, agua, etc.)
// `frecuencia` = default; el usuario puede cambiarla al seleccionar.
const GASTOS_FIJOS_CATALOGO = [
  {
    titulo: 'Vivienda', icono: 'home',
    items: [
      { nombre: 'Renta',    icono: 'home',        frecuencia: 'mensual' },
      { nombre: 'Hipoteca', icono: 'building-2',  frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Servicios', icono: 'zap',
    items: [
      { nombre: 'Luz / CFE',        icono: 'zap',        frecuencia: 'bimestral', montoVariable: true },
      { nombre: 'Agua',             icono: 'droplets',   frecuencia: 'mensual',   montoVariable: true },
      { nombre: 'Internet',         icono: 'wifi',       frecuencia: 'mensual' },
      { nombre: 'Teléfono celular', icono: 'smartphone', frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Streaming y suscripciones', icono: 'tv',
    items: [
      { nombre: 'Netflix',         icono: 'tv',           frecuencia: 'mensual' },
      { nombre: 'Spotify',         icono: 'music',        frecuencia: 'mensual' },
      { nombre: 'Disney+',         icono: 'clapperboard', frecuencia: 'mensual' },
      { nombre: 'HBO Max',         icono: 'tv',           frecuencia: 'mensual' },
      { nombre: 'Amazon Prime',    icono: 'package',      frecuencia: 'mensual' },
      { nombre: 'YouTube Premium', icono: 'youtube',      frecuencia: 'mensual' },
      { nombre: 'Apple Music',     icono: 'music',        frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Salud y bienestar', icono: 'shield',
    items: [
      { nombre: 'Seguro médico', icono: 'shield',   frecuencia: 'anual' },
      { nombre: 'Gimnasio',      icono: 'dumbbell', frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Auto', icono: 'car',
    items: [
      { nombre: 'Seguro de auto', icono: 'car', frecuencia: 'anual' },
    ],
  },
  {
    titulo: 'Educación', icono: 'graduation-cap',
    items: [
      { nombre: 'Colegiatura', icono: 'graduation-cap', frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Créditos', icono: 'credit-card',
    items: [
      { nombre: 'Tarjeta de crédito', icono: 'credit-card', frecuencia: 'mensual', montoVariable: true },
    ],
  },
];

// ---- CATÁLOGO DE GASTOS VARIABLES (predefinidos para el picker) ----
// Se siembran en la tabla `categorias` al terminar onboarding.
// Marcador `special` se usa para flujos especiales en el registro (ahorro, pago de deuda).
const GASTOS_VARIABLES_CATALOGO = [
  {
    titulo: 'Hogar', icono: 'home',
    items: [
      { nombre: 'Renta',           icono: 'home' },
      { nombre: 'Mantenimiento',   icono: 'wrench' },
      { nombre: 'Muebles y decoración', icono: 'sofa' },
      { nombre: 'Otro hogar',      icono: 'home' },
    ],
  },
  {
    titulo: 'Servicios', icono: 'zap',
    items: [
      { nombre: 'Luz',             icono: 'zap' },
      { nombre: 'Agua',            icono: 'droplets' },
      { nombre: 'Gas',             icono: 'flame' },
      { nombre: 'Internet y telefonía', icono: 'wifi' },
      { nombre: 'Otro servicio',   icono: 'package' },
    ],
  },
  {
    titulo: 'Alimentación', icono: 'utensils',
    items: [
      { nombre: 'Súper',           icono: 'shopping-cart' },
      { nombre: 'Restaurantes',    icono: 'utensils' },
      { nombre: 'Cafés y snacks',  icono: 'coffee' },
      { nombre: 'Comida a domicilio', icono: 'package' },
      { nombre: 'Otro alimentación', icono: 'utensils' },
    ],
  },
  {
    titulo: 'Transporte', icono: 'car',
    items: [
      { nombre: 'Gasolina',        icono: 'fuel' },
      { nombre: 'Mantenimiento auto', icono: 'wrench' },
      { nombre: 'Trámites y seguros', icono: 'file-text' },
      { nombre: 'Transporte público y apps', icono: 'bus' },
      { nombre: 'Otro transporte', icono: 'car' },
    ],
  },
  {
    titulo: 'Entretenimiento', icono: 'gamepad-2',
    items: [
      { nombre: 'Gaming',          icono: 'gamepad-2' },
      { nombre: 'Eventos y salidas', icono: 'music' },
      { nombre: 'Hobbies',         icono: 'palette' },
      { nombre: 'Otro entretenimiento', icono: 'tv' },
    ],
  },
  {
    titulo: 'Educación', icono: 'graduation-cap',
    items: [
      { nombre: 'Colegiaturas',    icono: 'graduation-cap' },
      { nombre: 'Material y libros', icono: 'book-open' },
      { nombre: 'Cursos y apps',   icono: 'laptop' },
      { nombre: 'Otro educación',  icono: 'graduation-cap' },
    ],
  },
  {
    titulo: 'Salud y cuidado', icono: 'heart-pulse',
    items: [
      { nombre: 'Médico y farmacia', icono: 'stethoscope' },
      { nombre: 'Ropa y calzado',  icono: 'shirt' },
      { nombre: 'Aseo personal',   icono: 'sparkles' },
      { nombre: 'Otro salud',      icono: 'heart-pulse' },
    ],
  },
  {
    titulo: 'Personas', icono: 'users',
    items: [
      { nombre: 'Citas',           icono: 'heart' },
      { nombre: 'Familia',         icono: 'users' },
      { nombre: 'Amigos',          icono: 'users' },
      { nombre: 'Regalos',         icono: 'gift' },
      { nombre: 'Otro personas',   icono: 'users' },
    ],
  },
  {
    titulo: 'Finanzas', icono: 'piggy-bank',
    items: [
      { nombre: 'Ahorro',          icono: 'piggy-bank',   special: 'ahorro' },
      { nombre: 'Pago de deudas',  icono: 'trending-down', special: 'pago_deuda' },
      { nombre: 'Comisiones e impuestos', icono: 'percent' },
      { nombre: 'Otro finanzas',   icono: 'coins' },
    ],
  },
  {
    titulo: 'Negocio', icono: 'briefcase',
    items: [
      { nombre: 'Inventario',      icono: 'box' },
      { nombre: 'Software y herramientas', icono: 'laptop' },
      { nombre: 'Publicidad y envíos', icono: 'megaphone' },
      { nombre: 'Otro negocio',    icono: 'briefcase' },
    ],
  },
];

// Mapa rápido nombre → {grupo, icono, special} para el picker de registro de gasto
const GASTOS_VARIABLES_INDEX = (() => {
  const idx = {};
  GASTOS_VARIABLES_CATALOGO.forEach(g => {
    g.items.forEach(it => {
      idx[it.nombre] = { grupo: g.titulo, grupoIcono: g.icono, icono: it.icono, special: it.special || null };
    });
  });
  return idx;
})();

// STEP 3: Gastos fijos
function renderStep3nuevo() {
  setHeader('Gastos fijos', 'Los que pagas sí o sí cada cierto tiempo.');

  window._showFijoCustomForm = false;
  window._fijoCustomNombre = '';
  window._fijoCustomIcono = 'receipt';
  window._showFijoIconPanel = false;

  if (!(window._fijoGruposAbiertos instanceof Set)) {
    window._fijoGruposAbiertos = new Set();
  }

  window.toggleFijoGrupo = function(titulo) {
    if (window._fijoGruposAbiertos.has(titulo)) {
      window._fijoGruposAbiertos.delete(titulo);
    } else {
      window._fijoGruposAbiertos.add(titulo);
    }
    if (window._renderStep3Body) window._renderStep3Body();
  };

  function render() {
    const fijosNombres = new Set(onboardingData.gastosFijos.map(f => f.nombre));

    const sugeridosHtml = `
      <div class="fijo-grupos">
        ${GASTOS_FIJOS_CATALOGO.map(grupo => {
          const seleccionados = grupo.items.filter(it => fijosNombres.has(it.nombre)).length;
          const abierto = window._fijoGruposAbiertos.has(grupo.titulo) || seleccionados > 0;
          return `
            <div class="fijo-grupo${abierto ? ' is-open' : ''}">
              <button type="button" class="fijo-grupo-header" onclick="toggleFijoGrupo('${grupo.titulo.replace(/'/g, "\\'")}')">
                <span class="fijo-grupo-title">
                  <i data-lucide="${grupo.icono}"></i>
                  <span>${grupo.titulo}</span>
                  ${seleccionados > 0 ? `<span class="fijo-grupo-count">${seleccionados}</span>` : ''}
                </span>
                <i data-lucide="chevron-down" class="fijo-grupo-chevron"></i>
              </button>
              ${abierto ? `
                <div class="fijo-grupo-body">
                  ${grupo.items.map(it => {
                    const added = fijosNombres.has(it.nombre);
                    const meta = JSON.stringify({ nombre: it.nombre, icono: it.icono, frecuencia: it.frecuencia || 'mensual', montoVariable: !!it.montoVariable }).replace(/"/g, '&quot;');
                    return `<button class="fijo-sugerido-chip${added ? ' added' : ''}" onclick="toggleGastoFijoSugerido(this)" data-item="${meta}">
                      <i data-lucide="${it.icono}"></i>
                      <span>${it.nombre}</span>
                    </button>`;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    const FRECUENCIA_OPTIONS = [
      ['semanal',    'Semanal'],
      ['quincenal',  'Quincenal'],
      ['mensual',    'Mensual'],
      ['bimestral',  'Bimestral'],
      ['trimestral', 'Trimestral'],
      ['semestral',  'Semestral'],
      ['anual',      'Anual'],
    ];

    const fijosAddedHtml = onboardingData.gastosFijos.length > 0 ? `
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
        ${onboardingData.gastosFijos.map((f, idx) => {
          const isVariable = f.monto_variable === true;
          const diaField = f.frecuencia === 'semanal'
            ? `<select class="form-select" id="gf-dia-${idx}" onchange="updateGastoFijo(${idx})">
                <option value="0" ${f.dia_semana === 0 ? 'selected':''}>Domingo</option>
                <option value="1" ${f.dia_semana === 1 ? 'selected':''}>Lunes</option>
                <option value="2" ${f.dia_semana === 2 ? 'selected':''}>Martes</option>
                <option value="3" ${f.dia_semana === 3 ? 'selected':''}>Miércoles</option>
                <option value="4" ${f.dia_semana === 4 ? 'selected':''}>Jueves</option>
                <option value="5" ${f.dia_semana === 5 ? 'selected':''}>Viernes</option>
                <option value="6" ${f.dia_semana === 6 ? 'selected':''}>Sábado</option>
               </select>`
            : `<input class="form-input" id="gf-prox-${idx}" type="date" value="${f.proximo_pago ?? ''}" onchange="updateGastoFijo(${idx})" />`;
          return `
            <div class="fijo-card">
              <div class="fijo-card-header">
                <div class="fijo-card-name">
                  <i data-lucide="${f.icono}"></i>
                  <span>${f.nombre}</span>
                </div>
                <button class="btn-remove" onclick="removeGastoFijo(${idx})">✕</button>
              </div>
              <div class="fijo-card-fields">
                <div class="tipo-monto-toggle" role="group" aria-label="Tipo de monto">
                  <button type="button" class="tipo-monto-opt${!isVariable ? ' active' : ''}" onclick="setFijoMontoVariable(${idx}, false)">Definido</button>
                  <button type="button" class="tipo-monto-opt${isVariable ? ' active' : ''}" onclick="setFijoMontoVariable(${idx}, true)">Variable</button>
                </div>
                ${isVariable ? `
                  <div class="fijo-hint">Cambia cada pago — solo te avisaremos la fecha.</div>
                ` : `
                  <div class="input-money-wrap">
                    <span class="currency-prefix">$</span>
                    <input class="form-input" id="gf-monto-${idx}" type="number" min="0" value="${f.monto ?? ''}" placeholder="Monto" onchange="updateGastoFijo(${idx})" />
                  </div>
                `}
                <select class="form-select" id="gf-freq-${idx}" onchange="updateGastoFijo(${idx})">
                  ${FRECUENCIA_OPTIONS.map(([v, l]) => `<option value="${v}" ${f.frecuencia === v ? 'selected':''}>${l}</option>`).join('')}
                </select>
                ${diaField}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    const fijoCustomFormHtml = window._showFijoCustomForm ? `
      <div class="custom-form" style="margin-top:14px">
        <div class="custom-form-row">
          <button class="emoji-picker-btn" onclick="toggleFijoIconPanel()">
            <i data-lucide="${window._fijoCustomIcono}"></i>
          </button>
          <input class="form-input" id="fijo-custom-nombre" value="${window._fijoCustomNombre || ''}" placeholder="Nombre del gasto fijo" oninput="window._fijoCustomNombre=this.value" />
        </div>
        ${window._showFijoIconPanel ? `
          <div class="icon-panel" style="margin-top:12px">
            <div class="icon-grid">
              ${TODOS_ICONOS.map(ic => `
                <div class="icon-grid-item${ic === window._fijoCustomIcono ? ' selected' : ''}" onclick="selectFijoIcono('${ic}')">
                  <i data-lucide="${ic}"></i>
                </div>`).join('')}
            </div>
          </div>
        ` : ''}
        <button class="btn btn-secondary" style="margin-top:12px;width:100%" onclick="addGastoFijoCustom()">+ Agregar</button>
      </div>
    ` : `
      <button class="btn-add-item" style="margin-top:14px" onclick="showFijoCustomForm()">
        <span>+</span> Agregar personalizado
      </button>
    `;

    document.getElementById('onboarding-body').innerHTML = `
      <div class="step-section-header">
        <div class="step-section-subtitle">Montos pueden ser definidos (igual cada vez, como renta o internet) o variables (cambian, como luz o agua). Solo los usamos para recordarte cuándo se acerca la fecha y que apartes dinero.</div>
      </div>
      ${sugeridosHtml}
      ${fijosAddedHtml}
      ${fijoCustomFormHtml}
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

// ---- Gastos Fijos (onboarding) ----
window.toggleGastoFijoSugerido = function(btnOrNombre, iconoOpt) {
  let nombre, icono, frecuencia = 'mensual', montoVariable = false;
  if (typeof btnOrNombre === 'string') {
    nombre = btnOrNombre;
    icono = iconoOpt || 'receipt';
  } else {
    try {
      const meta = JSON.parse(btnOrNombre.getAttribute('data-item'));
      nombre = meta.nombre;
      icono = meta.icono;
      frecuencia = meta.frecuencia || 'mensual';
      montoVariable = !!meta.montoVariable;
    } catch {
      return;
    }
  }
  const idx = onboardingData.gastosFijos.findIndex(f => f.nombre === nombre);
  if (idx >= 0) {
    onboardingData.gastosFijos.splice(idx, 1);
  } else {
    onboardingData.gastosFijos.push({
      nombre, icono,
      monto: null,
      monto_variable: montoVariable,
      frecuencia,
      dia_pago: null,
      dia_semana: null,
      proximo_pago: null,
    });
  }
  if (window._renderStep3Body) window._renderStep3Body();
};

window.removeGastoFijo = function(idx) {
  onboardingData.gastosFijos.splice(idx, 1);
  if (window._renderStep3Body) window._renderStep3Body();
};

window.setFijoMontoVariable = function(idx, isVariable) {
  const f = onboardingData.gastosFijos[idx];
  if (!f) return;
  f.monto_variable = !!isVariable;
  if (isVariable) f.monto = null;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.updateGastoFijo = function(idx) {
  const f = onboardingData.gastosFijos[idx];
  if (!f) return;
  const prevFreq = f.frecuencia;

  f.frecuencia = document.getElementById(`gf-freq-${idx}`)?.value || 'mensual';

  if (!f.monto_variable) {
    const monto = parseFloat(document.getElementById(`gf-monto-${idx}`)?.value);
    f.monto = Number.isFinite(monto) ? monto : null;
  } else {
    f.monto = null;
  }

  if (f.frecuencia === 'semanal') {
    const diaSemana = parseInt(document.getElementById(`gf-dia-${idx}`)?.value, 10);
    f.dia_semana = Number.isInteger(diaSemana) ? diaSemana : null;
    f.dia_pago = null;
    f.proximo_pago = null;
  } else {
    const prox = document.getElementById(`gf-prox-${idx}`)?.value || null;
    f.proximo_pago = prox || null;
    if (prox) {
      const dia = parseInt(prox.split('-')[2], 10);
      f.dia_pago = Number.isInteger(dia) ? dia : null;
    }
    f.dia_semana = null;
  }

  if (f.frecuencia !== prevFreq && window._renderStep3Body) window._renderStep3Body();
};

window.showFijoCustomForm = function() {
  window._showFijoCustomForm = true;
  window._fijoCustomNombre = '';
  window._fijoCustomIcono = 'receipt';
  window._showFijoIconPanel = false;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.toggleFijoIconPanel = function() {
  window._showFijoIconPanel = !window._showFijoIconPanel;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.selectFijoIcono = function(icono) {
  window._fijoCustomIcono = icono;
  window._showFijoIconPanel = false;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.addGastoFijoCustom = function() {
  const nombre = (window._fijoCustomNombre || document.getElementById('fijo-custom-nombre')?.value || '').trim();
  if (!nombre) { showSnackbar('Escribe el nombre del gasto fijo', 'error'); return; }
  onboardingData.gastosFijos.push({
    nombre,
    icono: window._fijoCustomIcono || 'receipt',
    monto: null,
    monto_variable: false,
    frecuencia: 'mensual',
    dia_pago: null,
    dia_semana: null,
    proximo_pago: null,
  });
  window._showFijoCustomForm = false;
  window._fijoCustomNombre = '';
  if (window._renderStep3Body) window._renderStep3Body();
};

function nextStep3nuevo() {
  const faltantes = onboardingData.gastosFijos.filter(f => !f.monto_variable && (!Number.isFinite(f.monto) || f.monto <= 0));
  if (faltantes.length > 0) {
    showSnackbar(`Falta monto en "${faltantes[0].nombre}" o márcalo como Variable`, 'error');
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

function renderStep6resumen() {
  setHeader('Todo listo, revisa tu configuración', 'Si algo no está bien, regresa a corregirlo.');

  const totalGastosFijos = onboardingData.gastosFijos.length;

  const sectionStyle = 'background:var(--bg-card);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:12px';

  const renderList = (items, emptyText = 'Ninguna', formatter = item => item) => {
    if (!items || items.length === 0) return `<p class="form-hint">${emptyText}</p>`;
    return `<div style="display:flex;flex-wrap:wrap;gap:8px">${items.map(item => `<span class="category-chip" style="cursor:default">${formatter(item)}</span>`).join('')}</div>`;
  };

  document.getElementById('onboarding-body').innerHTML = `
    <div style="${sectionStyle}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <strong>Ingresos</strong>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="renderStep(1)">Editar</button>
      </div>
      ${renderList(onboardingData.tiposIngreso, 'Ninguno', item => item.nombre)}
    </div>

    <div style="${sectionStyle}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <strong>Gastos fijos</strong>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="renderStep(2)">Editar</button>
      </div>
      <p class="form-hint" style="margin-bottom:8px">${totalGastosFijos} ${totalGastosFijos === 1 ? 'gasto fijo' : 'gastos fijos'}</p>
      ${renderList(onboardingData.gastosFijos, 'Ninguno', item => `${item.nombre}${item.monto_variable ? ' · variable' : (item.monto ? ` · ${formatMXN(item.monto)}` : '')}`)}
    </div>

    <div style="${sectionStyle}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <strong>Cuentas</strong>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="renderStep(3)">Editar</button>
      </div>
      ${onboardingData.cuentas.length === 0 ? '<p class="form-hint">Ninguna</p>' : onboardingData.cuentas.map(c => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <span>${c.nombre}</span>
          <span style="color:var(--text-secondary)">${formatMXN(c.saldo_inicial || 0)}</span>
        </div>
      `).join('')}
    </div>

    <div style="${sectionStyle}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <strong>Deudas</strong>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="renderStep(4)">Editar</button>
      </div>
      ${onboardingData.deudas.length === 0 ? '<p class="form-hint">Ninguna</p>' : onboardingData.deudas.map(d => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <span>${d.acreedor}</span>
          <span style="color:var(--text-secondary)">${formatMXN(d.monto_actual || 0)}</span>
        </div>
      `).join('')}
    </div>

    <div style="${sectionStyle}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <strong>Metas</strong>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="renderStep(5)">Editar</button>
      </div>
      ${onboardingData.metas.length === 0 ? '<p class="form-hint">Ninguna</p>' : onboardingData.metas.map(m => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <span>${m.nombre}</span>
          <span style="color:var(--text-secondary)">${formatMXN(m.monto_objetivo || 0)}</span>
        </div>
      `).join('')}
    </div>
  `;

  setFooter(`
    <button class="btn btn-success" id="btn-finish" onclick="finishOnboarding()">¡Listo, empecemos! 🚀</button>
    <button class="btn btn-ghost mt-8" onclick="renderStep(5)">← Atrás</button>
  `);

  renderLucideIcons();
}


function renderStep6() {
  window._metaSelectedIcono = window._metaSelectedIcono || 'target';
  window._metaIconPanelOpen = false;
  setHeader('¿Para qué quieres ahorrar?', 'Define tus metas. Las iremos completando juntos poco a poco.');
  renderStep6Body();
  setFooter(`
    <button class="btn btn-primary" onclick="nextStep6()">Continuar →</button>
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
      <div class="custom-form-row" style="margin-bottom:10px">
        <button class="emoji-picker-btn" onclick="toggleMetaIconPanel()">
          ${window._metaSelectedIcono ? `<i data-lucide="${window._metaSelectedIcono}"></i>` : '+'}
        </button>
        <input class="form-input" id="m-nombre" placeholder="Nombre de la meta" style="margin:0" />
      </div>
      ${window._metaIconPanelOpen ? `
        <div class="icon-panel" style="margin-bottom:10px">
          <div class="icon-grid">
            ${TODOS_ICONOS.map(ic => `
              <div class="icon-grid-item${selectedIcono === ic ? ' selected' : ''}" onclick="selectIconoMeta('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
        </div>
      ` : ''}
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
  window._metaSelectedIcono = icono;
  window._metaIconPanelOpen = false;
  renderStep6Body(true, icono);
};

window.toggleMetaIconPanel = function() {
  window._metaIconPanelOpen = !window._metaIconPanelOpen;
  renderStep6Body(true, window._metaSelectedIcono || 'target');
};

function addMeta() {
  const icono = window._metaSelectedIcono || 'target';
  const nombre = document.getElementById('m-nombre')?.value.trim();
  const monto_objetivo = parseFloat(document.getElementById('m-monto')?.value);
  const cuenta_nombre = document.getElementById('m-cuenta-nombre')?.value || null;
  if (!nombre || !monto_objetivo) { showSnackbar('Completa nombre y monto', 'error'); return; }
  onboardingData.metas.push({ icono, nombre, monto_objetivo, cuenta_nombre });
  window._metaSelectedIcono = 'target';
  window._metaIconPanelOpen = false;
  renderStep6Body(false);
}

function removeMeta(i) {
  onboardingData.metas.splice(i, 1);
  renderStep6Body(false);
}

function nextStep6() {
  renderStep(6);
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

    // 3. Sembrar categorías de gasto predefinidas (picker agrupado)
    const cats_gasto_predef = GASTOS_VARIABLES_CATALOGO.flatMap(g => g.items.map(it => ({
      nombre: it.nombre,
      emoji: it.icono,
      tipo: 'gasto',
      usuario_id: userId,
      es_default: true
    })));
    if (cats_gasto_predef.length > 0) {
      await db.from('categorias').insert(cats_gasto_predef);
    }

    // Insertar gastos fijos (la categoría_id se resuelve por nombre si existe)
    if (onboardingData.gastosFijos.length > 0) {
      const { data: categoriasGasto } = await db
        .from('categorias')
        .select('id, nombre')
        .eq('usuario_id', userId)
        .eq('tipo', 'gasto');
      const catNombreAId = {};
      (categoriasGasto || []).forEach(c => { catNombreAId[c.nombre] = c.id; });

      const fijos = onboardingData.gastosFijos.map(f => ({
        descripcion: f.nombre,
        monto: f.monto_variable ? null : (f.monto ?? null),
        monto_variable: !!f.monto_variable,
        frecuencia: f.frecuencia || 'mensual',
        dia_pago: f.dia_pago ?? null,
        dia_semana: f.dia_semana ?? null,
        proximo_pago: f.proximo_pago ?? null,
        usuario_id: userId,
        categoria_id: catNombreAId[f.nombre] || null
      }));
      const { error: errFijos } = await db.from('gastos_fijos').insert(fijos);
      if (errFijos) {
        // Fallback: si la migración aún no corrió, reintentar sin las columnas nuevas.
        const fijosLegacy = fijos.map(({ monto_variable, proximo_pago, ...rest }) => ({
          ...rest,
          monto: rest.monto ?? 0,
        }));
        await db.from('gastos_fijos').insert(fijosLegacy);
      }
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
export async function loadDashboard() {
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
                <div class="item-row-amount">${p.monto_variable && !p.monto ? 'Variable' : formatMXN(p.monto)}</div>
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

  if (frecuencia === 'unico') {
    campos.innerHTML = `
      <label class="form-label">Día de pago</label>
      <input class="form-input" id="ed-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Día del mes que pagas</label>
      <input class="form-input" id="ed-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="ed-dia-semana">
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
      <input class="form-input" id="ed-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" />
    `;
    return;
  }

  campos.innerHTML = '';
}

async function openEditarDeuda(deudaId) {
  const { data: deuda, error } = await db
    .from('deudas')
    .select('id, acreedor, monto_actual, tipo_pago, dia_pago, dia_semana, monto_pago, tipo_deuda')
    .eq('id', deudaId)
    .eq('usuario_id', (await getUsuarioId()))
    .maybeSingle();

  if (error || !deuda) {
    showSnackbar('No se pudo cargar la deuda', 'error');
    return;
  }

  const esTabla = deuda.tipo_deuda === 'tabla';
  const frecuenciaInicial = deuda.tipo_pago || 'libre';

  const formFrecuencia = esTabla ? '' : `
    <div class="form-group">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="ed-freq" onchange="renderCamposFechaEditarDeuda()">
        <option value="unico" ${frecuenciaInicial === 'unico' ? 'selected' : ''}>Pago único</option>
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
  `;

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
    ${formFrecuencia}
    ${esTabla ? '<p class="form-hint" style="margin-bottom:8px">Esta deuda tiene una tabla de pagos programados.</p>' : ''}
    <button class="btn btn-primary" onclick="guardarEdicionDeuda('${deuda.id}', ${esTabla})">Guardar cambios</button>
  `);

  if (!esTabla) {
    renderCamposFechaEditarDeuda();

    if (frecuenciaInicial === 'semanal') {
      const inputSemana = document.getElementById('ed-dia-semana');
      if (inputSemana && deuda.dia_semana !== null && deuda.dia_semana !== undefined) {
        inputSemana.value = String(deuda.dia_semana);
      }
    } else if (frecuenciaInicial === 'mensual' || frecuenciaInicial === 'quincenal' || frecuenciaInicial === 'unico') {
      const inputDia = document.getElementById('ed-dia-pago');
      if (inputDia && deuda.dia_pago) {
        inputDia.value = String(deuda.dia_pago);
      }
    }
  }

  renderLucideIcons();
}

async function guardarEdicionDeuda(deudaId, esTabla = false) {
  const acreedor = document.getElementById('ed-acreedor')?.value.trim();
  const monto_actual = parseFloat(document.getElementById('ed-monto')?.value);

  if (!acreedor || Number.isNaN(monto_actual) || monto_actual < 0) {
    showSnackbar('Completa los campos requeridos', 'error');
    return;
  }

  const payload = { acreedor, monto_actual, activa: monto_actual > 0 };

  if (!esTabla) {
    const tipo_pago = document.getElementById('ed-freq')?.value || 'libre';
    const monto_pagoValor = document.getElementById('ed-monto-pago')?.value;
    const monto_pago = monto_pagoValor ? parseFloat(monto_pagoValor) : null;

    let dia_pago = null;
    let dia_semana = null;

    if (tipo_pago === 'semanal') {
      dia_semana = parseInt(document.getElementById('ed-dia-semana')?.value, 10);
      if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
        showSnackbar('Selecciona un día de la semana válido', 'error');
        return;
      }
    } else if (tipo_pago === 'mensual' || tipo_pago === 'unico') {
      dia_pago = parseInt(document.getElementById('ed-dia-pago')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
        showSnackbar('Ingresa un día del mes entre 1 y 31', 'error');
        return;
      }
    } else if (tipo_pago === 'quincenal') {
      dia_pago = parseInt(document.getElementById('ed-dia-pago')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
        showSnackbar('Ingresa un día de la quincena entre 1 y 15', 'error');
        return;
      }
    }

    if (monto_pago !== null && (Number.isNaN(monto_pago) || monto_pago < 0)) {
      showSnackbar('Monto por pago inválido', 'error');
      return;
    }

    payload.tipo_pago = tipo_pago;
    payload.dia_pago = dia_pago;
    payload.dia_semana = dia_semana;
    payload.monto_pago = monto_pago;
  }

  const { error } = await db
    .from('deudas')
    .update(payload)
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
                <span style="font-size:28px;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px">${renderEmojiOrIcon(m.emoji, 'target', 22)}</span>
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
    showSnackbar('Ingresa un monto válido', 'error');
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
  const sinCuentaSelected = !meta.cuenta_id ? 'selected' : '';
  const iconoInicial = (meta.emoji && /^[a-z][a-z0-9-]*$/.test(meta.emoji)) ? meta.emoji : 'target';

  window._editMetaIcono = iconoInicial;
  window._editMetaIconPanelOpen = false;
  window._editMetaMeta = { ...meta, cuentasOptions, sinCuentaSelected };

  renderEditarMetaModal();
}

function renderEditarMetaModal() {
  const meta = window._editMetaMeta;
  const icono = window._editMetaIcono;
  const panelAbierto = window._editMetaIconPanelOpen;

  openModal('Editar meta', `
    <div class="form-group">
      <label class="form-label">Icono</label>
      <div class="custom-form-row" style="align-items:center">
        <button type="button" class="emoji-picker-btn" onclick="toggleEditMetaIconPanel()">
          <i data-lucide="${icono}"></i>
        </button>
        <span style="font-size:13px;color:var(--text-secondary);margin-left:10px">Toca el icono para cambiarlo</span>
      </div>
      ${panelAbierto ? `
        <div class="icon-panel" style="margin-top:10px">
          <div class="icon-grid">
            ${TODOS_ICONOS.map(ic => `
              <div class="icon-grid-item${icono === ic ? ' selected' : ''}" onclick="selectEditMetaIcono('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
        </div>
      ` : ''}
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
        <option value="" ${meta.sinCuentaSelected}>Sin cuenta vinculada</option>
        ${meta.cuentasOptions}
      </select>
    </div>
    <button class="btn btn-primary" onclick="guardarEdicionMeta('${meta.id}')">Guardar cambios</button>
  `);
}

window.toggleEditMetaIconPanel = function() {
  const nombre = document.getElementById('em-nombre')?.value;
  const monto = document.getElementById('em-monto')?.value;
  const cuenta = document.getElementById('meta-cuenta-id')?.value;
  if (nombre !== undefined) window._editMetaMeta.nombre = nombre;
  if (monto !== undefined) window._editMetaMeta.monto_objetivo = monto;
  window._editMetaIconPanelOpen = !window._editMetaIconPanelOpen;
  renderEditarMetaModal();
  if (cuenta !== undefined) {
    const sel = document.getElementById('meta-cuenta-id');
    if (sel) sel.value = cuenta;
  }
};

window.selectEditMetaIcono = function(ic) {
  const nombre = document.getElementById('em-nombre')?.value;
  const monto = document.getElementById('em-monto')?.value;
  const cuenta = document.getElementById('meta-cuenta-id')?.value;
  if (nombre !== undefined) window._editMetaMeta.nombre = nombre;
  if (monto !== undefined) window._editMetaMeta.monto_objetivo = monto;
  window._editMetaIcono = ic;
  window._editMetaIconPanelOpen = false;
  renderEditarMetaModal();
  if (cuenta !== undefined) {
    const sel = document.getElementById('meta-cuenta-id');
    if (sel) sel.value = cuenta;
  }
};

async function guardarEdicionMeta(metaId) {
  const emoji = window._editMetaIcono || 'target';
  const nombre = document.getElementById('em-nombre')?.value.trim();
  const monto_objetivo = parseFloat(document.getElementById('em-monto')?.value);
  const cuenta_id = document.getElementById('meta-cuenta-id')?.value || null;

  if (!nombre || Number.isNaN(monto_objetivo) || monto_objetivo <= 0) {
    showSnackbar('Completa nombre y monto objetivo', 'error');
    return;
  }

  const { error } = await db
    .from('metas_ahorro')
    .update({ emoji, nombre, monto_objetivo, cuenta_id: cuenta_id || null })
    .eq('id', metaId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo actualizar la meta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Meta actualizada ✓', 'success');
  await loadMetas();
  await loadDashboard();
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
  await loadDashboard();
}

// ---- GASTOS FIJOS ----
const FRECUENCIA_LABEL = {
  semanal:    'Semanal',
  quincenal:  'Quincenal',
  mensual:    'Mensual',
  bimestral:  'Bimestral',
  trimestral: 'Trimestral',
  semestral:  'Semestral',
  anual:      'Anual',
};

function formatearFrecuenciaGastoFijo(frecuencia, diaPago, diaSemana, proximoPago) {
  const diasSemana = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  const base = FRECUENCIA_LABEL[frecuencia] || frecuencia || 'Sin frecuencia';

  if (frecuencia === 'semanal') {
    const dia = Number.isInteger(diaSemana) && diaSemana >= 0 && diaSemana <= 6 ? diasSemana[diaSemana] : null;
    return `${base}${dia ? ` · ${dia}` : ''}`;
  }

  if (proximoPago) {
    const d = new Date(proximoPago);
    if (!Number.isNaN(d.getTime())) {
      const opts = { day: 'numeric', month: 'short' };
      return `${base} · próx. ${d.toLocaleDateString('es-MX', opts)}`;
    }
  }

  if (diaPago) return `${base} · día ${diaPago}`;
  return base;
}

async function loadFijos() {
  const uid = (await getUsuarioId());
  const { data: fijos, error } = await db
    .from('gastos_fijos')
    .select('*, categorias(emoji)')
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
      ` : fijos.map(g => {
        const iconoHtml = renderEmojiOrIcon(g.categorias?.emoji, 'pin', 18);
        const isVariable = g.monto_variable === true || g.monto == null;
        const montoTxt = isVariable ? 'Variable' : formatMXN(g.monto);
        return `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji">${iconoHtml}</div>
          <div class="item-row-info">
            <div class="item-row-name">${g.descripcion}</div>
            <div class="item-row-detail">${formatearFrecuenciaGastoFijo(g.frecuencia, g.dia_pago, g.dia_semana, g.proximo_pago)}</div>
          </div>
          <div class="item-row-amount" style="color:var(--red)">${montoTxt}</div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuGastoFijo('${g.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
        </div>
      `;
      }).join('')}
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

const FRECUENCIAS_FIJO_UI = [
  ['semanal',    'Semanal'],
  ['quincenal',  'Quincenal'],
  ['mensual',    'Mensual'],
  ['bimestral',  'Bimestral'],
  ['trimestral', 'Trimestral'],
  ['semestral',  'Semestral'],
  ['anual',      'Anual'],
];

function frecuenciaSelectHtml(id, onchange, selected) {
  return `<select class="form-select" id="${id}" onchange="${onchange}">
    ${FRECUENCIAS_FIJO_UI.map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('')}
  </select>`;
}

function renderCamposFechaFijo(prefix, initial = {}) {
  const frecuencia = document.getElementById(`${prefix}-freq`)?.value;
  const campos = document.getElementById(`${prefix}-fecha-campos`);
  if (!campos) return;

  // Preservar valores actuales si el usuario los ingresó
  const previoProx = document.getElementById(`${prefix}-prox`)?.value;
  const previoDiaSemana = document.getElementById(`${prefix}-dia-semana`)?.value;
  const diaSemanaInicial = Number.isInteger(initial.dia_semana)
    ? initial.dia_semana
    : (previoDiaSemana !== undefined ? parseInt(previoDiaSemana, 10) : null);
  const proxInicial = initial.proximo_pago || previoProx || '';

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="${prefix}-dia-semana">
        ${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
          .map((d, i) => `<option value="${i}" ${diaSemanaInicial === i ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
    `;
    return;
  }

  campos.innerHTML = `
    <label class="form-label">Próximo pago</label>
    <input class="form-input" id="${prefix}-prox" type="date" value="${proxInicial}" />
  `;
}

window.setFijoMontoVariableModal = function(prefix, isVariable) {
  const toggleRoot = document.getElementById(`${prefix}-tipo-monto`);
  const montoWrap = document.getElementById(`${prefix}-monto-wrap`);
  const hint = document.getElementById(`${prefix}-hint`);
  if (!toggleRoot) return;
  toggleRoot.dataset.variable = isVariable ? '1' : '0';
  toggleRoot.querySelectorAll('.tipo-monto-opt').forEach((btn, i) => {
    const matches = (i === 0 && !isVariable) || (i === 1 && isVariable);
    btn.classList.toggle('active', matches);
  });
  if (montoWrap) montoWrap.style.display = isVariable ? 'none' : '';
  if (hint) hint.style.display = isVariable ? '' : 'none';
};

function tipoMontoToggleHtml(prefix, isVariable) {
  return `
    <div class="tipo-monto-toggle" id="${prefix}-tipo-monto" role="group" data-variable="${isVariable ? '1' : '0'}">
      <button type="button" class="tipo-monto-opt${!isVariable ? ' active' : ''}" onclick="setFijoMontoVariableModal('${prefix}', false)">Definido</button>
      <button type="button" class="tipo-monto-opt${isVariable ? ' active' : ''}" onclick="setFijoMontoVariableModal('${prefix}', true)">Variable</button>
    </div>
  `;
}

async function openEditarGastoFijo(gastoFijoId) {
  const uid = (await getUsuarioId());
  const [
    { data: gasto, error },
    { data: categorias }
  ] = await Promise.all([
    db.from('gastos_fijos')
      .select('*')
      .eq('id', gastoFijoId)
      .eq('usuario_id', uid)
      .maybeSingle(),
    db.from('categorias').select('id, nombre, emoji').eq('usuario_id', uid).eq('tipo', 'gasto').order('nombre', { ascending: true })
  ]);

  if (error || !gasto) {
    showSnackbar('No se pudo cargar el gasto fijo', 'error');
    return;
  }

  const isVariable = gasto.monto_variable === true || (gasto.monto == null);
  const catOptions = (categorias || []).map(c => `<option value="${c.id}" ${c.id === gasto.categoria_id ? 'selected' : ''}>${c.nombre}</option>`).join('');
  const sinCatSel = !gasto.categoria_id ? 'selected' : '';

  openModal('Editar gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="egf-desc" type="text" value="${gasto.descripcion || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de monto</label>
      ${tipoMontoToggleHtml('egf', isVariable)}
    </div>
    <div class="form-group" id="egf-monto-wrap" style="${isVariable ? 'display:none' : ''}">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="egf-monto" type="number" min="0" value="${gasto.monto != null ? Number(gasto.monto) : ''}" /></div>
    </div>
    <p class="form-hint" id="egf-hint" style="${isVariable ? '' : 'display:none'};margin:-8px 0 12px">Cambia cada pago — solo te avisaremos la fecha.</p>
    <div class="form-group">
      <label class="form-label">Categoría (define el icono)</label>
      <select class="form-select" id="egf-cat">
        <option value="" ${sinCatSel}>Sin categoría</option>
        ${catOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia</label>
      ${frecuenciaSelectHtml('egf-freq', "renderCamposFechaFijo('egf')", gasto.frecuencia || 'mensual')}
    </div>
    <div class="form-group" id="egf-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarEdicionGastoFijo('${gasto.id}')">Guardar cambios</button>
  `);

  renderCamposFechaFijo('egf', {
    dia_semana: gasto.dia_semana,
    proximo_pago: gasto.proximo_pago || null,
  });

  renderLucideIcons();
}

async function guardarEdicionGastoFijo(gastoFijoId) {
  const descripcion = document.getElementById('egf-desc')?.value.trim();
  const toggleRoot = document.getElementById('egf-tipo-monto');
  const isVariable = toggleRoot?.dataset.variable === '1';
  const frecuencia = document.getElementById('egf-freq')?.value;
  const categoria_id = document.getElementById('egf-cat')?.value || null;

  if (!descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  let monto = null;
  if (!isVariable) {
    monto = parseFloat(document.getElementById('egf-monto')?.value);
    if (Number.isNaN(monto) || monto <= 0) {
      showSnackbar('Ingresa un monto válido o marca como variable', 'error');
      return;
    }
  }

  let dia_semana = null;
  let dia_pago = null;
  let proximo_pago = null;

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('egf-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un día de la semana', 'error');
      return;
    }
  } else {
    proximo_pago = document.getElementById('egf-prox')?.value || null;
    if (proximo_pago) {
      const dia = parseInt(proximo_pago.split('-')[2], 10);
      dia_pago = Number.isInteger(dia) ? dia : null;
    }
  }

  const payload = { descripcion, monto, monto_variable: isVariable, frecuencia, dia_pago, dia_semana, proximo_pago, categoria_id };
  let { error } = await db.from('gastos_fijos').update(payload).eq('id', gastoFijoId).eq('usuario_id', (await getUsuarioId()));

  if (error) {
    const { monto_variable, proximo_pago: _p, ...legacy } = payload;
    legacy.monto = monto ?? 0;
    ({ error } = await db.from('gastos_fijos').update(legacy).eq('id', gastoFijoId).eq('usuario_id', (await getUsuarioId())));
  }

  if (error) {
    showSnackbar('No se pudo actualizar el gasto fijo', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto fijo actualizado ✓', 'success');
  await loadFijos();
  await loadDashboard();
}

async function openAgregarGastoFijo() {
  const uid = (await getUsuarioId());
  const { data: categorias } = await db.from('categorias').select('id, nombre, emoji').eq('usuario_id', uid).eq('tipo', 'gasto').order('nombre', { ascending: true });
  const catOptions = (categorias || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  openModal('Nuevo gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="fgf-desc" type="text" placeholder="Ej: Internet, renta, gimnasio" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de monto</label>
      ${tipoMontoToggleHtml('fgf', false)}
    </div>
    <div class="form-group" id="fgf-monto-wrap">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="fgf-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <p class="form-hint" id="fgf-hint" style="display:none;margin:-8px 0 12px">Cambia cada pago — solo te avisaremos la fecha.</p>
    <div class="form-group">
      <label class="form-label">Categoría (define el icono)</label>
      <select class="form-select" id="fgf-cat">
        <option value="">Sin categoría</option>
        ${catOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia</label>
      ${frecuenciaSelectHtml('fgf-freq', "renderCamposFechaFijo('fgf')", 'mensual')}
    </div>
    <div class="form-group" id="fgf-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarNuevoGastoFijo()">Guardar</button>
  `);

  renderCamposFechaFijo('fgf');
}

async function guardarNuevoGastoFijo() {
  const descripcion = document.getElementById('fgf-desc')?.value.trim();
  const toggleRoot = document.getElementById('fgf-tipo-monto');
  const isVariable = toggleRoot?.dataset.variable === '1';
  const frecuencia = document.getElementById('fgf-freq')?.value;
  const categoria_id = document.getElementById('fgf-cat')?.value || null;

  if (!descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  let monto = null;
  if (!isVariable) {
    monto = parseFloat(document.getElementById('fgf-monto')?.value);
    if (Number.isNaN(monto) || monto <= 0) {
      showSnackbar('Ingresa un monto válido o marca como variable', 'error');
      return;
    }
  }

  let dia_semana = null;
  let dia_pago = null;
  let proximo_pago = null;

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('fgf-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un día de la semana', 'error');
      return;
    }
  } else {
    proximo_pago = document.getElementById('fgf-prox')?.value || null;
    if (proximo_pago) {
      const dia = parseInt(proximo_pago.split('-')[2], 10);
      dia_pago = Number.isInteger(dia) ? dia : null;
    }
  }

  const payload = {
    usuario_id: (await getUsuarioId()),
    descripcion,
    monto,
    monto_variable: isVariable,
    frecuencia,
    dia_pago,
    dia_semana,
    proximo_pago,
    categoria_id,
    activo: true,
  };

  let { error } = await db.from('gastos_fijos').insert(payload);
  if (error) {
    const { monto_variable, proximo_pago: _p, ...legacy } = payload;
    legacy.monto = monto ?? 0;
    ({ error } = await db.from('gastos_fijos').insert(legacy));
  }

  if (error) {
    showSnackbar('No se pudo guardar el gasto fijo', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto fijo guardado ✓', 'success');
  await loadFijos();
  await loadDashboard();
}

async function eliminarGastoFijo(gastoFijoId) {
  if (!window.confirm('¿Eliminar este gasto fijo?')) return;

  const { error } = await db
    .from('gastos_fijos')
    .update({ activo: false })
    .eq('id', gastoFijoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar el gasto fijo', 'error');
    return;
  }

  showSnackbar('Gasto fijo eliminado', 'success');
  await loadFijos();
  await loadDashboard();
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
          <div class="item-row-emoji">${g.categorias?.emoji ? renderEmojiOrIcon(g.categorias.emoji, 'package', 18) : getCategoriaGastoIcon(g.categorias?.nombre)}</div>
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
    db.from('ingresos').select('*, categorias(nombre, emoji)').eq('usuario_id', uid).order('fecha', { ascending: false }).limit(50)
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
        const nombre = i.descripcion?.trim() || i.categorias?.nombre || formatIngresoTipo(i.tipo);
        const iconoHtml = i.categorias?.emoji
          ? renderEmojiOrIcon(i.categorias.emoji, 'plus-circle', 18)
          : getIngresoTipoIcon(i.tipo);
        return `
          <div class="item-row" style="margin-bottom:8px">
            <div class="item-row-emoji">${iconoHtml}</div>
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
      <button onclick="openRegistrarIngreso()" style="background:var(--green-soft);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:8px 14px;color:var(--green);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Nuevo</button>
    </div>
    <div class="page-body">
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:14px">Programados</div>
          <button onclick="openAgregarIngresoProgramado()" style="background:var(--green-soft);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:8px 12px;color:var(--green);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body)">+ Agregar</button>
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
      <label class="form-label">Día del mes</label>
      <input class="form-input" id="eip-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="eip-dia-semana">
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
      <label class="form-label">Descripción</label>
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
    showSnackbar('Completa descripción y monto', 'error');
    return;
  }

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('eip-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un día de la semana válido', 'error');
      return;
    }
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById('eip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un día del mes entre 1 y 31', 'error');
      return;
    }
  } else if (frecuencia === 'quincenal') {
    dia_pago = parseInt(document.getElementById('eip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un día de la quincena entre 1 y 15', 'error');
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

// ---- AJUSTES ----
function formatearFrecuenciaIngresoProgramado(frecuencia, diaPago, diaSemana) {
  const diasSemana = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

  if (frecuencia === 'mensual') {
    return `Mensual${diaPago ? ` · día ${diaPago}` : ''}`;
  }

  if (frecuencia === 'quincenal') {
    return `Quincenal${diaPago ? ` · día ${diaPago}` : ''}`;
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
      <label class="form-label">Descripción</label>
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
      <label class="form-label">Día del mes</label>
      <input class="form-input" id="ip-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="ip-dia-semana">
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
    showSnackbar('Completa descripción y monto', 'error');
    return;
  }

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('ip-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un día de la semana válido', 'error');
      return;
    }
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById('ip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
      showSnackbar('Ingresa un día del mes entre 1 y 31', 'error');
      return;
    }
  } else if (frecuencia === 'quincenal') {
    dia_pago = parseInt(document.getElementById('ip-dia-pago')?.value, 10);
    if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 15) {
      showSnackbar('Ingresa un día de la quincena entre 1 y 15', 'error');
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

async function resetApp() {
  if (!window.confirm('¿Cerrar sesión y reiniciar la app?')) return;
  localStorage.removeItem('jmf_usuario_id');
  await db.auth.signOut();
  location.reload();
}

// ---- MODALES ----

let currentCatId = null;
let currentCatTipo = null;
let currentCatMeta = null;
let currentIngresoTipo = 'otro';
window._categoriaSelectorItems = [];

function getCategoriaIcono(item, fallback = 'package') {
  return item?.emoji || item?.icono || fallback;
}

function actualizarBotonCategoriaSelector() {
  const btn = document.getElementById('btn-cat-selector');
  if (!btn) return;

  const icono = getCategoriaIcono(currentCatMeta, currentCatTipo === 'ingreso' ? 'wallet' : 'package');
  const nombre = currentCatMeta?.nombre || (currentCatTipo === 'ingreso' ? 'Selecciona tipo' : 'Selecciona categoría');

  btn.innerHTML = `
    <i data-lucide="${icono}" class="cat-btn-icon"></i>
    <span class="cat-btn-label">${nombre}</span>
    <i data-lucide="chevron-down" class="cat-btn-chevron"></i>
  `;

  renderLucideIcons();
}

function closeSelectorCategoriaSheet() {
  const overlay = document.getElementById('categoria-selector-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => overlay.remove(), 180);
}

function seleccionarCategoriaDesdeSheet(index) {
  const item = window._categoriaSelectorItems[index];
  if (!item) return;

  currentCatId = item.id ?? null;
  currentCatMeta = item;
  currentCatTipo = item.tipoSelector;

  if (currentCatTipo === 'ingreso') {
    currentIngresoTipo = item.special === 'prestamo' ? 'prestamo' : 'otro';
    toggleCamposPrestamo();
  }

  if (currentCatTipo === 'gasto') {
    window._gastoEspecial = item.special || null;
    toggleCamposGastoEspecial();
  }

  actualizarBotonCategoriaSelector();
  closeSelectorCategoriaSheet();
}

async function abrirSelectorCategoria(tipo) {
  if (tipo === 'gasto') {
    return abrirSelectorGasto();
  }

  const usuarioId = await getUsuarioId();
  const { data: categorias } = await db
    .from('categorias')
    .select('id, nombre, emoji, es_default')
    .eq('usuario_id', usuarioId)
    .eq('tipo', tipo)
    .order('nombre', { ascending: true });

  const personalizadas = (categorias || []).filter(c => c.es_default === false).map(c => ({ ...c, tipoSelector: tipo }));
  const resto = (categorias || []).filter(c => c.es_default !== false).map(c => ({ ...c, tipoSelector: tipo }));

  const secciones = [];
  if (personalizadas.length > 0) secciones.push({ titulo: 'Personalizadas', items: personalizadas });
  if (resto.length > 0) secciones.push({ titulo: 'Categorías', items: resto });

  if (tipo === 'ingreso') {
    secciones.push({
      titulo: 'Opciones',
      items: [
        { id: null, nombre: 'Otro', emoji: 'circle', special: 'otro', tipoSelector: 'ingreso' },
        { id: null, nombre: 'Préstamo recibido', emoji: 'handshake', special: 'prestamo', tipoSelector: 'ingreso' }
      ]
    });
  }

  const flatItems = [];
  const html = secciones.map(sec => {
    const sectionHtml = sec.items.map(item => {
      const idx = flatItems.push(item) - 1;
      return `
        <button class="category-item" style="width:100%" onclick="seleccionarCategoriaDesdeSheet(${idx})">
          <i data-lucide="${getCategoriaIcono(item, tipo === 'ingreso' ? 'wallet' : 'package')}" class="cat-icon"></i>
          <span class="cat-name">${item.nombre}</span>
        </button>
      `;
    }).join('');

    return `
      <div style="margin-bottom:12px">
        <div class="category-group-title" style="margin-top:0">${sec.titulo}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${sectionHtml}</div>
      </div>
    `;
  }).join('');

  window._categoriaSelectorItems = flatItems;

  const old = document.getElementById('categoria-selector-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'categoria-selector-overlay';
  overlay.className = 'modal-overlay categoria-selector-overlay';
  overlay.innerHTML = `
    <div class="bottom-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">Selecciona ${tipo === 'ingreso' ? 'tipo de ingreso' : 'categoría'}</h3>
      ${html || '<p class="form-hint">No hay categorías disponibles.</p>'}
    </div>
  `;
  overlay.addEventListener('click', closeSelectorCategoriaSheet);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  renderLucideIcons();
}

// ---- Picker agrupado de GASTO (con recientes + subgrupos) ----
async function abrirSelectorGasto() {
  const usuarioId = await getUsuarioId();

  const [catsRes, gastosRes] = await Promise.all([
    db.from('categorias').select('id, nombre, emoji, es_default').eq('usuario_id', usuarioId).eq('tipo', 'gasto').order('nombre', { ascending: true }),
    db.from('gastos').select('categoria_id, fecha').eq('usuario_id', usuarioId).order('fecha', { ascending: false }).limit(40)
  ]);

  const categorias = catsRes.data || [];
  const catByNombre = Object.fromEntries(categorias.map(c => [c.nombre, c]));
  const catById = Object.fromEntries(categorias.map(c => [c.id, c]));

  // Top 5 categorías más recientes (únicas)
  const recientes = [];
  const seen = new Set();
  for (const g of (gastosRes.data || [])) {
    if (!g.categoria_id || seen.has(g.categoria_id) || !catById[g.categoria_id]) continue;
    recientes.push(catById[g.categoria_id]);
    seen.add(g.categoria_id);
    if (recientes.length >= 5) break;
  }

  // Personalizadas que no están en el catálogo predefinido
  const personalizadas = categorias.filter(c => c.es_default === false && !GASTOS_VARIABLES_INDEX[c.nombre]);

  window._gastoPickerCache = { categorias, catByNombre, recientes, personalizadas };
  renderGastoPickerSheet();
}

function renderGastoPickerSheet() {
  const cache = window._gastoPickerCache;
  if (!cache) return;
  const { catByNombre, recientes, personalizadas } = cache;

  if (!(window._gastoGruposAbiertos instanceof Set)) {
    window._gastoGruposAbiertos = new Set();
  }

  const flatItems = [];
  const pushItem = (cat, special = null) => {
    const item = { id: cat.id ?? null, nombre: cat.nombre, emoji: cat.emoji || 'package', tipoSelector: 'gasto', special };
    flatItems.push(item);
    return flatItems.length - 1;
  };

  const chipHtml = (cat, special = null, iconoFallback = null) => {
    const idx = pushItem(cat, special);
    const icono = cat.emoji || iconoFallback || 'package';
    return `<button class="fijo-sugerido-chip" onclick="seleccionarCategoriaDesdeSheet(${idx})">
      <i data-lucide="${icono}"></i>
      <span>${cat.nombre}</span>
    </button>`;
  };

  const recientesHtml = recientes.length > 0 ? `
    <div class="gasto-pick-section">
      <div class="gasto-pick-section-label"><i data-lucide="clock"></i>Recientes</div>
      <div class="gasto-pick-chips">
        ${recientes.map(c => chipHtml(c)).join('')}
      </div>
    </div>
  ` : '';

  const personalizadasHtml = personalizadas.length > 0 ? `
    <div class="gasto-pick-section">
      <div class="gasto-pick-section-label"><i data-lucide="sparkles"></i>Personalizadas</div>
      <div class="gasto-pick-chips">
        ${personalizadas.map(c => chipHtml(c)).join('')}
      </div>
    </div>
  ` : '';

  const gruposHtml = `
    <div class="fijo-grupos">
      ${GASTOS_VARIABLES_CATALOGO.map(grupo => {
        const abierto = window._gastoGruposAbiertos.has(grupo.titulo);
        const chips = grupo.items.map(it => {
          const cat = catByNombre[it.nombre];
          if (!cat) return '';
          return chipHtml(cat, it.special || null, it.icono);
        }).join('');
        return `
          <div class="fijo-grupo${abierto ? ' is-open' : ''}">
            <button type="button" class="fijo-grupo-header" onclick="toggleGastoPickerGrupo('${grupo.titulo.replace(/'/g, "\\'")}')">
              <span class="fijo-grupo-title">
                <i data-lucide="${grupo.icono}"></i>
                <span>${grupo.titulo}</span>
              </span>
              <i data-lucide="chevron-down" class="fijo-grupo-chevron"></i>
            </button>
            ${abierto ? `<div class="fijo-grupo-body">${chips}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  window._categoriaSelectorItems = flatItems;

  const old = document.getElementById('categoria-selector-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'categoria-selector-overlay';
  overlay.className = 'modal-overlay categoria-selector-overlay';
  overlay.innerHTML = `
    <div class="bottom-sheet gasto-picker-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">Selecciona categoría</h3>
      ${recientesHtml}
      ${personalizadasHtml}
      <div class="gasto-pick-section">
        <div class="gasto-pick-section-label"><i data-lucide="grid-2x2"></i>Todas las categorías</div>
        ${gruposHtml}
      </div>
    </div>
  `;
  overlay.addEventListener('click', closeSelectorCategoriaSheet);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  renderLucideIcons();
}

window.toggleGastoPickerGrupo = function(titulo) {
  if (!(window._gastoGruposAbiertos instanceof Set)) window._gastoGruposAbiertos = new Set();
  if (window._gastoGruposAbiertos.has(titulo)) window._gastoGruposAbiertos.delete(titulo);
  else window._gastoGruposAbiertos.add(titulo);
  renderGastoPickerSheet();
};

// ---- Campos especiales para Finanzas (Ahorro / Pago de deudas) ----
async function toggleCamposGastoEspecial() {
  const tipo = window._gastoEspecial || null;
  const contenedor = document.getElementById('rg-extra-campos');
  if (!contenedor) return;

  if (!tipo) {
    contenedor.style.display = 'none';
    contenedor.innerHTML = '';
    return;
  }

  const uid = await getUsuarioId();

  if (tipo === 'ahorro') {
    const { data: metas } = await db
      .from('metas_ahorro')
      .select('id, nombre, emoji, monto_objetivo, monto_actual')
      .eq('usuario_id', uid)
      .eq('activa', true)
      .order('nombre', { ascending: true });
    const lista = metas || [];
    contenedor.style.display = 'block';
    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div class="form-group finanza-empty">
          <p class="form-hint" style="margin-bottom:8px">No tienes metas activas. Crea una para aportar tu ahorro.</p>
          <button class="btn btn-secondary" type="button" style="width:100%" onclick="closeModal(); openAgregarMeta();">+ Crear meta</button>
        </div>
      `;
    } else {
      contenedor.innerHTML = `
        <div class="form-group">
          <label class="form-label">Meta</label>
          <select class="form-select" id="rg-meta-id">
            ${lista.map(m => `<option value="${m.id}">${m.nombre} · ${formatMXN(m.monto_actual || 0)} / ${formatMXN(m.monto_objetivo || 0)}</option>`).join('')}
          </select>
        </div>
      `;
    }
    return;
  }

  if (tipo === 'pago_deuda') {
    const { data: deudas } = await db
      .from('deudas')
      .select('id, acreedor, monto_actual, tipo_deuda')
      .eq('usuario_id', uid)
      .eq('activa', true)
      .order('acreedor', { ascending: true });
    const lista = deudas || [];
    contenedor.style.display = 'block';
    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div class="form-group finanza-empty">
          <p class="form-hint">No tienes deudas activas.</p>
        </div>
      `;
    } else {
      contenedor.innerHTML = `
        <div class="form-group">
          <label class="form-label">Deuda</label>
          <select class="form-select" id="rg-deuda-id">
            ${lista.map(d => `<option value="${d.id}" data-tipo="${d.tipo_deuda}" data-max="${d.monto_actual}">${d.acreedor} · ${formatMXN(d.monto_actual)}</option>`).join('')}
          </select>
        </div>
      `;
    }
    return;
  }

  contenedor.style.display = 'none';
  contenedor.innerHTML = '';
}

// Registrar Ingreso
async function openRegistrarIngreso() {
  const { data: categorias } = await db.from('categorias').select('id, nombre, emoji, es_default').eq('usuario_id', (await getUsuarioId())).eq('tipo', 'ingreso').order('nombre', { ascending: true });
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', (await getUsuarioId())).eq('activa', true);

  const categoriasIngreso = categorias || [];
  const categoriaInicial = categoriasIngreso.find(c => c.es_default === false) || categoriasIngreso[0] || { id: null, nombre: 'Otro', emoji: 'circle', special: 'otro', tipoSelector: 'ingreso' };

  currentCatTipo = 'ingreso';
  currentCatId = categoriaInicial.id ?? null;
  currentCatMeta = { ...categoriaInicial, tipoSelector: 'ingreso' };
  currentIngresoTipo = categoriaInicial.special === 'prestamo' ? 'prestamo' : 'otro';

  openModal('Registrar ingreso', `
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ri-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <button id="btn-cat-selector" class="categoria-btn" type="button" onclick="abrirSelectorCategoria('ingreso')"></button>
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

  actualizarBotonCategoriaSelector();
  toggleCamposPrestamo();
}

function toggleCamposPrestamo() {
  const tipo = currentIngresoTipo || 'otro';
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
  const tipo = currentIngresoTipo || 'otro';
  const categoria_id = currentCatId;
  const descripcion = document.getElementById('ri-desc').value.trim();
  const cuenta_id = document.getElementById('ri-cuenta')?.value || null;
  const fecha = document.getElementById('ri-fecha').value;
  const usuario_id = (await getUsuarioId());
  const prestamista = document.getElementById('ri-prestamista')?.value?.trim() || '';
  const frecuenciaPrestamo = document.getElementById('ri-freq-prestamo')?.value || 'libre';
  const montoPagoPrestamo = parseFloat(document.getElementById('ri-pago-prestamo')?.value) || null;
  if (!monto) { showSnackbar('Ingresa un monto', 'error'); return; }
  if (tipo === 'prestamo' && !prestamista) { showSnackbar('Escribe quién te prestó', 'error'); return; }

  const ingresoPayload = {
    usuario_id,
    monto,
    tipo,
    descripcion,
    cuenta_id,
    fecha,
    categoria_id: categoria_id ?? null
  };

  let { error } = await db.from('ingresos').insert(ingresoPayload);
  if (error && /categoria_id/i.test(String(error.message || ''))) {
    delete ingresoPayload.categoria_id;
    ({ error } = await db.from('ingresos').insert(ingresoPayload));
  }

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
          <div class="item-row-amount">${pago.monto_variable && !pago.monto ? 'Variable' : formatMXN(pago.monto)}</div>
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

// Registrar Gasto
async function openRegistrarGasto() {
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', (await getUsuarioId())).eq('activa', true);

  currentCatTipo = 'gasto';
  currentCatId = null;
  currentCatMeta = null;
  window._gastoEspecial = null;

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
      <button id="btn-cat-selector" class="categoria-btn" type="button" onclick="abrirSelectorCategoria('gasto')"></button>
    </div>
    <div id="rg-extra-campos" style="display:none"></div>
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

  actualizarBotonCategoriaSelector();
}

async function guardarGasto() {
  const descripcion = document.getElementById('rg-desc').value.trim();
  const monto = parseFloat(document.getElementById('rg-monto').value);
  const categoria_id = currentCatId;
  const cuenta_id = document.getElementById('rg-cuenta')?.value || null;
  const fecha = document.getElementById('rg-fecha').value;
  const usuarioId = (await getUsuarioId());
  const especial = window._gastoEspecial || null;
  if (!monto || monto <= 0) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (!categoria_id) { showSnackbar('Selecciona una categoría', 'error'); return; }
  if (!especial && !descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  // Validación de saldo disponible (aplica a todos los flujos con cuenta)
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

  // Flujo especial: Ahorro → registra el gasto y aumenta monto_actual de la meta
  if (especial === 'ahorro') {
    const meta_id = document.getElementById('rg-meta-id')?.value || null;
    if (!meta_id) { showSnackbar('Selecciona una meta', 'error'); return; }

    const { data: meta, error: errMeta } = await db.from('metas_ahorro').select('nombre, monto_actual').eq('id', meta_id).maybeSingle();
    if (errMeta || !meta) { showSnackbar('No se pudo cargar la meta', 'error'); return; }

    const gastoPayload = {
      usuario_id: usuarioId,
      descripcion: descripcion || `Aporte a ${meta.nombre}`,
      monto,
      categoria_id,
      cuenta_id,
      fecha,
    };
    const { error } = await db.from('gastos').insert(gastoPayload);
    if (error) { showSnackbar('Error al guardar', 'error'); return; }

    await db.from('metas_ahorro')
      .update({ monto_actual: Number(meta.monto_actual || 0) + monto })
      .eq('id', meta_id);

    window._gastoEspecial = null;
    closeModal();
    showSnackbar('Aporte a meta registrado ✓', 'success');
    await loadDashboard();
    if (typeof loadMetas === 'function') await loadMetas();
    loadGastos();
    return;
  }

  // Flujo especial: Pago de deuda → NO crea gasto (pagos_deuda ya se descuenta del saldo)
  if (especial === 'pago_deuda') {
    const deuda_id = document.getElementById('rg-deuda-id')?.value || null;
    if (!deuda_id) { showSnackbar('Selecciona una deuda', 'error'); return; }
    if (!cuenta_id) { showSnackbar('Selecciona una cuenta', 'error'); return; }

    const { data: deuda, error: errDeuda } = await db.from('deudas').select('monto_actual, tipo_deuda').eq('id', deuda_id).maybeSingle();
    if (errDeuda || !deuda) { showSnackbar('No se pudo cargar la deuda', 'error'); return; }
    if (monto > Number(deuda.monto_actual)) { showSnackbar('El pago excede el saldo de la deuda', 'error'); return; }

    const { error: errPago } = await db.from('pagos_deuda').insert({
      deuda_id,
      usuario_id: usuarioId,
      cuenta_id,
      monto,
      nota: descripcion,
      fecha,
    });
    if (errPago) { showSnackbar('Error al registrar el pago', 'error'); return; }

    if (deuda.tipo_deuda === 'tabla') {
      const { data: proximoPago } = await db.from('pagos_programados')
        .select('id')
        .eq('deuda_id', deuda_id)
        .eq('pagado', false)
        .order('fecha_vencimiento')
        .limit(1)
        .maybeSingle();
      if (proximoPago) {
        await db.from('pagos_programados').update({
          pagado: true,
          fecha_pago: fecha,
          monto_pagado: monto
        }).eq('id', proximoPago.id);
      }
    }

    const nuevoMonto = Number(deuda.monto_actual) - monto;
    await db.from('deudas').update({
      monto_actual: nuevoMonto,
      activa: nuevoMonto > 0,
      ultimo_pago: fecha,
      monto_ultimo_pago: monto,
    }).eq('id', deuda_id);

    window._gastoEspecial = null;
    closeModal();
    showSnackbar(nuevoMonto === 0 ? 'Deuda saldada' : 'Pago registrado ✓', 'success');
    await loadDashboard();
    if (typeof loadDeudas === 'function') await loadDeudas();
    return;
  }

  // Flujo normal
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

function selectTipoDeuda(tipo) {
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
  filasPagesProgramados = [];
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
  const usuarioId = await getUsuarioId();
  const { data: cuentas } = await db.from('cuentas').select('id, nombre').eq('usuario_id', usuarioId).eq('activa', true);
  const cuentasOptions = (cuentas || []).map(cuenta => `<option value="${cuenta.id}">${cuenta.nombre}</option>`).join('');

  window._nuevaMetaIcono = 'target';
  window._nuevaMetaIconPanelOpen = false;
  window._nuevaMetaDraft = { nombre: '', monto: '', cuenta_id: '' };
  window._nuevaMetaCuentasOptions = cuentasOptions;

  renderAgregarMetaModal();
}

function renderAgregarMetaModal() {
  const icono = window._nuevaMetaIcono || 'target';
  const panelAbierto = window._nuevaMetaIconPanelOpen;
  const draft = window._nuevaMetaDraft || { nombre: '', monto: '', cuenta_id: '' };

  openModal('Nueva meta de ahorro', `
    <div class="form-group">
      <label class="form-label">Icono</label>
      <div class="custom-form-row" style="align-items:center">
        <button type="button" class="emoji-picker-btn" onclick="toggleNuevaMetaIconPanel()">
          <i data-lucide="${icono}"></i>
        </button>
        <span style="font-size:13px;color:var(--text-secondary);margin-left:10px">Toca el icono para cambiarlo</span>
      </div>
      ${panelAbierto ? `
        <div class="icon-panel" style="margin-top:10px">
          <div class="icon-grid">
            ${TODOS_ICONOS.map(ic => `
              <div class="icon-grid-item${icono === ic ? ' selected' : ''}" onclick="selectNuevaMetaIcono('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">Nombre de la meta</label>
      <input class="form-input" id="nm-nombre" type="text" placeholder="Ej: Capital para cachuchas" value="${draft.nombre}" />
    </div>
    <div class="form-group">
      <label class="form-label">¿Cuánto necesitas?</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nm-monto" type="number" placeholder="0.00" min="0" value="${draft.monto}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">¿En qué cuenta ahorrarás?</label>
      <select class="form-select" id="meta-cuenta-id">
        <option value="">Sin cuenta vinculada</option>
        ${window._nuevaMetaCuentasOptions}
      </select>
    </div>
    <button class="btn btn-primary" onclick="guardarNuevaMeta()">Guardar meta</button>
  `);

  const selCuenta = document.getElementById('meta-cuenta-id');
  if (selCuenta && draft.cuenta_id) selCuenta.value = draft.cuenta_id;
}

window.toggleNuevaMetaIconPanel = function() {
  window._nuevaMetaDraft = {
    nombre: document.getElementById('nm-nombre')?.value || '',
    monto: document.getElementById('nm-monto')?.value || '',
    cuenta_id: document.getElementById('meta-cuenta-id')?.value || ''
  };
  window._nuevaMetaIconPanelOpen = !window._nuevaMetaIconPanelOpen;
  renderAgregarMetaModal();
};

window.selectNuevaMetaIcono = function(ic) {
  window._nuevaMetaDraft = {
    nombre: document.getElementById('nm-nombre')?.value || '',
    monto: document.getElementById('nm-monto')?.value || '',
    cuenta_id: document.getElementById('meta-cuenta-id')?.value || ''
  };
  window._nuevaMetaIcono = ic;
  window._nuevaMetaIconPanelOpen = false;
  renderAgregarMetaModal();
};

async function guardarNuevaMeta() {
  const emoji = window._nuevaMetaIcono || 'target';
  const nombre = document.getElementById('nm-nombre').value.trim();
  const monto_objetivo = parseFloat(document.getElementById('nm-monto').value);
  const cuenta_id = document.getElementById('meta-cuenta-id')?.value || null;
  if (!nombre || Number.isNaN(monto_objetivo) || monto_objetivo <= 0) {
    showSnackbar('Completa nombre y monto', 'error');
    return;
  }

  const { error } = await db.from('metas_ahorro').insert({
    usuario_id: (await getUsuarioId()),
    emoji, nombre, monto_objetivo, cuenta_id, activa: true
  });

  if (error) {
    showSnackbar('No se pudo crear la meta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Meta creada ✓', 'success');
  await loadMetas();
  await loadDashboard();
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
export async function renderApp() {
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

export function openModal(title, content) {
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

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    modalCloseTimeoutId = setTimeout(() => {
      overlay.remove();
      modalCloseTimeoutId = null;
    }, 300);
  }
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
    initAuthEvents();
  }
});

