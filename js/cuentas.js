// js/cuentas.js — Módulo de Cuentas
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN,
  showSnackbar,
  openModal,
  closeModal,
  openActionSheet,
  renderLucideIcons,
  loadDashboard
} from './app.js';

// ---- SEGURIDAD ----
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- TAXONOMÍA FINANCIERA ----
// efectivo / debito  → es_disponible=true,  es_pasivo=false  (dinero líquido real)
// credito            → es_disponible=false, es_pasivo=true   (pasivo circulante)
// ahorro             → es_disponible=false, es_pasivo=false  (fondos comprometidos)
function getEsDisponiblePasivo(tipo) {
  return {
    es_disponible: tipo === 'efectivo' || tipo === 'debito',
    es_pasivo:     tipo === 'credito'
  };
}

export function getCuentaIcon(tipo) {
  const icons = {
    efectivo: '<i data-lucide="banknote"    style="width:18px;height:18px;stroke-width:1.75"></i>',
    debito:   '<i data-lucide="building-2"  style="width:18px;height:18px;stroke-width:1.75"></i>',
    credito:  '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>',
    ahorro:   '<i data-lucide="piggy-bank"  style="width:18px;height:18px;stroke-width:1.75"></i>'
  };
  return icons[tipo] || icons.debito;
}

export function getCuentaTipos() {
  return [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'debito',   label: 'Débito / Nómina' },
    { value: 'credito',  label: 'Tarjeta de Crédito' },
    { value: 'ahorro',   label: 'Ahorro / Inversión' }
  ];
}

export function calcularCuentasConSaldo(cuentas = [], ingresosPorCuenta = [], gastosPorCuenta = [], pagosDeudaPorCuenta = [], traspasosSalida = [], traspasosEntrada = []) {
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

export async function loadCuentas() {
  const uid = await getUsuarioId();
  const [
    { data: cuentas },
    { data: ingresosPorCuenta },
    { data: gastosPorCuenta },
    { data: pagosDeudaPorCuenta },
    { data: traspasosSalida },
    { data: traspasosEntrada }
  ] = await Promise.all([
    db.from('cuentas').select('id, nombre, tipo, saldo_inicial, es_disponible, es_pasivo').eq('usuario_id', uid).eq('activa', true),
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
              <div class="item-row-name">${escapeHtml(cuenta.nombre)}</div>
              <div class="item-row-detail">${escapeHtml(cuenta.tipoLabel)}</div>
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

export function openCuentaActions(cuentaId) {
  openActionSheet('Opciones de cuenta', [
    { label: 'Editar', onClick: `openEditarCuenta('${cuentaId}')` },
    { label: 'Eliminar', onClick: `eliminarCuenta('${cuentaId}')`, danger: true }
  ]);
}

export function openMenuCuenta(cuentaId) {
  openCuentaActions(cuentaId);
}

export async function openEditarCuenta(cuentaId) {
  const { data: cuenta, error } = await db
    .from('cuentas')
    .select('id, nombre, tipo, saldo_inicial, es_disponible, es_pasivo')
    .eq('id', cuentaId)
    .eq('usuario_id', await getUsuarioId())
    .maybeSingle();

  if (error || !cuenta) {
    showSnackbar('No se pudo cargar la cuenta', 'error');
    return;
  }

  const opciones = getCuentaTipos();

  openModal('Editar cuenta', `
    <div class="form-group">
      <label class="form-label">Nombre</label>
      <input class="form-input" id="ec-nombre" type="text" value="${escapeHtml(cuenta.nombre || '')}" />
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

export async function guardarEdicionCuenta(cuentaId) {
  const nombre = document.getElementById('ec-nombre')?.value.trim();
  const tipo = document.getElementById('ec-tipo')?.value;
  const saldo_inicial = parseFloat(document.getElementById('ec-saldo')?.value);

  const TIPOS_VALIDOS = ['efectivo', 'debito', 'credito', 'ahorro'];
  const MAX_SALDO = 999999999;
  if (!nombre || nombre.length > 100 || !TIPOS_VALIDOS.includes(tipo) || Number.isNaN(saldo_inicial) || saldo_inicial < 0 || saldo_inicial > MAX_SALDO) {
    showSnackbar('Completa los campos correctamente', 'error');
    return;
  }

  const { es_disponible, es_pasivo } = getEsDisponiblePasivo(tipo);
  const { error } = await db
    .from('cuentas')
    .update({ nombre, tipo, saldo_inicial, es_disponible, es_pasivo })
    .eq('id', cuentaId)
    .eq('usuario_id', await getUsuarioId());

  if (error) {
    showSnackbar('No se pudo actualizar la cuenta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Cuenta actualizada ✓', 'success');
  await loadCuentas();
  await loadDashboard();
}

export async function eliminarCuenta(cuentaId) {
  const { data: cuentaCheck } = await db
    .from('cuentas')
    .select('tipo, nombre')
    .eq('id', cuentaId)
    .maybeSingle();

  if (cuentaCheck?.tipo === 'efectivo') {
    showSnackbar('La cuenta de Efectivo no puede eliminarse', 'error');
    return;
  }

  if (!confirm('¿Eliminar esta cuenta?\n\nLos movimientos de esta cuenta se conservan en el historial.')) return;

  const { error } = await db
    .from('cuentas')
    .update({ activa: false })
    .eq('id', cuentaId)
    .eq('usuario_id', await getUsuarioId());

  if (error) {
    showSnackbar('No se pudo eliminar la cuenta', 'error');
    return;
  }

  closeModal();
  showSnackbar('Cuenta eliminada', 'success');
  await loadCuentas();
  await loadDashboard();
}

export async function openAgregarCuenta() {
  openModal('Nueva cuenta', `
    <div class="form-group">
      <label class="form-label">Nombre de la cuenta</label>
      <input class="form-input" id="nc-nombre" type="text" placeholder="Ej: Efectivo, banco, negocio" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <select class="form-select" id="nc-tipo">
        ${getCuentaTipos().map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Saldo inicial</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nc-saldo" type="number" min="0" max="999999999" placeholder="0.00" /></div>
    </div>
    <button class="btn btn-primary" onclick="guardarNuevaCuenta()">Guardar cuenta</button>
  `);
}

export async function guardarNuevaCuenta() {
  const nombre = document.getElementById('nc-nombre')?.value.trim();
  const tipo = document.getElementById('nc-tipo')?.value;
  const saldo_inicial = parseFloat(document.getElementById('nc-saldo')?.value) || 0;
  const TIPOS_VALIDOS = ['efectivo', 'debito', 'credito', 'ahorro'];
  const MAX_SALDO = 999999999;

  if (!nombre || nombre.length > 100) {
    showSnackbar('El nombre debe tener entre 1 y 100 caracteres', 'error');
    return;
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    showSnackbar('Selecciona un tipo de cuenta válido', 'error');
    return;
  }
  if (saldo_inicial < 0 || saldo_inicial > MAX_SALDO) {
    showSnackbar('Ingresa un saldo entre $0 y $999,999,999', 'error');
    return;
  }

  const { es_disponible, es_pasivo } = getEsDisponiblePasivo(tipo);
  const { error } = await db.from('cuentas').insert({
    usuario_id: await getUsuarioId(),
    nombre,
    tipo,
    saldo_inicial,
    es_disponible,
    es_pasivo,
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

// Solo las funciones invocadas desde atributos onclick en HTML generado dinámicamente
window.openMenuCuenta = openMenuCuenta;
window.openEditarCuenta = openEditarCuenta;
window.eliminarCuenta = eliminarCuenta;
window.guardarEdicionCuenta = guardarEdicionCuenta;
window.openAgregarCuenta = openAgregarCuenta;
window.guardarNuevaCuenta = guardarNuevaCuenta;
