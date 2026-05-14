// js/metas.js

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN, showSnackbar, renderLucideIcons,
  openModal, closeModal, openActionSheet,
  renderEmojiOrIcon, loadDashboard
} from './app.js';
import { getSaldoCuentaEspecifica } from './balance.js';
import { loadCuentas } from './cuentas.js';

let currentEditMetaId = null;

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

function _mensajeProgresoMeta(m, pct) {
  if (pct >= 100) return { txt: 'Meta alcanzada', color: 'var(--green)', icono: 'check-circle-2' };
  if (m.monto_actual <= 0) return { txt: 'Comienza con tu primer ahorro', color: 'var(--text-muted)', icono: 'piggy-bank' };

  // Estimación de ritmo usando created_at
  const creado = m.created_at ? new Date(m.created_at) : null;
  if (creado) {
    const diasTranscurridos = Math.max(1, Math.round((Date.now() - creado.getTime()) / 86400000));
    const ritmoMensual = (Number(m.monto_actual) / diasTranscurridos) * 30;
    const faltante = Number(m.monto_objetivo) - Number(m.monto_actual);
    if (ritmoMensual > 0) {
      const mesesRestantes = Math.round(faltante / ritmoMensual);
      if (mesesRestantes <= 0) return { txt: `Ya llevas el ${pct}%, casi lista`, color: 'var(--accent)', icono: 'trending-up' };
      if (mesesRestantes <= 3) return { txt: `A este ritmo: ${mesesRestantes} mes${mesesRestantes > 1 ? 'es' : ''} para alcanzarla`, color: 'var(--accent)', icono: 'trending-up' };
      if (mesesRestantes <= 12) return { txt: `A este ritmo: ${mesesRestantes} meses para alcanzarla`, color: 'var(--text-muted)', icono: 'clock' };
      return { txt: `Ahorra más seguido para alcanzarla más rápido`, color: 'var(--yellow)', icono: 'alert-triangle' };
    }
  }

  if (pct >= 75) return { txt: `Ya llevas el ${pct}%, sigue así`, color: 'var(--accent)', icono: 'trending-up' };
  if (pct >= 50) return { txt: `Ya llevas el ${pct}% de tu meta`, color: 'var(--accent)', icono: 'trending-up' };
  return { txt: `${pct}% completado`, color: 'var(--text-muted)', icono: 'target' };
}

export async function loadMetas() {
  const uid = await getUsuarioId();
  const [{ data: metas }, { data: cuentas }] = await Promise.all([
    db.from('metas_ahorro').select('*').eq('usuario_id', uid).eq('activa', true),
    db.from('cuentas').select('id, nombre').eq('usuario_id', uid).eq('activa', true),
  ]);

  const cuentasPorId = Object.fromEntries((cuentas || []).map(c => [c.id, c.nombre]));

  // Fondo de emergencia primero
  const metasOrdenadas = [...(metas || [])].sort((a, b) => {
    const esEmergA = /emergencia|fondo/i.test(a.nombre) ? 0 : 1;
    const esEmergB = /emergencia|fondo/i.test(b.nombre) ? 0 : 1;
    return esEmergA - esEmergB;
  });

  document.getElementById('page-metas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Metas de ahorro</h1>
    </div>
    <div class="page-body">
      ${!metasOrdenadas.length ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="piggy-bank" style="width:40px;height:40px;stroke-width:1.5"></i></div>
          <p>Sin metas de ahorro</p>
          <p style="font-size:13px;color:var(--text-muted);margin-top:4px">Los expertos recomiendan empezar con un fondo de emergencia de 3 meses de gastos.</p>
        </div>
      ` : metasOrdenadas.map(m => {
        const pct = m.monto_objetivo > 0 ? Math.min(Math.round((m.monto_actual / m.monto_objetivo) * 100), 100) : 0;
        const esFondo = /emergencia|fondo/i.test(m.nombre);
        const progreso = _mensajeProgresoMeta(m, pct);
        const barColor = pct >= 100 ? 'var(--green)' : esFondo ? 'var(--accent)' : 'var(--accent)';
        return `
          <div class="card${esFondo ? ' meta-fondo-destacada' : ''}">
            ${esFondo ? `<div class="meta-fondo-label"><i data-lucide="shield" style="width:11px;height:11px"></i> Prioritaria</div>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:12px">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:var(--bg-hover);border-radius:var(--radius-sm)">${renderEmojiOrIcon(m.emoji, 'target', 22)}</span>
                <div>
                  <div style="font-weight:600;font-size:14px">${escapeHtml(m.nombre)}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${m.cuenta_id ? escapeHtml(cuentasPorId[m.cuenta_id] || 'Cuenta eliminada') : 'Sin cuenta vinculada'}</div>
                </div>
              </div>
              <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuMeta('${m.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
            </div>
            <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:8px">
              <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.6s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px">
              <span style="color:var(--green);font-weight:600">${formatMXN(m.monto_actual)}</span>
              <span style="color:var(--text-muted)">de ${formatMXN(m.monto_objetivo)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;font-size:12px;color:${progreso.color}">
              <i data-lucide="${progreso.icono}" style="width:12px;height:12px;flex-shrink:0"></i>
              <span>${progreso.txt}</span>
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
    { label: 'Editar', icon: 'pencil', fullWidth: true, onClick: `openAgregarMeta('${metaId}')` },
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
        ${metas.map(meta => `<option value="${escapeHtml(meta.id)}" ${metaId && meta.id === metaId ? 'selected' : ''}>${escapeHtml(meta.nombre)}</option>`).join('')}
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

async function openAgregarMeta(metaId = null) {
  const usuarioId = await getUsuarioId();
  const { data: cuentas } = await db.from('cuentas').select('id, nombre').eq('usuario_id', usuarioId).eq('activa', true);

  currentEditMetaId = metaId || null;

  let draft = { nombre: '', monto: '', cuenta_id: '' };
  let iconoInicial = 'target';

  if (metaId) {
    const { data: meta, error } = await db
      .from('metas_ahorro')
      .select('id, nombre, emoji, monto_objetivo, cuenta_id')
      .eq('id', metaId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error || !meta) {
      currentEditMetaId = null;
      showSnackbar('No se pudo cargar la meta', 'error');
      return;
    }

    draft = { nombre: meta.nombre || '', monto: meta.monto_objetivo != null ? Number(meta.monto_objetivo) : '', cuenta_id: meta.cuenta_id || '' };
    iconoInicial = (meta.emoji && /^[a-z][a-z0-9-]*$/.test(meta.emoji)) ? meta.emoji : 'target';
  }

  const cuentasOptions = (cuentas || []).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}</option>`).join('');

  window._metaIcono = iconoInicial;
  window._metaIconPanelOpen = false;
  window._metaDraft = draft;
  window._metaCuentasOptions = cuentasOptions;

  renderMetaModal();
}

function renderMetaModal() {
  const icono       = window._metaIcono || 'target';
  const panelAbierto = window._metaIconPanelOpen;
  const draft       = window._metaDraft || { nombre: '', monto: '', cuenta_id: '', fecha_limite: '', frecuencia_ahorro: 'mensual' };
  const titulo      = currentEditMetaId ? 'Editar meta' : 'Nueva meta de ahorro';
  const btnLabel    = currentEditMetaId ? 'Guardar cambios' : 'Guardar meta';
  const iconoBtn = `<i data-lucide="${icono || 'target'}" style="width:20px;height:20px;stroke-width:1.75"></i>`;

  openModal(titulo, `
    <div class="form-group">
      <div class="custom-form-row" style="align-items:center;margin-bottom:4px">
        <button type="button" class="emoji-picker-btn" onclick="toggleMetaIconPanel()">${iconoBtn}</button>
        <span style="font-size:13px;color:var(--text-secondary);margin-left:10px">Toca para cambiar el ícono</span>
      </div>
      ${panelAbierto ? `
        <div class="icon-panel" style="margin-top:10px">
          <div class="icon-grid">
            ${TODOS_ICONOS.map(ic => `
              <div class="icon-grid-item${icono === ic ? ' selected' : ''}" onclick="selectMetaIcono('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">¿Para qué estás ahorrando?</label>
      <input class="form-input" id="nm-nombre" type="text" placeholder="Ej: Fondo de emergencia, enganche, vacaciones…" value="${escapeHtml(draft.nombre)}" />
      <p class="form-hint" style="margin:4px 0 0">Sugerencias: Fondo de emergencia · Quincena extra · Enganche de coche · Vacaciones</p>
    </div>
    <div class="form-group">
      <label class="form-label">¿Cuánto necesitas juntar?</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nm-monto" type="number" placeholder="0.00" min="0" value="${draft.monto}" oninput="calcularAhorroMetaDash()" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha límite</label>
      <input class="form-input" id="nm-fecha-limite" type="date" value="${draft.fecha_limite || ''}" onchange="calcularAhorroMetaDash()" />
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia de ahorro</label>
      <select class="form-select" id="nm-frecuencia" onchange="calcularAhorroMetaDash()">
        <option value="diaria"    ${draft.frecuencia_ahorro === 'diaria'    ? 'selected' : ''}>Diaria</option>
        <option value="semanal"   ${draft.frecuencia_ahorro === 'semanal'   ? 'selected' : ''}>Semanal</option>
        <option value="quincenal" ${draft.frecuencia_ahorro === 'quincenal' ? 'selected' : ''}>Quincenal</option>
        <option value="mensual"   ${draft.frecuencia_ahorro === 'mensual'   ? 'selected' : ''}>Mensual</option>
        <option value="libre"     ${draft.frecuencia_ahorro === 'libre'     ? 'selected' : ''}>Libre (sin fecha fija)</option>
      </select>
    </div>
    <p id="nm-calculo-sugerido" style="font-size:13px;color:var(--accent);margin-bottom:10px;min-height:18px;font-weight:500"></p>
    <div class="form-group">
      <label class="form-label">¿En qué cuenta ahorrarás?</label>
      <select class="form-select" id="meta-cuenta-id">
        <option value="">Sin cuenta vinculada</option>
        ${window._metaCuentasOptions}
      </select>
    </div>
    <button class="btn btn-primary" onclick="guardarMeta()">${btnLabel}</button>
  `);

  const selCuenta = document.getElementById('meta-cuenta-id');
  if (selCuenta && draft.cuenta_id) selCuenta.value = draft.cuenta_id;
  renderLucideIcons();
}

function _capturarDraftMeta() {
  return {
    nombre:           document.getElementById('nm-nombre')?.value || '',
    monto:            document.getElementById('nm-monto')?.value || '',
    cuenta_id:        document.getElementById('meta-cuenta-id')?.value || '',
    fecha_limite:     document.getElementById('nm-fecha-limite')?.value || '',
    frecuencia_ahorro: document.getElementById('nm-frecuencia')?.value || 'mensual',
  };
}

window.toggleMetaIconPanel = function() {
  window._metaDraft = _capturarDraftMeta();
  window._metaIconPanelOpen = !window._metaIconPanelOpen;
  renderMetaModal();
};

window.selectMetaIcono = function(ic) {
  window._metaDraft = _capturarDraftMeta();
  window._metaIcono = ic;
  window._metaIconPanelOpen = false;
  renderMetaModal();
};

window.calcularAhorroMetaDash = function() {
  const monto      = parseFloat(document.getElementById('nm-monto')?.value);
  const fechaStr   = document.getElementById('nm-fecha-limite')?.value;
  const frecuencia = document.getElementById('nm-frecuencia')?.value;
  const resultado  = document.getElementById('nm-calculo-sugerido');
  if (!resultado) return;

  if (!monto || monto <= 0 || !fechaStr || frecuencia === 'libre') {
    resultado.textContent = ''; return;
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaStr + 'T00:00:00');
  if (limite <= hoy) { resultado.textContent = ''; return; }

  const dias      = Math.ceil((limite - hoy) / 86400000);
  const divisores = { diaria: 1, semanal: 7, quincenal: 15, mensual: 30 };
  const singular  = { diaria: 'día',   semanal: 'semana',  quincenal: 'quincena', mensual: 'mes'   };
  const plural    = { diaria: 'días',  semanal: 'semanas', quincenal: 'quincenas',mensual: 'meses' };
  const periodos  = Math.ceil(dias / (divisores[frecuencia] || 30));
  if (periodos <= 0) { resultado.textContent = ''; return; }

  const cuota    = monto / periodos;
  const labelPer = periodos === 1 ? singular[frecuencia] : plural[frecuencia];
  resultado.textContent = `Deberás ahorrar ${formatMXN(cuota)} cada ${singular[frecuencia]} (${periodos} ${labelPer}).`;
};

async function guardarMeta() {
  const emoji = window._metaIcono || 'target';
  const nombre = document.getElementById('nm-nombre')?.value.trim();
  const monto_objetivo = parseFloat(document.getElementById('nm-monto')?.value);
  const cuenta_id = document.getElementById('meta-cuenta-id')?.value || null;

  if (!nombre || Number.isNaN(monto_objetivo) || monto_objetivo <= 0) {
    showSnackbar('Completa nombre y monto', 'error');
    return;
  }

  const usuarioId = await getUsuarioId();

  if (currentEditMetaId) {
    const metaId = currentEditMetaId;
    currentEditMetaId = null;

    const { error } = await db
      .from('metas_ahorro')
      .update({ emoji, nombre, monto_objetivo, cuenta_id: cuenta_id || null })
      .eq('id', metaId)
      .eq('usuario_id', usuarioId);

    if (error) { showSnackbar('No se pudo actualizar la meta', 'error'); return; }
    closeModal();
    showSnackbar('Meta actualizada ✓', 'success');
  } else {
    const { error } = await db.from('metas_ahorro').insert({
      usuario_id: usuarioId,
      emoji, nombre, monto_objetivo, cuenta_id, activa: true
    });

    if (error) { showSnackbar('No se pudo crear la meta', 'error'); return; }
    closeModal();
    showSnackbar('Meta creada ✓', 'success');
  }

  await loadMetas();
  await loadDashboard();
}

window.openMenuMeta = openMenuMeta;
window.eliminarMeta = eliminarMeta;
window.openAgregarMeta = openAgregarMeta;
window.guardarMeta = guardarMeta;
window.renderMetaAbonoHint = renderMetaAbonoHint;
window.guardarAbonoMeta = guardarAbonoMeta;
window.openAbonarMeta = openAbonarMeta;
