// js/deudas.js
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN, showSnackbar, renderLucideIcons,
  openModal, closeModal, openActionSheet, loadDashboard
} from './app.js';

let currentEditDeudaId = null;

const TIPO_CONFIG = {
  simple:   { label: 'Préstamo',      icono: 'landmark',    color: 'var(--accent)' },
  variable: { label: 'Tarjeta',       icono: 'credit-card', color: '#f59e0b' },
  tabla:    { label: 'Hipoteca/Auto', icono: 'home',        color: '#10b981' },
  flexible: { label: 'Informal',      icono: 'users',       color: 'var(--text-secondary)' },
};

function diasHastaProximoPago(diaPago, frecuencia) {
  if (!diaPago || !frecuencia || frecuencia === 'libre') return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let proxima = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);
  if (proxima <= hoy) proxima = new Date(hoy.getFullYear(), hoy.getMonth() + 1, diaPago);
  return Math.round((proxima - hoy) / 86400000);
}

function badgeVencimiento(dias) {
  if (dias === null || dias > 7) return '';
  const [bg, color, border] = dias <= 0
    ? ['rgba(240,93,110,0.15)', 'var(--red)', 'rgba(240,93,110,0.35)']
    : dias <= 3
    ? ['rgba(245,158,11,0.15)', '#d97706', 'rgba(245,158,11,0.35)']
    : ['rgba(16,185,129,0.12)', '#059669', 'rgba(16,185,129,0.3)'];
  const texto = dias < 0 ? 'Vencido' : dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
  return `<span style="display:inline-flex;align-items:center;background:${bg};color:${color};border:1px solid ${border};border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:600">${texto}</span>`;
}

export async function loadDeudas() {
  const uid = await getUsuarioId();
  const { data: deudas } = await db.from('deudas').select('*').eq('usuario_id', uid).eq('activa', true).order('created_at');

  let deudaCardsHTML = '';
  if (!deudas || deudas.length === 0) {
    deudaCardsHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
        <p>¡Sin deudas registradas!</p>
        <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">Registra tus deudas para hacer un plan de pago claro.</p>
      </div>
    `;
  } else {
    for (const d of deudas) {
      const pct = d.monto_inicial > 0
        ? Math.max(0, Math.min(100, Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100)))
        : 0;

      const config = TIPO_CONFIG[d.tipo_deuda] || TIPO_CONFIG.flexible;
      const dias = d.tipo_deuda !== 'tabla' ? diasHastaProximoPago(d.dia_pago, d.tipo_pago) : null;

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
          const diasTabla = Math.round(
            (new Date(proximoPago.fecha_vencimiento + 'T00:00:00').setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000
          );
          botonPagoHTML = `
            <div style="margin-top:12px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-size:12px;color:var(--text-secondary)">Cuota #${proximoPago.numero_pago}</span>
                ${badgeVencimiento(diasTabla)}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:12px;color:var(--text-secondary)">${new Date(proximoPago.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX', {day:'numeric',month:'short',year:'numeric'})}</span>
                <span style="font-weight:700;color:var(--accent)">${formatMXN(proximoPago.monto_esperado)}</span>
              </div>
              <button onclick="openPagarDeuda('${d.id}', '${d.acreedor}', ${d.monto_actual}, '${d.tipo_deuda}', ${d.monto_ultimo_pago || null})"
                style="background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body);width:100%">
                Registrar pago
              </button>
            </div>
          `;
        } else if (!sinTablaConfigurada) {
          botonPagoHTML = `<div style="margin-top:10px;font-size:13px;color:var(--green);text-align:center"><i data-lucide="check-circle-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Todas las cuotas pagadas</div>`;
        }
      } else {
        botonPagoHTML = `
          <button onclick="openPagarDeuda('${d.id}', '${d.acreedor}', ${d.monto_actual}, '${d.tipo_deuda}', ${d.monto_ultimo_pago || null})"
            style="margin-top:12px;background:var(--accent-soft);border:1px solid rgba(124,108,252,0.2);border-radius:var(--radius-xs);padding:8px 14px;color:var(--accent);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-body);width:100%">
            Registrar pago
          </button>
        `;
      }

      const infoPago = d.monto_pago && d.tipo_pago && d.tipo_pago !== 'libre'
        ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:6px">${config.label === 'Tarjeta' ? 'Pago mínimo' : 'Cuota'} ${d.tipo_pago}: <strong>${formatMXN(d.monto_pago)}</strong></div>`
        : '';

      deudaCardsHTML += `
        <div class="deuda-card">
          <div class="deuda-header">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              <i data-lucide="${config.icono}" style="width:18px;height:18px;stroke-width:1.75;color:${config.color};flex-shrink:0"></i>
              <span class="deuda-acreedor" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.acreedor}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              ${sinTablaConfigurada ? `<span title="Sin tabla de pagos cargada" style="display:inline-flex;align-items:center;gap:3px;background:rgba(245,158,11,0.15);color:#d97706;border:1px solid rgba(245,158,11,0.35);border-radius:9999px;padding:2px 7px;font-size:11px;font-weight:600"><i data-lucide="alert-triangle" style="width:11px;height:11px;stroke-width:2.5"></i> Sin tabla</span>` : ''}
              <span class="deuda-badge ${d.tipo_deuda}">${config.label}</span>
              <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuDeuda('${d.id}')">
                <i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i>
              </button>
            </div>
          </div>
          <div class="deuda-progress" style="margin-top:10px">
            <div class="deuda-progress-fill" style="width:${Math.max(pct, 2)}%"></div>
          </div>
          <div class="deuda-amounts">
            <span>${pct}% pagado</span>
            <span>Resta: <strong>${formatMXN(d.monto_actual)}</strong></span>
          </div>
          ${dias !== null ? `<div style="margin-top:6px">${badgeVencimiento(dias)}</div>` : ''}
          ${infoPago}
          ${botonPagoHTML}
        </div>
      `;
    }
  }

  document.getElementById('page-deudas').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Mis deudas</h1>
    </div>
    <div class="page-body">
      ${deudaCardsHTML}
    </div>
  `;

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

// ---- Editar deuda ----

function renderCamposFechaEditarDeuda() {
  const frecuencia = document.getElementById('ed-freq')?.value;
  const campos = document.getElementById('ed-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'unico') {
    campos.innerHTML = `
      <label class="form-label">Día de pago</label>
      <input class="form-input" id="ed-dia-pago" type="number" min="1" max="31" placeholder="1 - 31" />
    `;
    return;
  }
  if (frecuencia === 'mensual') {
    const edDiaPagoVal = document.getElementById('ed-dia-pago')?.value || '1';
    const opts = Array.from({length: 31}, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${parseInt(edDiaPagoVal) === d ? 'selected' : ''}>${d}</option>`).join('');
    campos.innerHTML = `
      <label class="form-label">Día del mes que pagas</label>
      <select class="form-select" id="ed-dia-pago">${opts}</select>
    `;
    return;
  }
  if (frecuencia === 'semanal') {
    const edDiaSemVal = document.getElementById('ed-dia-semana')?.value || '1';
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="ed-dia-semana">
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
    .select('id, acreedor, monto_actual, tipo_pago, dia_pago, dia_semana, monto_pago, tipo_deuda')
    .eq('id', deudaId)
    .eq('usuario_id', (await getUsuarioId()))
    .maybeSingle();

  if (error || !deuda) {
    currentEditDeudaId = null;
    showSnackbar('No se pudo cargar la deuda', 'error');
    return;
  }

  const config = TIPO_CONFIG[deuda.tipo_deuda] || TIPO_CONFIG.flexible;
  const esTabla = deuda.tipo_deuda === 'tabla';
  const esTarjeta = deuda.tipo_deuda === 'variable';
  const frecuenciaInicial = deuda.tipo_pago || 'libre';

  const labelMonto = esTarjeta ? 'Deuda actual (saldo tarjeta)' : 'Monto que debes actualmente';
  const labelCuota = esTarjeta ? 'Pago mínimo mensual (opcional)' : 'Cuota por período';

  const formFrecuencia = esTabla ? '' : `
    <div class="form-group">
      <label class="form-label">Frecuencia de pago</label>
      <select class="form-select" id="ed-freq" onchange="renderCamposFechaEditarDeuda()" ${esTarjeta ? 'disabled' : ''}>
        <option value="unico" ${frecuenciaInicial === 'unico' ? 'selected' : ''}>Pago único</option>
        <option value="semanal" ${frecuenciaInicial === 'semanal' ? 'selected' : ''}>Semanal</option>
        <option value="quincenal" ${frecuenciaInicial === 'quincenal' ? 'selected' : ''}>Quincenal</option>
        <option value="mensual" ${frecuenciaInicial === 'mensual' || esTarjeta ? 'selected' : ''}>Mensual</option>
        <option value="libre" ${frecuenciaInicial === 'libre' && !esTarjeta ? 'selected' : ''}>Sin fecha fija</option>
      </select>
    </div>
    <div class="form-group" id="ed-fecha-campos"></div>
    <div class="form-group">
      <label class="form-label">${labelCuota}</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ed-monto-pago" type="number" min="0" value="${deuda.monto_pago ? Number(deuda.monto_pago) : ''}" placeholder="0.00" /></div>
    </div>
  `;

  openModal(`Editar — ${config.label}`, `
    <div class="form-group">
      <label class="form-label">Acreedor</label>
      <input class="form-input" id="ed-acreedor" type="text" value="${deuda.acreedor || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">${labelMonto}</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="ed-monto" type="number" min="0" value="${Number(deuda.monto_actual || 0)}" /></div>
    </div>
    ${formFrecuencia}
    ${esTabla ? `
    <p class="form-hint" style="margin-bottom:8px">Esta deuda usa una tabla de amortización.</p>
    <button class="btn btn-secondary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px" onclick="abrirCargarPagosDesdeEdicion('${deuda.id}', '${deuda.acreedor.replace(/'/g, "\\'")}')">
      <i data-lucide="table-2" style="width:16px;height:16px;stroke-width:1.75;pointer-events:none"></i> Ver / cargar tabla de pagos
    </button>` : ''}
    <button class="btn btn-primary" onclick="guardarEdicionDeuda(${esTabla})">Guardar cambios</button>
  `);

  if (!esTabla) {
    renderCamposFechaEditarDeuda();
    if (frecuenciaInicial === 'semanal') {
      const inputSemana = document.getElementById('ed-dia-semana');
      if (inputSemana && deuda.dia_semana !== null) inputSemana.value = String(deuda.dia_semana);
    } else if (['mensual', 'quincenal', 'unico'].includes(frecuenciaInicial)) {
      const inputDia = document.getElementById('ed-dia-pago');
      if (inputDia && deuda.dia_pago) inputDia.value = String(deuda.dia_pago);
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

  const payload = { acreedor, monto_actual, activa: monto_actual > 0 };

  if (!esTabla) {
    const tipo_pago = document.getElementById('ed-freq')?.value || 'libre';
    const monto_pagoValor = document.getElementById('ed-monto-pago')?.value;
    const monto_pago = monto_pagoValor ? parseFloat(monto_pagoValor) : null;
    let dia_pago = null, dia_semana = null;

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

  const { error } = await db.from('deudas').update(payload)
    .eq('id', deudaId).eq('usuario_id', (await getUsuarioId()));

  if (error) { showSnackbar('No se pudo actualizar la deuda', 'error'); return; }

  closeModal();
  showSnackbar('Deuda actualizada ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

async function eliminarDeuda(deudaId) {
  if (!window.confirm('¿Eliminar esta deuda?')) return;

  const { error } = await db.from('deudas').update({ activa: false })
    .eq('id', deudaId).eq('usuario_id', (await getUsuarioId()));

  if (error) { showSnackbar('No se pudo eliminar la deuda', 'error'); return; }

  closeModal();
  showSnackbar('Deuda eliminada', 'success');
  await loadDeudas();
  await loadDashboard();
}

// ---- Pagar deuda ----

async function openPagarDeuda(deudaId, acreedor, montoActual, tipoDeuda, montoUltimoPago) {
  const { data: cuentas, error } = await db.from('cuentas').select('*')
    .eq('usuario_id', (await getUsuarioId())).eq('activa', true);

  if (error) { showSnackbar('No se pudieron cargar las cuentas', 'error'); return; }

  const config = TIPO_CONFIG[tipoDeuda] || TIPO_CONFIG.flexible;

  let infoReferenciaHTML = '';
  if (tipoDeuda === 'variable' && montoUltimoPago) {
    infoReferenciaHTML = `
    <div class="card" style="margin-bottom:12px;background:var(--bg-elevated)">
      <div style="font-size:12px;color:var(--text-secondary)">Último pago registrado</div>
      <div style="font-size:15px;font-weight:700">${formatMXN(montoUltimoPago)}</div>
    </div>`;
  }

  const hintMonto = tipoDeuda === 'variable'
    ? '<p class="form-hint" style="margin-top:4px">Escribe lo que vas a pagar esta vez (puede ser el mínimo o más).</p>'
    : '';

  openModal(`Pagar: ${acreedor}`, `
    <div class="card" style="margin-bottom:16px;background:var(--red-soft);border-color:rgba(240,93,110,0.2)">
      <div style="display:flex;align-items:center;gap:8px">
        <i data-lucide="${config.icono}" style="width:16px;height:16px;color:${config.color};stroke-width:1.75;flex-shrink:0"></i>
        <div>
          <div style="font-size:12px;color:var(--text-secondary)">${config.label} — deuda actual</div>
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--red)">${formatMXN(montoActual)}</div>
        </div>
      </div>
    </div>
    ${infoReferenciaHTML}
    <div class="form-group">
      <label class="form-label">Monto del pago</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="pd-monto" type="number" placeholder="0.00" min="0" max="${montoActual}" /></div>
      ${hintMonto}
    </div>
    <div class="form-group">
      <label class="form-label">¿De qué cuenta sale el dinero?</label>
      <select class="form-select" id="pd-cuenta">
        <option value="">— Selecciona una cuenta —</option>
        ${(cuentas || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Nota (opcional)</label>
      <input class="form-input" id="pd-nota" type="text" placeholder="Ej: Abono quincenal, pago mínimo…" />
    </div>
    <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:16px">
      <input type="checkbox" id="pd-historico" style="width:16px;height:16px;cursor:pointer;margin-top:2px;flex-shrink:0" />
      <div>
        <div style="font-size:14px;font-weight:600">Ya lo pagué antes de usar la app</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Solo suma al progreso — no descuenta saldo de ninguna cuenta</div>
      </div>
    </label>
    <button class="btn btn-primary" onclick="guardarPagoDeuda('${deudaId}', ${montoActual}, '${tipoDeuda}')">Registrar pago</button>
  `);

  renderLucideIcons();
}

async function guardarPagoDeuda(deudaId, montoActual, tipoDeuda) {
  const monto = parseFloat(document.getElementById('pd-monto').value);
  const cuenta_id = document.getElementById('pd-cuenta')?.value || null;
  const nota = document.getElementById('pd-nota').value.trim();
  const esHistorico = document.getElementById('pd-historico')?.checked || false;
  const usuarioId = await getUsuarioId();

  if (!monto || monto <= 0) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (monto > montoActual) { showSnackbar('El pago no puede ser mayor a la deuda', 'error'); return; }

  const nuevoMonto = montoActual - monto;
  const fechaHoy = new Date().toISOString().split('T')[0];

  if (!esHistorico) {
    if (!cuenta_id) { showSnackbar('Selecciona la cuenta de donde salió el pago', 'error'); return; }

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

    const totalIngresos = (ingresosCuenta || []).reduce((s, m) => s + Number(m.monto || 0), 0);
    const totalGastos   = (gastosCuenta   || []).reduce((s, m) => s + Number(m.monto || 0), 0);
    const totalPagos    = (pagosDeudaCuenta || []).reduce((s, m) => s + Number(m.monto || 0), 0);
    const saldoDisponible = Number(cuenta.saldo_inicial || 0) + totalIngresos - totalGastos - totalPagos;

    if (monto > saldoDisponible) {
      showSnackbar('Saldo insuficiente en esa cuenta', 'error');
      return;
    }

    await db.from('pagos_deuda').insert({ deuda_id: deudaId, usuario_id: usuarioId, cuenta_id, monto, nota, fecha: fechaHoy });
  }

  if (tipoDeuda === 'tabla') {
    const { data: proximoPago } = await db.from('pagos_programados')
      .select('id').eq('deuda_id', deudaId).eq('pagado', false)
      .order('fecha_vencimiento').limit(1).maybeSingle();
    if (proximoPago) {
      await db.from('pagos_programados').update({ pagado: true, fecha_pago: fechaHoy, monto_pagado: monto }).eq('id', proximoPago.id);
    }
  }

  await db.from('deudas').update({
    monto_actual: nuevoMonto,
    activa: nuevoMonto > 0,
    ultimo_pago: fechaHoy,
    monto_ultimo_pago: monto
  }).eq('id', deudaId);

  closeModal();
  showSnackbar(nuevoMonto === 0 ? 'Deuda liquidada' : 'Pago registrado', 'success');
  await loadDeudas();
  await loadDashboard();
}

// ---- Nueva deuda ----

function openAgregarDeuda() {
  openModal('Nueva deuda', `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">¿Qué tipo de deuda quieres registrar?</p>
    <div style="display:flex;flex-direction:column;gap:10px">

      <button onclick="selectTipoDeuda('variable')"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-family:var(--font-body);text-align:left">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;background:rgba(245,158,11,0.12);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i data-lucide="credit-card" style="width:20px;height:20px;color:#f59e0b;stroke-width:1.75;pointer-events:none"></i>
          </div>
          <div>
            <div style="font-weight:600;font-size:14px">Tarjeta de crédito</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">BBVA, Santander, Banamex, Liverpool…</div>
          </div>
        </div>
        <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-muted);stroke-width:2;pointer-events:none;flex-shrink:0"></i>
      </button>

      <button onclick="selectTipoDeuda('simple')"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-family:var(--font-body);text-align:left">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;background:rgba(124,108,252,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i data-lucide="landmark" style="width:20px;height:20px;color:var(--accent);stroke-width:1.75;pointer-events:none"></i>
          </div>
          <div>
            <div style="font-weight:600;font-size:14px">Préstamo personal</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Caja Popular, FONACOT, banco, nómina…</div>
          </div>
        </div>
        <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-muted);stroke-width:2;pointer-events:none;flex-shrink:0"></i>
      </button>

      <button onclick="selectTipoDeuda('tabla')"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-family:var(--font-body);text-align:left">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;background:rgba(16,185,129,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i data-lucide="home" style="width:20px;height:20px;color:#10b981;stroke-width:1.75;pointer-events:none"></i>
          </div>
          <div>
            <div style="font-weight:600;font-size:14px">Hipoteca / Crédito automotriz</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">INFONAVIT, FOVISSSTE, crédito de auto…</div>
          </div>
        </div>
        <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-muted);stroke-width:2;pointer-events:none;flex-shrink:0"></i>
      </button>

      <button onclick="selectTipoDeuda('flexible')"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-family:var(--font-body);text-align:left">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;background:rgba(99,102,241,0.08);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i data-lucide="users" style="width:20px;height:20px;color:var(--text-secondary);stroke-width:1.75;pointer-events:none"></i>
          </div>
          <div>
            <div style="font-weight:600;font-size:14px">Deuda informal</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Familia, amigos, sin fecha fija de pago…</div>
          </div>
        </div>
        <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-muted);stroke-width:2;pointer-events:none;flex-shrink:0"></i>
      </button>

    </div>
  `);
  renderLucideIcons();
}

function selectTipoDeuda(tipo) {
  openFormularioNuevaDeuda(tipo);
}

function openFormularioNuevaDeuda(tipo) {
  const config = TIPO_CONFIG[tipo] || TIPO_CONFIG.flexible;
  let formContent = '';

  if (tipo === 'variable') {
    // Tarjeta de crédito
    const opts = Array.from({length: 31}, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${d === 1 ? 'selected' : ''}>${d}</option>`).join('');
    formContent = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 12px;background:rgba(245,158,11,0.08);border-radius:var(--radius-sm);border:1px solid rgba(245,158,11,0.2)">
        <i data-lucide="credit-card" style="width:16px;height:16px;color:#f59e0b;stroke-width:1.75;flex-shrink:0"></i>
        <span style="font-size:13px;color:#92400e;font-weight:500">Tarjeta de crédito</span>
      </div>
      <div class="form-group">
        <label class="form-label">¿Cuál tarjeta?</label>
        <input class="form-input" id="nd-acreedor" type="text" placeholder="Ej: BBVA Azul, Santander Zero, Liverpool…" />
      </div>
      <div class="form-group">
        <label class="form-label">¿Cuánto debes actualmente?</label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nd-monto" type="number" placeholder="0.00" min="0" /></div>
        <p class="form-hint">El saldo que aparece en tu último estado de cuenta.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Pago mínimo mensual <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nd-cuota" type="number" placeholder="0.00" min="0" /></div>
        <p class="form-hint">Lo que pagas de mínimo para no caer en mora — está en tu estado de cuenta.</p>
      </div>
      <div class="form-group">
        <label class="form-label">¿Qué día del mes es tu fecha límite de pago?</label>
        <select class="form-select" id="nd-dia-pago">${opts}</select>
        <p class="form-hint">La fecha límite viene en tu estado de cuenta mensual.</p>
      </div>
      <input type="hidden" id="nd-freq" value="mensual" />
    `;
  } else if (tipo === 'simple') {
    // Préstamo personal
    formContent = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 12px;background:rgba(124,108,252,0.08);border-radius:var(--radius-sm);border:1px solid rgba(124,108,252,0.2)">
        <i data-lucide="landmark" style="width:16px;height:16px;color:var(--accent);stroke-width:1.75;flex-shrink:0"></i>
        <span style="font-size:13px;color:var(--accent);font-weight:500">Préstamo personal</span>
      </div>
      <div class="form-group">
        <label class="form-label">¿A quién le debes?</label>
        <input class="form-input" id="nd-acreedor" type="text" placeholder="Ej: Caja Popular Jalisco, FONACOT, BBVA Crédito…" />
      </div>
      <div class="form-group">
        <label class="form-label">¿Cuánto debes todavía?</label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nd-monto" type="number" placeholder="0.00" min="0" /></div>
        <p class="form-hint">El saldo pendiente, no el monto original del préstamo.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Frecuencia de pago</label>
        <select class="form-select" id="nd-freq" onchange="renderCamposFechaDeuda()">
          <option value="mensual" selected>Mensual</option>
          <option value="quincenal">Quincenal (2 veces al mes)</option>
          <option value="semanal">Semanal</option>
          <option value="unico">Pago único (una sola vez)</option>
        </select>
      </div>
      <div class="form-group" id="nd-fecha-campos"></div>
      <div class="form-group">
        <label class="form-label">Cuota fija por período</label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nd-cuota" type="number" placeholder="0.00" min="0" /></div>
        <p class="form-hint">Lo que pagas cada quincena o mes — está en tu contrato o recibo.</p>
      </div>
    `;
  } else if (tipo === 'tabla') {
    // Hipoteca / Auto
    formContent = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 12px;background:rgba(16,185,129,0.08);border-radius:var(--radius-sm);border:1px solid rgba(16,185,129,0.2)">
        <i data-lucide="home" style="width:16px;height:16px;color:#10b981;stroke-width:1.75;flex-shrink:0"></i>
        <span style="font-size:13px;color:#065f46;font-weight:500">Hipoteca / Crédito automotriz</span>
      </div>
      <div class="form-group">
        <label class="form-label">¿A quién le debes?</label>
        <input class="form-input" id="nd-acreedor" type="text" placeholder="Ej: INFONAVIT, FOVISSSTE, BBVA Auto…" />
      </div>
      <div class="form-group">
        <label class="form-label">Saldo actual del crédito</label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nd-monto" type="number" placeholder="0.00" min="0" /></div>
        <p class="form-hint">Lo que todavía debes, no el valor total de la propiedad o auto.</p>
      </div>
      <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:12px">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <i data-lucide="info" style="width:14px;height:14px;color:var(--text-muted);margin-top:1px;flex-shrink:0;stroke-width:2"></i>
          <p style="font-size:12px;color:var(--text-secondary);margin:0">Después podrás cargar tu <strong>tabla de amortización</strong> completa con cada mensualidad, fecha y monto.</p>
        </div>
      </div>
    `;
  } else {
    // Deuda informal
    formContent = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 12px;background:rgba(99,102,241,0.06);border-radius:var(--radius-sm);border:1px solid rgba(99,102,241,0.15)">
        <i data-lucide="users" style="width:16px;height:16px;color:var(--text-secondary);stroke-width:1.75;flex-shrink:0"></i>
        <span style="font-size:13px;color:var(--text-secondary);font-weight:500">Deuda informal</span>
      </div>
      <div class="form-group">
        <label class="form-label">¿A quién le debes?</label>
        <input class="form-input" id="nd-acreedor" type="text" placeholder="Ej: Mamá, amigo Juan, vecino…" />
      </div>
      <div class="form-group">
        <label class="form-label">¿Cuánto debes?</label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nd-monto" type="number" placeholder="0.00" min="0" /></div>
      </div>
      <div class="form-group">
        <label class="form-label">¿Cuánto puedes pagar cada que puedas? <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <div class="input-money-wrap"><span class="currency-prefix">$</span>
        <input class="form-input" id="nd-cuota" type="number" placeholder="0.00" min="0" /></div>
        <p class="form-hint">Solo para llevar un estimado — no hay fecha fija.</p>
      </div>
    `;
  }

  formContent += `<button class="btn btn-primary" onclick="guardarNuevaDeuda('${tipo}')">Guardar deuda</button>`;

  openModal(`Nueva deuda — ${config.label}`, formContent);

  if (tipo === 'simple') {
    setTimeout(() => renderCamposFechaDeuda(), 100);
  }

  renderLucideIcons();
}

function renderCamposFechaDeuda() {
  const frecuencia = document.getElementById('nd-freq')?.value;
  const campos = document.getElementById('nd-fecha-campos');
  if (!campos) return;

  if (frecuencia === 'unico') {
    campos.innerHTML = `
      <label class="form-label">¿Cuándo es la fecha de pago?</label>
      <input class="form-input" id="nd-fecha-pago" type="date" />
    `;
    return;
  }
  if (frecuencia === 'mensual') {
    const opts = Array.from({length: 31}, (_, i) => i + 1)
      .map(d => `<option value="${d}">${d}</option>`).join('');
    campos.innerHTML = `
      <label class="form-label">¿Qué día del mes pagas?</label>
      <select class="form-select" id="nd-dia-pago">${opts}</select>
      <p class="form-hint">El día que descuenta tu institución cada mes.</p>
    `;
    return;
  }
  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">¿Qué día de la semana pagas?</label>
      <select class="form-select" id="nd-dia-semana">
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
    campos.innerHTML = `<p class="form-hint" style="margin:4px 0 8px">Los pagos se registrarán los días 15 y último de cada mes.</p>`;
    return;
  }
  campos.innerHTML = '';
}

async function guardarNuevaDeuda(tipo) {
  const acreedor = document.getElementById('nd-acreedor').value.trim();
  const monto = parseFloat(document.getElementById('nd-monto').value);
  let tipo_pago = null, monto_pago = null, dia_pago = null, dia_semana = null;

  if (!acreedor) { showSnackbar('Escribe el nombre del acreedor', 'error'); return; }
  if (!monto || monto <= 0) { showSnackbar('Ingresa un monto válido', 'error'); return; }

  if (tipo === 'flexible') {
    tipo_pago = 'libre';
    monto_pago = parseFloat(document.getElementById('nd-cuota')?.value) || null;
  }

  if (tipo === 'simple' || tipo === 'variable') {
    tipo_pago = document.getElementById('nd-freq').value;
    monto_pago = parseFloat(document.getElementById('nd-cuota')?.value) || null;

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
    }
  }

  const { data: deudaInsertada, error } = await db.from('deudas').insert({
    usuario_id: (await getUsuarioId()),
    acreedor, monto_inicial: monto, monto_actual: monto,
    tipo_pago, monto_pago, dia_pago, dia_semana, tipo_deuda: tipo
  }).select();

  if (error) { showSnackbar('Error al guardar la deuda', 'error'); return; }

  closeModal();
  showSnackbar('Deuda registrada ✓', 'success');

  if (tipo === 'tabla' && deudaInsertada?.length > 0) {
    setTimeout(() => openAgregarPagosProgramados(deudaInsertada[0].id, acreedor), 500);
  } else {
    await loadDeudas();
    await loadDashboard();
  }
}

// ---- Tabla de amortización ----

function abrirCargarPagosDesdeEdicion(deudaId, acreedor) {
  closeModal();
  setTimeout(() => openAgregarPagosProgramados(deudaId, acreedor), 200);
}

function openAgregarPagosProgramados(deudaId, acreedor) {
  filasPagesProgramados = [];
  openModal(`Tabla de pagos: ${acreedor}`, `
    <p class="form-hint" style="margin-bottom:12px">Agrega cada cuota de tu tabla de amortización: número, fecha y monto.</p>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;max-height:400px;overflow-y:auto" id="pagos-programados-lista"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <input class="form-input" id="pp-numero" type="number" placeholder="# Pago" min="1" />
      <input class="form-input" id="pp-fecha" type="date" />
      <input class="form-input" id="pp-monto" type="number" placeholder="Monto" min="0" />
    </div>
    <button class="btn btn-secondary" style="margin-bottom:8px" onclick="agregarFilaPago()">+ Agregar cuota</button>
    <button class="btn btn-primary" onclick="guardarTablaPagesProgramados('${deudaId}')">Guardar tabla</button>
  `);
  renderFilasPagos();
}

let filasPagesProgramados = [];

function agregarFilaPago() {
  const numero = document.getElementById('pp-numero')?.value || '';
  const fecha  = document.getElementById('pp-fecha')?.value  || '';
  const monto  = document.getElementById('pp-monto')?.value  || '';
  if (!numero || !fecha || !monto) { showSnackbar('Completa los 3 campos de la cuota', 'error'); return; }
  filasPagesProgramados.push({ numero: parseInt(numero), fecha_vencimiento: fecha, monto_esperado: parseFloat(monto) });
  document.getElementById('pp-numero').value = '';
  document.getElementById('pp-fecha').value  = '';
  document.getElementById('pp-monto').value  = '';
  renderFilasPagos();
}

function renderFilasPagos() {
  const lista = document.getElementById('pagos-programados-lista');
  if (!lista) return;
  lista.innerHTML = filasPagesProgramados.map((fila, i) => `
    <div class="item-row" style="margin-bottom:0;background:var(--bg-elevated);padding:12px;border-radius:var(--radius-sm)">
      <div class="item-row-info">
        <div class="item-row-name">Cuota #${fila.numero}</div>
        <div class="item-row-detail">${new Date(fila.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-MX', {day:'numeric',month:'short',year:'numeric'})}</div>
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
    showSnackbar('Agrega al menos una cuota', 'error');
    return;
  }
  const usuarioId = await getUsuarioId();
  const { error } = await db.from('pagos_programados').insert(
    filasPagesProgramados.map(f => ({
      deuda_id: deudaId,
      usuario_id: usuarioId,
      numero_pago: f.numero,
      fecha_vencimiento: f.fecha_vencimiento,
      monto_esperado: f.monto_esperado,
      pagado: false
    }))
  );
  if (error) { showSnackbar('Error al guardar la tabla de pagos', 'error'); return; }
  closeModal();
  filasPagesProgramados = [];
  showSnackbar('Tabla de pagos guardada ✓', 'success');
  await loadDeudas();
  await loadDashboard();
}

// ---- Exports ----
window.openMenuDeuda               = openMenuDeuda;
window.openPagarDeuda              = openPagarDeuda;
window.guardarPagoDeuda            = guardarPagoDeuda;
window.openAgregarDeuda            = openAgregarDeuda;
window.selectTipoDeuda             = selectTipoDeuda;
window.renderCamposFechaDeuda      = renderCamposFechaDeuda;
window.guardarNuevaDeuda           = guardarNuevaDeuda;
window.renderCamposFechaEditarDeuda = renderCamposFechaEditarDeuda;
window.guardarEdicionDeuda         = guardarEdicionDeuda;
window.openEditarDeuda             = openEditarDeuda;
window.eliminarDeuda               = eliminarDeuda;
window.agregarFilaPago             = agregarFilaPago;
window.eliminarFilaPago            = eliminarFilaPago;
window.guardarTablaPagesProgramados = guardarTablaPagesProgramados;
window.abrirCargarPagosDesdeEdicion = abrirCargarPagosDesdeEdicion;
