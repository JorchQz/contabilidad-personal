// js/metas.js
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN, showSnackbar, renderLucideIcons,
  openModal, closeModal, openActionSheet,
  renderEmojiOrIcon, loadDashboard
} from './app.js';
import { getSaldoCuentaEspecifica } from './balance.js';
import { loadCuentas } from './cuentas.js';

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

export async function loadMetas() {
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

window.openMenuMeta = openMenuMeta;
window.openEditarMeta = openEditarMeta;
window.eliminarMeta = eliminarMeta;
window.guardarEdicionMeta = guardarEdicionMeta;
window.openAgregarMeta = openAgregarMeta;
window.guardarNuevaMeta = guardarNuevaMeta;
window.renderMetaAbonoHint = renderMetaAbonoHint;
window.guardarAbonoMeta = guardarAbonoMeta;
window.openAbonarMeta = openAbonarMeta;
