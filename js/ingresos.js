// js/ingresos.js — Módulo de Ingresos (puntuales y programados)
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN,
  showSnackbar,
  renderEmojiOrIcon,
  renderLucideIcons,
  openActionSheet,
  openModal,
  closeModal,
  actualizarBotonCategoriaSelector,
  setCatState,
  getCurrentCatId,
  loadDashboard,
} from './app.js';
import { getPagosPendientes } from './balance.js';
import { loadCuentas } from './cuentas.js';
import { loadDeudas } from './deudas.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let currentIngresoTipo = 'otro';

export function setCurrentIngresoTipo(tipo) {
  currentIngresoTipo = tipo;
}

// ---- HELPERS ----
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

// ---- LOAD ----
export async function loadIngresos() {
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
            <div class="item-row-name">${escapeHtml(i.descripcion || '')}</div>
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
              <div class="item-row-name">${escapeHtml(nombre)}</div>
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
      <button onclick="openRegistrarIngreso()" style="background:var(--green-soft);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:8px 14px;color:var(--green);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font)">+ Nuevo</button>
    </div>
    <div class="page-body">
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:14px">Programados</div>
          <button onclick="openAgregarIngresoProgramado()" style="background:var(--green-soft);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:8px 12px;color:var(--green);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)">+ Agregar</button>
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

// ---- INGRESOS PROGRAMADOS ----
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
  const H = 'height:46px;max-height:46px;width:100%';

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Día del mes</label>
      <input class="form-input" id="eip-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" style="${H}" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="eip-dia-semana" style="${H}">
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
      <input class="form-input" id="eip-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" style="${H}" />
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
      <input class="form-input" id="eip-desc" type="text" value="${escapeHtml(ingresoProgramado.descripcion || '')}" />
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

  if (!descripcion || !monto_estimado || monto_estimado <= 0 || !isFinite(monto_estimado)) {
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
  const H = 'height:46px;max-height:46px;width:100%';

  if (frecuencia === 'mensual') {
    campos.innerHTML = `
      <label class="form-label">Día del mes</label>
      <input class="form-input" id="ip-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" style="${H}" />
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="ip-dia-semana" style="${H}">
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
      <input class="form-input" id="ip-dia-pago" type="number" min="1" max="15" placeholder="1 - 15" style="${H}" />
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

  if (!descripcion || !monto_estimado || monto_estimado <= 0 || !isFinite(monto_estimado)) {
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

async function _doEliminarIngresoProgramado(ingresoProgramadoId) {
  const { error } = await db
    .from('ingresos_programados')
    .update({ activo: false })
    .eq('id', ingresoProgramadoId)
    .eq('usuario_id', (await getUsuarioId()));
  if (error) { showSnackbar('No se pudo eliminar el ingreso programado', 'error'); return; }
  showSnackbar('Ingreso programado eliminado', 'success');
  await loadIngresos();
}

function eliminarIngresoProgramado(ingresoProgramadoId) {
  openConfirmModal('¿Eliminar este ingreso programado?', `_doEliminarIngresoProgramado('${ingresoProgramadoId}')`);
}
window._doEliminarIngresoProgramado = _doEliminarIngresoProgramado;

// ---- HISTORIAL DE INGRESOS ----
function openMenuIngresoHistorial(ingresoId) {
  openActionSheet('Opciones del ingreso', [
    { label: 'Eliminar', onClick: `eliminarIngreso('${ingresoId}')`, danger: true }
  ]);
}

async function _doEliminarIngreso(ingresoId) {
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
function eliminarIngreso(ingresoId) {
  openConfirmModal('¿Eliminar este ingreso del historial?', `_doEliminarIngreso('${ingresoId}')`);
}
window._doEliminarIngreso = _doEliminarIngreso;

// ---- REGISTRAR INGRESO ----
async function openRegistrarIngreso() {
  const uid = await getUsuarioId();
  const [
    { data: categorias, error: errCatsIng },
    { data: cuentas, error: errCuentasIng }
  ] = await Promise.all([
    db.from('categorias').select('id, nombre, emoji, es_default').eq('usuario_id', uid).eq('tipo', 'ingreso').order('nombre', { ascending: true }),
    db.from('cuentas').select('*').eq('usuario_id', uid).eq('activa', true)
  ]);
  if (errCatsIng || errCuentasIng) { showSnackbar('No se pudieron cargar los datos', 'error'); return; }

  const categoriasIngreso = categorias || [];
  const categoriaInicial = categoriasIngreso.find(c => c.es_default === false) || categoriasIngreso[0] || { id: null, nombre: 'Otro', emoji: 'circle', special: 'otro', tipoSelector: 'ingreso' };

  currentIngresoTipo = categoriaInicial.special === 'prestamo' ? 'prestamo' : 'otro';
  setCatState(categoriaInicial.id ?? null, { ...categoriaInicial, tipoSelector: 'ingreso' }, 'ingreso');

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
      <input class="form-input" id="ri-fecha" type="date" min="2000-01-01" max="${new Date().toISOString().split('T')[0]}" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <button class="btn btn-primary" onclick="guardarIngreso()">Guardar ingreso</button>
  `);

  actualizarBotonCategoriaSelector();
  toggleCamposPrestamo();
}

export function toggleCamposPrestamo() {
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
        <label class="form-label">Pago por cuota</label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="ri-pago-prestamo" type="number" placeholder="¿Cuánto pagarás cada vez?" min="0" /></div>
        <p class="form-hint" style="margin-top:4px">Necesario para proyectar tus pagos futuros</p>
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
  const categoria_id = getCurrentCatId();
  const descripcion = document.getElementById('ri-desc').value.trim();
  const cuenta_id = document.getElementById('ri-cuenta')?.value || null;
  const fecha = document.getElementById('ri-fecha').value;
  const usuario_id = (await getUsuarioId());
  const prestamista = document.getElementById('ri-prestamista')?.value?.trim() || '';
  const frecuenciaPrestamo = document.getElementById('ri-freq-prestamo')?.value || 'libre';
  const montoPagoPrestamo = parseFloat(document.getElementById('ri-pago-prestamo')?.value) || null;
  if (!monto || monto <= 0 || !isFinite(monto)) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (tipo === 'prestamo' && !prestamista) { showSnackbar('Escribe quién te prestó', 'error'); return; }
  if (tipo === 'prestamo' && (!montoPagoPrestamo || montoPagoPrestamo <= 0 || !isFinite(montoPagoPrestamo))) {
    showSnackbar('Ingresa el monto de cada cuota para proyectar tus pagos', 'error'); return;
  }

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

  const _uid = await getUsuarioId();
  const { data: _metas } = await db
    .from('metas_ahorro')
    .select('nombre, emoji, monto_objetivo, monto_actual, fecha_limite, frecuencia_ahorro')
    .eq('usuario_id', _uid)
    .eq('activa', true);

  const _hoy = new Date(); _hoy.setHours(0, 0, 0, 0);
  const _divs = { diaria: 1, semanal: 7, quincenal: 15, mensual: 30 };
  const metasConCuota = (_metas || [])
    .filter(m => m.fecha_limite && m.frecuencia_ahorro && m.frecuencia_ahorro !== 'libre')
    .map(m => {
      const restante = Math.max(Number(m.monto_objetivo || 0) - Number(m.monto_actual || 0), 0);
      if (restante <= 0) return null;
      const dias = Math.max(Math.ceil((new Date(m.fecha_limite + 'T00:00:00') - _hoy) / 86400000), 0);
      const periodos = Math.max(Math.ceil(dias / (_divs[m.frecuencia_ahorro] || 30)), 1);
      return { nombre: m.nombre, emoji: m.emoji, cuota: restante / periodos };
    })
    .filter(Boolean);

  const totalMetas = metasConCuota.reduce((s, m) => s + m.cuota, 0);
  const totalComprometido = pagosPendientes.reduce((acc, pago) => acc + Number(pago.monto || 0), 0) + totalMetas;
  const libre = monto - totalComprometido;

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
            <div class="item-row-name">${escapeHtml(pago.nombre || '')}</div>
            <div class="item-row-detail">${pago.tipo === 'fijo' ? 'Gasto fijo' : 'Deuda'}${pago.urgente ? ' · <i data-lucide="alert-triangle" style="width:18px;height:18px;stroke-width:1.75"></i> Urgente' : ''}</div>
          </div>
          <div class="item-row-amount">${pago.fecha_flexible && !pago.monto ? 'Variable' : formatMXN(pago.monto)}</div>
        </div>
      `).join('')}
    </div>

    ${metasConCuota.length > 0 ? `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;padding:0 2px">Metas de ahorro</div>
      ${metasConCuota.map(m => `
        <div class="item-row" style="margin-bottom:0">
          <div class="item-row-emoji">${renderEmojiOrIcon(m.emoji, 'target', 18)}</div>
          <div class="item-row-info">
            <div class="item-row-name">${String(m.nombre ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            <div class="item-row-detail">Aporte sugerido</div>
          </div>
          <div class="item-row-amount">${formatMXN(m.cuota)}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

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

// Funciones invocadas desde atributos onclick en HTML generado dinámicamente
window.openMenuIngresoProgramado = openMenuIngresoProgramado;
window.renderCamposFechaEditarIngresoProgramado = renderCamposFechaEditarIngresoProgramado;
window.openEditarIngresoProgramado = openEditarIngresoProgramado;
window.guardarEdicionIngresoProgramado = guardarEdicionIngresoProgramado;
window.openAgregarIngresoProgramado = openAgregarIngresoProgramado;
window.renderCamposFechaIngresoProgramado = renderCamposFechaIngresoProgramado;
window.guardarIngresoProgramado = guardarIngresoProgramado;
window.eliminarIngresoProgramado = eliminarIngresoProgramado;
window.openMenuIngresoHistorial = openMenuIngresoHistorial;
window.eliminarIngreso = eliminarIngreso;
window.openRegistrarIngreso = openRegistrarIngreso;
window.guardarIngreso = guardarIngreso;
window.onEntendidoDineroComprometido = onEntendidoDineroComprometido;
