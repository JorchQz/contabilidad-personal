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

// ---- CATÁLOGO DE GASTOS FIJOS ----
export const GASTOS_FIJOS_CATALOGO = [
  {
    titulo: 'Vivienda', icono: 'home',
    items: [
      { nombre: 'Renta',    icono: 'home',        frecuencia: 'mensual' },
      { nombre: 'Hipoteca', icono: 'building-2',  frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Servicios', icono: 'zap',
    items: [
      { nombre: 'Luz / CFE',        icono: 'zap',        frecuencia: 'bimestral', montoVariable: true },
      { nombre: 'Agua',             icono: 'droplets',   frecuencia: 'mensual',   montoVariable: true },
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
      { nombre: 'YouTube Premium', icono: 'youtube',      frecuencia: 'mensual' },
      { nombre: 'Apple Music',     icono: 'music',        frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Salud y bienestar', icono: 'shield',
    items: [
      { nombre: 'Seguro médico', icono: 'shield',   frecuencia: 'anual' },
      { nombre: 'Gimnasio',      icono: 'dumbbell', frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Auto', icono: 'car',
    items: [
      { nombre: 'Seguro de auto', icono: 'car', frecuencia: 'anual' },
    ],
  },
  {
    titulo: 'Educación', icono: 'graduation-cap',
    items: [
      { nombre: 'Colegiatura', icono: 'graduation-cap', frecuencia: 'mensual' },
    ],
  },
  {
    titulo: 'Créditos', icono: 'credit-card',
    items: [
      { nombre: 'Tarjeta de crédito', icono: 'credit-card', frecuencia: 'mensual', montoVariable: true },
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
      { nombre: 'Luz',             icono: 'zap' },
      { nombre: 'Agua',            icono: 'droplets' },
      { nombre: 'Gas',             icono: 'flame' },
      { nombre: 'Internet y telefonía', icono: 'wifi' },
      { nombre: 'Otro servicio',   icono: 'package' },
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
        const isVariable = g.monto_variable === true || g.monto == null;
        const montoTxt = isVariable ? 'Variable' : formatMXN(g.monto);
        return `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji">${iconoHtml}</div>
          <div class="item-row-info">
            <div class="item-row-name">${g.descripcion}</div>
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

function frecuenciaSelectHtml(id, onchange, selected) {
  return `<select class="form-select" id="${id}" onchange="${onchange}">
    ${FRECUENCIAS_FIJO_UI.map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('')}
  </select>`;
}

function renderCamposFechaFijo(prefix, initial = {}) {
  const frecuencia = document.getElementById(`${prefix}-freq`)?.value;
  const campos = document.getElementById(`${prefix}-fecha-campos`);
  if (!campos) return;

  const previoProx = document.getElementById(`${prefix}-prox`)?.value;
  const previoDiaSemana = document.getElementById(`${prefix}-dia-semana`)?.value;
  const diaSemanaInicial = Number.isInteger(initial.dia_semana)
    ? initial.dia_semana
    : (previoDiaSemana !== undefined ? parseInt(previoDiaSemana, 10) : null);
  const proxInicial = initial.proximo_pago || previoProx || '';

  if (frecuencia === 'semanal') {
    campos.innerHTML = `
      <label class="form-label">Día de la semana</label>
      <select class="form-select" id="${prefix}-dia-semana">
        ${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
          .map((d, i) => `<option value="${i}" ${diaSemanaInicial === i ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
    `;
    return;
  }

  campos.innerHTML = `
    <label class="form-label">Próximo pago</label>
    <input class="form-input" id="${prefix}-prox" type="date" value="${proxInicial}" />
  `;
}

function setFijoMontoVariableModal(prefix, isVariable) {
  const toggleRoot = document.getElementById(`${prefix}-tipo-monto`);
  const montoWrap = document.getElementById(`${prefix}-monto-wrap`);
  const hint = document.getElementById(`${prefix}-hint`);
  if (!toggleRoot) return;
  toggleRoot.dataset.variable = isVariable ? '1' : '0';
  toggleRoot.querySelectorAll('.tipo-monto-opt').forEach((btn, i) => {
    const matches = (i === 0 && !isVariable) || (i === 1 && isVariable);
    btn.classList.toggle('active', matches);
  });
  if (montoWrap) montoWrap.style.display = isVariable ? 'none' : '';
  if (hint) hint.style.display = isVariable ? '' : 'none';
}

function tipoMontoToggleHtml(prefix, isVariable) {
  return `
    <div class="tipo-monto-toggle" id="${prefix}-tipo-monto" role="group" data-variable="${isVariable ? '1' : '0'}">
      <button type="button" class="tipo-monto-opt${!isVariable ? ' active' : ''}" onclick="setFijoMontoVariableModal('${prefix}', false)">Definido</button>
      <button type="button" class="tipo-monto-opt${isVariable ? ' active' : ''}" onclick="setFijoMontoVariableModal('${prefix}', true)">Variable</button>
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

  const isVariable = gasto.monto_variable === true || (gasto.monto == null);
  const catOptions = (categorias || []).map(c => `<option value="${c.id}" ${c.id === gasto.categoria_id ? 'selected' : ''}>${c.nombre}</option>`).join('');
  const sinCatSel = !gasto.categoria_id ? 'selected' : '';

  openModal('Editar gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="egf-desc" type="text" value="${gasto.descripcion || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de monto</label>
      ${tipoMontoToggleHtml('egf', isVariable)}
    </div>
    <div class="form-group" id="egf-monto-wrap" style="${isVariable ? 'display:none' : ''}">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="egf-monto" type="number" min="0" value="${gasto.monto != null ? Number(gasto.monto) : ''}" /></div>
    </div>
    <p class="form-hint" id="egf-hint" style="${isVariable ? '' : 'display:none'};margin:-8px 0 12px">Cambia cada pago — solo te avisaremos la fecha.</p>
    <div class="form-group">
      <label class="form-label">Categoría (define el icono)</label>
      <select class="form-select" id="egf-cat">
        <option value="" ${sinCatSel}>Sin categoría</option>
        ${catOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Frecuencia</label>
      ${frecuenciaSelectHtml('egf-freq', "renderCamposFechaFijo('egf')", gasto.frecuencia || 'mensual')}
    </div>
    <div class="form-group" id="egf-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarEdicionGastoFijo('${gasto.id}')">Guardar cambios</button>
  `);

  renderCamposFechaFijo('egf', {
    dia_semana: gasto.dia_semana,
    proximo_pago: gasto.proximo_pago || null,
  });

  renderLucideIcons();
}

async function guardarEdicionGastoFijo(gastoFijoId) {
  const descripcion = document.getElementById('egf-desc')?.value.trim();
  const toggleRoot = document.getElementById('egf-tipo-monto');
  const isVariable = toggleRoot?.dataset.variable === '1';
  const frecuencia = document.getElementById('egf-freq')?.value;
  const categoria_id = document.getElementById('egf-cat')?.value || null;

  if (!descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  let monto = null;
  if (!isVariable) {
    monto = parseFloat(document.getElementById('egf-monto')?.value);
    if (Number.isNaN(monto) || monto <= 0) {
      showSnackbar('Ingresa un monto válido o marca como variable', 'error');
      return;
    }
  }

  let dia_semana = null;
  let dia_pago = null;
  let proximo_pago = null;

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('egf-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un día de la semana', 'error');
      return;
    }
  } else {
    proximo_pago = document.getElementById('egf-prox')?.value || null;
    if (proximo_pago) {
      const dia = parseInt(proximo_pago.split('-')[2], 10);
      dia_pago = Number.isInteger(dia) ? dia : null;
    }
  }

  const payload = { descripcion, monto, monto_variable: isVariable, frecuencia, dia_pago, dia_semana, proximo_pago, categoria_id };
  let { error } = await db.from('gastos_fijos').update(payload).eq('id', gastoFijoId).eq('usuario_id', (await getUsuarioId()));

  if (error) {
    const { monto_variable, proximo_pago: _p, ...legacy } = payload;
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
  const { data: categorias } = await db.from('categorias').select('id, nombre, emoji').eq('usuario_id', uid).eq('tipo', 'gasto').order('nombre', { ascending: true });
  const catOptions = (categorias || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  openModal('Nuevo gasto fijo', `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="fgf-desc" type="text" placeholder="Ej: Internet, renta, gimnasio" />
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de monto</label>
      ${tipoMontoToggleHtml('fgf', false)}
    </div>
    <div class="form-group" id="fgf-monto-wrap">
      <label class="form-label">Monto</label>
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
      <label class="form-label">Frecuencia</label>
      ${frecuenciaSelectHtml('fgf-freq', "renderCamposFechaFijo('fgf')", 'mensual')}
    </div>
    <div class="form-group" id="fgf-fecha-campos"></div>
    <button class="btn btn-primary" onclick="guardarNuevoGastoFijo()">Guardar</button>
  `);

  renderCamposFechaFijo('fgf');
}

async function guardarNuevoGastoFijo() {
  const descripcion = document.getElementById('fgf-desc')?.value.trim();
  const toggleRoot = document.getElementById('fgf-tipo-monto');
  const isVariable = toggleRoot?.dataset.variable === '1';
  const frecuencia = document.getElementById('fgf-freq')?.value;
  const categoria_id = document.getElementById('fgf-cat')?.value || null;

  if (!descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  let monto = null;
  if (!isVariable) {
    monto = parseFloat(document.getElementById('fgf-monto')?.value);
    if (Number.isNaN(monto) || monto <= 0) {
      showSnackbar('Ingresa un monto válido o marca como variable', 'error');
      return;
    }
  }

  let dia_semana = null;
  let dia_pago = null;
  let proximo_pago = null;

  if (frecuencia === 'semanal') {
    dia_semana = parseInt(document.getElementById('fgf-dia-semana')?.value, 10);
    if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
      showSnackbar('Selecciona un día de la semana', 'error');
      return;
    }
  } else {
    proximo_pago = document.getElementById('fgf-prox')?.value || null;
    if (proximo_pago) {
      const dia = parseInt(proximo_pago.split('-')[2], 10);
      dia_pago = Number.isInteger(dia) ? dia : null;
    }
  }

  const payload = {
    usuario_id: (await getUsuarioId()),
    descripcion,
    monto,
    monto_variable: isVariable,
    frecuencia,
    dia_pago,
    dia_semana,
    proximo_pago,
    categoria_id,
    activo: true,
  };

  let { error } = await db.from('gastos_fijos').insert(payload);
  if (error) {
    const { monto_variable, proximo_pago: _p, ...legacy } = payload;
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

async function eliminarGastoFijo(gastoFijoId) {
  if (!window.confirm('¿Eliminar este gasto fijo?')) return;

  const { error } = await db
    .from('gastos_fijos')
    .update({ activo: false })
    .eq('id', gastoFijoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar el gasto fijo', 'error');
    return;
  }

  showSnackbar('Gasto fijo eliminado', 'success');
  await loadFijos();
  await loadDashboard();
}

// ---- GASTOS (historial) ----
export async function loadGastos() {
  const uid = (await getUsuarioId());
  const { data: gastos } = await db
    .from('gastos')
    .select('*, categorias(nombre, emoji)')
    .eq('usuario_id', uid)
    .order('fecha', { ascending: false })
    .limit(50);

  document.getElementById('page-gastos').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Mis gastos</h1>
    </div>
    <div class="page-body">
      ${!gastos || gastos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <p>No hay gastos registrados todavía.<br>Usa el botón + para agregar uno.</p>
        </div>
      ` : gastos.map(g => `
        <div class="item-row" style="margin-bottom:8px">
          <div class="item-row-emoji">${g.categorias?.emoji ? renderEmojiOrIcon(g.categorias.emoji, 'package', 18) : getCategoriaGastoIcon(g.categorias?.nombre)}</div>
          <div class="item-row-info">
            <div class="item-row-name">${g.descripcion}</div>
            <div class="item-row-detail">${g.categorias?.nombre || 'Sin categoría'} · ${g.fecha}</div>
          </div>
          <div class="item-row-amount">${formatMXN(g.monto)}</div>
          <button class="item-row-delete" style="background:none;border:none;cursor:pointer;padding:8px;border-radius:var(--radius-xs);color:var(--text-muted);display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px" onclick="openMenuGasto('${g.id}')"><i data-lucide="more-vertical" style="width:16px;height:16px;pointer-events:none"></i></button>
        </div>
      `).join('')}
    </div>
  `;

  renderLucideIcons();
}

function openMenuGasto(gastoId) {
  openActionSheet('Opciones de gasto', [
    { label: 'Editar', icon: 'pencil', onClick: `openRegistrarGasto('${gastoId}')` },
    { label: 'Eliminar', onClick: `eliminarGasto('${gastoId}')`, danger: true }
  ]);
}

async function eliminarGasto(gastoId) {
  if (!window.confirm('¿Eliminar este gasto?')) return;

  const { error } = await db
    .from('gastos')
    .delete()
    .eq('id', gastoId)
    .eq('usuario_id', (await getUsuarioId()));

  if (error) {
    showSnackbar('No se pudo eliminar el gasto', 'error');
    return;
  }

  closeModal();
  showSnackbar('Gasto eliminado', 'success');
  await loadGastos();
  await loadDashboard();
}

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
      <span>${cat.nombre}</span>
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
            ${lista.map(m => `<option value="${m.id}">${m.nombre} · ${formatMXN(m.monto_actual || 0)} / ${formatMXN(m.monto_objetivo || 0)}</option>`).join('')}
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
            ${lista.map(d => `<option value="${d.id}" data-tipo="${d.tipo_deuda}" data-max="${d.monto_actual}">${d.acreedor} · ${formatMXN(d.monto_actual)}</option>`).join('')}
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
  const { data: cuentas } = await db.from('cuentas').select('*').eq('usuario_id', uid).eq('activa', true);

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

  openModal(titulo, `
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-input" id="rg-desc" type="text" placeholder="¿En qué gastaste?" value="${descValue}" />
    </div>
    <div class="form-group">
      <label class="form-label">Monto</label>
      <div class="input-money-wrap"><span class="currency-prefix">$</span>
      <input class="form-input" id="rg-monto" type="number" placeholder="0.00" min="0" value="${montoValue}" /></div>
    </div>
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <button id="btn-cat-selector" class="categoria-btn" type="button" onclick="abrirSelectorCategoria('gasto')"></button>
    </div>
    <div id="rg-extra-campos" style="display:none"></div>
    <div class="form-group">
      <label class="form-label">Cuenta</label>
      <select class="form-select" id="rg-cuenta">
        ${(cuentas || []).map(c => `<option value="${c.id}" ${c.id === cuentaDefault ? 'selected' : ''}>${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input class="form-input" id="rg-fecha" type="date" value="${fechaValue}" />
    </div>
    <button class="btn btn-primary" onclick="guardarGasto()">${gastoId ? 'Guardar cambios' : 'Guardar gasto'}</button>
  `);

  actualizarBotonCategoriaSelector();
}

async function guardarGasto() {
  const descripcion = document.getElementById('rg-desc').value.trim();
  const monto = parseFloat(document.getElementById('rg-monto').value);
  const categoria_id = getCurrentCatId();
  const cuenta_id = document.getElementById('rg-cuenta')?.value || null;
  const fecha = document.getElementById('rg-fecha').value;
  const usuarioId = (await getUsuarioId());
  const especial = window._gastoEspecial || null;
  if (!monto || monto <= 0) { showSnackbar('Ingresa un monto válido', 'error'); return; }
  if (!categoria_id) { showSnackbar('Selecciona una categoría', 'error'); return; }
  if (!especial && !descripcion) { showSnackbar('Escribe una descripción', 'error'); return; }

  if (currentEditGastoId) {
    const { error } = await db.from('gastos')
      .update({ descripcion, monto, categoria_id, cuenta_id, fecha })
      .eq('id', currentEditGastoId)
      .eq('usuario_id', usuarioId);

    currentEditGastoId = null;
    window._gastoEspecial = null;
    if (error) { showSnackbar('Error al actualizar', 'error'); return; }
    closeModal();
    showSnackbar('Gasto actualizado ✓', 'success');
    await loadDashboard();
    loadGastos();
    return;
  }

  if (cuenta_id) {
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

  if (especial === 'ahorro') {
    const meta_id = document.getElementById('rg-meta-id')?.value || null;
    if (!meta_id) { showSnackbar('Selecciona una meta', 'error'); return; }

    const { data: meta, error: errMeta } = await db.from('metas_ahorro').select('nombre, monto_actual').eq('id', meta_id).maybeSingle();
    if (errMeta || !meta) { showSnackbar('No se pudo cargar la meta', 'error'); return; }

    const gastoPayload = {
      usuario_id: usuarioId,
      descripcion: descripcion || `Aporte a ${meta.nombre}`,
      monto,
      categoria_id,
      cuenta_id,
      fecha,
    };
    const { error } = await db.from('gastos').insert(gastoPayload);
    if (error) { showSnackbar('Error al guardar', 'error'); return; }

    await db.from('metas_ahorro')
      .update({ monto_actual: Number(meta.monto_actual || 0) + monto })
      .eq('id', meta_id);

    window._gastoEspecial = null;
    closeModal();
    showSnackbar('Aporte a meta registrado ✓', 'success');
    await loadDashboard();
    await loadMetas();
    loadGastos();
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
    if (errPago) { showSnackbar('Error al registrar el pago', 'error'); return; }

    if (deuda.tipo_deuda === 'tabla') {
      const { data: proximoPago } = await db.from('pagos_programados')
        .select('id')
        .eq('deuda_id', deuda_id)
        .eq('pagado', false)
        .order('fecha_vencimiento')
        .limit(1)
        .maybeSingle();
      if (proximoPago) {
        await db.from('pagos_programados').update({
          pagado: true,
          fecha_pago: fecha,
          monto_pagado: monto
        }).eq('id', proximoPago.id);
      }
    }

    const nuevoMonto = Number(deuda.monto_actual) - monto;
    await db.from('deudas').update({
      monto_actual: nuevoMonto,
      activa: nuevoMonto > 0,
      ultimo_pago: fecha,
      monto_ultimo_pago: monto,
    }).eq('id', deuda_id);

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

  if (error) { showSnackbar('Error al guardar', 'error'); return; }
  closeModal();
  showSnackbar('Gasto registrado ✓', 'success');
  await loadDashboard();
  loadGastos();
}

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
window.setFijoMontoVariableModal = setFijoMontoVariableModal;
window.renderCamposFechaFijo = renderCamposFechaFijo;
window.toggleGastoPickerGrupo = toggleGastoPickerGrupo;
