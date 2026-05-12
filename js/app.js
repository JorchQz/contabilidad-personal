// js/app.js — Inicialización y onboarding
import { db, getUsuarioId } from './supabase.js';
import { showPage, renderNav, initSwipeNavigation } from './router.js';
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
import { getSaldoCuentaEspecifica, getPagosPendientes } from './balance.js';
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
import { loadPresupuestos } from './presupuestos.js';
import { renderGraficaGastos } from './graficas.js';
import { exportarDatosCSV, exportarReportePDF } from './export.js';

// NOTA PARA EL DESARROLLADOR — ejecutar en Supabase SQL Editor antes de usar pago único:
// ALTER TABLE deudas DROP CONSTRAINT IF EXISTS deudas_tipo_pago_check;
// ALTER TABLE deudas ADD CONSTRAINT deudas_tipo_pago_check
//   CHECK (tipo_pago = ANY (ARRAY['semanal','quincenal','mensual','libre','unico']));

// NOTA — Migración para gastos fijos con monto variable + frecuencias extendidas:
// ALTER TABLE gastos_fijos ALTER COLUMN monto DROP NOT NULL;
// ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS fecha_flexible BOOLEAN DEFAULT false;
// ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS monto_estimado BOOLEAN DEFAULT false;
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
    label.innerHTML = isLight
      ? `<i data-lucide="sun" style="width:16px;height:16px;stroke-width:1.75;vertical-align:middle;margin-right:4px"></i> Modo claro`
      : `<i data-lucide="moon" style="width:16px;height:16px;stroke-width:1.75;vertical-align:middle;margin-right:4px"></i> Modo oscuro`;
    renderLucideIcons();
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
    sb.setAttribute('aria-live', 'assertive');
    sb.setAttribute('role', 'alert');
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
    { icon: 'calculator', label: '¿Puedo comprarlo?', action: 'openSimuladorCompra()' },
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
  presupuestos: null,
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
    fab.setAttribute('aria-label', item.label || 'Agregar');
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
    db.from('gastos').select('monto').eq('usuario_id', uid).neq('es_ahorro', true),
    db.from('deudas').select('monto_actual').eq('usuario_id', uid).eq('activa', true),
    db.from('cuentas').select('id, nombre, tipo, saldo_inicial, es_disponible').eq('usuario_id', uid).eq('activa', true),
    db.from('ingresos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('gastos').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('pagos_deuda').select('cuenta_id, monto').eq('usuario_id', uid).not('cuenta_id', 'is', null),
    db.from('transferencias').select('cuenta_origen_id, monto').eq('usuario_id', uid).not('cuenta_origen_id', 'is', null),
    db.from('transferencias').select('cuenta_destino_id, monto').eq('usuario_id', uid).not('cuenta_destino_id', 'is', null)
  ]);

  const pagosPendientes = await getPagosPendientes();
  const proximaFechaCobro = pagosPendientes.proxima_fecha_cobro;
  const totalPendientePeriodo = pagosPendientes.total_periodo || 0;

  const [
    { data: ingProgramados },
    { data: gastosFijosData },
    { data: deudasConPago },
    { data: gastosDiferidos },
    { data: deudasAlerta }
  ] = await Promise.all([
    db.from('ingresos_programados').select('monto_estimado, frecuencia').eq('usuario_id', uid).eq('activo', true),
    db.from('gastos_fijos').select('monto, frecuencia, monto_estimado').eq('usuario_id', uid),
    db.from('deudas').select('monto_pago, tipo_pago').eq('usuario_id', uid).eq('activa', true).not('monto_pago', 'is', null),
    db.from('gastos_diferidos').select('id, descripcion, monto_total, monto_cuota, num_meses, cuotas_pagadas, fecha_primer_cargo').eq('usuario_id', uid).eq('activo', true),
    db.from('deudas').select('acreedor, monto_actual, monto_pago, tasa_interes_anual, tipo_pago').eq('usuario_id', uid).eq('activa', true).gt('tasa_interes_anual', 0)
  ]);

  const _normMens = (monto, freq) => {
    const f = { semanal: 4.33, quincenal: 2, mensual: 1, bimestral: 0.5, trimestral: 0.333, semestral: 0.167, anual: 0.0833 };
    return (Number(monto) || 0) * (f[freq] || 1);
  };
  const ingresoMensualEst = (ingProgramados || []).reduce((s, i) => s + _normMens(i.monto_estimado, i.frecuencia), 0);
  const gastosFijosMens   = (gastosFijosData || []).reduce((s, g) => s + _normMens(g.monto || g.monto_estimado || 0, g.frecuencia), 0);
  const servDeudaMens     = (deudasConPago || []).reduce((s, d) => s + _normMens(d.monto_pago, d.tipo_pago || 'mensual'), 0);

  // ── ALERTAS PROACTIVAS ───────────────────────────────────────────────────
  const hoyAlerta = new Date(); hoyAlerta.setHours(0, 0, 0, 0);
  const alertas = [];

  // 1. MSI próximo a vencer (últimas 2 cuotas o menos de 60 días para el fin)
  for (const gd of (gastosDiferidos || [])) {
    const cuotasPendientes = gd.num_meses - (gd.cuotas_pagadas || 0);
    if (cuotasPendientes <= 0) continue;
    const fechaFin = new Date(gd.fecha_primer_cargo + 'T00:00:00');
    fechaFin.setMonth(fechaFin.getMonth() + gd.num_meses);
    const diasParaFin = Math.ceil((fechaFin.getTime() - hoyAlerta.getTime()) / 86400000);
    if (diasParaFin <= 60 && cuotasPendientes <= 2) {
      alertas.push({
        tipo: 'rojo',
        icono: 'alert-triangle',
        titulo: `MSI a punto de vencer — ${escapeHtml(gd.descripcion)}`,
        detalle: `Quedan ${cuotasPendientes} cuota${cuotasPendientes > 1 ? 's' : ''}. Si no has pagado el total (${formatMXN(gd.monto_total)}), se cobrarán intereses retroactivos.`
      });
    }
  }

  // 2. Deuda con interés creciente (pago no cubre los intereses)
  for (const d of (deudasAlerta || [])) {
    if (!d.monto_pago || !d.monto_actual) continue;
    const r = (d.tasa_interes_anual / 100) / 12;
    const interesMes = d.monto_actual * r;
    if (d.monto_pago > 0 && d.monto_pago <= interesMes * 1.05) {
      alertas.push({
        tipo: 'amarillo',
        icono: 'trending-up',
        titulo: `Tu deuda con ${escapeHtml(d.acreedor)} crece cada mes`,
        detalle: `Tu pago de ${formatMXN(d.monto_pago)} apenas cubre los intereses (${formatMXN(interesMes)}/mes). Necesitas pagar más para bajar el saldo.`
      });
    }
  }

  const alertasHtml = alertas.length > 0 ? `
    <div style="padding:0 16px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px">
      ${alertas.map(a => {
        const borde = a.tipo === 'rojo' ? 'var(--red)' : 'var(--yellow)';
        const fondo = a.tipo === 'rojo' ? 'var(--red-soft)' : 'rgba(245,158,11,0.08)';
        return `
          <div style="background:${fondo};border-left:3px solid ${borde};border-radius:var(--radius-sm);padding:12px 14px;display:flex;align-items:flex-start;gap:10px">
            <i data-lucide="${a.icono}" style="width:16px;height:16px;stroke-width:2;color:${borde};flex-shrink:0;margin-top:1px;pointer-events:none"></i>
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">${a.titulo}</div>
              <div style="font-size:12px;color:var(--text-secondary);line-height:1.4">${a.detalle}</div>
            </div>
          </div>`;
      }).join('')}
    </div>
  ` : '';
  // ─────────────────────────────────────────────────────────────────────────

  let semaforoHtml = '';
  if (ingresoMensualEst > 0) {
    const ratio = (gastosFijosMens + servDeudaMens) / ingresoMensualEst;
    const comprometidosPor100 = Math.min(Math.round(ratio * 100), 100);
    const libresPor100 = Math.max(100 - comprometidosPor100, 0);
    const color = ratio < 0.5 ? 'var(--green)' : ratio < 0.7 ? 'var(--yellow)' : 'var(--red)';
    const icon  = ratio < 0.5 ? 'smile' : ratio < 0.7 ? 'alert-circle' : 'alert-triangle';
    const msg   = ratio < 0.5
      ? 'Tus finanzas tienen margen'
      : ratio < 0.7
      ? 'Gran parte de tu ingreso ya está comprometido'
      : 'Casi todo tu ingreso está comprometido';
    semaforoHtml = `
      <div style="padding:0 16px;margin-bottom:16px">
        <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-left:3px solid ${color}">
          <i data-lucide="${icon}" style="width:20px;height:20px;stroke-width:1.75;color:${color};flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:${color}">${msg}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">De cada $100 → <strong style="color:${color}">$${comprometidosPor100} comprometidos</strong> · $${libresPor100} disponibles</div>
          </div>
        </div>
      </div>
    `;
  }

  const { totalGeneralCuentas, totalDisponible } = calcularCuentasConSaldo(
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
  const disponible = totalDisponible;
  const realParaGastar = disponible - totalPendientePeriodo;

  const horaActual = new Date().getHours();
  const saludo = (horaActual >= 5 && horaActual < 12) ? 'Buenos días'
    : (horaActual >= 12 && horaActual < 19) ? 'Buenas tardes'
    : 'Buenas noches';

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header">
      <div>
        <p class="text-secondary" style="font-size:12px">${saludo}</p>
        <h1 class="page-title">${escapeHtml(usuario?.nombre?.split(' ')[0] || 'JM Finance')}</h1>
      </div>
    </div>

    <div class="balance-hero">
      <div class="balance-label">Disponible ahora</div>
      <div class="balance-amount">
        <span class="currency">$</span>${Math.abs(disponible).toLocaleString('es-MX')}
        ${disponible < 0 ? '<span style="font-size:14px;color:var(--red);margin-left:8px"><i data-lucide="alert-triangle" style="width:18px;height:18px;stroke-width:1.75"></i> Negativo</span>' : ''}
      </div>
      ${proximaFechaCobro && totalPendientePeriodo > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px;padding:10px 14px;background:rgba(255,255,255,0.05);border-radius:var(--radius-sm)">
          <div style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:5px">
            <i data-lucide="calendar-clock" style="width:13px;height:13px;stroke-width:1.75"></i>
            Libre en tu bolsillo
            <span style="opacity:0.65"> · hasta ${proximaFechaCobro.toLocaleDateString('es-MX', {day:'numeric', month:'short'})}</span>
          </div>
          <strong style="font-size:14px;color:${realParaGastar >= 0 ? 'var(--green)' : 'var(--red)'}">${formatMXN(realParaGastar)}</strong>
        </div>
      ` : ''}
      <div class="balance-row">
        <div class="balance-stat">
          <span class="balance-stat-label">Ingresos del mes</span>
          <span class="balance-stat-value income">${formatMXN(totalIngresos)}</span>
        </div>
        <div class="balance-stat">
          <span class="balance-stat-label">Gastos del mes</span>
          <span class="balance-stat-value expense">${formatMXN(totalGastos)}</span>
        </div>
        <div class="balance-stat">
          <span class="balance-stat-label">Deuda total</span>
          <span class="balance-stat-value" style="color:var(--yellow)">${formatMXN(totalDeuda)}</span>
        </div>
      </div>
    </div>

    ${alertasHtml}
    ${semaforoHtml}

    <div style="padding: 0 16px; margin-bottom: 16px">
      <p class="section-title">Gastos del mes por categoría</p>
      <div class="card" style="padding:16px;position:relative">
        <canvas id="gastosChart" style="max-height:280px"></canvas>
        <p class="graficas-empty form-hint" style="display:none;text-align:center;margin:0">Sin gastos registrados este mes</p>
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
                  <div class="item-row-name">${escapeHtml(p.nombre || '')}</div>
                  <div class="item-row-detail">${p.sin_fecha ? 'Sin fecha fija — pendiente' : fechaTxt}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <div class="item-row-amount">${p.fecha_flexible && !p.monto ? 'Variable' : formatMXN(p.monto)}</div>
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

  const canvas = document.getElementById('gastosChart');
  if (canvas) renderGraficaGastos(canvas);
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
  menu.style.cssText = 'position:fixed;bottom:145px;right:16px;z-index:40;display:flex;flex-direction:column;gap:10px;align-items:flex-end;opacity:0;transform:translateY(10px);transition:opacity 180ms ease,transform 180ms ease;';
  menu.innerHTML = currentFabItems.map(item => `
    <button onclick="closeFabMenu(); ${item.action}" style="display:flex;align-items:center;gap:10px;width:min(180px,calc(100vw - 80px));background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;color:var(--text);font-size:14px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,0.12);cursor:pointer;font-family:var(--font)">
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

  window._cuentasTraspasoCache = cuentas;
  const primeraId = cuentas[0]?.id || '';
  const segundaId = cuentas[1]?.id || cuentas[0]?.id || '';
  openModal('Registrar traspaso', `
    <div class="form-group">
      <label class="form-label">De qué cuenta</label>
      <select class="form-select" id="tr-origen" onchange="actualizarDestinoTraspaso()">
        ${cuentas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">A qué cuenta</label>
      <select class="form-select" id="tr-destino">
        ${cuentas.filter(c => c.id !== primeraId).map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="tr-monto" type="number" min="0" placeholder="0.00" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input class="form-input" id="tr-fecha" type="date" min="2000-01-01" max="${new Date().toISOString().split('T')[0]}" value="${new Date().toISOString().split('T')[0]}" />
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

  if (!cuenta_origen_id || !cuenta_destino_id || !monto || monto <= 0 || !isFinite(monto) || !fecha) {
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
  let email = '';
  try {
    const { data } = await db.auth.getUser();
    email = data?.user?.email || '';
  } catch(e) { /* sesión no disponible */ }

  document.getElementById('page-ajustes').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Ajustes</h1>
    </div>
    <div class="page-body">
      <div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Cuenta</div>
        <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:12px">${escapeHtml(email)}</div>
        <button class="btn btn-secondary" onclick="cerrarSesionConConfirm()">Cerrar sesión</button>
      </div>

      <div class="theme-toggle" onclick="toggleTheme()" style="margin-bottom:12px">
        <div class="theme-toggle-label">
          <span id="theme-label"><i data-lucide="moon" style="width:16px;height:16px;stroke-width:1.75;vertical-align:middle;margin-right:4px"></i> Modo oscuro</span>
        </div>
        <div class="toggle-switch" id="theme-switch">
          <div class="toggle-knob"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Version</div>
        <div style="font-weight:600">JM Finance v1.0</div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Exportar datos</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn btn-secondary" onclick="exportarDatosCSV()" style="flex-direction:column;gap:4px;height:auto;padding:10px 8px">
            <i data-lucide="file-spreadsheet" style="width:18px;height:18px;pointer-events:none"></i>
            <span style="font-size:13px">CSV</span>
            <span style="font-size:11px;color:var(--text-muted);font-weight:400">Para Excel</span>
          </button>
          <button class="btn btn-secondary" onclick="exportarReportePDF()" style="flex-direction:column;gap:4px;height:auto;padding:10px 8px">
            <i data-lucide="file-text" style="width:18px;height:18px;pointer-events:none"></i>
            <span style="font-size:13px">PDF</span>
            <span style="font-size:11px;color:var(--text-muted);font-weight:400">Para compartir</span>
          </button>
        </div>
      </div>

      ${window.JMF_DEV ? `<button class="btn btn-danger" style="margin-top:8px" onclick="resetApp()">Resetear datos (desarrollo)</button>` : ''}
    </div>
  `;

  updateThemeToggleUI();
  renderLucideIcons();
}

async function resetApp() {
  openConfirmModal('¿Cerrar sesión y limpiar datos locales?', '_ejecutarResetApp()', 'Sí, cerrar sesión');
}

window._ejecutarResetApp = async function() {
  await db.auth.signOut();
  location.reload();
};

window.cerrarSesionConConfirm = function() {
  openConfirmModal('¿Cerrar sesión?', 'cerrarSesion()', 'Cerrar sesión');
};

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
  window._gastoPickerCache = null; // forzar recarga en próxima apertura
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
          <span class="cat-name">${escapeHtml(item.nombre || '')}</span>
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
window.actualizarDestinoTraspaso = function() {
  const origenId = document.getElementById('tr-origen')?.value;
  const destino = document.getElementById('tr-destino');
  if (!destino || !window._cuentasTraspasoCache) return;
  const selActual = destino.value;
  destino.innerHTML = window._cuentasTraspasoCache
    .filter(c => c.id !== origenId)
    .map(c => `<option value="${c.id}" ${c.id === selActual ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`)
    .join('');
};
// ── SIMULADOR DE COMPRAS ─────────────────────────────────────────────────────
async function openSimuladorCompra() {
  const uid = await getUsuarioId();
  const [
    { data: ingProg },
    { data: deudasConPago },
    { data: gastosFijosData },
    { data: gastosDiferidos }
  ] = await Promise.all([
    db.from('ingresos_programados').select('monto_estimado, frecuencia').eq('usuario_id', uid).eq('activo', true),
    db.from('deudas').select('monto_pago, tipo_pago').eq('usuario_id', uid).eq('activa', true).not('monto_pago', 'is', null),
    db.from('gastos_fijos').select('monto, frecuencia, monto_estimado').eq('usuario_id', uid),
    db.from('gastos_diferidos').select('monto_cuota, num_meses, cuotas_pagadas').eq('usuario_id', uid).eq('activo', true)
  ]);

  const _norm = (m, f) => {
    const t = { semanal:4.33, quincenal:2, mensual:1, bimestral:0.5, trimestral:0.333, semestral:0.167, anual:0.0833 };
    return (Number(m)||0) * (t[f]||1);
  };
  const ingresoMensual = (ingProg||[]).reduce((s,i) => s + _norm(i.monto_estimado, i.frecuencia), 0);
  const ingresoQuincenal = ingresoMensual / 2;

  // Compromiso mensual actual
  const compromisoMens = (deudasConPago||[]).reduce((s,d) => s + _norm(d.monto_pago, d.tipo_pago||'mensual'), 0)
    + (gastosFijosData||[]).reduce((s,g) => s + _norm(g.monto||g.monto_estimado||0, g.frecuencia), 0)
    + (gastosDiferidos||[]).reduce((s,gd) => {
        const pend = gd.num_meses - (gd.cuotas_pagadas||0);
        return pend > 0 ? s + Number(gd.monto_cuota||0) : s;
      }, 0);

  const ratioActual = ingresoMensual > 0 ? compromisoMens / ingresoMensual : 0;

  // Guardamos datos para la función de cálculo
  window._simCompraCtx = { ingresoMensual, ingresoQuincenal, compromisoMens, ratioActual };

  openModal('¿Puedo comprarlo?', `
    <div class="form-group">
      <label class="form-label">¿Cuánto cuesta?</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="sc-monto" type="number" placeholder="0.00" min="0"
             inputmode="decimal" autofocus oninput="calcularSimCompra()" /></div>
    </div>

    <div class="form-group">
      <label class="form-label">¿Cómo lo pagas?</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px">
        ${[
          { v:'efectivo', icon:'banknote',     label:'Efectivo',      sub:'Lo pagas hoy' },
          { v:'contado',  icon:'credit-card',  label:'TDC contado',   sub:'Pagas al corte' },
          { v:'msi',      icon:'calendar',     label:'MSI',           sub:'Sin intereses' },
          { v:'credito',  icon:'landmark',     label:'A crédito',     sub:'Con préstamo' }
        ].map(op => `
          <button onclick="selectModoPago('${op.v}')" id="sc-modo-${op.v}"
            style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:10px 8px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 150ms ease">
            <i data-lucide="${op.icon}" style="width:16px;height:16px;color:var(--accent);display:block;margin-bottom:4px;stroke-width:1.75;pointer-events:none"></i>
            <div style="font-size:12px;font-weight:700">${op.label}</div>
            <div style="font-size:10px;color:var(--text-muted)">${op.sub}</div>
          </button>`).join('')}
      </div>
    </div>

    <!-- Campos extra según modo -->
    <div id="sc-extra-campos"></div>

    <!-- Resultado -->
    <div id="sc-resultado" style="min-height:60px"></div>

    <button class="btn btn-ghost" style="margin-top:12px;width:100%" onclick="closeModal()">
      Cerrar — solo estaba viendo
    </button>
  `);

  window._simCompraModo = 'efectivo';
  renderLucideIcons();
  setTimeout(() => selectModoPago('efectivo'), 50);
}

window.selectModoPago = function(modo) {
  window._simCompraModo = modo;
  // Resaltar botón activo
  ['efectivo','contado','msi','credito'].forEach(m => {
    const btn = document.getElementById(`sc-modo-${m}`);
    if (!btn) return;
    btn.style.borderColor = m === modo ? 'var(--accent)' : 'var(--border)';
    btn.style.background  = m === modo ? 'var(--accent-soft)' : 'var(--bg-elevated)';
  });
  // Campos extra
  const extra = document.getElementById('sc-extra-campos');
  if (!extra) return;
  if (modo === 'msi') {
    extra.innerHTML = `
      <div class="form-group">
        <label class="form-label">¿A cuántos meses?</label>
        <select class="form-select" id="sc-meses" onchange="calcularSimCompra()">
          ${[3,6,9,12,18,24].map(m => `<option value="${m}">${m} meses</option>`).join('')}
        </select>
      </div>`;
  } else if (modo === 'credito') {
    extra.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group">
          <label class="form-label">Meses del préstamo</label>
          <input class="form-input" id="sc-cr-meses" type="number" min="1" max="360"
                 placeholder="Ej: 24" value="24" inputmode="numeric" oninput="calcularSimCompra()" />
        </div>
        <div class="form-group">
          <label class="form-label">Tasa mensual %</label>
          <input class="form-input" id="sc-cr-tasa" type="number" min="0" max="99"
                 placeholder="Ej: 2" value="2" step="0.1" inputmode="decimal" oninput="calcularSimCompra()" />
        </div>
      </div>`;
  } else {
    extra.innerHTML = '';
  }
  calcularSimCompra();
};

window.calcularSimCompra = function() {
  const ctx = window._simCompraCtx;
  if (!ctx) return;
  const res = document.getElementById('sc-resultado');
  if (!res) return;

  const monto = parseFloat(String(document.getElementById('sc-monto')?.value || '').replace(/,/g, ''));
  const modo  = window._simCompraModo || 'efectivo';
  if (!monto || monto <= 0 || !isFinite(monto)) {
    res.innerHTML = '';
    return;
  }

  const { ingresoMensual, ingresoQuincenal, compromisoMens, ratioActual } = ctx;
  let html = '';

  if (modo === 'efectivo') {
    // Comparar contra saldo libre estimado
    const libreEstimado = ingresoMensual - compromisoMens;
    const pct = ingresoMensual > 0 ? Math.round((monto / ingresoMensual) * 100) : 0;
    const quincenas = ingresoQuincenal > 0 ? (monto / ingresoQuincenal).toFixed(1) : '?';
    const veredicto = monto <= libreEstimado * 0.9 ? 'comodo' : monto <= libreEstimado ? 'justo' : 'apretado';
    const color  = veredicto === 'comodo' ? 'var(--green)' : veredicto === 'justo' ? 'var(--yellow)' : 'var(--red)';
    const icono  = veredicto === 'comodo' ? 'check-circle' : veredicto === 'justo' ? 'alert-circle' : 'x-circle';
    const texto  = veredicto === 'comodo' ? 'Puedes comprarlo con margen' : veredicto === 'justo' ? 'Puedes, pero quedas ajustado' : 'No alcanza este mes';
    html = `
      <div style="background:${veredicto === 'comodo' ? 'var(--green-soft)' : veredicto === 'justo' ? 'rgba(245,158,11,0.1)' : 'var(--red-soft)'};border:1px solid ${color};border-radius:var(--radius-sm);padding:12px 14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <i data-lucide="${icono}" style="width:18px;height:18px;color:${color};stroke-width:2;pointer-events:none"></i>
          <span style="font-size:14px;font-weight:700;color:${color}">${texto}</span>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
          Representa el <strong>${pct}%</strong> de tu ingreso mensual.<br>
          Equivale a <strong>${quincenas} quincenas</strong> de trabajo.
          ${veredicto === 'apretado' ? `<br>Te faltan aprox. ${formatMXN(monto - libreEstimado)} para cubrirlo con margen.` : ''}
        </div>
      </div>`;
  } else if (modo === 'contado') {
    const pct = ingresoMensual > 0 ? Math.round((monto / ingresoMensual) * 100) : 0;
    const quincenas = ingresoQuincenal > 0 ? (monto / ingresoQuincenal).toFixed(1) : '?';
    const cabe = monto <= (ingresoMensual - compromisoMens);
    const color = cabe ? 'var(--green)' : 'var(--yellow)';
    html = `
      <div style="background:${cabe ? 'var(--green-soft)' : 'rgba(245,158,11,0.1)'};border:1px solid ${color};border-radius:var(--radius-sm);padding:12px 14px">
        <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px">
          ${cabe ? 'Cabe en tu presupuesto' : 'Compromete parte de lo que reservas para deudas'}
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
          Pagas ${formatMXN(monto)} en un solo estado de cuenta.<br>
          Equivale a ${pct}% de tu ingreso mensual — ${quincenas} quincenas de trabajo.
        </div>
      </div>`;
  } else if (modo === 'msi') {
    const meses = parseInt(document.getElementById('sc-meses')?.value || '12', 10);
    const cuota = monto / meses;
    const nuevaRatio = ingresoMensual > 0 ? (compromisoMens + cuota) / ingresoMensual : 0;
    const pctInc  = ingresoMensual > 0 ? Math.round((cuota / ingresoMensual) * 100) : 0;
    const quincenas = ingresoQuincenal > 0 ? (monto / ingresoQuincenal).toFixed(1) : '?';
    const color = nuevaRatio < 0.5 ? 'var(--green)' : nuevaRatio < 0.7 ? 'var(--yellow)' : 'var(--red)';
    const semNuevo = Math.round(nuevaRatio * 100);
    html = `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:12px 14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:800;color:var(--accent)">${formatMXN(cuota)}</div>
            <div style="font-size:11px;color:var(--text-muted)">por mes, ${meses} meses</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:800">${quincenas}</div>
            <div style="font-size:11px;color:var(--text-muted)">quincenas de trabajo</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">
          ${pctInc}% de tu ingreso mensual comprometido por ${meses} meses.
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="color:var(--text-muted)">Semáforo actual</span>
          <span style="color:${ratioActual < 0.5 ? 'var(--green)' : ratioActual < 0.7 ? 'var(--yellow)' : 'var(--red)'}">
            ${Math.round(ratioActual*100)}%
          </span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="color:var(--text-muted)">Con este MSI sería</span>
          <span style="font-weight:700;color:${color}">${semNuevo}%</span>
        </div>
      </div>`;
  } else if (modo === 'credito') {
    const meses = parseInt(document.getElementById('sc-cr-meses')?.value || '24', 10);
    const tasaMensual = parseFloat(document.getElementById('sc-cr-tasa')?.value || '2') / 100;
    if (!meses || meses < 1) return;
    let cuota, totalPagado, interesTotal;
    if (tasaMensual <= 0) {
      cuota = monto / meses;
      totalPagado = monto;
      interesTotal = 0;
    } else {
      cuota = monto * (tasaMensual * Math.pow(1+tasaMensual, meses)) / (Math.pow(1+tasaMensual, meses) - 1);
      totalPagado = cuota * meses;
      interesTotal = totalPagado - monto;
    }
    if (!isFinite(cuota)) return;
    const quincenas = ingresoQuincenal > 0 ? (monto / ingresoQuincenal).toFixed(1) : '?';
    const pctCuota = ingresoMensual > 0 ? Math.round((cuota / ingresoMensual) * 100) : 0;
    html = `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:12px 14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:800;color:var(--accent)">${formatMXN(cuota)}</div>
            <div style="font-size:11px;color:var(--text-muted)">cuota mensual</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:800;color:var(--red)">${formatMXN(interesTotal)}</div>
            <div style="font-size:11px;color:var(--text-muted)">en intereses</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
          Pagarás <strong>${formatMXN(totalPagado)}</strong> en total — ${formatMXN(interesTotal)} más de lo que cuesta hoy.<br>
          La cuota equivale al ${pctCuota}% de tu ingreso mensual.<br>
          Equivale a <strong>${quincenas} quincenas</strong> de trabajo total.
        </div>
        ${interesTotal > 0 && ingresoMensual > 0 ? `
        <div style="margin-top:8px;padding:8px;background:var(--red-soft);border-radius:var(--radius-xs);font-size:12px;color:var(--text-secondary)">
          Si ahorras ${formatMXN(cuota)}/mes en cambio, lo compras en ${meses} meses <strong>sin pagar ${formatMXN(interesTotal)} en intereses</strong>.
        </div>` : ''}
      </div>`;
  }

  res.innerHTML = html;
  renderLucideIcons();
};

window.openSimuladorCompra = openSimuladorCompra;
// ─────────────────────────────────────────────────────────────────────────────

window.openConfirmModal = openConfirmModal;
window.exportarDatosCSV = exportarDatosCSV;
window.exportarReportePDF = exportarReportePDF;
window.toggleTheme = toggleTheme;
window.resetApp = resetApp;
window.closeFabMenu = closeFabMenu;
window.showPage = showPage;
window.updateFab = updateFab;
window.loadPresupuestos = loadPresupuestos;
window.loadDashboard = loadDashboard;
window.loadGastos = loadGastos;
window.loadIngresos = loadIngresos;
window.loadDeudas = loadDeudas;
window.loadMetas = loadMetas;
window.loadFijos = loadFijos;
window.loadCuentas = loadCuentas;
window.loadAjustes = loadAjustes;

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
    <div id="page-presupuestos" class="page"></div>
    <div id="page-fijos" class="page"></div>
    <div id="page-ajustes" class="page"></div>
  `;

  renderNav();
  initSwipeNavigation();
  showPage('dashboard');
  await Promise.all([
    loadDashboard(),
    loadCuentas(),
    loadDeudas(),
    loadMetas(),
    loadPresupuestos(),
    loadFijos(),
    loadGastos(),
    loadIngresos(),
    loadAjustes(),
  ]);
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
      <div class="sheet-title">${escapeHtml(title)}</div>
      ${content}
    </div>
  `;

  renderLucideIcons();

  requestAnimationFrame(() => overlay.classList.add('open'));
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function openConfirmModal(mensaje, onConfirmJs, labelConfirm = 'Eliminar') {
  openModal('Confirmar', `
    <p style="font-size:14px;line-height:1.5;margin-bottom:20px;color:var(--text-secondary)">${escapeHtml(mensaje)}</p>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" style="flex:1" onclick="closeModal();${onConfirmJs}">${escapeHtml(labelConfirm)}</button>
    </div>
  `);
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

// ---- SERVICE WORKER ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

// ---- INICIO ----
window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await new Promise(r => setTimeout(r, 1200)); // splash

  try {
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
  } catch (e) {
    document.getElementById('app').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;padding:24px;text-align:center">
        <i data-lucide="wifi-off" style="width:48px;height:48px;color:var(--text-muted)"></i>
        <p style="font-size:16px;font-weight:600;color:var(--text)">Sin conexión</p>
        <p style="font-size:14px;color:var(--text-secondary)">Verifica tu internet y recarga la app.</p>
        <button class="btn btn-secondary" style="width:auto;padding:12px 24px" onclick="location.reload()">Reintentar</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
});

