// js/onboarding.js — Flujo completo de onboarding (6 pasos)
import { db } from './supabase.js';
import { formatMXN, showSnackbar, renderLucideIcons, renderApp } from './app.js';
import { GASTOS_FIJOS_CATALOGO, GASTOS_VARIABLES_CATALOGO } from './gastos.js';

// ---- ESTADO ----
let onboardingData = {
  nombre: '',
  tiposIngreso: [],
  cuentas: [],
  deudas: [],
  gastosFijos: [],
  metas: [],
  gastosDiarios: []
};

let currentStep = 1;
const TOTAL_STEPS = 7;

// ---- ICONOS ----
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

function renderIcono(icono, size = 18) {
  return (icono && icono.startsWith('bx'))
    ? `<i class="${icono}" style="font-size:${size}px;pointer-events:none"></i>`
    : `<i data-lucide="${icono || 'circle'}" style="width:${size}px;height:${size}px;stroke-width:1.75;pointer-events:none"></i>`;
}

// ---- NÚCLEO ----
export function renderOnboarding() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="onboarding" id="onboarding">
      <div class="onboarding-header">
        <div class="onboarding-step-indicator" id="step-indicator"></div>
        <div id="onboarding-header-content"></div>
      </div>
      <div class="onboarding-body" id="onboarding-body"></div>
      <div class="onboarding-footer" id="onboarding-footer"></div>
    </div>
  `;

  // Listener delegado persistente — sobrevive cualquier innerHTML en los hijos
  document.getElementById('onboarding-body').addEventListener('click', e => {
    // Step 1: tarjetas de tipo de ingreso
    const incomeCard = e.target.closest('.income-option[data-nombre]');
    if (incomeCard) {
      const nombre = incomeCard.dataset.nombre;
      const icono = incomeCard.dataset.icono || 'briefcase';
      const index = onboardingData.tiposIngreso.findIndex(t => t.nombre === nombre);
      if (index === -1) {
        onboardingData.tiposIngreso.push({ nombre, icono });
        incomeCard.classList.add('selected');
      } else {
        onboardingData.tiposIngreso.splice(index, 1);
        incomeCard.classList.remove('selected');
      }
      return;
    }
    // Step 3: chips de gastos fijos sugeridos
    const fijoChip = e.target.closest('.fijo-sugerido-chip');
    if (fijoChip) {
      window.toggleGastoFijoSugerido(fijoChip);
    }
  });

  renderStep(1);
}

function renderStep(step) {
  currentStep = step;
  updateStepIndicator();

  const steps = {
    1: renderStep2nuevo,
    2: renderStep3nuevo,
    3: renderStep4,
    4: renderStep5,
    5: renderStep6,
    6: renderStepGastosDiarios,
    7: renderStep6resumen
  };

  steps[step]?.();
}

function onboardingBack() {
  if (currentStep <= 1) return;
  renderStep(currentStep - 1);
}

function updateStepIndicator() {
  const indicator = document.getElementById('step-indicator');
  indicator.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) => {
    const n = i + 1;
    const cls = n < currentStep ? 'done' : n === currentStep ? 'active' : '';
    return `<div class="step-dot ${cls}"></div>`;
  }).join('');
}

function setHeader(title, subtitle) {
  document.getElementById('onboarding-header-content').innerHTML = `
    <h1 class="onboarding-title">${title}</h1>
    <p class="onboarding-subtitle">${subtitle}</p>
  `;
}

function setFooter(html) {
  const footer = document.getElementById('onboarding-footer');
  footer.innerHTML = html;
  footer.querySelectorAll('button, .btn').forEach(btn => {
    btn.style.webkitTapHighlightColor = 'transparent';
  });
}

// ---- STEP 1: Tipos de ingreso ----
const TIPOS_INGRESO_DEFAULT = [
  { nombre: 'Salario / Nómina', icono: 'briefcase' },
  { nombre: 'Honorarios / Freelance', icono: 'laptop' },
  { nombre: 'Negocio propio', icono: 'store' },
  { nombre: 'Inversiones / Rendimientos', icono: 'trending-up' },
  { nombre: 'Renta de inmueble', icono: 'home' },
  { nombre: 'Beca / Apoyo gobierno', icono: 'graduation-cap' },
  { nombre: 'Pensión / Retiro', icono: 'landmark' },
  { nombre: 'Mesada / Apoyo familiar', icono: 'users' },
];

function renderStep2nuevo() {
  setHeader('¿Cómo recibes dinero?', 'Selecciona todas las que apliquen.');

  function render(showIconPanel = false) {
    const customItems = onboardingData.tiposIngreso.filter(x => !TIPOS_INGRESO_DEFAULT.some(t => t.nombre === x.nombre));

    const itemsHtml = `
      <div class="income-list">
        ${TIPOS_INGRESO_DEFAULT.map(item => {
          const selected = onboardingData.tiposIngreso.some(x => x.nombre === item.nombre);
          return `
            <div class="income-option${selected ? ' selected' : ''}"
                 data-nombre="${item.nombre.replace(/"/g, '&quot;')}"
                 data-icono="${item.icono}">
              <span class="income-option-icon" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px">
                <i data-lucide="${item.icono}" style="width:18px;height:18px;stroke-width:1.75"></i>
              </span>
              <span class="income-option-text">${item.nombre}</span>
            </div>`;
        }).join('')}

        ${customItems.map((item, idx) => `
          <div class="income-option selected">
            <span>${item.nombre}</span>
            <button class="btn-remove" onclick="removeTipoIngresoCustom(${idx})" style="margin-left:auto">✕</button>
          </div>`).join('')}
      </div>
    `;

    const customFormHtml = `
      <div class="custom-form">
        <div class="custom-form-row">
          <button class="emoji-picker-btn" id="emoji-btn" onclick="toggleIconPanel()">
            <i data-lucide="${window._tipoIngresoSelectedIcono || 'smile'}"></i>
          </button>
          <input class="form-input" id="ti-nombre" placeholder="Nombre del ingreso" />
        </div>

        ${showIconPanel ? `
        <div class="icon-panel">
          <div class="icon-grid">
            ${TODOS_ICONOS.map(ic => `
              <div class="icon-grid-item${ic === window._tipoIngresoSelectedIcono ? ' selected' : ''}" onclick="selectIconoTipoIngreso('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
        </div>
        ` : ''}

        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn-cancel-custom" onclick="cancelCustomIngresoForm()">Cancelar</button>
          <button class="btn btn-secondary" style="flex:1" onclick="addTipoIngresoCustom()">+ Agregar</button>
        </div>
      </div>
    `;

    document.getElementById('onboarding-body').innerHTML = `
      ${itemsHtml}
      <div style="margin-top:20px">
        ${window._showCustomForm ? customFormHtml : `
          <button class="btn-add-item" onclick="showCustomIngresoForm()">
            <i class="bx bx-plus"></i> Agregar personalizado
          </button>
        `}
      </div>
    `;

    lucide.createIcons();
  }

  window._renderStep2Body = render;
  window._showCustomForm = false;
  window._tipoIngresoSelectedIcono = 'smile';
  render();

  setFooter(`
    <button class="btn btn-primary" onclick="nextStep2nuevo()">Continuar →</button>
  `);
}

function nextStep2nuevo() {
  if (onboardingData.tiposIngreso.length < 1) {
    showSnackbar('Selecciona al menos un tipo de ingreso', 'error');
    return;
  }
  renderStep(2);
}

// ---- STEP 2: Gastos fijos ----
function renderStep3nuevo() {
  setHeader('Gastos fijos', 'Los que pagas sí o sí cada cierto tiempo.');

  window._showFijoCustomForm = false;
  window._fijoCustomNombre = '';
  window._fijoCustomIcono = 'smile';
  window._showFijoIconPanel = false;

  if (!(window._fijoGruposAbiertos instanceof Set)) {
    window._fijoGruposAbiertos = new Set();
  }

  window.toggleFijoGrupo = function(titulo) {
    if (window._fijoGruposAbiertos.has(titulo)) {
      window._fijoGruposAbiertos.delete(titulo);
    } else {
      window._fijoGruposAbiertos.add(titulo);
    }
    if (window._renderStep3Body) window._renderStep3Body();
  };

  function render() {
    const fijosNombres = new Set(onboardingData.gastosFijos.map(f => f.nombre));

    const sugeridosHtml = `
      <div class="fijo-grupos">
        ${GASTOS_FIJOS_CATALOGO.map(grupo => {
          const seleccionados = grupo.items.filter(it => fijosNombres.has(it.nombre)).length;
          const abierto = window._fijoGruposAbiertos.has(grupo.titulo) || seleccionados > 0;
          return `
            <div class="fijo-grupo${abierto ? ' is-open' : ''}">
              <button type="button" class="fijo-grupo-header" onclick="toggleFijoGrupo('${grupo.titulo.replace(/'/g, "\\'")}')">
                <span class="fijo-grupo-title">
                  <i data-lucide="${grupo.icono}"></i>
                  <span>${grupo.titulo}</span>
                  ${seleccionados > 0 ? `<span class="fijo-grupo-count">${seleccionados}</span>` : ''}
                </span>
                <i data-lucide="chevron-down" class="fijo-grupo-chevron"></i>
              </button>
              ${abierto ? `
                <div class="fijo-grupo-body">
                  ${grupo.items.map(it => {
                    const added = fijosNombres.has(it.nombre);
                    const meta = JSON.stringify({ nombre: it.nombre, icono: it.icono, frecuencia: it.frecuencia || 'mensual', montoVariable: !!it.montoVariable }).replace(/"/g, '&quot;');
                    return `<button class="fijo-sugerido-chip${added ? ' added' : ''}" data-item="${meta}" type="button">
                      ${renderIcono(it.icono)}
                      <span style="pointer-events:none">${it.nombre}</span>
                    </button>`;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    const FRECUENCIA_OPTIONS = [
      ['semanal',    'Semanal'],
      ['quincenal',  'Quincenal'],
      ['mensual',    'Mensual'],
      ['bimestral',  'Bimestral'],
      ['trimestral', 'Trimestral'],
      ['semestral',  'Semestral'],
      ['anual',      'Anual'],
    ];

    const fijosAddedHtml = onboardingData.gastosFijos.length > 0 ? `
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
        ${onboardingData.gastosFijos.map((f, idx) => {
          const isVariable = f.monto_variable === true;
          const diaField = f.frecuencia === 'semanal'
            ? `<select class="form-select" id="gf-dia-${idx}" onchange="updateGastoFijo(${idx})">
                <option value="0" ${f.dia_semana === 0 ? 'selected':''}>Domingo</option>
                <option value="1" ${f.dia_semana === 1 ? 'selected':''}>Lunes</option>
                <option value="2" ${f.dia_semana === 2 ? 'selected':''}>Martes</option>
                <option value="3" ${f.dia_semana === 3 ? 'selected':''}>Miércoles</option>
                <option value="4" ${f.dia_semana === 4 ? 'selected':''}>Jueves</option>
                <option value="5" ${f.dia_semana === 5 ? 'selected':''}>Viernes</option>
                <option value="6" ${f.dia_semana === 6 ? 'selected':''}>Sábado</option>
               </select>`
            : `<input class="form-input" id="gf-prox-${idx}" type="date" value="${f.proximo_pago ?? ''}" onchange="updateGastoFijo(${idx})" />`;
          return `
            <div class="fijo-card">
              <div class="fijo-card-header">
                <div class="fijo-card-name">
                  ${renderIcono(f.icono)}
                  <span>${f.nombre}</span>
                </div>
                <button class="btn-remove" onclick="removeGastoFijo(${idx})">✕</button>
              </div>
              <div class="fijo-card-fields">
                <div class="tipo-monto-toggle" role="group" aria-label="Tipo de monto">
                  <button type="button" class="tipo-monto-opt${!isVariable ? ' active' : ''}" onclick="setFijoMontoVariable(${idx}, false)">Definido</button>
                  <button type="button" class="tipo-monto-opt${isVariable ? ' active' : ''}" onclick="setFijoMontoVariable(${idx}, true)">Variable</button>
                </div>
                ${isVariable ? `
                  <div class="fijo-hint">Cambia cada pago — solo te avisaremos la fecha.</div>
                ` : `
                  <div class="input-money-wrap">
                    <span class="currency-prefix">$</span>
                    <input class="form-input" id="gf-monto-${idx}" type="number" min="0" value="${f.monto ?? ''}" placeholder="Monto" onchange="updateGastoFijo(${idx})" />
                  </div>
                `}
                <div class="fijo-bottom-row">
                  <select class="form-select" id="gf-freq-${idx}" onchange="updateGastoFijo(${idx})">
                    ${FRECUENCIA_OPTIONS.map(([v, l]) => `<option value="${v}" ${f.frecuencia === v ? 'selected':''}>${l}</option>`).join('')}
                  </select>
                  ${diaField}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    const fijoCustomFormHtml = window._showFijoCustomForm ? `
      <div class="custom-form" style="margin-top:14px">
        <div class="custom-form-row">
          <button class="emoji-picker-btn" onclick="toggleFijoIconPanel()">
            <i data-lucide="${window._fijoCustomIcono}"></i>
          </button>
          <input class="form-input" id="fijo-custom-nombre" value="${window._fijoCustomNombre || ''}" placeholder="Nombre del gasto fijo" oninput="window._fijoCustomNombre=this.value" />
        </div>
        ${window._showFijoIconPanel ? `
          <div class="icon-panel" style="margin-top:12px">
            <div class="icon-grid">
              ${TODOS_ICONOS.map(ic => `
                <div class="icon-grid-item${ic === window._fijoCustomIcono ? ' selected' : ''}" onclick="selectFijoIcono('${ic}')">
                  <i data-lucide="${ic}"></i>
                </div>`).join('')}
            </div>
          </div>
        ` : ''}
        <button class="btn btn-secondary" style="margin-top:12px;width:100%" onclick="addGastoFijoCustom()">+ Agregar</button>
      </div>
    ` : `
      <button class="btn-add-item" style="margin-top:14px" onclick="showFijoCustomForm()">
        <i class="bx bx-plus"></i> Agregar personalizado
      </button>
    `;

    document.getElementById('onboarding-body').innerHTML = `
      <div class="step-section-header">
        <div class="step-section-subtitle">Montos pueden ser definidos (igual cada vez, como renta o internet) o variables (cambian, como luz o agua). Solo los usamos para recordarte cuándo se acerca la fecha y que apartes dinero.</div>
      </div>
      ${sugeridosHtml}
      ${fijoCustomFormHtml}
      ${fijosAddedHtml}
    `;

    lucide.createIcons();
  }

  window._renderStep3Body = render;
  render();

  setFooter(`
    <div class="footer-nav-row">
      <button class="btn btn-ghost" onclick="onboardingBack()">← Atrás</button>
      <button class="btn btn-primary" onclick="nextStep3nuevo()">Continuar →</button>
    </div>
  `);
}

function nextStep3nuevo() {
  const faltantes = onboardingData.gastosFijos.filter(f => !f.monto_variable && (!Number.isFinite(f.monto) || f.monto <= 0));
  if (faltantes.length > 0) {
    showSnackbar(`Falta monto en "${faltantes[0].nombre}" o márcalo como Variable`, 'error');
    return;
  }
  renderStep(3);
}

// ---- STEP 3: Cuentas ----
const INSTITUCIONES = [
  { nombre: 'BBVA',                  tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Banamex / Citibanamex', tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Santander',             tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Banorte',               tipo: 'debito',   icono: 'building-2' },
  { nombre: 'HSBC',                  tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Scotiabank',            tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Inbursa',               tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Afirme',                tipo: 'debito',   icono: 'building-2' },
  { nombre: 'BanBajío',              tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Nu',                    tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Mercado Pago',          tipo: 'negocio',  icono: 'store' },
  { nombre: 'Hey Banco',             tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Klar',                  tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Spin by OXXO',          tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Ualá',                  tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'PayPal',                tipo: 'negocio',  icono: 'globe' },
  { nombre: 'Stori',                 tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Vexi',                  tipo: 'debito',   icono: 'smartphone' },
  { nombre: 'Bitso',                 tipo: 'otro',     icono: 'coins' },
  { nombre: 'Otro banco',            tipo: 'debito',   icono: 'building-2' },
  { nombre: 'Otro digital',          tipo: 'otro',     icono: 'smartphone' },
];

function renderStep4() {
  const primerNombre = (window._regNombre || '').split(' ')[0];
  const headerTitle = primerNombre ? `¿Dónde tienes tu dinero, ${primerNombre}?` : '¿Dónde tienes tu dinero?';
  setHeader(headerTitle, 'Registra tus cuentas activas — efectivo, débito, lo que uses.');
  renderStep4Body();
  const efectivoYaAgregado = onboardingData.cuentas.some(c => c.tipo === 'efectivo');
  if (!efectivoYaAgregado) {
    window._selectedBancoTipo = 'efectivo';
    window._selectedBancoIcono = 'banknote';
    document.getElementById('btn-add-otra-cuenta').style.display = 'none';
    _abrirFormCuenta({ nombre: 'Efectivo', readOnly: true, sinCancelar: true, focusSaldo: true });
  }
  setFooter(`
    <div class="footer-nav-row">
      <button class="btn btn-ghost" onclick="onboardingBack()">← Atrás</button>
      <button class="btn btn-primary" onclick="nextStep4()">Continuar →</button>
    </div>
  `);
}

function renderStep4Body() {
  const TIPO_LABELS = { efectivo: 'Efectivo', debito: 'Débito / Banco', negocio: 'Negocio/Digital', otro: 'Otro' };
  const efectivoAgregado = onboardingData.cuentas.some(c => c.tipo === 'efectivo');

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list" id="cuentas-list">
      ${onboardingData.cuentas.map((c, i) => `
        <div class="item-row">
          <div class="item-row-emoji"><i data-lucide="${c.icono || 'credit-card'}" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${c.nombre}</div>
            <div class="item-row-detail">${TIPO_LABELS[c.tipo] || 'Cuenta'} · Saldo: ${formatMXN(c.saldo_inicial)}</div>
          </div>
          ${c.tipo !== 'efectivo' ? `<button class="item-row-delete" onclick="removeCuenta(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>` : ''}
        </div>
      `).join('')}
    </div>

    <button id="btn-add-otra-cuenta" class="btn-add-item" style="${efectivoAgregado ? '' : 'display:none'}margin-top:4px" onclick="mostrarBuscadorCuenta()">
      <span>+</span> Agregar otra cuenta
    </button>

    <div id="form-cuenta-banco" style="display:none">
      <div class="mini-form">
        <div id="cuenta-search-row" style="display:none;position:relative;margin-bottom:8px">
          <i data-lucide="search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-muted);pointer-events:none;z-index:1"></i>
          <input class="form-input" id="banco-search" style="padding-left:36px" placeholder="Buscar o crear cuenta..." onfocus="mostrarInstituciones()" oninput="filtrarBancos(this.value)" autocomplete="off" />
        </div>
        <div id="banco-resultados" class="banco-resultados-list" style="display:none;margin-bottom:4px"></div>
        <input class="form-input" id="c-nombre" placeholder="Nombre de la cuenta" style="display:none;margin-bottom:8px" />
        <div id="cuenta-saldo-wrap" class="input-money-wrap" style="display:none;margin-bottom:8px">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="c-saldo" type="number" placeholder="Saldo actual (0)" min="0" />
        </div>
        <div id="form-cuenta-actions" style="display:none;gap:8px">
          <button class="btn-cancel-custom" id="btn-cancelar-cuenta" onclick="cancelarFormCuenta()">Cancelar</button>
          <button class="btn btn-secondary" style="flex:1" onclick="addCuenta()">+ Agregar</button>
        </div>
      </div>
    </div>
  `;

  renderLucideIcons();
}

function _abrirFormCuenta({ nombre = '', readOnly = false, sinCancelar = false, focusSaldo = false } = {}) {
  document.getElementById('form-cuenta-banco').style.display = 'block';
  document.getElementById('cuenta-search-row').style.display = 'none';
  document.getElementById('banco-resultados').style.display = 'none';
  const cNombre = document.getElementById('c-nombre');
  cNombre.style.display = 'block';
  cNombre.value = nombre;
  cNombre.readOnly = readOnly;
  document.getElementById('cuenta-saldo-wrap').style.display = 'flex';
  document.getElementById('c-saldo').value = '';
  const actions = document.getElementById('form-cuenta-actions');
  actions.style.display = 'flex';
  document.getElementById('btn-cancelar-cuenta').style.display = sinCancelar ? 'none' : '';
  if (focusSaldo) document.getElementById('c-saldo').focus();
  else if (!readOnly) cNombre.focus();
  else document.getElementById('c-saldo').focus();
}

function ordenarInstitucionesConEfectivoPrimero(items) {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (a.nombre === 'Efectivo') return -1;
    if (b.nombre === 'Efectivo') return 1;
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
  return sorted;
}

function addCuenta() {
  const nombre = document.getElementById('c-nombre')?.value.trim();
  const tipo = window._selectedBancoTipo || 'otro';
  const icono = window._selectedBancoIcono || 'credit-card';
  const saldo = parseFloat(document.getElementById('c-saldo')?.value) || 0;
  if (!nombre) { showSnackbar('Escribe el nombre de la cuenta', 'error'); return; }
  onboardingData.cuentas.push({ nombre, tipo, icono, saldo_inicial: saldo });
  window._selectedBancoTipo = null;
  window._selectedBancoIcono = null;
  renderStep4Body();
}

function removeCuenta(i) {
  onboardingData.cuentas.splice(i, 1);
  renderStep4Body();
}

function nextStep4() {
  if (onboardingData.cuentas.length === 0) {
    showSnackbar('Agrega al menos una cuenta', 'error');
    return;
  }
  renderStep(4);
}

// ---- STEP 4: Deudas ----
function renderStep5() {
  setHeader('¿Qué debes actualmente?', 'Registra tus deudas para tener el panorama completo y hacer un plan de pago.');
  renderStep5Body();
  setFooter(`
    <div class="footer-nav-row">
      <button class="btn btn-ghost" onclick="onboardingBack()">← Atrás</button>
      <button class="btn btn-primary" onclick="nextStep5()">Continuar →</button>
    </div>
  `);
}

function renderStep5Body(showForm = false) {
  const tipoDeuda = window._onboardingTipoDeuda || null;

  const selectorTipoHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <button onclick="selectTipoDeudaOnboarding('simple')" style="background:var(--bg-elevated);border:2px solid ${tipoDeuda === 'simple' ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="credit-card" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block"></i>
        <div style="font-weight:600;font-size:14px">Simple</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Fijo<br>Fecha: Fija</div>
      </button>
      <button onclick="selectTipoDeudaOnboarding('variable')" style="background:var(--bg-elevated);border:2px solid ${tipoDeuda === 'variable' ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="trending-down" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block"></i>
        <div style="font-weight:600;font-size:14px">Variable</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Cambia<br>Fecha: Fija</div>
      </button>
      <button onclick="selectTipoDeudaOnboarding('tabla')" style="background:var(--bg-elevated);border:2px solid ${tipoDeuda === 'tabla' ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="calendar" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block"></i>
        <div style="font-weight:600;font-size:14px">Con tabla</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Cambia<br>Fecha: Cambia</div>
      </button>
      <button onclick="selectTipoDeudaOnboarding('flexible')" style="background:var(--bg-elevated);border:2px solid ${tipoDeuda === 'flexible' ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);padding:14px 16px;cursor:pointer;font-family:var(--font);text-align:left;transition:all 180ms ease">
        <i data-lucide="wallet" style="width:20px;height:20px;color:var(--accent);margin-bottom:6px;display:block"></i>
        <div style="font-weight:600;font-size:14px">Flexible</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;line-height:1.5">Monto: Libre<br>Fecha: Libre</div>
      </button>
    </div>
  `;

  const esSimple = tipoDeuda === 'simple';
  const cuotaLabel = esSimple ? 'Cuota fija' : 'Pago promedio (Opcional) - Para presupuestar';
  const cuotaRequired = esSimple ? 'required' : '';

  const formularioSimpleVariable = `
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">¿A quién le debes?</label>
        <input class="form-input" id="d-acreedor" type="text" placeholder="Ej: Caja Popular, mamá…" />
      </div>
      <div class="form-group">
        <label class="form-label">Monto total</label>
        <div class="input-money-wrap">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="d-monto" type="number" placeholder="0.00" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Frecuencia de pago</label>
        <div style="display:flex;gap:8px">
          <select class="form-select" id="d-freq" onchange="renderCamposDeudaOnboarding()" style="flex:1">
            <option value="unico">Único</option>
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual" selected>Mensual</option>
            ${(tipoDeuda === 'simple' || tipoDeuda === 'variable') ? '' : '<option value="libre">Libre</option>'}
          </select>
          <div id="d-fecha-campos" style="flex:1"></div>
        </div>
        <div id="d-freq-hint"></div>
      </div>
      <div class="form-group">
        <label class="form-label">${cuotaLabel}</label>
        <div class="input-money-wrap">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="d-cuota" type="number" placeholder="0.00" min="0" ${cuotaRequired} />
        </div>
      </div>
    </div>
  `;

  const formularioFlexible = `
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">¿A quién le debes?</label>
        <input class="form-input" id="d-acreedor" type="text" placeholder="Ej: Amigo, familiar…" />
      </div>
      <div class="form-group">
        <label class="form-label">Monto total</label>
        <div class="input-money-wrap">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="d-monto" type="number" placeholder="0.00" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Pago estimado (Opcional)</label>
        <div class="input-money-wrap">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="d-cuota" type="number" placeholder="0.00" min="0" />
        </div>
      </div>
    </div>
  `;

  const formularioTabla = `
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">¿A quién le debes?</label>
        <input class="form-input" id="d-acreedor" type="text" placeholder="Ej: Caja Popular, mamá…" />
      </div>
      <div class="form-group">
        <label class="form-label">Monto total</label>
        <div class="input-money-wrap">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="d-monto" type="number" placeholder="0.00" min="0" />
        </div>
      </div>
      <p class="form-hint">Podrás agregar los pagos programados después.</p>
    </div>
  `;

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list" id="deudas-list">
      ${onboardingData.deudas.map((d, i) => `
        <div class="item-row">
          <div class="item-row-emoji"><i data-lucide="trending-down" style="width:18px;height:18px;stroke-width:1.75"></i></div>
          <div class="item-row-info">
            <div class="item-row-name">${d.acreedor}</div>
            <div class="item-row-detail">${d.tipo_deuda === 'tabla' ? 'con tabla' : (d.tipo_pago || 'sin fecha fija')}${d.monto_pago ? ` · ${formatMXN(d.monto_pago)}/pago` : ''}</div>
          </div>
          <div class="item-row-amount">${formatMXN(d.monto_actual)}</div>
          <button class="item-row-delete" onclick="removeDeuda(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form">
      ${selectorTipoHtml}
      ${tipoDeuda ? (tipoDeuda === 'tabla' ? formularioTabla : tipoDeuda === 'flexible' ? formularioFlexible : formularioSimpleVariable) : `<p class="form-hint" style="margin-bottom:8px">Selecciona el tipo de deuda para continuar</p>`}
      ${tipoDeuda ? `<button class="btn btn-secondary" onclick="addDeuda()">+ Agregar</button>` : ''}
    </div>
    ` : `
    <button class="btn-add-item" onclick="openDeudaOnboardingForm()">
      <span>+</span> Agregar deuda
    </button>
    `}
    <p class="form-hint mt-8" style="padding: 0 4px">Si no tienes deudas activas puedes continuar sin agregar ninguna.</p>
  `;

  if (showForm && (tipoDeuda === 'simple' || tipoDeuda === 'variable')) {
    renderCamposDeudaOnboarding();
  }
  if (showForm && tipoDeuda === 'flexible') {
    // sin campos de fecha — formulario completo desde el HTML estático
  }

  renderLucideIcons();
}

function renderCamposDeudaOnboarding() {
  const tipo = document.getElementById('d-freq')?.value;
  const campos = document.getElementById('d-fecha-campos');
  const hint = document.getElementById('d-freq-hint');
  if (!campos) return;
  if (hint) hint.innerHTML = '';

  if (tipo === 'unico') {
    campos.innerHTML = `<input class="form-input" id="d-fecha-pago" type="date" style="width:100%" />`;
    return;
  }
  if (tipo === 'semanal') {
    campos.innerHTML = `
      <select class="form-select" id="d-dia-semana" style="width:100%">
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miércoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sábado</option>
        <option value="0">Domingo</option>
      </select>`;
    return;
  }
  if (tipo === 'quincenal') {
    campos.innerHTML = '';
    if (hint) hint.innerHTML = `<p class="text-xs text-gray-500 mt-1 block" style="color:var(--text-secondary);font-size:12px;margin-top:6px">Los pagos se programarán los días 15 y último del mes.</p>`;
    return;
  }
  if (tipo === 'mensual') {
    const opciones = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    campos.innerHTML = `<select class="form-select" id="d-dia-pago" style="width:100%">${opciones}</select>`;
    return;
  }
  campos.innerHTML = '';
}

function addDeuda() {
  const tipo_deuda = window._onboardingTipoDeuda || 'simple';
  if (!window._onboardingTipoDeuda) {
    showSnackbar('Selecciona un tipo de deuda', 'error');
    return;
  }
  const acreedor = document.getElementById('d-acreedor')?.value.trim();
  const monto = parseFloat(document.getElementById('d-monto')?.value);
  let tipo_pago = null;
  let monto_pago = null;
  if (!acreedor || !monto) { showSnackbar('Completa acreedor y monto', 'error'); return; }

  let dia_pago = null;
  let dia_semana = null;

  if (tipo_deuda === 'simple' || tipo_deuda === 'variable') {
    tipo_pago = document.getElementById('d-freq')?.value || 'libre';
    monto_pago = parseFloat(document.getElementById('d-cuota')?.value) || null;

    if (tipo_pago === 'unico') {
      const fechaStr = document.getElementById('d-fecha-pago')?.value;
      if (fechaStr) dia_pago = new Date(fechaStr + 'T00:00:00').getDate();
    } else if (tipo_pago === 'semanal') {
      dia_semana = parseInt(document.getElementById('d-dia-semana')?.value, 10);
      if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
        showSnackbar('Selecciona un día de la semana válido', 'error');
        return;
      }
    } else if (tipo_pago === 'mensual') {
      dia_pago = parseInt(document.getElementById('d-dia-pago')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 31) {
        showSnackbar('Ingresa un día del mes entre 1 y 31', 'error');
        return;
      }
    } else if (tipo_pago === 'quincenal') {
      dia_pago = parseInt(document.getElementById('d-quincena')?.value, 10);
      if (Number.isNaN(dia_pago) || dia_pago < 1 || dia_pago > 2) {
        showSnackbar('Ingresa 1 o 2 para la quincena', 'error');
        return;
      }
    }
  }

  onboardingData.deudas.push({
    acreedor,
    monto_inicial: monto,
    monto_actual: monto,
    tipo_pago,
    monto_pago,
    dia_pago,
    dia_semana,
    tipo_deuda
  });

  window._onboardingTipoDeuda = null;
  renderStep5Body(false);
}

function removeDeuda(i) {
  onboardingData.deudas.splice(i, 1);
  renderStep5Body(false);
}

function nextStep5() {
  renderStep(5);
}

// ---- CATÁLOGO GASTOS DIARIOS ----
const GASTOS_DIARIOS_CATALOGO = [
  { categoria: 'Alimentación',    icono: 'bx bx-restaurant',  items: ['Súper / Despensa', 'Restaurantes', 'Antojitos / Café', 'Delivery'] },
  { categoria: 'Transporte',      icono: 'bx bx-car',         items: ['Transporte público', 'Gasolina', 'Uber / Didi', 'Estacionamiento'] },
  { categoria: 'Hogar',           icono: 'bx bx-home-alt',    items: ['Limpieza', 'Mascotas', 'Mantenimiento'] },
  { categoria: 'Entretenimiento', icono: 'bx bx-party',       items: ['Salidas', 'Cine / Eventos', 'Hobbies'] },
  { categoria: 'Salud y Cuidado', icono: 'bx bx-heart',       items: ['Farmacia / Medicinas', 'Peluquería', 'Ropa', 'Gimnasio'] },
  { categoria: 'Educación',       icono: 'bx bx-book',        items: ['Material escolar', 'Cursos'] },
  { categoria: 'Otros',           icono: 'bx bx-grid-alt',    items: ['Regalos', 'Gastos hormiga'] },
];

// ---- STEP 5: Metas ----
function renderStep6() {
  setHeader('¿Para qué quieres ahorrar?', 'Define tus metas. Las iremos completando juntos poco a poco.');
  renderStep6Body();
  setFooter(`
    <div class="footer-nav-row">
      <button class="btn btn-ghost" onclick="onboardingBack()">← Atrás</button>
      <button class="btn btn-primary" onclick="nextStep6()">Continuar →</button>
    </div>
  `);
}

function renderStep6Body(showForm = false) {
  const cuentasOptions = onboardingData.cuentas.map(c =>
    `<option value="${c.nombre}">${c.nombre}</option>`
  ).join('');

  document.getElementById('onboarding-body').innerHTML = `
    <div class="item-list">
      ${onboardingData.metas.map((m, i) => `
        <div class="item-row">
          <div class="item-row-emoji" style="display:flex;align-items:center;justify-content:center">
            <i data-lucide="${m.icono || 'target'}" style="width:20px;height:20px;stroke-width:1.75;color:var(--accent)"></i>
          </div>
          <div class="item-row-info">
            <div class="item-row-name">${m.nombre}</div>
            <div class="item-row-detail">
              ${formatMXN(m.monto_objetivo)}
              ${m.frecuencia_ahorro && m.frecuencia_ahorro !== 'libre' ? ` · ${m.frecuencia_ahorro}` : ''}
              ${m.cuenta_nombre ? ` · ${m.cuenta_nombre}` : ''}
              ${m.fecha_limite ? ` · hasta ${new Date(m.fecha_limite + 'T00:00:00').toLocaleDateString('es-MX')}` : ''}
            </div>
          </div>
          <button class="item-row-delete" onclick="removeMeta(${i})"><i data-lucide="x" style="width:18px;height:18px;stroke-width:1.75"></i></button>
        </div>
      `).join('')}
    </div>

    ${showForm ? `
    <div class="mini-form">
      <div class="form-group" style="margin-bottom:10px">
        <div class="custom-form-row">
          <button class="emoji-picker-btn" onclick="toggleMetaIconPanel()">
            <i data-lucide="${window._metaIcono || 'target'}"></i>
          </button>
          <input class="form-input" id="m-nombre" placeholder="Nombre de la meta" />
        </div>
        ${window._showMetaIconPanel ? `
        <div class="icon-panel" style="margin-top:8px">
          <div class="icon-grid">
            ${TODOS_ICONOS.map(ic => `
              <div class="icon-grid-item${ic === window._metaIcono ? ' selected' : ''}" onclick="selectIconoMeta('${ic}')">
                <i data-lucide="${ic}"></i>
              </div>`).join('')}
          </div>
        </div>
        ` : ''}
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">Monto a ahorrar</label>
        <div class="input-money-wrap">
          <span class="currency-prefix">$</span>
          <input class="form-input" id="m-monto" type="number" placeholder="0.00" min="0" oninput="calcularAhorroMeta()" />
        </div>
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">Fecha límite</label>
        <input class="form-input" id="m-fecha-limite" type="date" onchange="calcularAhorroMeta()" />
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">Frecuencia de ahorro</label>
        <select class="form-select" id="m-frecuencia" onchange="calcularAhorroMeta()">
          <option value="diaria">Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="quincenal">Quincenal</option>
          <option value="mensual" selected>Mensual</option>
          <option value="libre">Libre (sin fecha fija)</option>
        </select>
      </div>
      <p id="m-calculo-sugerido" style="font-size:13px;color:var(--accent);margin-bottom:10px;min-height:18px;font-weight:500"></p>
      ${onboardingData.cuentas.length > 0 ? `
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label">¿En qué cuenta ahorrarás?</label>
        <select class="form-select" id="m-cuenta-nombre">
          <option value="">Sin cuenta vinculada</option>
          ${cuentasOptions}
        </select>
      </div>` : ''}
      <button class="btn btn-secondary" onclick="addMeta()">+ Agregar</button>
    </div>
    ` : `
    <button class="btn-add-item" onclick="renderStep6Body(true)">
      <span>+</span> Agregar meta
    </button>
    `}
    <p class="form-hint mt-8" style="padding: 0 4px">También puedes empezar sin metas y definirlas después.</p>
  `;

  renderLucideIcons();
}

window.calcularAhorroMeta = function() {
  const monto     = parseFloat(document.getElementById('m-monto')?.value);
  const fechaStr  = document.getElementById('m-fecha-limite')?.value;
  const frecuencia = document.getElementById('m-frecuencia')?.value;
  const resultado = document.getElementById('m-calculo-sugerido');
  if (!resultado) return;

  if (!monto || monto <= 0 || !fechaStr || frecuencia === 'libre') {
    resultado.textContent = '';
    return;
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaStr + 'T00:00:00');
  if (limite <= hoy) { resultado.textContent = ''; return; }

  const dias = Math.ceil((limite - hoy) / 86400000);
  const divisores = { diaria: 1, semanal: 7, quincenal: 15, mensual: 30 };
  const singular  = { diaria: 'día',      semanal: 'semana',   quincenal: 'quincena', mensual: 'mes' };
  const plural    = { diaria: 'días',     semanal: 'semanas',  quincenal: 'quincenas',mensual: 'meses' };
  const periodos  = Math.ceil(dias / (divisores[frecuencia] || 30));
  if (periodos <= 0) { resultado.textContent = ''; return; }

  const cuota     = monto / periodos;
  const labelPer  = periodos === 1 ? singular[frecuencia] : plural[frecuencia];
  resultado.textContent = `Deberás ahorrar ${formatMXN(cuota)} cada ${singular[frecuencia]} (${periodos} ${labelPer}).`;
};

function addMeta() {
  const nombre          = document.getElementById('m-nombre')?.value.trim();
  const monto_objetivo  = parseFloat(document.getElementById('m-monto')?.value);
  const cuenta_nombre   = document.getElementById('m-cuenta-nombre')?.value || null;
  const fecha_limite    = document.getElementById('m-fecha-limite')?.value || null;
  const frecuencia_ahorro = document.getElementById('m-frecuencia')?.value || null;
  if (!nombre || !monto_objetivo) { showSnackbar('Completa nombre y monto', 'error'); return; }
  onboardingData.metas.push({ icono: window._metaIcono || 'target', nombre, monto_objetivo, cuenta_nombre, fecha_limite, frecuencia_ahorro });
  window._metaIcono = 'target';
  window._showMetaIconPanel = false;
  renderStep6Body(false);
}

function removeMeta(i) {
  onboardingData.metas.splice(i, 1);
  renderStep6Body(false);
}

function nextStep6() {
  renderStep(6);
}

// ---- STEP 6: Gastos Diarios ----
function renderStepGastosDiarios() {
  window._gdCategoriasAbiertas = window._gdCategoriasAbiertas || new Set();
  setHeader('¿En qué gastas día a día?', 'Selecciona los gastos variables que tienes con más frecuencia.');
  renderGastosDiariosBody();
  setFooter(`
    <div class="footer-nav-row">
      <button class="btn btn-ghost" onclick="onboardingBack()">← Atrás</button>
      <button class="btn btn-primary" onclick="nextStepGastosDiarios()">Continuar →</button>
    </div>
  `);
}

function renderGastosDiariosBody(customFormOpen = false) {
  const sel = onboardingData.gastosDiarios;
  const abiertos = window._gdCategoriasAbiertas || new Set();

  const acuerdeonHTML = GASTOS_DIARIOS_CATALOGO.map(grupo => {
    const isOpen = abiertos.has(grupo.categoria);
    const count  = sel.filter(g => g.categoria === grupo.categoria).length;
    const catKey = grupo.categoria.replace(/'/g, "\\'");
    const icoKey = grupo.icono.replace(/'/g, "\\'");

    const subcatsHTML = isOpen
      ? `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 14px 14px">` +
        grupo.items.map(item => {
          const active  = sel.some(g => g.categoria === grupo.categoria && g.subcategoria === item);
          const itemKey = item.replace(/'/g, "\\'");
          return `<button type="button"
            onclick="toggleGdSubcategoria('${catKey}','${icoKey}','${itemKey}')"
            style="padding:7px 14px;border-radius:9999px;font-size:13px;font-family:var(--font-body);cursor:pointer;transition:all 150ms ease;
              background:${active ? 'var(--accent)' : 'var(--bg-elevated)'};
              color:${active ? '#fff' : 'var(--text)'};
              border:1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}">
            ${item}
          </button>`;
        }).join('') + `</div>`
      : '';

    return `
      <div style="background:var(--bg-card);border:1.5px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:8px">
        <button type="button" onclick="toggleGdCategoria('${catKey}')"
          style="width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;background:none;border:none;cursor:pointer;font-family:var(--font-body);text-align:left">
          <i class="${grupo.icono}" style="font-size:20px;color:${isOpen || count > 0 ? 'var(--accent)' : 'var(--text-muted)'};flex-shrink:0"></i>
          <span style="font-weight:600;font-size:14px;flex:1">${grupo.categoria}</span>
          ${count > 0 ? `<span style="background:var(--accent);color:#fff;border-radius:9999px;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;padding:0 5px">${count}</span>` : ''}
          <i class="bx ${isOpen ? 'bx-chevron-up' : 'bx-chevron-down'}" style="font-size:20px;color:var(--text-muted)"></i>
        </button>
        ${isOpen ? `<div style="padding-bottom:8px">${subcatsHTML}</div>` : ''}
      </div>`;
  }).join('');

  const categoriasOpts = GASTOS_DIARIOS_CATALOGO
    .map(g => `<option value="${g.categoria}">${g.categoria}</option>`).join('');

  const customFormHTML = customFormOpen ? `
    <div class="mini-form" style="margin-top:4px">
      <div class="form-group">
        <label class="form-label">Nombre del gasto</label>
        <input class="form-input" id="gd-custom-nombre" type="text" placeholder="Ej. Netflix, Veterinario…" />
      </div>
      <div class="form-group">
        <label class="form-label">Categoría padre</label>
        <select class="form-select" id="gd-custom-cat">${categoriasOpts}</select>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="guardarGdCustom()">+ Agregar</button>
        <button class="btn btn-ghost" onclick="renderGastosDiariosBody(false)">Cancelar</button>
      </div>
    </div>` : `
    <button class="btn-add-item" onclick="renderGastosDiariosBody(true)" style="margin-top:4px">
      <i class="bx bx-plus"></i> Agregar gasto personalizado
    </button>`;

  document.getElementById('onboarding-body').innerHTML = `
    ${acuerdeonHTML}
    ${customFormHTML}
    <p class="form-hint" style="margin-top:12px;padding:0 4px">Puedes seleccionar varios o continuar sin ninguno.</p>
  `;
}

window.renderGastosDiariosBody = renderGastosDiariosBody;

window.toggleGdCategoria = function(categoria) {
  if (!window._gdCategoriasAbiertas) window._gdCategoriasAbiertas = new Set();
  if (window._gdCategoriasAbiertas.has(categoria)) {
    window._gdCategoriasAbiertas.delete(categoria);
  } else {
    window._gdCategoriasAbiertas.add(categoria);
  }
  renderGastosDiariosBody();
};

window.toggleGdSubcategoria = function(categoria, icono, subcategoria) {
  const idx = onboardingData.gastosDiarios.findIndex(
    g => g.categoria === categoria && g.subcategoria === subcategoria
  );
  if (idx >= 0) {
    onboardingData.gastosDiarios.splice(idx, 1);
  } else {
    onboardingData.gastosDiarios.push({ categoria, icono, subcategoria });
  }
  renderGastosDiariosBody();
};

window.guardarGdCustom = function() {
  const nombre = document.getElementById('gd-custom-nombre')?.value.trim();
  const categoria = document.getElementById('gd-custom-cat')?.value;
  if (!nombre) { showSnackbar('Escribe el nombre del gasto', 'error'); return; }
  const grupo = GASTOS_DIARIOS_CATALOGO.find(g => g.categoria === categoria);
  const icono = grupo ? grupo.icono : 'bx bx-grid-alt';
  const yaExiste = onboardingData.gastosDiarios.some(
    g => g.categoria === categoria && g.subcategoria === nombre
  );
  if (!yaExiste) {
    onboardingData.gastosDiarios.push({ categoria, icono, subcategoria: nombre });
  }
  renderGastosDiariosBody();
};

function nextStepGastosDiarios() {
  renderStep(7);
}
window.nextStepGastosDiarios = nextStepGastosDiarios;

// ---- STEP 7: Resumen ----
function renderStep6resumen() {
  setHeader('Todo listo, revisa tu configuración', 'Si algo no está bien, regresa a corregirlo.');

  const totalGastosFijos = onboardingData.gastosFijos.length;
  const sectionStyle = 'background:var(--bg-card);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:12px;position:relative';

  const renderList = (items, emptyText = 'Ninguna', formatter = item => item) => {
    if (!items || items.length === 0) return `<p class="form-hint">${emptyText}</p>`;
    return `<div style="display:flex;flex-wrap:wrap;gap:8px">${items.map(item => `<span class="category-chip" style="cursor:default">${formatter(item)}</span>`).join('')}</div>`;
  };

  document.getElementById('onboarding-body').innerHTML = `
    <div style="${sectionStyle}">
      <button class="btn btn-ghost" style="position:absolute;top:10px;right:12px;padding:4px 10px;font-size:12px" onclick="renderStep(1)">Editar</button>
      <strong style="display:block;margin-bottom:10px">Ingresos</strong>
      ${renderList(onboardingData.tiposIngreso, 'Ninguno', item => item.nombre)}
    </div>

    <div style="${sectionStyle}">
      <button class="btn btn-ghost" style="position:absolute;top:10px;right:12px;padding:4px 10px;font-size:12px" onclick="renderStep(2)">Editar</button>
      <strong style="display:block;margin-bottom:10px">Gastos fijos</strong>
      <p class="form-hint" style="margin-bottom:8px">${totalGastosFijos} ${totalGastosFijos === 1 ? 'gasto fijo' : 'gastos fijos'}</p>
      ${renderList(onboardingData.gastosFijos, 'Ninguno', item => `${item.nombre}${item.monto_variable ? ' · variable' : (item.monto ? ` · ${formatMXN(item.monto)}` : '')}`)}
    </div>

    <div style="${sectionStyle}">
      <button class="btn btn-ghost" style="position:absolute;top:10px;right:12px;padding:4px 10px;font-size:12px" onclick="renderStep(3)">Editar</button>
      <strong style="display:block;margin-bottom:10px">Cuentas</strong>
      ${onboardingData.cuentas.length === 0 ? '<p class="form-hint">Ninguna</p>' : onboardingData.cuentas.map(c => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <span>${c.nombre}</span>
          <span style="color:var(--text-secondary)">${formatMXN(c.saldo_inicial || 0)}</span>
        </div>
      `).join('')}
    </div>

    <div style="${sectionStyle}">
      <button class="btn btn-ghost" style="position:absolute;top:10px;right:12px;padding:4px 10px;font-size:12px" onclick="renderStep(4)">Editar</button>
      <strong style="display:block;margin-bottom:10px">Deudas</strong>
      ${onboardingData.deudas.length === 0 ? '<p class="form-hint">Ninguna</p>' : onboardingData.deudas.map(d => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <span>${d.acreedor}</span>
          <span style="color:var(--text-secondary)">${formatMXN(d.monto_actual || 0)}</span>
        </div>
      `).join('')}
    </div>

    <div style="${sectionStyle}">
      <button class="btn btn-ghost" style="position:absolute;top:10px;right:12px;padding:4px 10px;font-size:12px" onclick="renderStep(5)">Editar</button>
      <strong style="display:block;margin-bottom:10px">Metas</strong>
      ${onboardingData.metas.length === 0 ? '<p class="form-hint">Ninguna</p>' : onboardingData.metas.map(m => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <span>${m.nombre}</span>
          <span style="color:var(--text-secondary)">${formatMXN(m.monto_objetivo || 0)}</span>
        </div>
      `).join('')}
    </div>

    <div style="${sectionStyle}">
      <button class="btn btn-ghost" style="position:absolute;top:10px;right:12px;padding:4px 10px;font-size:12px" onclick="renderStep(6)">Editar</button>
      <strong style="display:block;margin-bottom:10px">Gastos diarios</strong>
      ${renderList(onboardingData.gastosDiarios, 'Ninguno', item => item.subcategoria || item.categoria)}
    </div>
  `;

  setFooter(`
    <div class="footer-nav-row">
      <button class="btn btn-ghost" onclick="onboardingBack()">← Atrás</button>
      <button class="btn btn-success" id="btn-finish" onclick="finishOnboarding()">¡Listo, empecemos!</button>
    </div>
  `);

  renderLucideIcons();
}

// ---- GUARDAR EN SUPABASE ----
async function finishOnboarding() {
  const btn = document.getElementById('btn-finish');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const { data: { user } } = await db.auth.getUser();
    const userId = user.id;
    const nombre = window._regNombre || (user.email ? user.email.split('@')[0] : 'Usuario');

    const { error: errUsuario } = await db.from('usuarios').insert({
      id: userId,
      nombre: nombre,
      onboarding_completo: true
    });

    if (errUsuario) throw errUsuario;

    if (onboardingData.tiposIngreso.length > 0) {
      const cats_ingreso = onboardingData.tiposIngreso.map(t => ({
        nombre: t.nombre,
        emoji: t.icono,
        tipo: 'ingreso',
        usuario_id: userId,
        es_default: false
      }));
      await db.from('categorias').insert(cats_ingreso);
    }

    const cats_gasto_predef = GASTOS_VARIABLES_CATALOGO.flatMap(g => g.items.map(it => ({
      nombre: it.nombre,
      emoji: it.icono,
      tipo: 'gasto',
      usuario_id: userId,
      es_default: true
    })));
    if (cats_gasto_predef.length > 0) {
      await db.from('categorias').insert(cats_gasto_predef);
    }

    if (onboardingData.gastosFijos.length > 0) {
      const { data: categoriasGasto } = await db
        .from('categorias')
        .select('id, nombre')
        .eq('usuario_id', userId)
        .eq('tipo', 'gasto');
      const catNombreAId = {};
      (categoriasGasto || []).forEach(c => { catNombreAId[c.nombre] = c.id; });

      const fijos = onboardingData.gastosFijos.map(f => ({
        descripcion: f.nombre,
        monto: f.monto_variable ? null : (f.monto ?? null),
        monto_variable: !!f.monto_variable,
        frecuencia: f.frecuencia || 'mensual',
        dia_pago: f.dia_pago ?? null,
        dia_semana: f.dia_semana ?? null,
        proximo_pago: f.proximo_pago ?? null,
        usuario_id: userId,
        categoria_id: catNombreAId[f.nombre] || null
      }));
      const { error: errFijos } = await db.from('gastos_fijos').insert(fijos);
      if (errFijos) {
        const fijosLegacy = fijos.map(({ monto_variable, proximo_pago, ...rest }) => ({
          ...rest,
          monto: rest.monto ?? 0,
        }));
        await db.from('gastos_fijos').insert(fijosLegacy);
      }
    }

    let cuentaNombreAId = {};
    if (onboardingData.cuentas.length > 0) {
      const cuentasPayload = onboardingData.cuentas.map(c => ({
        nombre: c.nombre,
        tipo: c.tipo,
        saldo_inicial: c.saldo_inicial,
        activa: true,
        usuario_id: userId
      }));
      const { data: insertedCuentas } = await db.from('cuentas').insert(cuentasPayload).select();
      (insertedCuentas || []).forEach(c => { cuentaNombreAId[c.nombre] = c.id; });
    }

    if (onboardingData.deudas.length > 0) {
      const deudas = onboardingData.deudas.map(d => ({
        acreedor: d.acreedor,
        monto_inicial: d.monto_inicial,
        monto_actual: d.monto_actual,
        tipo_pago: d.tipo_pago ?? null,
        monto_pago: d.monto_pago ?? null,
        dia_pago: d.dia_pago ?? null,
        dia_semana: d.dia_semana ?? null,
        tipo_deuda: d.tipo_deuda || 'simple',
        usuario_id: userId
      }));
      await db.from('deudas').insert(deudas);
    }

    if (onboardingData.metas.length > 0) {
      const metas = onboardingData.metas.map(m => ({
        nombre: m.nombre,
        emoji: m.icono || 'target',
        monto_objetivo: m.monto_objetivo,
        monto_actual: 0,
        activa: true,
        cuenta_id: m.cuenta_nombre ? (cuentaNombreAId[m.cuenta_nombre] || null) : null,
        usuario_id: userId
      }));
      await db.from('metas_ahorro').insert(metas);
    }

    showSnackbar('¡Todo listo! Bienvenido', 'success');
    setTimeout(() => renderApp(), 800);

  } catch (err) {
    console.error(err);
    showSnackbar('Error al guardar. Intenta de nuevo.', 'error');
    const btn = document.getElementById('btn-finish');
    if (btn) { btn.innerHTML = '<i class="bx bx-send" style="font-size:16px;vertical-align:middle;margin-right:6px"></i>¡Listo, empecemos!'; btn.disabled = false; }
  }
}

// ---- EXPONER AL ENTORNO GLOBAL (onclick en HTML dinámico) ----
window.renderStep           = renderStep;
window.onboardingBack       = onboardingBack;
window.renderStep6Body      = renderStep6Body;

window.toggleTipoIngreso = function(nombre, icono, elemento) {
  const index = onboardingData.tiposIngreso.findIndex(t => t.nombre === nombre);
  if (index === -1) {
    onboardingData.tiposIngreso.push({ nombre, icono });
    elemento.classList.add('selected');
  } else {
    onboardingData.tiposIngreso.splice(index, 1);
    elemento.classList.remove('selected');
  }
};

window.showCustomIngresoForm = function() {
  window._showCustomForm = true;
  window._tipoIngresoSelectedIcono = 'smile';
  if (window._renderStep2Body) window._renderStep2Body(false);
};

window.cancelCustomIngresoForm = function() {
  window._showCustomForm = false;
  window._tipoIngresoSelectedIcono = 'smile';
  window._showIconPanel = false;
  if (window._renderStep2Body) window._renderStep2Body(false);
};

window.toggleIconPanel = function() {
  const currentShow = window._showIconPanel || false;
  if (window._renderStep2Body) window._renderStep2Body(!currentShow);
  window._showIconPanel = !currentShow;
};

window.selectIconoTipoIngreso = function(icono) {
  window._tipoIngresoSelectedIcono = icono;
  window._showIconPanel = false;
  if (window._renderStep2Body) window._renderStep2Body(false);
};

window.addTipoIngresoCustom = function() {
  const nombre = document.getElementById('ti-nombre')?.value.trim();
  const icono = window._tipoIngresoSelectedIcono || 'smile';
  if (!nombre) { showSnackbar('Escribe el nombre del ingreso', 'error'); return; }
  onboardingData.tiposIngreso.push({ nombre, icono });
  window._showCustomForm = false;
  window._tipoIngresoSelectedIcono = 'smile';
  if (window._renderStep2Body) window._renderStep2Body();
};

window.removeTipoIngresoCustom = function(index) {
  const defaultNames = TIPOS_INGRESO_DEFAULT.map(t => t.nombre);
  const customItems = onboardingData.tiposIngreso.filter(x => !defaultNames.includes(x.nombre));
  const itemToRemove = customItems[index];
  const idx = onboardingData.tiposIngreso.findIndex(x => x.nombre === itemToRemove.nombre && x.icono === itemToRemove.icono);
  if (idx >= 0) onboardingData.tiposIngreso.splice(idx, 1);
  if (window._renderStep2Body) window._renderStep2Body();
};

window.nextStep2nuevo = nextStep2nuevo;

window.toggleGastoFijoSugerido = function(btnOrNombre, iconoOpt) {
  let nombre, icono, frecuencia = 'mensual', montoVariable = false;
  if (typeof btnOrNombre === 'string') {
    nombre = btnOrNombre;
    icono = iconoOpt || 'receipt';
  } else {
    try {
      const meta = JSON.parse(btnOrNombre.getAttribute('data-item'));
      nombre = meta.nombre;
      icono = meta.icono;
      frecuencia = meta.frecuencia || 'mensual';
      montoVariable = !!meta.montoVariable;
    } catch { return; }
  }
  const idx = onboardingData.gastosFijos.findIndex(f => f.nombre === nombre);
  if (idx >= 0) {
    onboardingData.gastosFijos.splice(idx, 1);
  } else {
    onboardingData.gastosFijos.push({
      nombre, icono,
      monto: null,
      monto_variable: montoVariable,
      frecuencia,
      dia_pago: null,
      dia_semana: null,
      proximo_pago: null,
    });
  }
  if (window._renderStep3Body) window._renderStep3Body();
};

window.removeGastoFijo = function(idx) {
  onboardingData.gastosFijos.splice(idx, 1);
  if (window._renderStep3Body) window._renderStep3Body();
};

window.setFijoMontoVariable = function(idx, isVariable) {
  const f = onboardingData.gastosFijos[idx];
  if (!f) return;
  f.monto_variable = !!isVariable;
  if (isVariable) f.monto = null;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.updateGastoFijo = function(idx) {
  const f = onboardingData.gastosFijos[idx];
  if (!f) return;
  const prevFreq = f.frecuencia;

  f.frecuencia = document.getElementById(`gf-freq-${idx}`)?.value || 'mensual';

  if (!f.monto_variable) {
    const monto = parseFloat(document.getElementById(`gf-monto-${idx}`)?.value);
    f.monto = Number.isFinite(monto) ? monto : null;
  } else {
    f.monto = null;
  }

  if (f.frecuencia === 'semanal') {
    const diaSemana = parseInt(document.getElementById(`gf-dia-${idx}`)?.value, 10);
    f.dia_semana = Number.isInteger(diaSemana) ? diaSemana : null;
    f.dia_pago = null;
    f.proximo_pago = null;
  } else {
    const prox = document.getElementById(`gf-prox-${idx}`)?.value || null;
    f.proximo_pago = prox || null;
    if (prox) {
      const dia = parseInt(prox.split('-')[2], 10);
      f.dia_pago = Number.isInteger(dia) ? dia : null;
    }
    f.dia_semana = null;
  }

  const prevSemanal = prevFreq === 'semanal';
  const newSemanal  = f.frecuencia === 'semanal';
  if (prevSemanal !== newSemanal && window._renderStep3Body) window._renderStep3Body();
};

window.showFijoCustomForm = function() {
  window._showFijoCustomForm = true;
  window._fijoCustomNombre = '';
  window._fijoCustomIcono = 'smile';
  window._showFijoIconPanel = false;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.toggleFijoIconPanel = function() {
  window._showFijoIconPanel = !window._showFijoIconPanel;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.selectFijoIcono = function(icono) {
  window._fijoCustomIcono = icono;
  window._showFijoIconPanel = false;
  if (window._renderStep3Body) window._renderStep3Body();
};

window.addGastoFijoCustom = function() {
  const nombre = (window._fijoCustomNombre || document.getElementById('fijo-custom-nombre')?.value || '').trim();
  if (!nombre) { showSnackbar('Escribe el nombre del gasto fijo', 'error'); return; }
  onboardingData.gastosFijos.push({
    nombre,
    icono: window._fijoCustomIcono || 'smile',
    monto: null,
    monto_variable: false,
    frecuencia: 'mensual',
    dia_pago: null,
    dia_semana: null,
    proximo_pago: null,
  });
  window._showFijoCustomForm = false;
  window._fijoCustomNombre = '';
  if (window._renderStep3Body) window._renderStep3Body();
};

window.nextStep3nuevo = nextStep3nuevo;

window.mostrarInstituciones = function() {
  window.filtrarBancos(document.getElementById('banco-search')?.value || '');
};

window.filtrarBancos = function(q) {
  const resultadosDiv = document.getElementById('banco-resultados');
  const qRaw = (q || '').trim();
  const qNorm = qRaw.toLowerCase();

  document.getElementById('c-nombre').style.display = 'none';
  document.getElementById('cuenta-saldo-wrap').style.display = 'none';
  document.getElementById('form-cuenta-actions').style.display = 'none';

  const filtered = qNorm
    ? INSTITUCIONES.filter(inst => inst.nombre.toLowerCase().includes(qNorm))
    : INSTITUCIONES;

  const ordered = ordenarInstitucionesConEfectivoPrimero(filtered);
  window._bancosFiltered = ordered;

  resultadosDiv.style.display = 'block';

  let html = ordered.map((inst, idx) => `
    <div class="banco-result-item" onclick="seleccionarBancoIdx(${idx})">
      <i data-lucide="${inst.icono}" style="width:16px;height:16px;color:var(--text-secondary);pointer-events:none"></i>
      <span>${inst.nombre}</span>
    </div>`).join('');

  if (qRaw) {
    html += `<div class="banco-result-item accent" onclick="seleccionarBancoCustom()">
      <i data-lucide="plus" style="width:16px;height:16px;pointer-events:none"></i>
      <span>+ Crear cuenta "${qRaw}"</span>
    </div>`;
  }

  resultadosDiv.innerHTML = html;
  lucide.createIcons();
};

window.seleccionarBancoIdx = function(idx) {
  const inst = window._bancosFiltered[idx];
  if (!inst) return;
  window._selectedBancoTipo = inst.tipo;
  window._selectedBancoIcono = inst.icono;
  document.getElementById('cuenta-search-row').style.display = 'none';
  document.getElementById('banco-search').value = '';
  _abrirFormCuenta({ nombre: inst.nombre, readOnly: true, focusSaldo: true });
};

window.seleccionarBancoCustom = function() {
  const q = document.getElementById('banco-search')?.value.trim() || '';
  window._selectedBancoTipo = 'otro';
  window._selectedBancoIcono = 'credit-card';
  document.getElementById('cuenta-search-row').style.display = 'none';
  document.getElementById('banco-search').value = '';
  _abrirFormCuenta({ nombre: q, readOnly: false });
};

window.cancelarFormCuenta = function() {
  window._selectedBancoTipo = null;
  window._selectedBancoIcono = null;
  document.getElementById('form-cuenta-banco').style.display = 'none';
  document.getElementById('btn-add-otra-cuenta').style.display = '';
};

window.mostrarBuscadorCuenta = function() {
  document.getElementById('btn-add-otra-cuenta').style.display = 'none';
  document.getElementById('form-cuenta-banco').style.display = 'block';
  document.getElementById('cuenta-search-row').style.display = 'block';
  document.getElementById('banco-resultados').style.display = 'none';
  document.getElementById('c-nombre').style.display = 'none';
  document.getElementById('cuenta-saldo-wrap').style.display = 'none';
  document.getElementById('form-cuenta-actions').style.display = 'none';
  requestAnimationFrame(() => document.getElementById('banco-search')?.focus());
};

window.addCuenta       = addCuenta;
window.removeCuenta    = removeCuenta;
window.nextStep4       = nextStep4;

window.openDeudaOnboardingForm = function() {
  window._onboardingTipoDeuda = null;
  renderStep5Body(true);
};

window.selectTipoDeudaOnboarding = function(tipo) {
  window._onboardingTipoDeuda = tipo;
  renderStep5Body(true);
};

window.renderCamposDeudaOnboarding = renderCamposDeudaOnboarding;
window.addDeuda        = addDeuda;
window.removeDeuda     = removeDeuda;
window.nextStep5       = nextStep5;


window.toggleMetaIconPanel = function() {
  window._showMetaIconPanel = !window._showMetaIconPanel;
  renderStep6Body(true);
};

window.selectIconoMeta = function(icono) {
  window._metaIcono = icono;
  window._showMetaIconPanel = false;
  renderStep6Body(true);
};

window.addMeta         = addMeta;
window.removeMeta      = removeMeta;
window.nextStep6       = nextStep6;
window.finishOnboarding = finishOnboarding;
