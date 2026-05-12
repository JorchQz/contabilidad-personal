// js/gastos.js — Módulo de Egresos (Gastos variables y Gastos Fijos)
import { db, getUsuarioId } from './supabase.js';
import {
  formatMXN,
  showSnackbar,
  renderEmojiOrIcon,
  renderLucideIcons,
  openActionSheet,
  openModal,
  closeModal,
  loadDashboard,
  actualizarBotonCategoriaSelector,
  setCatState,
  getCurrentCatId
} from './app.js';
import { loadDeudas } from './deudas.js';
import { loadMetas } from './metas.js';
import { getSaldoCuentaEspecifica } from './balance.js';

// ---- SEGURIDAD ----
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- CATÁLOGO DE GASTOS FIJOS ----
export const GASTOS_FIJOS_CATALOGO = [
  {
    titulo: 'Vivienda', icono: 'home',
    items: [
      { nombre: 'Renta',          icono: 'home',       frecuencia: 'mensual' },
      { nombre: 'Hipoteca',       icono: 'building-2', frecuencia: 'mensual' },
      { nombre: 'Cuota de mantenimiento', icono: 'wrench', frecuencia: 'mensual', montoVariable: true },
      { nombre: 'Predial',        icono: 'landmark',   frecuencia: 'anual' },
    ],
  },
  {
    titulo: 'Servicios', icono: 'zap',
    items: [
      { nombre: 'Luz / CFE',        icono: 'zap',        frecuencia: 'bimestral', montoVariable: true },
      { nombre: 'Agua',             icono: 'droplets',   frecuencia: 'mensual',   montoVariable: true },
      { nombre: 'Gas',              icono: 'flame',      frecuencia: 'mensual',   montoVariable: true },
      { nombre: 'Internet',         icono: 'wifi',       frecuencia: 'mensual' },
      { nombre: 'Teléfono celular', icono: 'smartphone', frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Streaming y suscripciones', icono: 'tv',
    items: [
      { nombre: 'Netflix',         icono: 'tv',           frecuencia: 'mensual' },
      { nombre: 'Spotify',         icono: 'music',        frecuencia: 'mensual' },
      { nombre: 'Disney+',         icono: 'clapperboard', frecuencia: 'mensual' },
      { nombre: 'HBO Max',         icono: 'tv',           frecuencia: 'mensual' },
      { nombre: 'Amazon Prime',    icono: 'package',      frecuencia: 'mensual' },
      { nombre: 'YouTube Premium', icono: 'bx bxl-youtube', frecuencia: 'mensual' },
      { nombre: 'Apple Music',     icono: 'music',        frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Salud y bienestar', icono: 'shield',
    items: [
      { nombre: 'Seguro médico', icono: 'shield',      frecuencia: 'anual' },
      { nombre: 'Gimnasio',      icono: 'dumbbell',    frecuencia: 'mensual' },
      { nombre: 'Terapia',       icono: 'heart-pulse', frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Auto', icono: 'car',
    items: [
      { nombre: 'Seguro de auto',      icono: 'car',       frecuencia: 'anual' },
      { nombre: 'Tenencia / Refrendo', icono: 'file-text', frecuencia: 'anual' },
    ],
  },
  {
    titulo: 'Educación', icono: 'graduation-cap',
    items: [
      { nombre: 'Colegiatura', icono: 'graduation-cap', frecuencia: 'mensual' },
    ],
  },
];

// ---- CATÁLOGO DE GASTOS VARIABLES (predefinidos para el picker) ----
// Se siembran en la tabla `categorias` al terminar onboarding.
// Marcador `special` se usa para flujos especiales en el registro (ahorro, pago de deuda).
export const GASTOS_VARIABLES_CATALOGO = [
  {
    titulo: 'Hogar', icono: 'home',
    items: [
      { nombre: 'Renta',           icono: 'home' },
      { nombre: 'Mantenimiento',   icono: 'wrench' },
      { nombre: 'Muebles y decoración', icono: 'sofa' },
      { nombre: 'Otro hogar',      icono: 'home' },
    ],
  },
  {
    titulo: 'Servicios', icono: 'zap',
    items: [
      { nombre: 'Luz',                    icono: 'zap' },
      { nombre: 'Agua',                   icono: 'droplets' },
      { nombre: 'Gas',                    icono: 'flame' },
      { nombre: 'Internet y telefonía',   icono: 'wifi' },
      { nombre: 'Suscripciones digitales',icono: 'smartphone' },
      { nombre: 'Otro servicio',          icono: 'package' },
    ],
  },
  {
    titulo: 'Alimentación', icono: 'utensils',
    items: [
      { nombre: 'Súper',           icono: 'shopping-cart' },
      { nombre: 'Restaurantes',    icono: 'utensils' },
      { nombre: 'Cafés y snacks',  icono: 'coffee' },
      { nombre: 'Comida a domicilio', icono: 'package' },
      { nombre: 'Otro alimentación', icono: 'utensils' },
    ],
  },
  {
    titulo: 'Transporte', icono: 'car',
    items: [
      { nombre: 'Gasolina',        icono: 'fuel' },
      { nombre: 'Mantenimiento auto', icono: 'wrench' },
      { nombre: 'Trámites y seguros', icono: 'file-text' },
      { nombre: 'Transporte público y apps', icono: 'bus' },
      { nombre: 'Otro transporte', icono: 'car' },
    ],
  },
  {
    titulo: 'Entretenimiento', icono: 'gamepad-2',
    items: [
      { nombre: 'Gaming',          icono: 'gamepad-2' },
      { nombre: 'Eventos y salidas', icono: 'music' },
      { nombre: 'Hobbies',         icono: 'palette' },
      { nombre: 'Otro entretenimiento', icono: 'tv' },
    ],
  },
  {
    titulo: 'Educación', icono: 'graduation-cap',
    items: [
      { nombre: 'Colegiaturas',    icono: 'graduation-cap' },
      { nombre: 'Material y libros', icono: 'book-open' },
      { nombre: 'Cursos y apps',   icono: 'laptop' },
      { nombre: 'Otro educación',  icono: 'graduation-cap' },
    ],
  },
  {
    titulo: 'Salud y cuidado', icono: 'heart-pulse',
    items: [
      { nombre: 'Médico y farmacia', icono: 'stethoscope' },
      { nombre: 'Ropa y calzado',  icono: 'shirt' },
      { nombre: 'Aseo personal',   icono: 'sparkles' },
      { nombre: 'Otro salud',      icono: 'heart-pulse' },
    ],
  },
  {
    titulo: 'Personas', icono: 'users',
    items: [
      { nombre: 'Citas',           icono: 'heart' },
      { nombre: 'Familia',         icono: 'users' },
      { nombre: 'Amigos',          icono: 'users' },
      { nombre: 'Regalos',         icono: 'gift' },
      { nombre: 'Otro personas',   icono: 'users' },
    ],
  },
  {
    titulo: 'Finanzas', icono: 'piggy-bank',
    items: [
      { nombre: 'Ahorro',          icono: 'piggy-bank',   special: 'ahorro' },
      { nombre: 'Pago de deudas',  icono: 'trending-down', special: 'pago_deuda' },
      { nombre: 'Comisiones e impuestos', icono: 'percent' },
      { nombre: 'Otro finanzas',   icono: 'coins' },
    ],
  },
  {
    titulo: 'Gastos hormiga', icono: 'shopping-bag',
    items: [
      { nombre: 'OXXO / Tiendita',    icono: 'store' },
      { nombre: 'Café / Refresco',    icono: 'coffee' },
      { nombre: 'Antojitos',          icono: 'utensils' },
      { nombre: 'Propinas',           icono: 'coins' },
      { nombre: 'Otro hormiga',       icono: 'shopping-bag' },
    ],
  },
  {
    titulo: 'Negocio', icono: 'briefcase',
    items: [
      { nombre: 'Inventario',      icono: 'box' },
      { nombre: 'Software y herramientas', icono: 'laptop' },
      { nombre: 'Publicidad y envíos', icono: 'megaphone' },
      { nombre: 'Otro negocio',    icono: 'briefcase' },
    ],
  },
];

// Mapa rápido nombre → {grupo, icono, special} para el picker de registro de gasto
export const GASTOS_VARIABLES_INDEX = (() => {
  const idx = {};
  GASTOS_VARIABLES_CATALOGO.forEach(g => {
    g.items.forEach(it => {
      idx[it.nombre] = { grupo: g.titulo, grupoIcono: g.icono, icono: it.icono, special: it.special || null };
    });
  });
  return idx;
})();

let currentEditGastoId = null;
let _cuentasParaGasto   = []; // referencia para detectar TDC en el modal de gasto

// ---- HELPERS EXCLUSIVOS DE GASTOS ----
function getCategoriaGastoIcon(nombre) {
  const map = {
    Comida: 'utensils',
    Transporte: 'car',
    Ropa: 'shopping-bag',
    Internet: 'wifi',
    Salud: 'heart-pulse',
    Familia: 'users',
    Entretenimiento: 'tv',
    Negocio: 'briefcase',
    Deuda: 'trending-down',
    Ahorro: 'piggy-bank',
    Otros: 'package'
  };

  const iconName = map[nombre] || 'package';
  return `<i data-lucide="${iconName}" style="width:18px;height:18px;stroke-width:1.75"></i>`;
}

// ---- GASTOS FIJOS ----
const FRECUENCIA_LABEL = {
  semanal:    'Semanal',
  quincenal:  'Quincenal',
  mensual:    'Mensual',
  bimestral:  'Bimestral',
  trimestral: 'Trimestral',
  semestral:  'Semestral',
  anual:      'Anual',
};

function formatearFrecuenciaGastoFijo(frecuencia, diaPago, diaSemana, proximoPago) {
  const diasSemana = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  const base = FRECUENCIA_LABEL[frecuencia] || frecuencia || 'Sin frecuencia';

  if (frecuencia === 'semanal') {
    const dia = Number.isInteger(diaSemana) && diaSemana >= 0 && diaSemana <= 6 ? diasSemana[diaSemana] : null;
    return `${base}${dia ? ` · ${dia}` : ''}`;
  }

  if (proximoPago) {
    const d = new Date(proximoPago);
    if (!Number.isNaN(d.getTime())) {
      const opts = { day: 'numeric', month: 'short' };
      return `${base} · próx. ${d.toLocaleDateString('es-MX', opts)}`;
    }
  }

  if (diaPago) return `${base} · día ${diaPago}`;
  return base;
}

export async function loadFijos() {
  const uid = (await getUsuarioId());
  const { data: fijos, error } = await db
    .from('gastos_fijos')
    .select('*, categorias(emoji)')
    .eq('usuario_id', uid)
    .eq('activo', true)
    .order('descripcion', { ascending: true });

  if (error) {
    document.getElementById('page-fijos').innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Gastos fijos</h1>
      </div>
      <div class="page-body">
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No se pudieron cargar los gastos fijos.</p>
        </div>
      </div>
    `;
    renderLucideIcons();
    return;
  }

  document.getElementById('page-fijos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Gastos fijos</h1>
    </div>
    <div class="page-body">
      ${!fijos || fijos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No tienes gastos fijos registrados.<br>Agrega uno para empezar.</p>
        </div>
      ` : fijos.map(g => {
        const iconoHtml = renderEmojiOrIcon(g.categorias?.emoji, 'pin', 18);
        const montoTxt = g.monto != null ? formatMXN(g.monto) : '—';
        return `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji">${iconoHtml}</div>
          <div class="item-row-info">
            <div class="item-row-name">${escapeHtml(g.descripcion)}</div>
            <div class="item-row-detail">${formatearFrecuenciaGastoFijo(g.frecuencia, g.dia_pago, g.dia_semana, g.proximo_pago)}</div>
          </div>
          <div class="item-row-amount" style="color:var(--red)">${montoTxt}</div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuGastoFijo('${g.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
        </div>
      `;
      }).join('')}
    </div>
  `;

  renderLucideIcons();
}

function openGastoFijoActions(gastoFijoId) {
  openActionSheet('Opciones de gasto fijo', [
    { label: 'Editar', onClick: `openEditarGastoFijo('${gastoFijoId}')` },
    { label: 'Eliminar', onClick: `eliminarGastoFijo('${gastoFijoId}')`, danger: true }
  ]);
}

function openMenuGastoFijo(gastoFijoId) {
  openGastoFijoActions(gastoFijoId);
}

const FRECUENCIAS_FIJO_UI = [
  ['semanal',    'Semanal'],
  ['quincenal',  'Quincenal'],
  ['mensual',    'Mensual'],
  ['bimestral',  'Bimestral'],
  ['trimestral', 'Trimestral'],
  ['semestral',  'Semestral'],
  ['anual',      'Anual'],
];

const FREQ_DESC_MODAL = {
  semanal:    'Cada semana, el día que elijas.',
  quincenal:  'Los días 15 y último de cada mes.',
  mensual:    'Una vez al mes, en el día que elijas.',
  bimestral:  'Cada 2 meses — ingresa el último pago para proyectar el siguiente.',
  trimestral: 'Cada 3 meses — ingresa el último pago para proyectar el siguiente.',
  semestral:  'Cada 6 meses — ingresa el último pago para proyectar el siguiente.',
  anual:      'Una vez al año — ingresa el último pago para proyectar el siguiente.',
};

const CICLOS_LARGOS_FIJO = ['bimestral', 'trimestral', 'semestral', 'anual'];

function extraerCamposFechaFijo(prefix, frecuencia, tipo) {
  let dia_semana = null, dia_pago = null, proximo_pago = null, ultima_fecha_pago = null;
  const esFlex = tipo === 'fecha-flexible' || tipo === 'aproximado';
  if (esFlex) {
    ultima_fecha_pago = document.getElementById(`${prefix}-ultimo-pago`)?.value || null;
    return { dia_semana, dia_pago, proximo_pago, ultima_fecha_pago };
  }
  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById(`${prefix}-dia-semana`)?.value, 10);
    if (Number.isNaN(dia_semana)) dia_semana = null;
  } else if (frecuencia === 'mensual') {
    dia_pago = parseInt(document.getElementById(`${prefix}-dia-mes`)?.value, 10) || null;
  } else if (CICLOS_LARGOS_FIJO.includes(frecuencia)) {
    proximo_pago = document.getElementById(`${prefix}-proximo-pago`)?.value || null;
  }
  return { dia_semana, dia_pago, proximo_pago, ultima_fecha_pago };
}

function frecuenciaSelectHtml(id, onchange, selected) {
  return `<select class="form-select" id="${id}" onchange="${onchange}" style="height:48px !important;max-height:48px !important;min-height:unset;width:100%;align-self:start">
    ${FRECUENCIAS_FIJO_UI.map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('')}
  </select>`;
}

function renderCamposFechaFijo(prefix, initial = {}) {
  const campos = document.getElementById(`${prefix}-fecha-campos`);
  if (!campos) return;

  const toggleRoot = document.getElementById(`${prefix}-tipo-monto`);
  const tipo       = toggleRoot?.dataset.tipo || 'exacto';
  const esFlex     = tipo === 'fecha-flexible' || tipo === 'aproximado';
  const esEstimado = tipo === 'monto-variable'  || tipo === 'aproximado';

  const montoWrap  = document.getElementById(`${prefix}-monto-wrap`);
  const montoLabel = document.getElementById(`${prefix}-monto-label`);
  if (montoWrap)  montoWrap.style.display = '';
  if (montoLabel) montoLabel.textContent  = esEstimado ? 'Monto promedio estimado' : 'Monto';

  const frecuencia = document.getElementById(`${prefix}-freq`)?.value;
  const freqDescEl = document.getElementById(`${prefix}-freq-desc`);
  if (freqDescEl) freqDescEl.textContent = FREQ_DESC_MODAL[frecuencia] || '';

  const prevDiaSemana = document.getElementById(`${prefix}-dia-semana`)?.value;
  const prevDiaMes    = document.getElementById(`${prefix}-dia-mes`)?.value;
  const prevProximo   = document.getElementById(`${prefix}-proximo-pago`)?.value;
  const prevUltimo    = document.getElementById(`${prefix}-ultimo-pago`)?.value;

  const diaSem  = Number.isInteger(initial.dia_semana) ? initial.dia_semana
                : (prevDiaSemana !== undefined ? parseInt(prevDiaSemana, 10) : 1);
  const diaMes  = initial.dia_pago || (prevDiaMes ? parseInt(prevDiaMes, 10) : 1);
  const proxVal = initial.proximo_pago      || prevProximo || '';
  const ultVal  = initial.ultima_fecha_pago || prevUltimo  || '';

  const DIAS = [[1,'Lunes'],[2,'Martes'],[3,'Miércoles'],[4,'Jueves'],[5,'Viernes'],[6,'Sábado'],[0,'Domingo']];

  const H = 'height:44px;min-height:44px;max-height:44px;width:100%;align-self:start';

  if (esFlex) {
    campos.innerHTML = `
      <label class="form-label">Último pago</label>
      <input class="form-input" id="${prefix}-ultimo-pago" type="date" value="${ultVal}" style="${H}" />
      <p class="form-hint" style="margin:4px 0 0;font-size:12px">Calcularemos la fecha esperada según tu frecuencia.</p>`;
    return;
  }

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de pago</label>
      <select class="form-select" id="${prefix}-dia-semana" style="${H}">
        ${DIAS.map(([v, l]) => `<option value="${v}" ${diaSem === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>`;
  } else if (frecuencia === 'mensual') {
    const opts = Array.from({length: 31}, (_, i) => i + 1)
      .map(d => `<option value="${d}" ${diaMes === d ? 'selected' : ''}>${d}</option>`).join('');
    campos.innerHTML = `
      <label class="form-label">Día de pago</label>
      <select class="form-select" id="${prefix}-dia-mes" style="${H}">${opts}</select>`;
  } else if (CICLOS_LARGOS_FIJO.includes(frecuencia)) {
    campos.innerHTML = `
      <label class="form-label">Próximo vencimiento</label>
      <input class="form-input" id="${prefix}-proximo-pago" type="date" value="${proxVal}" style="${H}" />`;
  } else {
    campos.innerHTML = '';
  }
}

function setFijoTipoMontoModal(prefix, tipo) {
  const toggleRoot = document.getElementById(`${prefix}-tipo-monto`);
  if (!toggleRoot) return;
  toggleRoot.dataset.tipo = tipo;
  toggleRoot.querySelectorAll('[data-tipo-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tipoBtn === tipo);
  });
  renderCamposFechaFijo(prefix);
}

const MODO_SUGERIDO_MAP = {
  'Renta':               'exacto',
  'Hipoteca':            'exacto',
  'Predial':             'exacto',
  'Internet':            'exacto',
  'Seguro médico':       'exacto',
  'Seguro de auto':      'exacto',
  'Gimnasio':            'exacto',
  'Netflix':             'exacto',
  'Spotify':             'exacto',
  'Disney+':             'exacto',
  'HBO Max':             'exacto',
  'Amazon Prime':        'exacto',
  'YouTube Premium':     'exacto',
  'Apple Music':         'exacto',
  'Colegiatura':         'monto-variable',
  'Tenencia / Refrendo': 'monto-variable',
  'Terapia':             'fecha-flexible',
  'Teléfono celular':    'fecha-flexible',
  'Luz / CFE':           'aproximado',
  'Agua':                'aproximado',
  'Gas':                 'aproximado',
  'Cuota de mantenimiento': 'aproximado',
};

function sugerirModoGastoFijo(descripcion) {
  if (!descripcion) return null;
  const lower = descripcion.toLowerCase().trim();
  for (const [nombre, modo] of Object.entries(MODO_SUGERIDO_MAP)) {
    if (lower === nombre.toLowerCase() || lower.includes(nombre.toLowerCase())) return modo;
  }
  return null;
}

function sugerirYAplicarModoFijo(prefix) {
  const desc     = document.getElementById(`${prefix}-desc`)?.value || '';
  const sugerido = sugerirModoGastoFijo(desc);
  const toggleRoot = document.getElementById(`${prefix}-tipo-monto`);
  if (toggleRoot) {
    toggleRoot.querySelectorAll('.tipo-sugerido-badge').forEach(b => b.remove());
    if (sugerido) {
      const btn = toggleRoot.querySelector(`[data-tipo-btn="${sugerido}"]`);
      if (btn) {
        const badge = document.createElement('span');
        badge.className = 'tipo-sugerido-badge';
        badge.textContent = 'Sugerido';
        btn.appendChild(badge);
      }
    }
  }
  if (sugerido) setFijoTipoMontoModal(prefix, sugerido);
}

function tipoMontoToggleHtml(prefix, tipoInicial) {
  const tipo = tipoInicial || 'exacto';
  const opts = [
    ['exacto',         'Fijo',       'Monto exacto · Fecha límite'],
    ['monto-variable', 'Variable',   'Monto estimado · Fecha límite'],
    ['fecha-flexible', 'Flexible',   'Monto exacto · Fecha esperada'],
    ['aproximado',     'Aproximado', 'Monto est. · Fecha esperada'],
  ];
  return `
    <div class="tipo-monto-toggle tipo-monto-toggle--4" id="${prefix}-tipo-monto" role="group" data-tipo="${tipo}">
      ${opts.map(([v, label, desc]) => `
        <button type="button" class="tipo-monto-opt${tipo === v ? ' active' : ''}" data-tipo-btn="${v}" onclick="setFijoTipoMontoModal('${prefix}','${v}')">
          <span class="tipo-opt-name">${label}</span>
          <span class="tipo-opt-desc">${desc}</span>
        </button>`).join('')}
    </div>
  `;
}

async function openEditarGastoFijo(gastoFijoId) {
  const uid = (await getUsuarioId());
  const [
    { data: gasto, error },
    { data: categorias }
  ] = await Promise.all([
    db.from('gastos_fijos')
      .select('*')
      .eq('id', gastoFijoId)
      .eq('usuario_id', uid)
      .maybeSingle(),
    db.from('categorias').select('id, nombre, emoji').eq('usuario_id', uid).eq('tipo', 'gasto').order('nombre', { ascending: true })
  ]);

  if (error || !gasto) {
    showSnackbar('No se pudo cargar el gasto fijo', 'error');
    return;
  }

  const mv = !!gasto.fecha_flexible;
  const ap = !!gasto.monto_estimado;
  const tipoInicial = !mv && !ap ? 'exacto' : !mv && ap ? 'monto-variable' : mv && !ap ? 'fecha-flexible' : 'aproximado';
  const catOptions = (categorias || []).map(c => `<option value="${c.id}" ${c.id === gasto.categoria_id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('');
  const sinCatSel = !gasto.categoria_id ? 'selected' : '';

  openModal('Editar gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="egf-desc" type="text" value="${escapeHtml(gasto.descripcion || '')}" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de monto</label>
      ${tipoMontoToggleHtml('egf', tipoInicial)}
    </div>
    <div class="form-group" id="egf-monto-wrap">
      <label class="form-label" id="egf-monto-label">${(tipoInicial === 'monto-variable' || tipoInicial === 'aproximado') ? 'Monto promedio estimado' : 'Monto'}</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="egf-monto" type="number" min="0" value="${gasto.monto != null ? Number(gasto.monto) : ''}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Categoría (define el icono)</label>
      <select class="form-select" id="egf-cat">
        <option value="" ${sinCatSel}>Sin categoría</option>
        ${catOptions}
      </select>
    </div>
    <div class="form-group">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:flex-start !important;width:100%">
        <div>
          <label class="form-label">Frecuencia</label>
          ${frecuenciaSelectHtml('egf-freq', "renderCamposFechaFijo('egf')", gasto.frecuencia || 'mensual')}
        </div>
        <div id="egf-fecha-campos"></div>
      </div>
      <p class="form-hint" id="egf-freq-desc" style="margin:4px 0 0;font-size:12px">${FREQ_DESC_MODAL[gasto.frecuencia || 'mensual'] || ''}</p>
    </div>
    <button class="btn btn-primary" onclick="guardarEdicionGastoFijo('${gasto.id}')">Guardar cambios</button>
  `);

  renderCamposFechaFijo('egf', {
    dia_semana:        gasto.dia_semana,
    dia_pago:          gasto.dia_pago,
    proximo_pago:      gasto.proximo_pago || null,
    ultima_fecha_pago: gasto.ultima_fecha_pago || null,
  });

  renderLucideIcons();
}

async function guardarEdicionGastoFijo(gastoFijoId) {
  const descripcion = document.getElementById('egf-desc')?.value.trim();
  const toggleRoot = document.getElementById('egf-tipo-monto');
  const tipo = toggleRoot?.dataset.tipo || 'exacto';
  // Regla 4 cuadrantes:
  // exacto        → fecha_flexible=false, monto_estimado=false
  // monto-variable→ fecha_flexible=false, monto_estimado=true
  // fecha-flexible→ fecha_flexible=true,  monto_estimado=false
  // aproximado    → fecha_flexible=true,  monto_estimado=true
  const esAprox = tipo === 'monto-variable' || tipo === 'aproximado';
  const esFlex  = tipo === 'fecha-flexible'  || tipo === 'aproximado';
  const frecuencia = document.getElementById('egf-freq')?.value;
  const categoria_id = document.getElementById('egf-cat')?.value || null;

  if (!descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  const monto = parseFloat(document.getElementById('egf-monto')?.value);
  if (Number.isNaN(monto) || monto <= 0 || !isFinite(monto)) {
    showSnackbar('Ingresa un monto válido', 'error');
    return;
  }

  const { dia_semana, dia_pago, proximo_pago, ultima_fecha_pago } = extraerCamposFechaFijo('egf', frecuencia, tipo);

  const payload = { descripcion, monto, fecha_flexible: esFlex, frecuencia, dia_pago, dia_semana, proximo_pago, monto_estimado: esAprox, ultima_fecha_pago, categoria_id };
  let { error } = await db.from('gastos_fijos').update(payload).eq('id', gastoFijoId).eq('usuario_id', (await getUsuarioId()));

  if (error) {
    const { fecha_flexible, proximo_pago: _p, monto_estimado: _a, ultima_fecha_pago: _u, ...legacy } = payload;
    legacy.monto = monto ?? 0;
    ({ error } = await db.from('gastos_fijos').update(legacy).eq('id', gastoFijoId).eq('usuario_id', (await getUsuarioId())));
  }

  if (error) {
    showSnackbar('No se pudo actualizar el gasto fijo', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto fijo actualizado ✓', 'success');
  await loadFijos();
  await loadDashboard();
}

async function openAgregarGastoFijo() {
  const uid = (await getUsuarioId());
  const { data: categorias, error: errCatsFijo } = await db.from('categorias').select('id, nombre, emoji').eq('usuario_id', uid).eq('tipo', 'gasto').order('nombre', { ascending: true });
  if (errCatsFijo) { showSnackbar('No se pudieron cargar las categorías', 'error'); return; }
  const catOptions = (categorias || []).map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');

  openModal('Nuevo gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="fgf-desc" type="text" placeholder="Ej: Internet, renta, gimnasio" oninput="sugerirYAplicarModoFijo('fgf')" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de monto</label>
      ${tipoMontoToggleHtml('fgf', 'exacto')}
    </div>
    <div class="form-group" id="fgf-monto-wrap">
      <label class="form-label" id="fgf-monto-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="fgf-monto" type="number" placeholder="0.00" min="0" /></div>
    </div>
    <p class="form-hint" id="fgf-hint" style="display:none;margin:-8px 0 12px">Cambia cada pago — solo te avisaremos la fecha.</p>
    <div class="form-group">
      <label class="form-label">Categoría (define el icono)</label>
      <select class="form-select" id="fgf-cat">
        <option value="">Sin categoría</option>
        ${catOptions}
      </select>
    </div>
    <div class="form-group">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:flex-start !important;width:100%">
        <div style="align-self:start">
          <label class="form-label">Frecuencia</label>
          ${frecuenciaSelectHtml('fgf-freq', "renderCamposFechaFijo('fgf')", 'mensual')}
        </div>
        <div id="fgf-fecha-campos" style="align-self:start"></div>
      </div>
      <p class="form-hint" id="fgf-freq-desc" style="margin:4px 0 0;font-size:12px">${FREQ_DESC_MODAL['mensual']}</p>
    </div>
    <button class="btn btn-primary" onclick="guardarNuevoGastoFijo()">Guardar</button>
  `);

  renderCamposFechaFijo('fgf');
}

async function guardarNuevoGastoFijo() {
  const descripcion = document.getElementById('fgf-desc')?.value.trim();
  const toggleRoot = document.getElementById('fgf-tipo-monto');
  const tipo = toggleRoot?.dataset.tipo || 'exacto';
  // Regla 4 cuadrantes:
  // exacto        → fecha_flexible=false, monto_estimado=false
  // monto-variable→ fecha_flexible=false, monto_estimado=true
  // fecha-flexible→ fecha_flexible=true,  monto_estimado=false
  // aproximado    → fecha_flexible=true,  monto_estimado=true
  const esAprox = tipo === 'monto-variable' || tipo === 'aproximado';
  const esFlex  = tipo === 'fecha-flexible'  || tipo === 'aproximado';
  const frecuencia = document.getElementById('fgf-freq')?.value;
  const categoria_id = document.getElementById('fgf-cat')?.value || null;

  if (!descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  const monto = parseFloat(document.getElementById('fgf-monto')?.value);
  if (Number.isNaN(monto) || monto <= 0 || !isFinite(monto)) {
    showSnackbar('Ingresa un monto válido', 'error');
    return;
  }

  const { dia_semana, dia_pago, proximo_pago, ultima_fecha_pago } = extraerCamposFechaFijo('fgf', frecuencia, tipo);

  const payload = {
    usuario_id: (await getUsuarioId()),
    descripcion,
    monto,
    fecha_flexible: esFlex,
    frecuencia,
    dia_pago,
    dia_semana,
    proximo_pago,
    monto_estimado: esAprox,
    ultima_fecha_pago,
    categoria_id,
    activo: true,
  };

  let { error } = await db.from('gastos_fijos').insert(payload);
  if (error) {
    const { fecha_flexible, proximo_pago: _p, monto_estimado: _a, ultima_fecha_pago: _u, ...legacy } = payload;
    legacy.monto = monto ?? 0;
    ({ error } = await db.from('gastos_fijos').insert(legacy));
  }

  if (error) {
    showSnackbar('No se pudo guardar el gasto fijo', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto fijo guardado ✓', 'success');
  await loadFijos();
  await loadDashboard();
}

async function _doEliminarGastoFijo(gastoFijoId) {
  const { error } = await db
    .from('gastos_fijos')
    .update({ activo: false })
    .eq('id', gastoFijoId)
    .eq('usuario_id', (await getUsuarioId()));
  if (error) { showSnackbar('No se pudo eliminar el gasto fijo', 'error'); return; }
  showSnackbar('Gasto fijo eliminado', 'success');
  await loadFijos();
  await loadDashboard();
}

function eliminarGastoFijo(gastoFijoId) {
  openConfirmModal('¿Eliminar este gasto fijo? No se puede deshacer.', `_doEliminarGastoFijo('${gastoFijoId}')`);
}
window._doEliminarGastoFijo = _doEliminarGastoFijo;

// ---- GASTOS (historial) ----
export async function loadGastos() {
  const uid = (await getUsuarioId());
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const finMes    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

  const [{ data: gastos }, { data: msiActivos }] = await Promise.all([
    db.from('gastos')
      .select('*, categorias(nombre, emoji)')
      .eq('usuario_id', uid)
      .neq('es_ahorro', true)
      .gte('fecha', inicioMes)
      .lte('fecha', finMes)
      .order('fecha', { ascending: false })
      .limit(200),
    db.from('gastos_diferidos')
      .select('id, descripcion, monto_total, monto_cuota, num_meses, cuotas_pagadas, fecha_primer_cargo, cuenta_id')
      .eq('usuario_id', uid)
      .eq('activo', true)
      .order('fecha_primer_cargo')
  ]);

  const totalMes = (gastos || []).reduce((s, g) => s + Number(g.monto || 0), 0);
  const mesLabel = hoy.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  // Sección MSI activos
  const msiHTML = (msiActivos || []).length > 0 ? `
    <div style="padding:0 16px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;display:flex;align-items:center;gap:5px">
        <i data-lucide="calendar-range" style="width:13px;height:13px;stroke-width:2;pointer-events:none"></i> MSI en curso
      </div>
      ${(msiActivos || []).map(m => {
        const pend    = m.num_meses - (m.cuotas_pagadas || 0);
        const pct     = Math.round(((m.cuotas_pagadas || 0) / m.num_meses) * 100);
        const fechaProx = new Date(m.fecha_primer_cargo + 'T00:00:00');
        fechaProx.setMonth(fechaProx.getMonth() + (m.cuotas_pagadas || 0));
        const proxLabel = fechaProx.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        return `
        <div class="card" style="margin-bottom:8px;padding:12px 14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
            <div>
              <div style="font-size:13px;font-weight:600">${escapeHtml(m.descripcion)}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                ${m.cuotas_pagadas || 0}/${m.num_meses} cuotas · Próxima: ${proxLabel}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:14px;font-weight:700">${formatMXN(m.monto_cuota)}<span style="font-size:10px;color:var(--text-muted)">/mes</span></div>
              <div style="font-size:10px;color:var(--text-muted)">${pend} restante${pend > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;background:var(--accent);width:${pct}%;border-radius:2px"></div>
          </div>
          <div style="display:flex;gap:6px">
            <button data-action="pagar-cuota-msi" data-id="${escapeHtml(m.id)}"
                    data-pagadas="${m.cuotas_pagadas || 0}" data-total="${m.num_meses}"
                    style="flex:1;background:var(--accent-soft);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-xs);padding:7px;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)">
              Pagué esta cuota
            </button>
            <button data-action="cancelar-msi" data-id="${escapeHtml(m.id)}"
                    style="background:transparent;border:1px solid var(--border);border-radius:var(--radius-xs);padding:7px 10px;color:var(--text-muted);font-size:12px;cursor:pointer;font-family:var(--font)">
              <i data-lucide="x" style="width:13px;height:13px;stroke-width:2;pointer-events:none"></i>
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>
  ` : '';

  document.getElementById('page-gastos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Mis gastos</h1>
    </div>
    ${totalMes > 0 ? `
    <div style="padding:0 16px;margin-bottom:12px">
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--red-soft);border-color:var(--red-border)">
        <div style="font-size:12px;color:var(--text-secondary);text-transform:capitalize">${mesLabel}</div>
        <div style="font-size:16px;font-weight:700;color:var(--red)">${formatMXN(totalMes)}</div>
      </div>
    </div>` : ''}
    ${msiHTML}
    <div class="page-body" id="gastos-lista">
      ${!gastos || gastos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:40px;height:40px;stroke-width:1.5"></i></div>
          <p>Sin gastos este mes.<br>Usa el botón + para agregar uno.</p>
        </div>
      ` : gastos.map(g => `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji">${g.categorias?.emoji ? renderEmojiOrIcon(g.categorias.emoji, 'package', 18) : getCategoriaGastoIcon(g.categorias?.nombre)}</div>
          <div class="item-row-info">
            <div class="item-row-name">${escapeHtml(g.descripcion)}</div>
            <div class="item-row-detail">${escapeHtml(g.categorias?.nombre || 'Sin categoría')} · ${g.fecha}</div>
          </div>
          <div class="item-row-amount">${formatMXN(g.monto)}</div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuGasto('${g.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
        </div>
      `).join('')}
    </div>
  `;

  // Delegación para botones MSI
  const pageGastos = document.getElementById('page-gastos');
  if (pageGastos) {
    pageGastos.addEventListener('click', async (e) => {
      const btnPagar   = e.target.closest('[data-action="pagar-cuota-msi"]');
      const btnCancelar = e.target.closest('[data-action="cancelar-msi"]');
      if (btnPagar) {
        const id = btnPagar.dataset.id;
        const pagadas = parseInt(btnPagar.dataset.pagadas, 10);
        const total   = parseInt(btnPagar.dataset.total, 10);
        await _pagarCuotaMSI(id, pagadas, total);
      }
      if (btnCancelar) {
        await _cancelarMSI(btnCancelar.dataset.id);
      }
    }, { once: true });
  }

  renderLucideIcons();
}

function openMenuGasto(gastoId) {
  openActionSheet('Opciones de gasto', [
    { label: 'Editar', icon: 'pencil', onClick: `openRegistrarGasto('${gastoId}')` },
    { label: 'Eliminar', onClick: `eliminarGasto('${gastoId}')`, danger: true }
  ]);
}

async function _doEliminarGasto(gastoId) {
  const usuarioId = await getUsuarioId();

  const { data: gasto } = await db
    .from('gastos')
    .select('monto, es_ahorro, meta_id')
    .eq('id', gastoId)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  const { error } = await db
    .from('gastos')
    .delete()
    .eq('id', gastoId)
    .eq('usuario_id', usuarioId);

  if (error) {
    showSnackbar('No se pudo eliminar el gasto', 'error');
    return;
  }

  if (gasto?.es_ahorro && gasto?.meta_id) {
    const { data: meta } = await db
      .from('metas_ahorro')
      .select('monto_actual')
      .eq('id', gasto.meta_id)
      .maybeSingle();

    if (meta) {
      const nuevoMonto = Math.max(Number(meta.monto_actual || 0) - Number(gasto.monto || 0), 0);
      await db.from('metas_ahorro')
        .update({ monto_actual: nuevoMonto })
        .eq('id', gasto.meta_id);
    }
  }

  closeModal();
  showSnackbar('Gasto eliminado', 'success');
  await loadGastos();
  await loadDashboard();
  if (gasto?.es_ahorro) await loadMetas();
}
function eliminarGasto(gastoId) {
  openConfirmModal('¿Eliminar este gasto? No se puede deshacer.', `_doEliminarGasto('${gastoId}')`);
}
window._doEliminarGasto = _doEliminarGasto;

// ---- PICKER AGRUPADO DE GASTO (con recientes + subgrupos) ----
export async function abrirSelectorGasto() {
  const usuarioId = await getUsuarioId();

  const [catsRes, gastosRes] = await Promise.all([
    db.from('categorias').select('id, nombre, emoji, es_default').eq('usuario_id', usuarioId).eq('tipo', 'gasto').order('nombre', { ascending: true }),
    db.from('gastos').select('categoria_id, fecha').eq('usuario_id', usuarioId).order('fecha', { ascending: false }).limit(40)
  ]);

  const categorias = catsRes.data || [];
  const catByNombre = Object.fromEntries(categorias.map(c => [c.nombre, c]));
  const catById = Object.fromEntries(categorias.map(c => [c.id, c]));

  const recientes = [];
  const seen = new Set();
  for (const g of (gastosRes.data || [])) {
    if (!g.categoria_id || seen.has(g.categoria_id) || !catById[g.categoria_id]) continue;
    recientes.push(catById[g.categoria_id]);
    seen.add(g.categoria_id);
    if (recientes.length >= 5) break;
  }

  const personalizadas = categorias.filter(c => c.es_default === false && !GASTOS_VARIABLES_INDEX[c.nombre]);

  window._gastoPickerCache = { categorias, catByNombre, recientes, personalizadas };
  renderGastoPickerSheet();
}

function renderGastoPickerSheet() {
  const cache = window._gastoPickerCache;
  if (!cache) return;
  const { catByNombre, recientes, personalizadas } = cache;

  if (!(window._gastoGruposAbiertos instanceof Set)) {
    window._gastoGruposAbiertos = new Set();
  }

  const flatItems = [];
  const pushItem = (cat, special = null) => {
    const item = { id: cat.id ?? null, nombre: cat.nombre, emoji: cat.emoji || 'package', tipoSelector: 'gasto', special };
    flatItems.push(item);
    return flatItems.length - 1;
  };

  const chipHtml = (cat, special = null, iconoFallback = null) => {
    const idx = pushItem(cat, special);
    const icono = cat.emoji || iconoFallback || 'package';
    return `<button class="fijo-sugerido-chip" onclick="seleccionarCategoriaDesdeSheet(${idx})">
      <i data-lucide="${icono}"></i>
      <span>${escapeHtml(cat.nombre)}</span>
    </button>`;
  };

  const recientesHtml = recientes.length > 0 ? `
    <div class="gasto-pick-section">
      <div class="gasto-pick-section-label"><i data-lucide="clock"></i>Recientes</div>
      <div class="gasto-pick-chips">
        ${recientes.map(c => chipHtml(c)).join('')}
      </div>
    </div>
  ` : '';

  const personalizadasHtml = personalizadas.length > 0 ? `
    <div class="gasto-pick-section">
      <div class="gasto-pick-section-label"><i data-lucide="sparkles"></i>Personalizadas</div>
      <div class="gasto-pick-chips">
        ${personalizadas.map(c => chipHtml(c)).join('')}
      </div>
    </div>
  ` : '';

  const gruposHtml = `
    <div class="fijo-grupos">
      ${GASTOS_VARIABLES_CATALOGO.map(grupo => {
        const abierto = window._gastoGruposAbiertos.has(grupo.titulo);
        const chips = grupo.items.map(it => {
          const cat = catByNombre[it.nombre];
          if (!cat) return '';
          return chipHtml(cat, it.special || null, it.icono);
        }).join('');
        return `
          <div class="fijo-grupo${abierto ? ' is-open' : ''}">
            <button type="button" class="fijo-grupo-header" onclick="toggleGastoPickerGrupo('${grupo.titulo.replace(/'/g, "\\'")}')">
              <span class="fijo-grupo-title">
                <i data-lucide="${grupo.icono}"></i>
                <span>${grupo.titulo}</span>
              </span>
              <i data-lucide="chevron-down" class="fijo-grupo-chevron"></i>
            </button>
            ${abierto ? `<div class="fijo-grupo-body">${chips}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  window._categoriaSelectorItems = flatItems;

  const old = document.getElementById('categoria-selector-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'categoria-selector-overlay';
  overlay.className = 'modal-overlay categoria-selector-overlay';
  overlay.innerHTML = `
    <div class="bottom-sheet gasto-picker-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <h3 class="sheet-title">Selecciona categoría</h3>
      ${recientesHtml}
      ${personalizadasHtml}
      <div class="gasto-pick-section">
        <div class="gasto-pick-section-label"><i data-lucide="grid-2x2"></i>Todas las categorías</div>
        ${gruposHtml}
      </div>
    </div>
  `;
  overlay.addEventListener('click', window.closeSelectorCategoriaSheet);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  renderLucideIcons();
}

function toggleGastoPickerGrupo(titulo) {
  if (!(window._gastoGruposAbiertos instanceof Set)) window._gastoGruposAbiertos = new Set();
  if (window._gastoGruposAbiertos.has(titulo)) window._gastoGruposAbiertos.delete(titulo);
  else window._gastoGruposAbiertos.add(titulo);
  renderGastoPickerSheet();
}

// ---- CAMPOS ESPECIALES PARA FINANZAS (Ahorro / Pago de deudas) ----
export async function toggleCamposGastoEspecial() {
  const tipo = window._gastoEspecial || null;
  const contenedor = document.getElementById('rg-extra-campos');
  if (!contenedor) return;

  if (!tipo) {
    contenedor.style.display = 'none';
    contenedor.innerHTML = '';
    return;
  }

  const uid = await getUsuarioId();

  if (tipo === 'ahorro') {
    const { data: metas } = await db
      .from('metas_ahorro')
      .select('id, nombre, emoji, monto_objetivo, monto_actual')
      .eq('usuario_id', uid)
      .eq('activa', true)
      .order('nombre', { ascending: true });
    const lista = metas || [];
    contenedor.style.display = 'block';
    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div class="form-group finanza-empty">
          <p class="form-hint" style="margin-bottom:8px">No tienes metas activas. Crea una para aportar tu ahorro.</p>
          <button class="btn btn-secondary" type="button" style="width:100%" onclick="closeModal(); openAgregarMeta();">+ Crear meta</button>
        </div>
      `;
    } else {
      contenedor.innerHTML = `
        <div class="form-group">
          <label class="form-label">Meta</label>
          <select class="form-select" id="rg-meta-id">
            ${lista.map(m => `<option value="${m.id}">${escapeHtml(m.nombre)} · ${formatMXN(m.monto_actual || 0)} / ${formatMXN(m.monto_objetivo || 0)}</option>`).join('')}
          </select>
        </div>
      `;
    }
    return;
  }

  if (tipo === 'pago_deuda') {
    const { data: deudas } = await db
      .from('deudas')
      .select('id, acreedor, monto_actual, tipo_deuda')
      .eq('usuario_id', uid)
      .eq('activa', true)
      .order('acreedor', { ascending: true });
    const lista = deudas || [];
    contenedor.style.display = 'block';
    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div class="form-group finanza-empty">
          <p class="form-hint">No tienes deudas activas.</p>
        </div>
      `;
    } else {
      contenedor.innerHTML = `
        <div class="form-group">
          <label class="form-label">Deuda</label>
          <select class="form-select" id="rg-deuda-id">
            ${lista.map(d => `<option value="${d.id}" data-tipo="${d.tipo_deuda}" data-max="${d.monto_actual}">${escapeHtml(d.acreedor)} · ${formatMXN(d.monto_actual)}</option>`).join('')}
          </select>
        </div>
      `;
    }
    return;
  }

  contenedor.style.display = 'none';
  contenedor.innerHTML = '';
}

// ---- REGISTRAR / EDITAR GASTO ----
async function openRegistrarGasto(gastoId = null) {
  const uid = await getUsuarioId();
  const { data: cuentas, error: errCuentasGasto } = await db.from('cuentas').select('*').eq('usuario_id', uid).eq('activa', true);
  if (errCuentasGasto) { showSnackbar('No se pudieron cargar las cuentas', 'error'); return; }

  currentEditGastoId = gastoId || null;
  setCatState(null, null, 'gasto');
  window._gastoEspecial = null;

  let titulo = 'Registrar gasto';
  let descValue = '';
  let montoValue = '';
  let fechaValue = new Date().toISOString().split('T')[0];
  let cuentaDefault = '';

  if (gastoId) {
    const { data: gasto } = await db.from('gastos')
      .select('*, categorias(id, nombre, emoji)')
      .eq('id', gastoId)
      .eq('usuario_id', uid)
      .maybeSingle();

    if (!gasto) { showSnackbar('No se pudo cargar el gasto', 'error'); return; }

    titulo = 'Editar gasto';
    descValue = gasto.descripcion || '';
    montoValue = gasto.monto != null ? Number(gasto.monto) : '';
    fechaValue = gasto.fecha || fechaValue;
    cuentaDefault = gasto.cuenta_id || '';

    if (gasto.categoria_id && gasto.categorias) {
      setCatState(
        gasto.categoria_id,
        { id: gasto.categoria_id, nombre: gasto.categorias.nombre, emoji: gasto.categorias.emoji },
        'gasto'
      );
    }
  }

  _cuentasParaGasto = cuentas || [];
  const lastCuenta = localStorage.getItem('jmf_last_cuenta_gasto') || cuentaDefault;
  const cuentaInicial = _cuentasParaGasto.find(c => c.id === lastCuenta) || _cuentasParaGasto[0];
  const cuentaInicialEsTDC = cuentaInicial?.tipo === 'credito';

  openModal(titulo, `
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="rg-monto" type="number" placeholder="0.00" min="0" inputmode="decimal" autofocus value="${montoValue}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <button id="btn-cat-selector" class="categoria-btn" type="button" onclick="abrirSelectorCategoria('gasto')"></button>
    </div>
    <div id="rg-extra-campos" style="display:none"></div>
    ${(cuentas || []).length > 1 ? `
    <div class="form-group">
      <label class="form-label">Cuenta</label>
      <select class="form-select" id="rg-cuenta" onchange="onCambiarCuentaGasto(this.value)">
        ${(cuentas || []).map(c => `<option value="${c.id}" data-tipo="${c.tipo}" ${c.id === lastCuenta ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
      </select>
    </div>` : `<input type="hidden" id="rg-cuenta" value="${(cuentas || [])[0]?.id || ''}" />`}
    <div id="rg-msi-seccion" style="display:${cuentaInicialEsTDC && !gastoId ? 'block' : 'none'}">
      <div class="form-group">
        <label class="form-label">¿A cuántos meses?</label>
        <select class="form-select" id="rg-msi" onchange="toggleMsiEnCurso()">
          <option value="1">Contado (1 sola vez)</option>
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="9">9 meses</option>
          <option value="12">12 meses</option>
          <option value="18">18 meses</option>
          <option value="24">24 meses</option>
        </select>
        <p class="form-hint">Si es "meses sin intereses" (MSI), la app aparta la cuota mensual en tu distribución de ingresos.</p>
      </div>
      <!-- MSI en curso: para compras que ya tienen pagos hechos -->
      <div id="rg-msi-en-curso" style="display:none;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px">
          <input type="checkbox" id="rg-msi-parcial" onchange="toggleMsiParcialCampos()"
                 style="width:16px;height:16px;cursor:pointer;flex-shrink:0" />
          <span style="font-size:13px;font-weight:600">Ya pagué algunas cuotas de este MSI</span>
        </label>
        <div id="rg-msi-parcial-campos" style="display:none;flex-direction:column;gap:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label class="form-label" style="font-size:11px">Cuotas ya pagadas</label>
              <input class="form-input" id="rg-msi-pagadas" type="number" min="0" max="23"
                     placeholder="Ej: 3" inputmode="numeric" style="height:40px" />
            </div>
            <div>
              <label class="form-label" style="font-size:11px">Fecha del próximo pago</label>
              <input class="form-input" id="rg-msi-prox-fecha" type="date"
                     min="${new Date().toISOString().split('T')[0]}"
                     style="height:40px" />
            </div>
          </div>
          <p class="form-hint">Ej: compraste a 7 meses, llevas 3 pagados. La app registra las 4 cuotas restantes.</p>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Nota <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
      <input class="form-input" id="rg-desc" type="text" placeholder="Lugar, detalle..." value="${escapeHtml(descValue)}" maxlength="200" />
    </div>
    <div style="margin-bottom:12px">
      ${!gastoId ? `<button type="button" id="btn-cambiar-fecha" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-muted);padding:4px 0;display:flex;align-items:center;gap:5px" onclick="document.getElementById('rg-fecha-wrap').style.display='flex';this.style.display='none'"><i data-lucide="calendar" style="width:14px;height:14px;stroke-width:1.75"></i>Cambiar fecha (hoy)</button>` : ''}
      <div id="rg-fecha-wrap" style="display:${gastoId ? 'flex' : 'none'};flex-direction:column;gap:4px">
        <label class="form-label">Fecha</label>
        <input class="form-input" id="rg-fecha" type="date" min="2000-01-01" max="${new Date().toISOString().split('T')[0]}" value="${fechaValue}" />
      </div>
    </div>
    <button class="btn btn-primary" onclick="guardarGasto()">${gastoId ? 'Guardar cambios' : 'Guardar gasto'}</button>
  `);

  actualizarBotonCategoriaSelector();
}

async function guardarGasto() {
  const _btn = document.querySelector('#modal-overlay .btn-primary');
  if (_btn?.disabled) return;
  if (_btn) _btn.disabled = true;
  try {
  const descripcion = document.getElementById('rg-desc').value.trim();
  const monto = parseFloat(String(document.getElementById('rg-monto').value).replace(/,/g, ''));
  const categoria_id = getCurrentCatId();
  const cuenta_id = document.getElementById('rg-cuenta')?.value || null;
  const fecha = document.getElementById('rg-fecha').value;
  const usuarioId = (await getUsuarioId());
  const especial = window._gastoEspecial || null;
  if (!monto || monto <= 0 || !isFinite(monto)) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (!categoria_id) { showSnackbar('Selecciona una categoría', 'error'); return; }
  if (!especial && !descripcion) { showSnackbar('Escribe una descripción o nota', 'error'); return; }
  if (descripcion.length > 200) { showSnackbar('La nota es muy larga (máx. 200 caracteres)', 'error'); return; }
  const fechaDate = new Date(fecha + 'T00:00:00');
  if (!fecha || isNaN(fechaDate) || fechaDate.getFullYear() < 2000 || fechaDate > new Date()) {
    showSnackbar('Fecha inválida', 'error'); return;
  }
  if (cuenta_id) localStorage.setItem('jmf_last_cuenta_gasto', cuenta_id);

  if (currentEditGastoId) {
    if (cuenta_id) {
      const { data: gastoOriginal } = await db.from('gastos').select('monto, cuenta_id').eq('id', currentEditGastoId).maybeSingle();
      const montoOriginal = Number(gastoOriginal?.monto || 0);
      const cuentaCambio = gastoOriginal?.cuenta_id !== cuenta_id;
      const { error: errSaldo, saldoDisponible } = await getSaldoCuentaEspecifica(usuarioId, cuenta_id);
      if (!errSaldo) {
        const saldoConMargen = cuentaCambio ? saldoDisponible : saldoDisponible + montoOriginal;
        if (monto > saldoConMargen) {
          showSnackbar('Saldo insuficiente en esa cuenta', 'error');
          return;
        }
      }
    }
    const { error } = await db.from('gastos')
      .update({ descripcion, monto, categoria_id, cuenta_id, fecha })
      .eq('id', currentEditGastoId)
      .eq('usuario_id', usuarioId);

    currentEditGastoId = null;
    window._gastoEspecial = null;
    if (error) { showSnackbar('No se pudo actualizar el gasto. Revisa tu conexión.', 'error'); return; }
    closeModal();
    showSnackbar('Gasto actualizado ✓', 'success');
    await loadDashboard();
    await loadGastos();
    return;
  }

  const cuentaInfo = _cuentasParaGasto.find(c => c.id === cuenta_id);
  const esCuentaTDC = cuentaInfo?.tipo === 'credito';

  // Validar saldo solo para cuentas no-TDC (TDC tiene línea de crédito, no saldo)
  if (cuenta_id && !esCuentaTDC) {
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
    const saldoDisponible = Number(cuenta.saldo_inicial || 0) + totalIngresosCuenta - totalGastosCuenta - totalPagosDeudaCuenta;

    if (monto > saldoDisponible) {
      showSnackbar('Saldo insuficiente — disponible: ' + formatMXN(saldoDisponible), 'error');
      return;
    }
  }

  // Compra a MSI con tarjeta de crédito (nueva o en curso)
  if (esCuentaTDC && !currentEditGastoId) {
    const numMeses = parseInt(document.getElementById('rg-msi')?.value || '1', 10);
    if (numMeses > 1) {
      const esParcial    = document.getElementById('rg-msi-parcial')?.checked || false;
      const cuotasPagadas = esParcial
        ? Math.max(0, Math.min(parseInt(document.getElementById('rg-msi-pagadas')?.value || '0', 10), numMeses - 1))
        : 0;
      const proxFechaStr  = esParcial ? document.getElementById('rg-msi-prox-fecha')?.value : null;

      // Para MSI en curso: calcular fecha_primer_cargo retrocediendo N meses desde el próximo pago
      let fechaPrimerCargo = fecha;
      if (esParcial && cuotasPagadas > 0 && proxFechaStr) {
        const proxFecha = new Date(proxFechaStr + 'T00:00:00');
        proxFecha.setMonth(proxFecha.getMonth() - cuotasPagadas);
        fechaPrimerCargo = proxFecha.toISOString().split('T')[0];
      }

      const cuotaMensual = parseFloat((monto / numMeses).toFixed(2));
      const { error: errMSI } = await db.from('gastos_diferidos').insert({
        usuario_id:         usuarioId,
        descripcion:        descripcion || 'Compra a meses',
        monto_total:        monto,
        num_meses:          numMeses,
        monto_cuota:        cuotaMensual,
        tasa_mensual:       0,
        fecha_primer_cargo: fechaPrimerCargo,
        cuotas_pagadas:     cuotasPagadas,
        cuenta_id,
        activo:             true
      });
      if (errMSI) { showSnackbar('No se pudo registrar la compra a meses. Revisa tu conexión.', 'error'); return; }
      closeModal();
      const restantes = numMeses - cuotasPagadas;
      showSnackbar(
        esParcial
          ? `MSI en curso registrado — ${restantes} cuota${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''} de ${formatMXN(cuotaMensual)}`
          : `Compra a ${numMeses} MSI registrada — ${formatMXN(cuotaMensual)}/mes`,
        'success'
      );
      await loadDashboard();
      await loadGastos();
      return;
    }
  }

  if (especial === 'ahorro') {
    const meta_id = document.getElementById('rg-meta-id')?.value || null;
    if (!meta_id) { showSnackbar('Selecciona una meta', 'error'); return; }

    const { data: meta, error: errMeta } = await db.from('metas_ahorro').select('nombre, monto_actual, monto_objetivo').eq('id', meta_id).maybeSingle();
    if (errMeta || !meta) { showSnackbar('No se pudo cargar la meta', 'error'); return; }
    const _restanteMeta = Math.max(Number(meta.monto_objetivo || 0) - Number(meta.monto_actual || 0), 0);
    if (monto > _restanteMeta) { showSnackbar(`El aporte excede el restante de la meta (${formatMXN(_restanteMeta)})`, 'error'); return; }

    const gastoPayload = {
      usuario_id: usuarioId,
      descripcion: descripcion || `Aporte a ${meta.nombre}`,
      monto,
      categoria_id,
      cuenta_id,
      fecha,
      es_ahorro: true,
      meta_id,
    };
    const { error } = await db.from('gastos').insert(gastoPayload);
    if (error) { showSnackbar('No se pudo guardar el aporte. Revisa tu conexión.', 'error'); return; }

    const { error: errMetaUpdate } = await db.from('metas_ahorro')
      .update({ monto_actual: Number(meta.monto_actual || 0) + monto })
      .eq('id', meta_id);
    if (errMetaUpdate) { showSnackbar('Gasto guardado, pero no se pudo actualizar la meta', 'error'); return; }

    window._gastoEspecial = null;
    closeModal();
    showSnackbar('Aporte a meta registrado ✓', 'success');
    await loadDashboard();
    await loadMetas();
    await loadGastos();
    return;
  }

  if (especial === 'pago_deuda') {
    const deuda_id = document.getElementById('rg-deuda-id')?.value || null;
    if (!deuda_id) { showSnackbar('Selecciona una deuda', 'error'); return; }
    if (!cuenta_id) { showSnackbar('Selecciona una cuenta', 'error'); return; }

    const { data: deuda, error: errDeuda } = await db.from('deudas').select('monto_actual, tipo_deuda').eq('id', deuda_id).maybeSingle();
    if (errDeuda || !deuda) { showSnackbar('No se pudo cargar la deuda', 'error'); return; }
    if (monto > Number(deuda.monto_actual)) { showSnackbar('El pago excede el saldo de la deuda', 'error'); return; }

    const { error: errPago } = await db.from('pagos_deuda').insert({
      deuda_id,
      usuario_id: usuarioId,
      cuenta_id,
      monto,
      nota: descripcion,
      fecha,
    });
    if (errPago) { showSnackbar('No se pudo registrar el pago. Revisa tu conexión.', 'error'); return; }

    if (deuda.tipo_deuda === 'tabla') {
      const { data: proximoPago } = await db.from('pagos_programados')
        .select('id')
        .eq('deuda_id', deuda_id)
        .eq('pagado', false)
        .order('fecha_vencimiento')
        .limit(1)
        .maybeSingle();
      if (proximoPago) {
        const { error: errProg } = await db.from('pagos_programados').update({
          pagado: true,
          fecha_pago: fecha,
          monto_pagado: monto
        }).eq('id', proximoPago.id);
        if (errProg) showSnackbar('Pago registrado, pero no se pudo marcar la cuota', 'error');
      }
    }

    const nuevoMonto = Number(deuda.monto_actual) - monto;
    const { error: errDeudaUpdate } = await db.from('deudas').update({
      monto_actual: nuevoMonto,
      activa: nuevoMonto > 0,
      ultimo_pago: fecha,
      monto_ultimo_pago: monto,
    }).eq('id', deuda_id);
    if (errDeudaUpdate) { showSnackbar('No se pudo actualizar el saldo de la deuda. Revisa tu conexión.', 'error'); return; }

    window._gastoEspecial = null;
    closeModal();
    showSnackbar(nuevoMonto === 0 ? 'Deuda saldada' : 'Pago registrado ✓', 'success');
    await loadDashboard();
    await loadDeudas();
    return;
  }

  const gastoPayload = {
    usuario_id: usuarioId,
    descripcion,
    monto,
    categoria_id,
    cuenta_id,
    fecha
  };

  const { error } = await db.from('gastos').insert(gastoPayload);

  if (error) { showSnackbar('No se pudo guardar el gasto. Revisa tu conexión.', 'error'); return; }
  closeModal();
  showSnackbar('Gasto registrado ✓', 'success');
  await loadDashboard();
  await loadGastos();
  } finally {
    if (_btn?.isConnected) _btn.disabled = false;
  }
}

// ── GESTIÓN DE MSI ACTIVOS ───────────────────────────────────────────────────

async function _pagarCuotaMSI(id, cuotasPagadas, numMeses) {
  const nuevasCuotas = cuotasPagadas + 1;
  const saldado      = nuevasCuotas >= numMeses;
  const { error } = await db.from('gastos_diferidos')
    .update({ cuotas_pagadas: nuevasCuotas, activo: !saldado })
    .eq('id', id)
    .eq('usuario_id', await getUsuarioId());
  if (error) { showSnackbar('No se pudo actualizar el MSI', 'error'); return; }
  showSnackbar(saldado ? '¡MSI completado! 🎉' : `Cuota ${nuevasCuotas}/${numMeses} registrada`, 'success');
  await loadGastos();
  await loadDashboard();
}

async function _cancelarMSI(id) {
  const { error } = await db.from('gastos_diferidos')
    .update({ activo: false })
    .eq('id', id)
    .eq('usuario_id', await getUsuarioId());
  if (error) { showSnackbar('No se pudo cancelar el MSI', 'error'); return; }
  showSnackbar('MSI cancelado', 'success');
  await loadGastos();
  await loadDashboard();
}

window.onCambiarCuentaGasto = function(cuentaId) {
  const cuenta = _cuentasParaGasto.find(c => c.id === cuentaId);
  const msiSec = document.getElementById('rg-msi-seccion');
  if (msiSec) msiSec.style.display = cuenta?.tipo === 'credito' ? 'block' : 'none';
};

window.toggleMsiEnCurso = function() {
  const meses = parseInt(document.getElementById('rg-msi')?.value || '1', 10);
  const enCursoDiv = document.getElementById('rg-msi-en-curso');
  if (enCursoDiv) enCursoDiv.style.display = meses > 1 ? 'block' : 'none';
  // Actualizar max de cuotas pagadas
  const pagadasInput = document.getElementById('rg-msi-pagadas');
  if (pagadasInput) pagadasInput.max = String(meses - 1);
};

window.toggleMsiParcialCampos = function() {
  const checked = document.getElementById('rg-msi-parcial')?.checked;
  const campos  = document.getElementById('rg-msi-parcial-campos');
  if (!campos) return;
  campos.style.display = checked ? 'flex' : 'none';
  campos.style.flexDirection = 'column';
  campos.style.gap = '8px';
};

// Funciones invocadas desde atributos onclick en HTML generado dinámicamente
window.openMenuGasto = openMenuGasto;
window.eliminarGasto = eliminarGasto;
window.openMenuGastoFijo = openMenuGastoFijo;
window.openEditarGastoFijo = openEditarGastoFijo;
window.eliminarGastoFijo = eliminarGastoFijo;
window.guardarEdicionGastoFijo = guardarEdicionGastoFijo;
window.openAgregarGastoFijo = openAgregarGastoFijo;
window.guardarNuevoGastoFijo = guardarNuevoGastoFijo;
window.openRegistrarGasto = openRegistrarGasto;
window.guardarGasto = guardarGasto;
window.setFijoTipoMontoModal = setFijoTipoMontoModal;
window.renderCamposFechaFijo = renderCamposFechaFijo;
window.sugerirYAplicarModoFijo = sugerirYAplicarModoFijo;
window.toggleGastoPickerGrupo = toggleGastoPickerGrupo;
