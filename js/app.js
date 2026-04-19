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
import { renderOnboarding } from './onboarding.js';
import { loadDeudas } from './deudas.js';
import { loadMetas } from './metas.js';
import {
  loadGastos,
  loadFijos,
  GASTOS_FIJOS_CATALOGO,
  GASTOS_VARIABLES_CATALOGO,
  toggleCamposGastoEspecial,
  abrirSelectorGasto
} from './gastos.js';
import {
  loadIngresos,
  toggleCamposPrestamo,
  setCurrentIngresoTipo
} from './ingresos.js';

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


// Renderiza un valor que puede ser un nombre de icono lucide (kebab-case) o un emoji literal
export function renderEmojiOrIcon(value, fallbackIcon = 'package', size = 18) {
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

  window.openPagarDeuda(deuda.id, deuda.acreedor, deuda.monto_actual, deuda.tipo_deuda, deuda.monto_ultimo_pago);
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

export async function getSaldoCuentaEspecifica(usuarioId, cuentaId) {
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

export async function getPagosPendientes() {
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
window._categoriaSelectorItems = [];

export function setCatState(id, meta, tipo) { currentCatId = id; currentCatMeta = meta; currentCatTipo = tipo; }
export function getCurrentCatId() { return currentCatId; }

function getCategoriaIcono(item, fallback = 'package') {
  return item?.emoji || item?.icono || fallback;
}

export function actualizarBotonCategoriaSelector() {
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
    setCurrentIngresoTipo(item.special === 'prestamo' ? 'prestamo' : 'otro');
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

window.abrirSelectorCategoria = abrirSelectorCategoria;
window.seleccionarCategoriaDesdeSheet = seleccionarCategoriaDesdeSheet;
window.closeSelectorCategoriaSheet = closeSelectorCategoriaSheet;
window.togglePagoPendienteExpand = togglePagoPendienteExpand;
window.abrirPagoPendienteDeuda = abrirPagoPendienteDeuda;
window.openMarcarPagoFijo = openMarcarPagoFijo;
window.confirmarMarcarPagoFijo = confirmarMarcarPagoFijo;
window.toggleTheme = toggleTheme;
window.resetApp = resetApp;
window.closeFabMenu = closeFabMenu;

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

