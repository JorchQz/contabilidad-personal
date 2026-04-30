// js/deudas.js
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN, showSnackbar, renderLucideIcons,
  openModal, closeModal, openActionSheet, loadDashboard
} from './app.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let currentEditDeudaId = null;

function calcularProyeccionLiquidacion(montoActual, montoPago, tasaAnual, tipoPago) {
  if (!montoPago || montoPago <= 0 || !montoActual || montoActual <= 0) return null;
  const periodosPorAnio = { mensual: 12, quincenal: 24, semanal: 52, unico: 1 };
  const diasPorPeriodo  = { mensual: 30, quincenal: 15, semanal: 7,  unico: 1 };
  const freq = periodosPorAnio[tipoPago] || 12;
  const dias = diasPorPeriodo[tipoPago]  || 30;
  const tasa = Number(tasaAnual || 0);
  let nPeriodos;
  if (tasa <= 0) {
    nPeriodos = Math.ceil(montoActual / montoPago);
  } else {
    const r = (tasa / 100) / freq;
    if (montoPago <= r * montoActual) return { sinSalida: true };
    nPeriodos = Math.ceil(-Math.log(1 - (r * montoActual) / montoPago) / Math.log(1 + r));
  }
  if (!isFinite(nPeriodos) || nPeriodos <= 0) return null;
  if (nPeriodos > 600) return { lejano: true, anios: Math.round(nPeriodos / freq) };
  const meses = Math.round(nPeriodos / (freq / 12));
  const fechaLiq = new Date(Date.now() + nPeriodos * dias * 86400000);
  return { fecha: fechaLiq, nPeriodos, meses };
}

function renderPlanPago(deudas) {
  const atacables = deudas.filter(d =>
    d.monto_pago > 0 && d.monto_actual > 0 &&
    d.tipo_deuda !== 'flexible' && d.tipo_deuda !== 'tabla'
  );
  if (atacables.length < 2) return '';

  const conTasa = atacables.some(d => (d.tasa_interes_anual || 0) > 0);
  const ordenBola = [...atacables].sort((a, b) => a.monto_actual - b.monto_actual);
  const ordenAval  = [...atacables].sort((a, b) => (b.tasa_interes_anual || 0) - (a.tasa_interes_anual || 0));

  const filas = (lista) => lista.map((d, i) => {
    const proy = calcularProyeccionLiquidacion(d.monto_actual, d.monto_pago, d.tasa_interes_anual, d.tipo_pago);
    const labelMeses = proy?.meses ? (proy.meses <= 1 ? 'menos de 1 mes' : `${proy.meses} meses`) : '';
    const primero = i === 0;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:var(--radius-xs);${primero ? 'background:var(--accent-soft);border:1px solid rgba(59,130,246,0.2)' : 'opacity:0.6'}">
        <span style="font-size:13px;font-weight:700;color:${primero ? 'var(--accent)' : 'var(--text-muted)'};min-width:18px;text-align:center">${i + 1}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:${primero ? '700' : '500'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.acreedor)}</div>
          ${labelMeses ? `<div style="font-size:11px;color:var(--text-secondary)">${primero ? 'Siguiente objetivo · ' : ''}libre en ${labelMeses}</div>` : ''}
        </div>
        <span style="font-size:12px;color:var(--text-secondary);flex-shrink:0">${formatMXN(d.monto_actual)}</span>
      </div>`;
  }).join('');

  const activo = 'background:var(--accent);color:#fff;border:1px solid var(--accent);padding:5px 10px;border-radius:var(--radius-xs);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)';
  const ghost  = 'background:transparent;color:var(--accent);border:1px solid var(--accent);padding:5px 10px;border-radius:var(--radius-xs);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)';

  return `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <i data-lucide="route" style="width:16px;height:16px;stroke-width:1.75;color:var(--accent)"></i>
          <span style="font-size:13px;font-weight:600">Plan de pago</span>
        </div>
        ${conTasa ? `
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button id="btn-plan-bola" onclick="togglePlanMetodo('bola')" style="${activo}">Bola de nieve</button>
          <button id="btn-plan-aval" onclick="togglePlanMetodo('avalancha')" style="${ghost}">Avalancha</button>
        </div>` : ''}
      </div>
      <div id="plan-display-bola" style="display:flex;flex-direction:column;gap:4px">
        ${filas(ordenBola)}
        <p style="font-size:11px;color:var(--text-muted);margin:8px 0 0">Primero la deuda más pequeña — cada victoria te da impulso.</p>
      </div>
      <div id="plan-display-aval" style="display:none;flex-direction:column;gap:4px">
        ${filas(ordenAval)}
        <p style="font-size:11px;color:var(--text-muted);margin:8px 0 0">Primero la de mayor interés — pagas menos en total.</p>
      </div>
    </div>`;
}

export async function loadDeudas() {
  const uid = (await getUsuarioId());
  const { data: deudas } = await db.from('deudas').select('*').eq('usuario_id', uid).eq('activa', true).order('created_at');

  const getBadgeDeuda = (tipo) => {
    const badges = {
      simple: '<i data-lucide="credit-card" style="width:18px;height:18px;stroke-width:1.75"></i>',
      variable: '<i data-lucide="line-chart" style="width:18px;height:18px;stroke-width:1.75"></i>',
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
      const pct = d.monto_inicial > 0 ? Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100) : 0;
      const badgeEmoji = getBadgeDeuda(d.tipo_deuda);

      let proyeccionHtml = '';
      if (d.tipo_deuda !== 'tabla' && d.tipo_deuda !== 'flexible' && d.monto_pago) {
        const proy = calcularProyeccionLiquidacion(d.monto_actual, d.monto_pago, d.tasa_interes_anual, d.tipo_pago);
        if (proy?.sinSalida) {
          proyeccionHtml = `<div style="margin-top:6px;font-size:12px;color:var(--red);display:flex;align-items:center;gap:4px"><i data-lucide="alert-triangle" style="width:12px;height:12px;stroke-width:2.5"></i> El pago no cubre los intereses</div>`;
        } else if (proy?.lejano) {
          proyeccionHtml = `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">Proyección: ~${proy.anios} año${proy.anios !== 1 ? 's' : ''} con el pago actual</div>`;
        } else if (proy?.fecha) {
          const cerca = proy.meses <= 3;
          const label = proy.meses <= 1 ? 'menos de un mes' : `${proy.meses} mese${proy.meses !== 1 ? 's' : ''}`;
          proyeccionHtml = `<div style="margin-top:6px;font-size:12px;color:${cerca ? 'var(--green)' : 'var(--text-secondary)'};display:flex;align-items:center;gap:4px"><i data-lucide="calendar-check" style="width:12px;height:12px;stroke-width:1.75"></i> Libre en ${label} · ${proy.fecha.toLocaleDateString('es-MX', {month:'long', year:'numeric'})}</div>`;
        }
      }

      let botonPagoHTML = '';
      let sinTablaConfigurada = false;
      if (d.tipo_deuda === 'tabla') {
        const { data: todosPagosProg } = await db.from('pagos_programados')
          .select('id, numero_pago, fecha_vencimiento, monto_esperado, pagado')
          .eq('deuda_id', d.id)
          .order('fecha_vencimiento');

        sinTablaConfigurada = !todosPagosProg || todosPagosProg.length === 0;
        const proximoPago = (todosPagosProg || []).find(p => !p.pagado) || null;

        if (proximoPago) {
          botonPagoHTML = `
            <div style="margin-top:12px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm)">
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Próximo pago</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-weight:600">Cuota #${proximoPago.numero_pago}</span>
                <span style="font-weight:700;color:var(--accent)">${formatMXN(proximoPago.monto_esperado)}</span>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Vence: ${new Date(proximoPago.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX')}</div>
              <button data-action="pagar-deuda" data-deuda-id="${escapeHtml(d.id)}" data-acreedor="${escapeHtml(d.acreedor)}" data-monto-actual="${d.monto_actual}" data-tipo-deuda="${escapeHtml(d.tipo_deuda)}" data-monto-ultimo-pago="${d.monto_ultimo_pago || ''}" style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body);width:100%">
                Registrar pago
              </button>
            </div>
          `;
        }
      } else {
        botonPagoHTML = `
          <button data-action="pagar-deuda" data-deuda-id="${escapeHtml(d.id)}" data-acreedor="${escapeHtml(d.acreedor)}" data-monto-actual="${d.monto_actual}" data-tipo-deuda="${escapeHtml(d.tipo_deuda)}" data-monto-ultimo-pago="${d.monto_ultimo_pago || ''}" style="margin-top:12px;background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body);width:100%">
            Registrar pago
          </button>
        `;
      }

      deudaCardsHTML += `
        <div class="deuda-card">
          <div class="deuda-header">
            <span class="deuda-acreedor">${badgeEmoji} ${escapeHtml(d.acreedor)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              ${sinTablaConfigurada ? `<span title="Sin tabla de pagos cargada" style="display:inline-flex;align-items:center;gap:3px;background:rgba(245,158,11,0.15);color:#d97706;border:1px solid rgba(245,158,11,0.35);border-radius:9999px;padding:2px 7px;font-size:11px;font-weight:600"><i data-lucide="alert-triangle" style="width:11px;height:11px;stroke-width:2.5"></i> Sin tabla</span>` : ''}
              <span class="deuda-badge ${escapeHtml(d.tipo_pago || d.tipo_deuda || '')}">${escapeHtml(d.tipo_pago || d.tipo_deuda || '')}</span>
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
          ${d.monto_pago ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Pago ${escapeHtml(d.tipo_pago || '')}: ${formatMXN(d.monto_pago)}</div>` : ''}
          ${proyeccionHtml}
          ${botonPagoHTML}
        </div>
      `;
    }
  }

  const planPagoHTML = deudas && deudas.length >= 2 ? renderPlanPago(deudas) : '';

  const pageDeudas = document.getElementById('page-deudas');
  pageDeudas.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Mis deudas</h1>
    </div>
    <div class="page-body">
      ${planPagoHTML}
      ${deudaCardsHTML}
    </div>
  `;

  pageDeudas.onclick = (e) => {
    const btn = e.target.closest('[data-action="pagar-deuda"]');
    if (!btn) return;
    openPagarDeuda(
      btn.dataset.deudaId,
      btn.dataset.acreedor,
      parseFloat(btn.dataset.montoActual),
      btn.dataset.tipoDeuda,
      btn.dataset.montoUltimoPago ? parseFloat(btn.dataset.montoUltimoPago) : null
    );
  };

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
  const H = 'height:46px;max-height:46px;width:100%';

  if (frecuencia === 'unico') {
    campos.innerHTML = `
      <label class="form-label">Día de pago</label>
      <input class="form-input" id="ed-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" style="${H}" />
    `;
    return;
  }

  if (frecuencia === 'mensual') {
    const edDiaPagoVal = document.getElementById('ed-dia-pago')?.value || '1';
    const opts = Array.from({length: 31}, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${parseInt(edDiaPagoVal) === d ? 'selected' : ''}>${d}</option>`).join('');
    campos.innerHTML = `
      <label class="form-label">Día del mes que pagas</label>
      <select class="form-select" id="ed-dia-pago" style="${H}">${opts}</select>
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    const edDiaSemVal = document.getElementById('ed-dia-semana')?.value || '1';
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="ed-dia-semana" style="${H}">
        <option value="1" ${edDiaSemVal === '1' ? 'selected' : ''}>Lunes</option>
        <option value="2" ${edDiaSemVal === '2' ? 'selected' : ''}>Martes</option>
        <option value="3" ${edDiaSemVal === '3' ? 'selected' : ''}>Miércoles</option>
        <option value="4" ${edDiaSemVal === '4' ? 'selected' : ''}>Jueves</option>
        <option value="5" ${edDiaSemVal === '5' ? 'selected' : ''}>Viernes</option>
        <option value="6" ${edDiaSemVal === '6' ? 'selected' : ''}>Sábado</option>
        <option value="0" ${edDiaSemVal === '0' ? 'selected' : ''}>Domingo</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `<p class="form-hint" style="margin:4px 0 0">Se programa para los días 15 y último de cada mes.</p>`;
    return;
  }

  campos.innerHTML = '';
}

async function openEditarDeuda(deudaId) {
  currentEditDeudaId = deudaId;

  const { data: deuda, error } = await db
    .from('deudas')
    .select('id, acreedor, monto_actual, tipo_pago, dia_pago, dia_semana, monto_pago, tipo_deuda, tasa_interes_anual')
    .eq('id', deudaId)
    .eq('usuario_id', (await getUsuarioId()))
    .maybeSingle();

  if (error || !deuda) {
    currentEditDeudaId = null;
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
      <input class="form-input" id="ed-acreedor" type="text" value="${escapeHtml(deuda.acreedor || '')}" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto actual</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ed-monto" type="number" min="0" value="${Number(deuda.monto_actual || 0)}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Tasa de interés anual % <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
      <input class="form-input" id="ed-tasa" type="number" min="0" max="999" value="${Number(deuda.tasa_interes_anual || 0)}" placeholder="Ej: 70 tarjeta · 30 caja popular · 0 sin interés" />
    </div>
    ${formFrecuencia}
    ${esTabla ? `
    <p class="form-hint" style="margin-bottom:8px">Esta deuda tiene una tabla de pagos programados.</p>
    <button class="btn btn-secondary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px" onclick="abrirCargarPagosDesdeEdicion('${deuda.id}')">
      <i data-lucide="table-2" style="width:16px;height:16px;stroke-width:1.75;pointer-events:none"></i> Cargar / ver pagos programados
    </button>` : ''}
    <button class="btn btn-primary" onclick="guardarEdicionDeuda(${esTabla})">Guardar cambios</button>
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

async function guardarEdicionDeuda(esTabla = false) {
  const acreedor = document.getElementById('ed-acreedor')?.value.trim();
  const monto_actual = parseFloat(document.getElementById('ed-monto')?.value);

  if (!acreedor || Number.isNaN(monto_actual) || monto_actual < 0) {
    showSnackbar('Completa los campos requeridos', 'error');
    return;
  }

  const tasa_interes_anual_edit = parseFloat(document.getElementById('ed-tasa')?.value) || 0;
  const payload = { acreedor, monto_actual, activa: monto_actual > 0, tasa_interes_anual: isFinite(tasa_interes_anual_edit) ? tasa_interes_anual_edit : 0 };

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

  const deudaId = currentEditDeudaId;
  currentEditDeudaId = null;

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

  openModal(`Pagar: ${escapeHtml(acreedor)}`, `
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
        <option value="">— Sin cuenta —</option>
        ${(cuentas || []).map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Nota (opcional)</label>
      <input class="form-input" id="pd-nota" type="text" placeholder="Ej: Abono quincenal" />
    </div>
    <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:16px">
      <input type="checkbox" id="pd-historico" style="width:16px;height:16px;cursor:pointer;margin-top:2px;flex-shrink:0" />
      <div>
        <div style="font-size:14px;font-weight:600">Ya pagado antes de usar la app</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Suma al progreso de la deuda, no resta saldo de cuenta</div>
      </div>
    </label>
    <button class="btn btn-primary" onclick="guardarPagoDeuda('${deudaId}', ${montoActual}, '${tipoDeuda}')">Registrar pago</button>
  `);
}

async function guardarPagoDeuda(deudaId, montoActual, tipoDeuda) {
  const monto = parseFloat(document.getElementById('pd-monto').value);
  const cuenta_id = document.getElementById('pd-cuenta')?.value || null;
  const nota = document.getElementById('pd-nota').value.trim();
  const esHistorico = document.getElementById('pd-historico')?.checked || false;
  const usuarioId = (await getUsuarioId());

  if (!monto || monto <= 0) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (monto > montoActual) { showSnackbar('El pago no puede ser mayor a la deuda', 'error'); return; }

  const nuevoMonto = montoActual - monto;
  const fechaHoy = new Date().toISOString().split('T')[0];

  if (!esHistorico) {
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

    const { error: errInsert } = await db.from('pagos_deuda').insert({
      deuda_id: deudaId,
      usuario_id: usuarioId,
      cuenta_id,
      monto, nota,
      fecha: fechaHoy
    });
    if (errInsert) { showSnackbar('Error al registrar el pago', 'error'); return; }
  }

  if (tipoDeuda === 'tabla') {
    const { data: proximoPago } = await db.from('pagos_programados')
      .select('id')
      .eq('deuda_id', deudaId)
      .eq('pagado', false)
      .order('fecha_vencimiento')
      .limit(1)
      .maybeSingle();

    if (proximoPago) {
      const { error: errProg } = await db.from('pagos_programados').update({
        pagado: true,
        fecha_pago: fechaHoy,
        monto_pagado: monto
      }).eq('id', proximoPago.id);
      if (errProg) { showSnackbar('Error al marcar cuota como pagada', 'error'); return; }
    }
  }

  const { error: errDeuda } = await db.from('deudas').update({
    monto_actual: nuevoMonto,
    activa: nuevoMonto > 0,
    ultimo_pago: fechaHoy,
    monto_ultimo_pago: monto
  }).eq('id', deudaId);
  if (errDeuda) { showSnackbar('Error al actualizar la deuda', 'error'); return; }

  closeModal();
  showSnackbar(nuevoMonto === 0 ? 'Deuda saldada' : 'Pago registrado ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

function openAgregarDeuda() {
  openModal('Nueva deuda', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <button onclick="selectTipoDeuda('simple')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font-body);text-align:left;transition:all 180ms ease">
        <i data-lucide="credit-card" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Simple</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Fijo<br>Fecha: Fija</div>
      </button>
      <button onclick="selectTipoDeuda('variable')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font-body);text-align:left;transition:all 180ms ease">
        <i data-lucide="trending-down" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Variable</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Cambia<br>Fecha: Fija</div>
      </button>
      <button onclick="selectTipoDeuda('tabla')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font-body);text-align:left;transition:all 180ms ease">
        <i data-lucide="calendar" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Con tabla</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Cambia<br>Fecha: Cambia</div>
      </button>
      <button onclick="selectTipoDeuda('flexible')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font-body);text-align:left;transition:all 180ms ease">
        <i data-lucide="wallet" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Flexible</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Libre<br>Fecha: Libre</div>
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
    <div class="form-group">
      <label class="form-label">Tasa de interés anual % <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
      <input class="form-input" id="nd-tasa" type="number" placeholder="Ej: 70 tarjeta · 30 caja popular · 0 sin interés" min="0" max="999" />
    </div>
  `;

  if (tipo === 'simple' || tipo === 'variable') {
    const sinLibre = tipo === 'simple' || tipo === 'variable';
    formContent += `
    <div class="form-group">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="nd-freq" onchange="renderCamposFechaDeuda()">
        <option value="unico">Pago único</option>
        <option value="semanal">Semanal</option>
        <option value="quincenal">Quincenal</option>
        <option value="mensual">Mensual</option>
        ${sinLibre ? '' : '<option value="libre">Sin fecha fija</option>'}
      </select>
    </div>
    <div class="form-group" id="nd-fecha-campos"></div>
    `;
  }

  if (tipo === 'simple' || tipo === 'variable' || tipo === 'flexible') {
    const cuotaLabel = tipo === 'simple' ? 'Cuota fija' : 'Pago estimado (opcional)';
    const cuotaReq   = tipo === 'simple' ? 'required' : '';
    formContent += `
    <div class="form-group">
      <label class="form-label">${cuotaLabel}</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nd-cuota" type="number" placeholder="0.00" min="0" ${cuotaReq} /></div>
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
  const H = 'height:46px;max-height:46px;width:100%';

  if (frecuencia === 'unico') {
    campos.innerHTML = `
      <label class="form-label">Fecha de pago</label>
      <input class="form-input" id="nd-fecha-pago" type="date" style="${H}" />
    `;
    return;
  }

  if (frecuencia === 'mensual') {
    const opts = Array.from({length: 31}, (_, i) => i + 1)
      .map(d => `<option value="${d}">${d}</option>`).join('');
    campos.innerHTML = `
      <label class="form-label">Día del mes que pagas</label>
      <select class="form-select" id="nd-dia-pago" style="${H}">${opts}</select>
    `;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="nd-dia-semana" style="${H}">
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miércoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sábado</option>
        <option value="0">Domingo</option>
      </select>
    `;
    return;
  }

  if (frecuencia === 'quincenal') {
    campos.innerHTML = `<p class="form-hint" style="margin:4px 0 0">Se programa para los días 15 y último de cada mes.</p>`;
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

  const tasa_interes_anual = parseFloat(document.getElementById('nd-tasa')?.value) || 0;
  if (!acreedor || !monto || monto <= 0 || !isFinite(monto)) { showSnackbar('Completa los campos requeridos', 'error'); return; }

  if (tipo === 'flexible') {
    tipo_pago = 'libre';
    monto_pago = parseFloat(document.getElementById('nd-cuota')?.value) || null;
  }

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
    acreedor, monto_inicial: monto, monto_actual: monto, tipo_pago, monto_pago, dia_pago, dia_semana, tipo_deuda: tipo,
    tasa_interes_anual: isFinite(tasa_interes_anual) ? tasa_interes_anual : 0
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

function abrirCargarPagosDesdeEdicion(deudaId) {
  const acreedor = document.getElementById('ed-acreedor')?.value.trim() || '';
  closeModal();
  setTimeout(() => openAgregarPagosProgramados(deudaId, acreedor), 200);
}

function openAgregarPagosProgramados(deudaId, acreedor) {
  filasPagesProgramados = [];
  const filasHTML = `
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

  openModal(`Pagos programados: ${escapeHtml(acreedor)}`, filasHTML);
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

  const numeroInt = parseInt(numero, 10);
  const montoFloat = parseFloat(monto);
  if (Number.isNaN(numeroInt) || numeroInt < 1 || Number.isNaN(montoFloat) || montoFloat <= 0) {
    showSnackbar('Número y monto deben ser valores válidos', 'error');
    return;
  }

  filasPagesProgramados.push({
    numero: numeroInt,
    fecha_vencimiento: fecha,
    monto_esperado: montoFloat
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

window.togglePlanMetodo = function(metodo) {
  const esBola = metodo === 'bola';
  const divBola = document.getElementById('plan-display-bola');
  const divAval  = document.getElementById('plan-display-aval');
  const btnBola  = document.getElementById('btn-plan-bola');
  const btnAval  = document.getElementById('btn-plan-aval');
  if (!divBola) return;
  divBola.style.display = esBola ? 'flex' : 'none';
  divAval.style.display  = esBola ? 'none' : 'flex';
  if (btnBola) { btnBola.style.background = esBola ? 'var(--accent)' : 'transparent'; btnBola.style.color = esBola ? '#fff' : 'var(--accent)'; }
  if (btnAval)  { btnAval.style.background  = esBola ? 'transparent' : 'var(--accent)'; btnAval.style.color  = esBola ? 'var(--accent)' : '#fff'; }
};

window.openMenuDeuda = openMenuDeuda;
window.openPagarDeuda = openPagarDeuda;
window.guardarPagoDeuda = guardarPagoDeuda;
window.openAgregarDeuda = openAgregarDeuda;
window.selectTipoDeuda = selectTipoDeuda;
window.renderCamposFechaDeuda = renderCamposFechaDeuda;
window.guardarNuevaDeuda = guardarNuevaDeuda;
window.renderCamposFechaEditarDeuda = renderCamposFechaEditarDeuda;
window.guardarEdicionDeuda = guardarEdicionDeuda;
window.openEditarDeuda = openEditarDeuda;
window.eliminarDeuda = eliminarDeuda;
window.agregarFilaPago = agregarFilaPago;
window.eliminarFilaPago = eliminarFilaPago;
window.guardarTablaPagesProgramados = guardarTablaPagesProgramados;
window.abrirCargarPagosDesdeEdicion = abrirCargarPagosDesdeEdicion;
