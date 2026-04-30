// js/presupuestos.js
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN, showSnackbar, renderLucideIcons,
  openModal, closeModal
} from './app.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export async function loadPresupuestos() {
  const uid = await getUsuarioId();
  const hoy = new Date();
  const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const inicioMes = `${periodo}-01`;
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

  const [
    { data: presupuestos },
    { data: categorias },
    { data: gastosMes }
  ] = await Promise.all([
    db.from('presupuestos').select('*').eq('usuario_id', uid).eq('periodo', periodo),
    db.from('categorias').select('id, nombre, emoji').eq('usuario_id', uid).eq('tipo', 'gasto').order('nombre', { ascending: true }),
    db.from('gastos').select('categoria_id, monto').eq('usuario_id', uid).neq('es_ahorro', true).gte('fecha', inicioMes).lte('fecha', finMes).not('categoria_id', 'is', null)
  ]);

  const gastoPorCat = {};
  for (const g of (gastosMes || [])) {
    gastoPorCat[g.categoria_id] = (gastoPorCat[g.categoria_id] || 0) + Number(g.monto);
  }

  const presupuestoPorCat = {};
  for (const p of (presupuestos || [])) {
    presupuestoPorCat[p.categoria_id] = p;
  }

  window._presupuestosCatMap = Object.fromEntries((categorias || []).map(c => [c.id, c.nombre]));
  const catsSinPresupuesto = (categorias || []).filter(c => !presupuestoPorCat[c.id]);
  const catsConPresupuesto = (categorias || []).filter(c => presupuestoPorCat[c.id]);

  const renderFila = (cat) => {
    const p = presupuestoPorCat[cat.id];
    const gastado = gastoPorCat[cat.id] || 0;
    const limite = p ? Number(p.monto_limite) : 0;
    const pct = limite > 0 ? Math.min(Math.round((gastado / limite) * 100), 100) : 0;
    const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
    const icono = cat.emoji || 'package';
    const isLucide = /^[a-z][a-z0-9-]*$/.test(icono);
    const iconHtml = isLucide
      ? `<i data-lucide="${icono}" style="width:20px;height:20px;stroke-width:1.75"></i>`
      : `<span style="font-size:18px">${escapeHtml(icono)}</span>`;

    if (!p) {
      return `
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px">
          <div style="display:flex;align-items:center;gap:10px">
            ${iconHtml}
            <div style="font-size:14px;font-weight:500">${escapeHtml(cat.nombre)}</div>
          </div>
          <button class="btn btn-secondary" style="padding:6px 14px;font-size:13px" onclick="openPresupuestoModal('${cat.id}',null)">Establecer</button>
        </div>
      `;
    }

    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px">
            ${iconHtml}
            <div>
              <div style="font-size:14px;font-weight:600">${escapeHtml(cat.nombre)}</div>
              <div style="font-size:12px;color:var(--text-muted)">Límite: ${formatMXN(limite)}</div>
            </div>
          </div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;min-width:32px;min-height:32px;justify-content:center" onclick="openPresupuestoModal('${cat.id}','${p.id}')"><i data-lucide="pencil" style="width:15px;height:15px;pointer-events:none"></i></button>
        </div>
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.5s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:var(--text-secondary)">${pct}% usado</span>
          <span style="font-weight:600;color:${color}">${formatMXN(gastado)} / ${formatMXN(limite)}</span>
        </div>
      </div>
    `;
  };

  const mes = hoy.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  document.getElementById('page-presupuestos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Presupuestos</h1>
      <div style="font-size:12px;color:var(--text-muted);text-transform:capitalize;margin-top:2px">${mes}</div>
    </div>
    <div class="page-body">
      ${catsConPresupuesto.length === 0 && catsSinPresupuesto.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No hay categorías de gasto.<br>Crea categorías primero.</p>
        </div>
      ` : ''}
      ${catsConPresupuesto.map(renderFila).join('')}
      ${catsSinPresupuesto.length > 0 ? `
        <div style="font-size:12px;color:var(--text-muted);margin:16px 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Sin presupuesto</div>
        ${catsSinPresupuesto.map(renderFila).join('')}
      ` : ''}
    </div>
  `;

  renderLucideIcons();
}

async function openPresupuestoModal(categoriaId, presupuestoId) {
  const uid = await getUsuarioId();
  const categoriaNombre = window._presupuestosCatMap?.[categoriaId] || '';
  let montoActual = '';

  if (presupuestoId) {
    const { data: p } = await db.from('presupuestos').select('monto_limite').eq('id', presupuestoId).maybeSingle();
    if (p) montoActual = Number(p.monto_limite);
  }

  const titulo = presupuestoId ? `Editar: ${escapeHtml(categoriaNombre)}` : `Establecer: ${escapeHtml(categoriaNombre)}`;

  openModal(titulo, `
    <div class="form-group">
      <label class="form-label">Límite mensual</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="pres-monto" type="number" min="0" placeholder="0.00" value="${montoActual}" /></div>
    </div>
    ${presupuestoId ? `<button class="btn btn-danger" style="margin-bottom:8px" onclick="eliminarPresupuesto('${presupuestoId}')">Eliminar presupuesto</button>` : ''}
    <button class="btn btn-primary" onclick="guardarPresupuesto('${categoriaId}')">Guardar</button>
  `);

  window._presupuestoEditId = presupuestoId || null;
  window._presupuestoCatId = categoriaId;
}

async function guardarPresupuesto(categoriaId) {
  const monto_limite = parseFloat(document.getElementById('pres-monto')?.value);
  if (!monto_limite || monto_limite <= 0 || !isFinite(monto_limite)) {
    showSnackbar('Ingresa un monto válido', 'error');
    return;
  }
  if (monto_limite > 999_999_999) {
    showSnackbar('Monto excede el límite permitido', 'error');
    return;
  }

  const uid = await getUsuarioId();
  const hoy = new Date();
  const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const { error } = await db.from('presupuestos').upsert(
    { usuario_id: uid, categoria_id: categoriaId, monto_limite, periodo },
    { onConflict: 'usuario_id,categoria_id,periodo' }
  );

  if (error) {
    showSnackbar('No se pudo guardar el presupuesto', 'error');
    return;
  }

  closeModal();
  showSnackbar('Presupuesto guardado ✓', 'success');
  await loadPresupuestos();
}

async function _doEliminarPresupuesto(presupuestoId) {
  const uid = await getUsuarioId();
  const { error } = await db.from('presupuestos').delete().eq('id', presupuestoId).eq('usuario_id', uid);
  if (error) { showSnackbar('No se pudo eliminar el presupuesto', 'error'); return; }
  closeModal();
  showSnackbar('Presupuesto eliminado', 'success');
  await loadPresupuestos();
}

function eliminarPresupuesto(presupuestoId) {
  openConfirmModal('¿Eliminar este presupuesto?', `_doEliminarPresupuesto('${presupuestoId}')`);
}
window._doEliminarPresupuesto = _doEliminarPresupuesto;

window.openPresupuestoModal = openPresupuestoModal;
window.guardarPresupuesto = guardarPresupuesto;
window.eliminarPresupuesto = eliminarPresupuesto;
