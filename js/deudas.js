// js/deudas.js
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN, showSnackbar, renderLucideIcons,
  openModal, closeModal, openActionSheet, loadDashboard
} from './app.js';
import { calcularDesgloseAmortizacion, generarTablaAmortizacion } from './balance.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let currentEditDeudaId = null;
let _simuladorData    = null; // estado del simulador de abono extra

function calcularProyeccionLiquidacion(montoActual, montoPago, tasaAnual, tipoPago) {
  if (!montoPago || montoPago <= 0 || !montoActual || montoActual <= 0) return null;

  // Pago único: se liquida de una sola vez, no aplicar fórmula de amortización
  if (tipoPago === 'unico') {
    if (montoPago >= montoActual) {
      return { fecha: new Date(Date.now() + 30 * 86400000), nPeriodos: 1, meses: 0 };
    }
    return null; // pago único configurado por debajo del saldo — no proyectar
  }

  const periodosPorAnio = { mensual: 12, quincenal: 24, semanal: 52 };
  const diasPorPeriodo  = { mensual: 30, quincenal: 15, semanal: 7  };
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
  const interesTotal = Math.max((nPeriodos * montoPago) - montoActual, 0);
  return { fecha: fechaLiq, nPeriodos, meses, interesTotal };
}

function renderPlanPago(deudas) {
  const atacables = deudas.filter(d =>
    d.monto_actual > 0 && d.tipo_deuda !== 'flexible' &&
    (d.monto_pago > 0 || d.tipo_deuda === 'tabla')
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
  const [
    { data: deudas },
    { data: todosPagosProgramados }
  ] = await Promise.all([
    db.from('deudas').select('*').eq('usuario_id', uid).eq('activa', true).order('created_at'),
    db.from('pagos_programados')
      .select('id, deuda_id, numero_pago, fecha_vencimiento, monto_esperado, pagado')
      .eq('usuario_id', uid)
      .order('fecha_vencimiento')
  ]);

  const pagosPorDeuda = {};
  for (const p of (todosPagosProgramados || [])) {
    if (!pagosPorDeuda[p.deuda_id]) pagosPorDeuda[p.deuda_id] = [];
    pagosPorDeuda[p.deuda_id].push(p);
  }

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
        <div class="empty-icon"><i data-lucide="shield-check" style="width:40px;height:40px;stroke-width:1.5"></i></div>
        <p style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">Sin deudas registradas</p>
        <p>Registra lo que debes para llevar control de tus pagos y saber cuándo te liberas.</p>
      </div>
    `;
  } else {
    for (const d of deudas) {
      const pct = d.monto_inicial > 0 ? Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100) : 0;
      const badgeEmoji = getBadgeDeuda(d.tipo_deuda);

      // ── Barra capital/interés + proyección ──
      const tasaMensualCard = (d.tasa_interes_anual || 0) / 12;
      const desgloseCard = (tasaMensualCard > 0 && d.num_pagos_restantes > 0 && d.monto_actual > 0)
        ? calcularDesgloseAmortizacion(d.monto_actual, tasaMensualCard, d.num_pagos_restantes)
        : null;

      let barraDesglose = '';
      if (desgloseCard) {
        const total = desgloseCard.total;
        const pctCap = total > 0 ? Math.round((desgloseCard.capital / total) * 100) : 0;
        const pctInt = total > 0 ? Math.round((desgloseCard.interes / total) * 100) : 0;
        const pctIva = 100 - pctCap - pctInt;
        barraDesglose = `
          <div style="margin-top:10px;padding:10px 12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border-light)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:11px;color:var(--text-muted)">De tu cuota de ${formatMXN(total)}</span>
              <span style="font-size:11px;font-weight:700;color:var(--green)">${formatMXN(desgloseCard.capital)} reducen tu deuda</span>
            </div>
            <div style="display:flex;border-radius:4px;overflow:hidden;height:6px;gap:1px">
              <div style="background:var(--green);flex:${pctCap};min-width:2px"></div>
              <div style="background:var(--red);flex:${pctInt};min-width:2px"></div>
              <div style="background:var(--text-muted);opacity:0.35;flex:${pctIva};min-width:1px"></div>
            </div>
            <div style="display:flex;gap:10px;margin-top:5px;flex-wrap:wrap">
              <span style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:3px">
                <span style="width:7px;height:7px;border-radius:2px;background:var(--green);display:inline-block;flex-shrink:0"></span>Capital ${formatMXN(desgloseCard.capital)}
              </span>
              <span style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:3px">
                <span style="width:7px;height:7px;border-radius:2px;background:var(--red);display:inline-block;flex-shrink:0"></span>Interés ${formatMXN(desgloseCard.interes)}
              </span>
              <span style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:3px">
                <span style="width:7px;height:7px;border-radius:2px;background:var(--text-muted);opacity:0.4;display:inline-block;flex-shrink:0"></span>IVA ${formatMXN(desgloseCard.iva)}
              </span>
            </div>
          </div>`;
      }

      let proyeccionHtml = '';
      if (d.tipo_deuda !== 'tabla' && d.tipo_deuda !== 'flexible' && d.monto_pago) {
        const montoPagoCalc = desgloseCard ? desgloseCard.total : d.monto_pago;
        const proy = calcularProyeccionLiquidacion(d.monto_actual, montoPagoCalc, d.tasa_interes_anual, d.tipo_pago);
        if (proy?.sinSalida) {
          const iMes = Number(((d.tasa_interes_anual || 0) / 100 / 12) * d.monto_actual) || 0;
          proyeccionHtml = `<div style="margin-top:6px;font-size:12px;color:var(--yellow);display:flex;align-items:center;gap:4px"><i data-lucide="alert-circle" style="width:12px;height:12px;stroke-width:1.75"></i> Tu saldo crece ${iMes > 0 ? formatMXN(iMes) : ''} cada mes — necesitas abonar más</div>`;
        } else if (proy?.lejano) {
          proyeccionHtml = `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">Proyección: ~${proy.anios} año${proy.anios !== 1 ? 's' : ''} con el pago actual</div>`;
        } else if (proy?.fecha) {
          const cerca = proy.meses <= 3;
          const label = proy.meses <= 1 ? 'menos de un mes' : `${proy.meses} mese${proy.meses !== 1 ? 's' : ''}`;
          const interesLabel = proy.interesTotal > 0 ? ` · ${formatMXN(proy.interesTotal)} en intereses` : '';
          proyeccionHtml = `<div style="margin-top:6px;font-size:12px;color:${cerca ? 'var(--green)' : 'var(--text-secondary)'};display:flex;align-items:center;gap:4px"><i data-lucide="calendar-check" style="width:12px;height:12px;stroke-width:1.75"></i> Libre en ${label} · ${proy.fecha.toLocaleDateString('es-MX', {month:'long', year:'numeric'})}${interesLabel}</div>`;
        }
      }

      let botonPagoHTML = '';
      let sinTablaConfigurada = false;
      if (d.tipo_deuda === 'tabla') {
        const pagosProg = pagosPorDeuda[d.id] || [];
        sinTablaConfigurada = pagosProg.length === 0;
        const proximoPago = pagosProg.find(p => !p.pagado) || null;

        if (proximoPago) {
          botonPagoHTML = `
            <div style="margin-top:12px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm)">
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Próximo pago</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-weight:600">Cuota #${proximoPago.numero_pago}</span>
                <span style="font-weight:700;color:var(--accent)">${formatMXN(proximoPago.monto_esperado)}</span>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Vence: ${new Date(proximoPago.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX')}</div>
              <button data-action="pagar-deuda" data-deuda-id="${escapeHtml(d.id)}" data-acreedor="${escapeHtml(d.acreedor)}" data-monto-actual="${d.monto_actual}" data-tipo-deuda="${escapeHtml(d.tipo_deuda)}" data-monto-ultimo-pago="${d.monto_ultimo_pago || ''}" data-tasa-anual="${d.tasa_interes_anual || 0}" data-num-pagos="${d.num_pagos_restantes || ''}" style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font);width:100%">
                Abonar
              </button>
            </div>
          `;
        }
      } else {
        botonPagoHTML = `
          <button data-action="pagar-deuda" data-deuda-id="${escapeHtml(d.id)}" data-acreedor="${escapeHtml(d.acreedor)}" data-monto-actual="${d.monto_actual}" data-tipo-deuda="${escapeHtml(d.tipo_deuda)}" data-monto-ultimo-pago="${d.monto_ultimo_pago || ''}" data-tasa-anual="${d.tasa_interes_anual || 0}" data-num-pagos="${d.num_pagos_restantes || ''}" style="margin-top:12px;background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font);width:100%">
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
          ${barraDesglose}
          ${proyeccionHtml}
          ${botonPagoHTML}
          ${desgloseCard && d.num_pagos_restantes > 1 ? `
          <button
            data-action="simular-abono"
            data-deuda-id="${escapeHtml(d.id)}"
            data-acreedor="${escapeHtml(d.acreedor)}"
            data-monto-actual="${d.monto_actual}"
            data-tasa-anual="${d.tasa_interes_anual || 0}"
            data-num-pagos="${d.num_pagos_restantes}"
            data-monto-cuota="${desgloseCard.total}"
            style="margin-top:8px;width:100%;background:transparent;border:1px solid var(--border);border-radius:var(--radius-xs);padding:7px 14px;color:var(--text-secondary);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:6px">
            <i data-lucide="calculator" style="width:14px;height:14px;stroke-width:1.75;pointer-events:none"></i>
            ¿Qué pasa si abono más?
          </button>` : ''}
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
    const btnPagar = e.target.closest('[data-action="pagar-deuda"]');
    if (btnPagar) {
      openPagarDeuda(
        btnPagar.dataset.deudaId,
        btnPagar.dataset.acreedor,
        parseFloat(btnPagar.dataset.montoActual),
        btnPagar.dataset.tipoDeuda,
        btnPagar.dataset.montoUltimoPago ? parseFloat(btnPagar.dataset.montoUltimoPago) : null,
        parseFloat(btnPagar.dataset.tasaAnual) || 0,
        btnPagar.dataset.numPagos ? parseInt(btnPagar.dataset.numPagos, 10) : null
      );
      return;
    }
    const btnSimular = e.target.closest('[data-action="simular-abono"]');
    if (btnSimular) {
      openSimuladorAbonoExtra(
        btnSimular.dataset.deudaId,
        btnSimular.dataset.acreedor,
        parseFloat(btnSimular.dataset.montoActual),
        parseFloat(btnSimular.dataset.tasaAnual) || 0,
        parseInt(btnSimular.dataset.numPagos, 10) || 1,
        parseFloat(btnSimular.dataset.montoCuota) || 0
      );
    }
  };

  renderLucideIcons();
}

function openDeudaActions(deudaId) {
  openActionSheet('Opciones de deuda', [
    { label: 'Editar', onClick: `openEditarDeuda('${deudaId}')` },
    { label: 'Registrar pagos anteriores', onClick: `openRegistrarPagosHistoricos('${deudaId}')` },
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
    campos.innerHTML = `<p class="form-hint" style="margin:4px 0 0">Pagos los días 15 y último de cada mes.</p>`;
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
      <input class="form-input" id="ed-monto-pago" type="number" min="0" inputmode="decimal" value="${deuda.monto_pago ? Number(deuda.monto_pago) : ''}" placeholder="0.00" /></div>
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
      <input class="form-input" id="ed-monto" type="number" min="0" inputmode="decimal" value="${Number(deuda.monto_actual || 0)}" /></div>
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
      dia_pago = 15;
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

async function _doEliminarDeuda(deudaId) {
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
function eliminarDeuda(deudaId) {
  openConfirmModal('¿Eliminar esta deuda? No se puede deshacer.', `_doEliminarDeuda('${deudaId}')`);
}
window._doEliminarDeuda = _doEliminarDeuda;

async function openPagarDeuda(deudaId, acreedor, montoActual, tipoDeuda, montoUltimoPago, tasaAnual = 0, numPagosRestantes = null) {
  const { data: cuentas, error } = await db
    .from('cuentas')
    .select('id, nombre')
    .eq('usuario_id', (await getUsuarioId()))
    .eq('activa', true)
    .eq('es_pasivo', false);

  if (error) {
    showSnackbar('No se pudieron cargar las cuentas', 'error');
    return;
  }

  const tasaMensual = (tasaAnual || 0) / 12;
  const desglose = calcularDesgloseAmortizacion(montoActual, tasaMensual, numPagosRestantes);

  let desgloseHTML = '';
  let montoSugerido = '';
  if (desglose) {
    montoSugerido = desglose.total.toFixed(2);
    desgloseHTML = `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;font-weight:600">Desglose de esta cuota</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:13px">
          <span style="color:var(--text-secondary)">Abono a capital</span>
          <span style="font-weight:600;color:var(--green);text-align:right">${formatMXN(desglose.capital)}</span>
          <span style="color:var(--text-secondary)">Intereses</span>
          <span style="font-weight:600;color:var(--red);text-align:right">${formatMXN(desglose.interes)}</span>
          <span style="color:var(--text-secondary)">IVA (16%)</span>
          <span style="font-weight:600;color:var(--text-muted);text-align:right">${formatMXN(desglose.iva)}</span>
          <span style="color:var(--text);font-weight:600;border-top:1px solid var(--border-light);padding-top:6px">Total a pagar</span>
          <span style="font-weight:700;text-align:right;border-top:1px solid var(--border-light);padding-top:6px">${formatMXN(desglose.total)}</span>
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin:8px 0 0;line-height:1.4">Solo los ${formatMXN(desglose.capital)} de capital reducen tu saldo de deuda. Los intereses van como gasto bancario.</p>
      </div>
      <input type="hidden" id="pd-capital"    value="${desglose.capital}" />
      <input type="hidden" id="pd-interes"   value="${desglose.interes}" />
      <input type="hidden" id="pd-iva"       value="${desglose.iva}" />
      <input type="hidden" id="pd-num-pagos" value="${numPagosRestantes || ''}" />
    `;
  }

  let infoReferenciaHTML = '';
  if (tipoDeuda === 'variable' && montoUltimoPago && !desglose) {
    infoReferenciaHTML = `
    <div class="card" style="margin-bottom:12px;background:var(--bg-elevated)">
      <div style="font-size:12px;color:var(--text-secondary)">Último pago</div>
      <div style="font-size:15px;font-weight:700">${formatMXN(montoUltimoPago)}</div>
    </div>
    `;
  }

  const cuentasOptions = (cuentas || []).map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');

  openModal(`Abonar: ${escapeHtml(acreedor)}`, `
    <div class="card" style="margin-bottom:16px;background:var(--red-soft);border-color:rgba(240,93,110,0.2)">
      <div style="font-size:12px;color:var(--text-secondary)">Saldo de la deuda</div>
      <div style="font-family:var(--font);font-size:15px;font-weight:700;color:var(--red)">${formatMXN(montoActual)}</div>
    </div>
    ${desgloseHTML}
    ${infoReferenciaHTML}
    <div class="form-group">
      <label class="form-label">${desglose ? 'Monto total del pago' : 'Monto del pago'}</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="pd-monto" type="number" placeholder="0.00" min="0" max="${montoActual * 2}" inputmode="decimal" value="${montoSugerido}" /></div>
      ${desglose ? `<p class="form-hint">Puedes cambiar el monto si abonaste una cantidad diferente.</p>` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">Cuenta</label>
      <select class="form-select" id="pd-cuenta">
        <option value="">— Sin cuenta —</option>
        ${cuentasOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Nota (opcional)</label>
      <input class="form-input" id="pd-nota" type="text" placeholder="Ej: Cuota de mayo" />
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
  const _btn = document.querySelector('#modal-overlay .btn-primary');
  if (_btn?.disabled) return;
  if (_btn) _btn.disabled = true;
  try {
    const monto = parseFloat(String(document.getElementById('pd-monto')?.value || '').replace(/,/g, ''));
    const cuenta_id  = document.getElementById('pd-cuenta')?.value || null;
    const nota       = document.getElementById('pd-nota')?.value.trim() || '';
    const esHistorico = document.getElementById('pd-historico')?.checked || false;
    const usuarioId  = await getUsuarioId();

    if (!monto || monto <= 0 || !isFinite(monto)) { showSnackbar('Ingresa un monto válido', 'error'); return; }

    // Leer desglose de amortización (si el modal lo calculó)
    const capitalHidden = parseFloat(document.getElementById('pd-capital')?.value);
    const interesHidden = parseFloat(document.getElementById('pd-interes')?.value);
    const ivaHidden     = parseFloat(document.getElementById('pd-iva')?.value);
    const numPagosEl    = parseInt(document.getElementById('pd-num-pagos')?.value, 10);
    const hayDesglose   = isFinite(capitalHidden) && capitalHidden > 0;
    const numPagosRestantes = isFinite(numPagosEl) && numPagosEl > 0 ? numPagosEl : null;

    let montoCapital, montoInteres, montoIva;
    if (hayDesglose) {
      const totalDesglose = capitalHidden + interesHidden + ivaHidden;
      const ratio = totalDesglose > 0 ? monto / totalDesglose : 1;
      montoCapital = parseFloat((capitalHidden * ratio).toFixed(2));
      montoInteres = parseFloat((interesHidden * ratio).toFixed(2));
      montoIva     = parseFloat((ivaHidden     * ratio).toFixed(2));
    } else {
      montoCapital = monto;
      montoInteres = 0;
      montoIva     = 0;
    }

    // Solo el capital reduce el saldo; no puede superar lo adeudado
    const capitalReduccion = Math.min(montoCapital, montoActual);
    if (capitalReduccion <= 0 && !hayDesglose) {
      showSnackbar('El pago no puede ser mayor a la deuda', 'error'); return;
    }
    const nuevoMonto = parseFloat((montoActual - capitalReduccion).toFixed(2));
    const fechaHoy   = new Date().toISOString().split('T')[0];

    if (!esHistorico) {
      if (!cuenta_id) { showSnackbar('Selecciona una cuenta', 'error'); return; }

      const [
        { data: cuenta, error: errorCuenta },
        { data: ingresosCuenta },
        { data: gastosCuenta },
        { data: pagosDeudaCuenta }
      ] = await Promise.all([
        db.from('cuentas').select('saldo_inicial').eq('id', cuenta_id).eq('usuario_id', usuarioId).single(),
        db.from('ingresos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_id),
        db.from('gastos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_id),
        db.from('pagos_deuda').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuenta_id)
      ]);

      if (errorCuenta || !cuenta) { showSnackbar('No se pudo validar el saldo de la cuenta', 'error'); return; }

      const saldoCuenta = Number(cuenta.saldo_inicial || 0)
        + (ingresosCuenta   || []).reduce((a, m) => a + Number(m.monto || 0), 0)
        - (gastosCuenta     || []).reduce((a, m) => a + Number(m.monto || 0), 0)
        - (pagosDeudaCuenta || []).reduce((a, m) => a + Number(m.monto || 0), 0);

      if (monto > saldoCuenta) { showSnackbar('Saldo insuficiente en esa cuenta', 'error'); return; }

      // Registrar pago con desglose completo
      const { error: errInsert } = await db.from('pagos_deuda').insert({
        deuda_id:      deudaId,
        usuario_id:    usuarioId,
        cuenta_id,
        monto,
        monto_capital: hayDesglose ? montoCapital : null,
        monto_interes: hayDesglose ? montoInteres : null,
        monto_iva:     hayDesglose ? montoIva     : null,
        nota,
        fecha:         fechaHoy
      });
      if (errInsert) { showSnackbar('No se pudo registrar el pago. Revisa tu conexión.', 'error'); return; }

      // Gasto de intereses (cuenta_id null → no doble-descuenta de cuenta, solo categoriza)
      if (hayDesglose && (montoInteres + montoIva) > 0.01) {
        await db.from('gastos').insert({
          usuario_id:  usuarioId,
          monto:       parseFloat((montoInteres + montoIva).toFixed(2)),
          fecha:       fechaHoy,
          descripcion: 'Intereses bancarios',
          cuenta_id:   null,
          es_ahorro:   false
        });
      }
    }

    // Marcar cuota como pagada si es tipo tabla
    if (tipoDeuda === 'tabla') {
      const { data: proximoPago } = await db.from('pagos_programados')
        .select('id')
        .eq('deuda_id', deudaId)
        .eq('pagado', false)
        .order('fecha_vencimiento')
        .limit(1)
        .maybeSingle();
      if (proximoPago) {
        const { error: errProg } = await db.from('pagos_programados')
          .update({ pagado: true, fecha_pago: fechaHoy, monto_pagado: monto })
          .eq('id', proximoPago.id);
        if (errProg) { showSnackbar('Error al marcar cuota como pagada', 'error'); return; }
      }
    }

    // Actualizar deuda — solo el CAPITAL reduce el saldo
    const deudaUpdate = {
      monto_actual:      nuevoMonto < 0.01 ? 0 : nuevoMonto,
      activa:            nuevoMonto >= 1,
      ultimo_pago:       fechaHoy,
      monto_ultimo_pago: monto
    };
    if (hayDesglose && numPagosRestantes !== null) {
      deudaUpdate.num_pagos_restantes = Math.max(0, numPagosRestantes - 1);
    }

    const { error: errDeuda } = await db.from('deudas').update(deudaUpdate)
      .eq('id', deudaId).eq('usuario_id', usuarioId);
    if (errDeuda) { showSnackbar('No se pudo actualizar el saldo de la deuda. Revisa tu conexión.', 'error'); return; }

    closeModal();
    showSnackbar(nuevoMonto < 1 ? '¡Deuda saldada! 🎉' : 'Pago registrado', 'success');
    await loadDeudas();
    await loadDashboard();
  } finally {
    const _b = document.querySelector('#modal-overlay .btn-primary');
    if (_b?.isConnected) _b.disabled = false;
  }
}

// ── SIMULADOR DE ABONO EXTRA ──────────────────────────────────────────────────

function openSimuladorAbonoExtra(deudaId, acreedor, montoActual, tasaAnual, numPagosRestantes, montoCuota) {
  _simuladorData = { deudaId, acreedor, montoActual, tasaAnual, numPagosRestantes, montoCuota };
  const tasaMensual = tasaAnual / 12;

  // Proyección actual (sin abono extra)
  const tablaActual = generarTablaAmortizacion(montoActual, tasaMensual, numPagosRestantes);
  const interesRestanteActual = tablaActual.reduce((s, r) => s + r.interes + r.iva, 0);
  const fechaActual = new Date();
  fechaActual.setMonth(fechaActual.getMonth() + numPagosRestantes);

  openModal(`¿Qué pasa si abono más a ${escapeHtml(acreedor)}?`, `
    <!-- Saldo actual -->
    <div style="background:var(--red-soft);border:1px solid rgba(240,93,110,0.2);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--text-secondary)">Deuda actual</span>
      <span style="font-size:18px;font-weight:800;color:var(--red)">${formatMXN(montoActual)}</span>
    </div>

    <!-- Input monto extra -->
    <div class="form-group">
      <label class="form-label">¿Cuánto quieres abonar extra a capital?</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="sim-monto" type="number" placeholder="0.00" min="0"
             max="${(montoActual - 1).toFixed(2)}" inputmode="decimal" autofocus
             oninput="calcularSimulacionAbonoExtra()" /></div>
      <p class="form-hint">Este monto se abona directo al capital — no incluye tu cuota mensual.</p>
    </div>

    <!-- Toggle modo -->
    <div style="display:flex;gap:6px;margin-bottom:16px">
      <button id="sim-btn-antes" onclick="toggleModoSimulador('antes')"
        style="flex:1;padding:8px;border-radius:var(--radius-xs);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:all 150ms ease;background:var(--accent);color:#fff;border:1px solid var(--accent)">
        Terminar antes
      </button>
      <button id="sim-btn-menos" onclick="toggleModoSimulador('menos')"
        style="flex:1;padding:8px;border-radius:var(--radius-xs);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:all 150ms ease;background:transparent;color:var(--accent);border:1px solid var(--accent)">
        Pagar menos cada mes
      </button>
    </div>

    <!-- Resultado dinámico -->
    <div id="sim-resultado" style="min-height:80px;margin-bottom:16px">
      <div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px">
        <i data-lucide="calculator" style="width:24px;height:24px;stroke-width:1.5;display:block;margin:0 auto 6px;opacity:0.4"></i>
        Escribe un monto para ver el impacto
      </div>
    </div>

    <!-- Botones de acción -->
    <div style="display:flex;flex-direction:column;gap:8px">
      <button id="sim-btn-confirmar" class="btn btn-primary" disabled
        onclick="confirmarAbonoExtra()">
        Confirmar abono
      </button>
      <button class="btn btn-ghost" onclick="closeModal()">
        Solo ver, no abonar todavía
      </button>
    </div>
  `);

  window._simModo = 'antes';
  renderLucideIcons();
}

window.toggleModoSimulador = function(modo) {
  window._simModo = modo;
  const btnAntes = document.getElementById('sim-btn-antes');
  const btnMenos = document.getElementById('sim-btn-menos');
  if (!btnAntes || !btnMenos) return;
  if (modo === 'antes') {
    btnAntes.style.background = 'var(--accent)'; btnAntes.style.color = '#fff'; btnAntes.style.borderColor = 'var(--accent)';
    btnMenos.style.background = 'transparent';   btnMenos.style.color = 'var(--accent)'; btnMenos.style.borderColor = 'var(--accent)';
  } else {
    btnAntes.style.background = 'transparent';   btnAntes.style.color = 'var(--accent)'; btnAntes.style.borderColor = 'var(--accent)';
    btnMenos.style.background = 'var(--accent)'; btnMenos.style.color = '#fff';          btnMenos.style.borderColor = 'var(--accent)';
  }
  window.calcularSimulacionAbonoExtra();
};

window.calcularSimulacionAbonoExtra = function() {
  if (!_simuladorData) return;
  const { montoActual, tasaAnual, numPagosRestantes, montoCuota } = _simuladorData;
  const abonoExtra = parseFloat(String(document.getElementById('sim-monto')?.value || '').replace(/,/g, ''));
  const resultado = document.getElementById('sim-resultado');
  const btnConfirmar = document.getElementById('sim-btn-confirmar');
  if (!resultado) return;

  if (!abonoExtra || abonoExtra <= 0 || !isFinite(abonoExtra) || abonoExtra >= montoActual) {
    resultado.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px">
      <i data-lucide="calculator" style="width:24px;height:24px;stroke-width:1.5;display:block;margin:0 auto 6px;opacity:0.4"></i>
      Escribe un monto para ver el impacto</div>`;
    if (btnConfirmar) btnConfirmar.disabled = true;
    renderLucideIcons();
    return;
  }

  const tasaMensual = tasaAnual / 12;
  const nuevoSaldo  = montoActual - abonoExtra;
  const r = tasaMensual / 100;
  const modo = window._simModo || 'antes';

  let html = '';

  if (modo === 'antes') {
    // Opción A: misma cuota, menos periodos
    let nuevosN;
    if (r <= 0) {
      nuevosN = Math.ceil(nuevoSaldo / montoCuota);
    } else {
      const logArg = 1 - (r * nuevoSaldo) / montoCuota;
      if (logArg <= 0) {
        resultado.innerHTML = `<div style="padding:12px;background:var(--red-soft);border-radius:var(--radius-sm);font-size:13px;color:var(--red)">El abono no es suficiente para reducir el plazo con esta cuota.</div>`;
        if (btnConfirmar) btnConfirmar.disabled = true;
        return;
      }
      nuevosN = Math.max(1, Math.ceil(-Math.log(logArg) / Math.log(1 + r)));
    }
    const mesesAhorrados = numPagosRestantes - nuevosN;
    const tablaOriginal  = generarTablaAmortizacion(montoActual, tasaMensual, numPagosRestantes);
    const tablaNueva     = generarTablaAmortizacion(nuevoSaldo, tasaMensual, nuevosN);
    const interesOriginal = tablaOriginal.reduce((s, f) => s + f.interes + f.iva, 0);
    const interesNuevo    = tablaNueva.reduce((s, f) => s + f.interes + f.iva, 0);
    const interesAhorrado = Math.max(0, interesOriginal - interesNuevo);
    const fechaNueva = new Date(); fechaNueva.setMonth(fechaNueva.getMonth() + nuevosN);
    const fechaOriginal = new Date(); fechaOriginal.setMonth(fechaOriginal.getMonth() + numPagosRestantes);
    const optsDate = { month: 'long', year: 'numeric' };

    html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg-elevated);border-radius:var(--radius-sm);padding:12px;border:1px solid var(--border-light)">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Antes</div>
          <div style="font-size:14px;font-weight:700">${numPagosRestantes} meses</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${fechaOriginal.toLocaleDateString('es-MX', optsDate)}</div>
        </div>
        <div style="background:var(--green-soft);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:12px">
          <div style="font-size:10px;color:var(--green);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;font-weight:700">Después</div>
          <div style="font-size:14px;font-weight:700;color:var(--green)">${nuevosN} meses</div>
          <div style="font-size:11px;color:var(--green);margin-top:2px">${fechaNueva.toLocaleDateString('es-MX', optsDate)}</div>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px">
        ${mesesAhorrados > 0 ? `
        <div style="flex:1;background:var(--accent-soft);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--accent)">${mesesAhorrados}</div>
          <div style="font-size:10px;color:var(--text-muted)">meses antes</div>
        </div>` : ''}
        ${interesAhorrado > 0 ? `
        <div style="flex:1;background:var(--green-soft);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:16px;font-weight:800;color:var(--green)">${formatMXN(interesAhorrado)}</div>
          <div style="font-size:10px;color:var(--text-muted)">ahorras en intereses</div>
        </div>` : ''}
      </div>`;
  } else {
    // Opción B: mismos periodos, cuota más baja
    if (r <= 0) {
      resultado.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:13px;text-align:center">Esta opción requiere una tasa de interés configurada.</div>`;
      if (btnConfirmar) btnConfirmar.disabled = true;
      return;
    }
    const nuevaCuota = nuevoSaldo * (r * Math.pow(1 + r, numPagosRestantes)) / (Math.pow(1 + r, numPagosRestantes) - 1);
    const ahorroMensual = montoCuota - nuevaCuota;
    const tablaOriginal = generarTablaAmortizacion(montoActual, tasaMensual, numPagosRestantes);
    const tablaNueva    = generarTablaAmortizacion(nuevoSaldo, tasaMensual, numPagosRestantes);
    const interesAhorrado = Math.max(0,
      tablaOriginal.reduce((s, f) => s + f.interes + f.iva, 0) -
      tablaNueva.reduce((s, f) => s + f.interes + f.iva, 0));

    html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg-elevated);border-radius:var(--radius-sm);padding:12px;border:1px solid var(--border-light)">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Cuota actual</div>
          <div style="font-size:14px;font-weight:700">${formatMXN(montoCuota)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">por mes</div>
        </div>
        <div style="background:var(--green-soft);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:12px">
          <div style="font-size:10px;color:var(--green);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;font-weight:700">Nueva cuota</div>
          <div style="font-size:14px;font-weight:700;color:var(--green)">${formatMXN(nuevaCuota)}</div>
          <div style="font-size:11px;color:var(--green);margin-top:2px">ahorras ${formatMXN(ahorroMensual)}/mes</div>
        </div>
      </div>
      ${interesAhorrado > 0 ? `
      <div style="margin-top:8px;background:var(--accent-soft);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-sm);padding:10px;text-align:center">
        <span style="font-size:14px;font-weight:700;color:var(--accent)">${formatMXN(interesAhorrado)}</span>
        <span style="font-size:11px;color:var(--text-muted)"> menos en intereses en total</span>
      </div>` : ''}`;
  }

  resultado.innerHTML = html;
  if (btnConfirmar) btnConfirmar.disabled = false;
  renderLucideIcons();
};

window.confirmarAbonoExtra = async function() {
  if (!_simuladorData) return;
  const { deudaId, montoActual, tasaAnual, numPagosRestantes } = _simuladorData;
  const abonoExtra = parseFloat(String(document.getElementById('sim-monto')?.value || '').replace(/,/g, ''));
  if (!abonoExtra || abonoExtra <= 0 || abonoExtra >= montoActual) return;

  const { data: cuentas } = await db
    .from('cuentas')
    .select('id, nombre')
    .eq('usuario_id', (await getUsuarioId()))
    .eq('activa', true)
    .eq('es_pasivo', false);

  const modo = window._simModo || 'antes';
  const tasaMensual = tasaAnual / 12;
  const r = tasaMensual / 100;
  const nuevoSaldo = montoActual - abonoExtra;

  let nuevosNumPagos = numPagosRestantes;
  let nuevaCuota = null;
  if (r > 0) {
    if (modo === 'antes') {
      const logArg = 1 - (r * nuevoSaldo) / _simuladorData.montoCuota;
      if (logArg > 0) nuevosNumPagos = Math.max(1, Math.ceil(-Math.log(logArg) / Math.log(1 + r)));
    } else {
      nuevaCuota = nuevoSaldo * (r * Math.pow(1 + r, numPagosRestantes)) / (Math.pow(1 + r, numPagosRestantes) - 1);
    }
  }

  const cuentasOptions = (cuentas || []).map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  const htmlConfirm = `
    <p style="font-size:14px;margin-bottom:16px">Abono a capital de <strong>${formatMXN(abonoExtra)}</strong> a <strong>${escapeHtml(_simuladorData.acreedor)}</strong></p>
    <div class="form-group">
      <label class="form-label">Cuenta de donde sale el dinero</label>
      <select class="form-select" id="sim-cuenta-confirm">
        <option value="">— Selecciona —</option>
        ${cuentasOptions}
      </select>
    </div>
    <button class="btn btn-primary" onclick="guardarAbonoExtraCapital()">Confirmar y registrar</button>
    <button class="btn btn-ghost" style="margin-top:8px" onclick="closeModal()">Cancelar</button>
  `;

  window._abonoExtraConfirmData = { deudaId, abonoExtra, montoActual, nuevoSaldo, nuevosNumPagos, nuevaCuota };
  openModal('Confirmar abono extra', htmlConfirm);
};

window.guardarAbonoExtraCapital = async function() {
  const d = window._abonoExtraConfirmData;
  if (!d) return;
  const cuenta_id = document.getElementById('sim-cuenta-confirm')?.value;
  if (!cuenta_id) { showSnackbar('Selecciona la cuenta', 'error'); return; }

  const usuarioId = await getUsuarioId();
  const fechaHoy = new Date().toISOString().split('T')[0];

  const { error: errPago } = await db.from('pagos_deuda').insert({
    deuda_id:      d.deudaId,
    usuario_id:    usuarioId,
    cuenta_id,
    monto:         d.abonoExtra,
    monto_capital: d.abonoExtra,
    monto_interes: 0,
    monto_iva:     0,
    nota:          'Abono extra a capital',
    fecha:         fechaHoy
  });
  if (errPago) { showSnackbar('No se pudo registrar el abono', 'error'); return; }

  const deudaUpdate = {
    monto_actual:      d.nuevoSaldo < 0.01 ? 0 : d.nuevoSaldo,
    activa:            d.nuevoSaldo >= 1,
    ultimo_pago:       fechaHoy,
    monto_ultimo_pago: d.abonoExtra,
    num_pagos_restantes: d.nuevosNumPagos
  };
  if (d.nuevaCuota !== null) deudaUpdate.monto_pago = parseFloat(d.nuevaCuota.toFixed(2));

  const { error: errDeuda } = await db.from('deudas').update(deudaUpdate)
    .eq('id', d.deudaId).eq('usuario_id', usuarioId);
  if (errDeuda) { showSnackbar('No se pudo actualizar la deuda', 'error'); return; }

  _simuladorData = null;
  window._abonoExtraConfirmData = null;
  closeModal();
  showSnackbar(d.nuevoSaldo < 1 ? '¡Deuda saldada! 🎉' : 'Abono extra registrado', 'success');
  await loadDeudas();
  await loadDashboard();
};

// ── PAGOS HISTÓRICOS ─────────────────────────────────────────────────────────

let _pagosHistoricosLista = [];

async function openRegistrarPagosHistoricos(deudaId) {
  const { data: deuda, error } = await db
    .from('deudas')
    .select('id, acreedor, monto_inicial, monto_actual, tasa_interes_anual, num_pagos_restantes, tipo_pago')
    .eq('id', deudaId)
    .eq('usuario_id', await getUsuarioId())
    .maybeSingle();

  if (error || !deuda) { showSnackbar('No se pudo cargar la deuda', 'error'); return; }

  _pagosHistoricosLista = [];

  const tasaMensual = (deuda.tasa_interes_anual || 0) / 12;
  const tieneTasa   = tasaMensual > 0 && deuda.num_pagos_restantes > 0;

  openModal(`Pagos anteriores — ${escapeHtml(deuda.acreedor)}`, `
    <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:16px;display:flex;align-items:flex-start;gap:8px">
      <i data-lucide="info" style="width:15px;height:15px;stroke-width:1.75;color:var(--accent);flex-shrink:0;margin-top:1px;pointer-events:none"></i>
      <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5">
        Registra los pagos que ya hiciste antes de agregar esta deuda a la app.
        <strong>No restan de tus cuentas</strong> — solo actualizan el historial y el porcentaje pagado.
      </p>
    </div>

    <div id="hist-lista" style="max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:12px"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:end;margin-bottom:4px">
      <div>
        <label class="form-label" style="font-size:11px">Fecha del pago</label>
        <input class="form-input" id="hist-fecha" type="date"
               max="${new Date().toISOString().split('T')[0]}"
               value="${new Date(Date.now() - 86400000).toISOString().split('T')[0]}"
               style="height:40px" />
      </div>
      <div>
        <label class="form-label" style="font-size:11px">Monto total pagado</label>
        <div class="input-money-wrap" style="height:40px"><span class="currency-prefix">$</span>
        <input class="form-input" id="hist-monto" type="number" placeholder="0.00"
               min="0" inputmode="decimal" style="height:40px" /></div>
      </div>
      <button class="btn btn-secondary" style="height:40px;padding:0 12px;white-space:nowrap"
              onclick="agregarFilaHistorico()">+ Agregar</button>
    </div>
    ${tieneTasa ? `<p class="form-hint">La app calculará automáticamente cuánto fue capital e interés en cada pago.</p>` : ''}

    <button class="btn btn-primary" style="margin-top:12px;width:100%"
            onclick="guardarPagosHistoricos('${deudaId}', ${deuda.monto_actual}, ${tasaMensual})">
      Guardar pagos históricos
    </button>
  `);

  _renderListaHistoricos();
  renderLucideIcons();
}

function _renderListaHistoricos() {
  const lista = document.getElementById('hist-lista');
  if (!lista) return;
  if (_pagosHistoricosLista.length === 0) {
    lista.innerHTML = `<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px 0">Aún no agregaste pagos.</p>`;
    return;
  }
  lista.innerHTML = _pagosHistoricosLista.map((p, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-elevated);padding:8px 10px;border-radius:var(--radius-xs)">
      <div>
        <div style="font-size:13px;font-weight:600">${formatMXN(p.monto)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' })}</div>
      </div>
      <button data-action="del-hist" data-idx="${i}" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--text-muted)">
        <i data-lucide="x" style="width:16px;height:16px;stroke-width:2;pointer-events:none"></i>
      </button>
    </div>
  `).join('');

  lista.onclick = (e) => {
    const btn = e.target.closest('[data-action="del-hist"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    if (Number.isFinite(idx) && idx >= 0 && idx < _pagosHistoricosLista.length) {
      _pagosHistoricosLista.splice(idx, 1);
      _renderListaHistoricos();
    }
  };
  renderLucideIcons();
}

window.agregarFilaHistorico = function() {
  const fecha = document.getElementById('hist-fecha')?.value;
  const monto = parseFloat(String(document.getElementById('hist-monto')?.value || '').replace(/,/g, ''));
  if (!fecha) { showSnackbar('Selecciona la fecha del pago', 'error'); return; }
  if (!monto || monto <= 0 || !isFinite(monto)) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (fecha > new Date().toISOString().split('T')[0]) { showSnackbar('La fecha no puede ser futura', 'error'); return; }

  _pagosHistoricosLista.push({ fecha, monto });
  _pagosHistoricosLista.sort((a, b) => a.fecha.localeCompare(b.fecha));

  document.getElementById('hist-monto').value = '';
  _renderListaHistoricos();
};

window.guardarPagosHistoricos = async function(deudaId, saldoActualActual, tasaMensual) {
  if (_pagosHistoricosLista.length === 0) { showSnackbar('Agrega al menos un pago', 'error'); return; }

  const usuarioId = await getUsuarioId();
  let saldoSimulado = saldoActualActual;

  // Construir pagos a insertar, calculando desglose si hay tasa
  const rows = _pagosHistoricosLista.map(p => {
    let montoCapital = p.monto;
    let montoInteres = 0;
    let montoIva     = 0;

    if (tasaMensual > 0 && saldoSimulado > 0) {
      const r = tasaMensual / 100;
      montoInteres = parseFloat((saldoSimulado * r).toFixed(2));
      montoIva     = parseFloat((montoInteres * 0.16).toFixed(2));
      montoCapital = parseFloat(Math.max(p.monto - montoInteres - montoIva, 0).toFixed(2));
      saldoSimulado = Math.max(0, saldoSimulado - montoCapital);
    }

    return {
      deuda_id:      deudaId,
      usuario_id:    usuarioId,
      cuenta_id:     null,         // histórico: no afecta cuentas
      monto:         p.monto,
      monto_capital: tasaMensual > 0 ? montoCapital : null,
      monto_interes: tasaMensual > 0 ? montoInteres : null,
      monto_iva:     tasaMensual > 0 ? montoIva     : null,
      nota:          'Pago histórico (antes de registrar en la app)',
      fecha:         p.fecha
    };
  });

  const { error } = await db.from('pagos_deuda').insert(rows);
  if (error) { showSnackbar('No se pudo guardar el historial. Revisa tu conexión.', 'error'); return; }

  _pagosHistoricosLista = [];
  closeModal();
  showSnackbar(`${rows.length} pago${rows.length > 1 ? 's' : ''} histórico${rows.length > 1 ? 's' : ''} registrado${rows.length > 1 ? 's' : ''}`, 'success');
  await loadDeudas();
};

window.openRegistrarPagosHistoricos = openRegistrarPagosHistoricos;

function openAgregarDeuda() {
  openModal('Nueva deuda', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <button onclick="selectTipoDeuda('simple')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="credit-card" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Préstamo fijo</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Mensualidades iguales<br>Ej: nómina, caja popular</div>
      </button>
      <button onclick="selectTipoDeuda('variable')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="trending-down" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Tarjeta de crédito</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">El pago cambia cada mes<br>Ej: BBVA, Liverpool, Coppel</div>
      </button>
      <button onclick="selectTipoDeuda('tabla')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="calendar" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Tengo mi tabla</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Capturo cada cuota<br>Ej: hipoteca, financiera</div>
      </button>
      <button onclick="selectTipoDeuda('flexible')" style="background:var(--bg-elevated);border:2px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="wallet" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block;stroke-width:1.75"></i>
        <div style="font-weight:600;font-size:14px">Deuda libre</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Pago lo que puedo<br>Ej: familia, amigos, fiado</div>
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
      <input class="form-input" id="nd-acreedor" type="text" placeholder="Ej: Caja Popular, mamá, etc." maxlength="80" />
    </div>
    <div class="form-group">
      <label class="form-label">¿Cuánto pediste originalmente?</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nd-monto" type="number" placeholder="0.00" min="0" inputmode="decimal" autofocus
             oninput="syncMontoActualDeuda()" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">¿Cuánto debes hoy? <span style="color:var(--text-muted);font-weight:400">(si ya llevas pagos)</span></label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="nd-monto-actual" type="number" placeholder="Igual al monto original si es deuda nueva" min="0" inputmode="decimal" oninput="this.dataset.editado='true'" /></div>
      <p class="form-hint">Si ya hiciste pagos antes de registrar la app, pon aquí tu saldo actual. La barra de progreso se calculará correctamente.</p>
    </div>
    <div class="form-group">
      <label class="form-label">Tasa de interés anual % <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
      <input class="form-input" id="nd-tasa" type="number" placeholder="Ej: 40 nómina · 55 tarjeta · 28 caja popular · 0 familiar" min="0" max="999" />
      <p class="form-hint" style="margin-top:4px">Tasa nominal anual (no el CAT). Si no la sabes, revisa tu contrato o estado de cuenta.</p>
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
      <input class="form-input" id="nd-cuota" type="number" placeholder="0.00" min="0" inputmode="decimal" ${cuotaReq} /></div>
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
    campos.innerHTML = `<p class="form-hint" style="margin:4px 0 0">Pagos los días 15 y último de cada mes.</p>`;
    return;
  }

  campos.innerHTML = '';
}

async function guardarNuevaDeuda(tipo) {
  const _btn = document.querySelector('#modal-overlay .btn-primary');
  if (_btn?.disabled) return;
  if (_btn) _btn.disabled = true;
  try {
  const acreedor = document.getElementById('nd-acreedor').value.trim();
  const montoInicial = parseFloat(String(document.getElementById('nd-monto').value).replace(/,/g, ''));
  const montoActualRaw = document.getElementById('nd-monto-actual')?.value;
  const montoActual = montoActualRaw
    ? parseFloat(String(montoActualRaw).replace(/,/g, ''))
    : montoInicial;
  let tipo_pago = null;
  let monto_pago = null;
  let dia_pago = null;
  let dia_semana = null;

  const tasa_interes_anual = parseFloat(document.getElementById('nd-tasa')?.value) || 0;
  if (!acreedor || acreedor.length > 80) { showSnackbar('Nombre del acreedor inválido', 'error'); return; }
  if (!montoInicial || montoInicial <= 0 || !isFinite(montoInicial) || montoInicial > 999_999_999) { showSnackbar('Monto inválido', 'error'); return; }
  if (montoActual < 0 || !isFinite(montoActual) || montoActual > montoInicial) {
    showSnackbar('El saldo actual no puede ser mayor al monto original', 'error'); return;
  }
  if (tasa_interes_anual < 0 || tasa_interes_anual > 999 || !isFinite(tasa_interes_anual)) { showSnackbar('Tasa de interés inválida (0-999%)', 'error'); return; }
  const monto = montoInicial; // alias para el resto del flujo

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
      dia_pago = 15;
    }
  }

  const { data: deudaInsertada, error } = await db.from('deudas').insert({
    usuario_id: (await getUsuarioId()),
    acreedor,
    monto_inicial: montoInicial,
    monto_actual:  montoActual,
    tipo_pago, monto_pago, dia_pago, dia_semana, tipo_deuda: tipo,
    tasa_interes_anual: isFinite(tasa_interes_anual) ? tasa_interes_anual : 0
  }).select();

  if (error) {
    showSnackbar('No se pudo guardar la deuda. Revisa tu conexión.', 'error');
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
  } finally {
    if (_btn?.isConnected) _btn.disabled = false;
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
  if (Number.isNaN(numeroInt) || numeroInt < 1 || Number.isNaN(montoFloat) || montoFloat <= 0 || montoFloat > 999_999_999) {
    showSnackbar('Número y monto deben ser valores válidos', 'error');
    return;
  }
  if (fecha < '2000-01-01' || fecha > '2100-12-31') {
    showSnackbar('Fecha inválida', 'error'); return;
  }
  if (filasPagesProgramados.some(f => f.numero === numeroInt)) {
    showSnackbar(`El pago #${numeroInt} ya existe en la tabla`, 'error'); return;
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
    showSnackbar('No se pudo guardar la tabla de pagos. Revisa tu conexión.', 'error');
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
window.syncMontoActualDeuda = function() {
  const original = document.getElementById('nd-monto')?.value;
  const actualInput = document.getElementById('nd-monto-actual');
  if (!actualInput || actualInput.dataset.editado === 'true') return;
  actualInput.value = original;
};
window.guardarNuevaDeuda = guardarNuevaDeuda;
window.renderCamposFechaEditarDeuda = renderCamposFechaEditarDeuda;
window.guardarEdicionDeuda = guardarEdicionDeuda;
window.openEditarDeuda = openEditarDeuda;
window.eliminarDeuda = eliminarDeuda;
window.agregarFilaPago = agregarFilaPago;
window.eliminarFilaPago = eliminarFilaPago;
window.guardarTablaPagesProgramados = guardarTablaPagesProgramados;
window.abrirCargarPagosDesdeEdicion = abrirCargarPagosDesdeEdicion;
