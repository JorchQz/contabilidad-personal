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

  const renderFila = (cat, pctTiempo = 0) => {
    const p = presupuestoPorCat[cat.id];
    const gastado = gastoPorCat[cat.id] || 0;
    const limite = p ? Number(p.monto_limite) : 0;
    const pct = limite > 0 ? Math.min(Math.round((gastado / limite) * 100), 100) : 0;
    const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
    const proyeccion = diaActual >= 5 && gastado > 0 ? Math.round(gastado * (diasMes / diaActual)) : 0;
    const proyeccionLabel = limite > 0 && proyeccion > limite
      ? `<span style="font-size:11px;color:var(--yellow)">~${formatMXN(proyeccion)} al mes a este ritmo</span>` : '';
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
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;position:relative;margin-bottom:8px">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.5s ease"></div>
          ${pctTiempo > 0 ? `<div style="position:absolute;top:0;left:${pctTiempo}%;width:2px;height:100%;background:var(--text-muted);opacity:0.4" title="Ritmo esperado hoy"></div>` : ''}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <div>${proyeccionLabel || `<span style="color:var(--text-secondary)">${pct}% usado</span>`}</div>
          <span style="font-weight:600;color:${color}">${formatMXN(gastado)} / ${formatMXN(limite)}</span>
        </div>
      </div>
    `;
  };

  const mes = hoy.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diaActual = hoy.getDate();
  const diasRestantes = diasMes - diaActual;
  const pctTiempoMes = Math.round((diaActual / diasMes) * 100);

  const totalLimite  = catsConPresupuesto.reduce((s, c) => s + Number(presupuestoPorCat[c.id]?.monto_limite || 0), 0);
  const totalGastado = catsConPresupuesto.reduce((s, c) => s + (gastoPorCat[c.id] || 0), 0);
  const pctTotal = totalLimite > 0 ? Math.min(Math.round((totalGastado / totalLimite) * 100), 100) : 0;
  const colorTotal = pctTotal >= 100 ? 'var(--red)' : pctTotal >= 80 ? 'var(--yellow)' : 'var(--green)';

  const resumenHtml = catsConPresupuesto.length > 0 ? `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;font-weight:600">Total presupuestado</span>
        <span style="font-size:13px;font-weight:700;color:${colorTotal}">${formatMXN(totalGastado)} / ${formatMXN(totalLimite)}</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;position:relative;margin-bottom:8px">
        <div style="height:100%;width:${pctTotal}%;background:${colorTotal};border-radius:4px;transition:width 0.5s ease"></div>
        <div style="position:absolute;top:0;left:${pctTiempoMes}%;width:2px;height:100%;background:var(--text-muted);opacity:0.5" title="Ritmo esperado hoy"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)">
        <span>${pctTotal}% del presupuesto</span>
        <span style="display:flex;align-items:center;gap:4px"><i data-lucide="calendar" style="width:12px;height:12px;stroke-width:1.75"></i> Faltan ${diasRestantes} días</span>
      </div>
    </div>` : '';

  document.getElementById('page-presupuestos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Presupuestos</h1>
      <div style="font-size:12px;color:var(--text-muted);text-transform:capitalize;margin-top:2px">${mes}</div>
    </div>
    <div class="page-body">
      ${catsConPresupuesto.length === 0 && catsSinPresupuesto.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="pie-chart" style="width:48px;height:48px;stroke-width:1.5"></i></div>
          <p>No hay categorías de gasto.<br>Crea categorías primero.</p>
        </div>
      ` : ''}
      ${resumenHtml}
      ${catsConPresupuesto.map(cat => renderFila(cat, pctTiempoMes)).join('')}
      ${catsSinPresupuesto.length > 0 ? `
        <details style="margin-top:8px">
          <summary style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;cursor:pointer;padding:8px 0;list-style:none;display:flex;align-items:center;gap:6px">
            <i data-lucide="chevron-right" style="width:14px;height:14px;stroke-width:2;transition:transform 200ms" class="details-chevron"></i>
            Sin presupuesto (${catsSinPresupuesto.length})
          </summary>
          <div style="margin-top:8px">
            ${catsSinPresupuesto.map(cat => renderFila(cat, pctTiempoMes)).join('')}
          </div>
        </details>
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
  showSnackbar('Presupuesto guardado', 'success');
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
