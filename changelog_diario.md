# Changelog Diario — JM Finance
**Fecha:** 2026-04-28
**Archivos modificados:** `js/metas.js`, `js/onboarding.js`
**Sesión:** Cirugía Módulo Metas — XSS, Colisión de Variables, Matemáticas y Payload DB

---

## PASO 1 — Seguridad XSS (C1, C2, C3)

### Fix 1 — `escapeHtml` añadida a `metas.js`
El módulo no tenía la función. Definida al inicio del archivo antes de cualquier uso.

### Fix 2 — `escapeHtml` aplicado en todos los puntos de interpolación de `metas.js`

| Línea | Variable | Contexto |
|---|---|---|
| 67 | `m.nombre` | Card header en `loadMetas` |
| 68 | `cuentasPorId[m.cuenta_id]` | Subtítulo de cuenta en card |
| 118 | `meta.nombre` | `<option>` en select de abonos |
| 264 | `c.nombre` | `<option>` en select de cuentas del modal |
| 301 | `draft.nombre` | Atributo `value` del input de edición |

### Fix 3 — `escapeHtml` aplicado en `onboarding.js`

| Línea | Variable | Contexto |
|---|---|---|
| 1162 | `m.nombre` | Lista de metas en Step 6 |
| 1166 | `m.cuenta_nombre` | Detalle de cuenta en Step 6 |
| 1467 | `m.nombre` | Resumen final Step 7 |

---

## PASO 2 — Colisión de Variables Globales (C4, C5)

### Fix 4 — `window.toggleMetaIconPanel` renombrado en `onboarding.js`
- `window.toggleMetaIconPanel` → `window.toggleOnboardingMetaIconPanel`
- `onclick="toggleMetaIconPanel()"` en template → `onclick="toggleOnboardingMetaIconPanel()"`

### Fix 5 — `window.selectIconoMeta` renombrado en `onboarding.js`
- `window.selectIconoMeta` → `window.selectOnboardingMetaIcono`
- `onclick="selectIconoMeta(...)"` en template → `onclick="selectOnboardingMetaIcono(...)"`

### Fix 6 — `window._metaIcono` aislado como `window._onbMetaIcono` en `onboarding.js`
Todos los accesos a `window._metaIcono` en `onboarding.js` reemplazados con `replace_all` a `window._onbMetaIcono`. Las referencias en `metas.js` permanecen intactas (son la versión de la app principal).

---

## PASO 3 — Corrección Matemática (A2, A4)

### Fix 7 — División por cero en barra de progreso (`metas.js`)
```javascript
// ANTES — NaN% si monto_objetivo = 0
const pct = Math.min(Math.round((m.monto_actual / m.monto_objetivo) * 100), 100);
// DESPUES
const pct = m.monto_objetivo > 0 ? Math.min(Math.round(...), 100) : 0;
```

### Fix 8 — Fórmula de cuota sugerida corregida (`metas.js`)
`calcularAhorroMetaDash` ahora calcula sobre el saldo restante:
```javascript
const montoActual = Number(window._metaDraft?.monto_actual || 0);
const restante    = Math.max(monto - montoActual, 0);
const cuota       = restante / periodos;
```
Si `restante <= 0` muestra "Ya alcanzaste el objetivo." en lugar de una cuota de cero.

### Fix 9 — `monto_actual` incluido en el draft al editar (`metas.js`)
El SELECT de edición ahora incluye `monto_actual, fecha_limite, frecuencia_ahorro`. El draft los recibe para que la calculadora pueda operar con el avance real.

### Fix 10 — Validación de monto en `addMeta` (`onboarding.js`)
```javascript
// ANTES
if (!nombre || !monto_objetivo)
// DESPUES
if (!nombre || !monto_objetivo || monto_objetivo <= 0 || !isFinite(monto_objetivo))
```

---

## PASO 4 — Datos Fantasma y Payload DB (A1, A3, C7)

### Fix 11 — BoxIcon `bx bx-smile` eliminado del picker (`metas.js`)
```javascript
// ANTES — icono roto cuando icono === 'target'
const iconoBtn = (icono === 'target' || !icono)
  ? `<i class="bx bx-smile" ...></i>`
  : `<i data-lucide="${icono}" ...></i>`;
// DESPUES — Lucide siempre
const iconoBtn = `<i data-lucide="${icono || 'target'}" style="width:20px;height:20px;stroke-width:1.75"></i>`;
```

### Fix 12 — `fecha_limite` y `frecuencia_ahorro` incluidos en UPDATE e INSERT (`metas.js`)
Ambos campos ahora se leen del DOM y se envían a Supabase en `guardarMeta()`.

### Fix 13 — `fecha_limite` y `frecuencia_ahorro` incluidos en `finishOnboarding` (`onboarding.js`)
```javascript
fecha_limite: m.fecha_limite || null,
frecuencia_ahorro: m.frecuencia_ahorro || null,
```

### Fix 14 — INSERT de metas con captura de error en `finishOnboarding` (`onboarding.js`)
```javascript
// ANTES — fallo silencioso
await db.from('metas_ahorro').insert(metas);
// DESPUES — error detenido con throw
const { error: errMetas } = await db.from('metas_ahorro').insert(metas);
if (errMetas) throw errMetas;
```

---

**Sin cambios de estilos. Sin refactoring de estado. Historial anterior intacto.**

---

# Changelog Diario — JM Finance
**Fecha:** 2026-04-28
**Archivos modificados:** `js/deudas.js`, `js/onboarding.js`
**Base de datos:** Supabase — migración `add_tasa_interes_activa_deudas`
**Sesión:** Cirugía Módulo Deudas — Seguridad, BD y Estabilidad (Prioridades 1-5)

---

## PASO 1 — Base de Datos: Migración aplicada

**Estado: COMPLETADO en Supabase (proyecto rzanhkfmwvbngbpjefec)**

```sql
ALTER TABLE deudas ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;
ALTER TABLE deudas ADD COLUMN IF NOT EXISTS tasa_interes_anual NUMERIC DEFAULT 0;
```

---

## PASO 2 — Seguridad XSS y Delegación de eventos

### Fix 1 — Función `escapeHtml` añadida a `deudas.js`
El módulo no tenía la función. Ahora está disponible para todos los puntos de interpolación.

### Fix 2 — Botones "Registrar pago" migrados de `onclick` a `data-*`
- **Antes:** `onclick="openPagarDeuda('${d.id}', '${d.acreedor}', ...)"` — acreedor inyectado en JS inline
- **Después:** `data-action="pagar-deuda"` + `data-acreedor="${escapeHtml(d.acreedor)}"` + delegación vía `pageDeudas.onclick`

### Fix 3 — `escapeHtml` aplicado en todos los puntos de interpolación

| Archivo | Variable | Ubicación |
|---|---|---|
| `deudas.js` | `d.acreedor` | Card header (`deuda-acreedor`) |
| `deudas.js` | `d.tipo_pago / d.tipo_deuda` | Badge clase y texto |
| `deudas.js` | `deuda.acreedor` | Value del input en edición |
| `deudas.js` | `c.nombre` | `<option>` en select de cuentas |
| `deudas.js` | `acreedor` | Título de modal "Pagar:" |
| `deudas.js` | `acreedor` | Título de modal "Pagos programados:" |
| `onboarding.js` | `d.acreedor` | Lista de deudas en Step 5 |
| `onboarding.js` | `d.acreedor` | Resumen final (Step 7) |

### Fix 4 — `abrirCargarPagosDesdeEdicion` sin acreedor en `onclick`
La función ya no recibe `acreedor` desde el HTML. Lo lee de `#ed-acreedor` antes de cerrar el modal.

---

## PASO 3 — Estabilidad y Matemáticas

### Fix 5 — Payload de deudas en onboarding con campos explícitos
```javascript
activa: true,
tasa_interes_anual: 0,
```
Campos añadidos al objeto de inserción en `finishOnboarding`.

### Fix 6 — `guardarPagoDeuda` con control de errores en cada escritura
Las tres operaciones DB verifican el error devuelto. Si alguna falla, snackbar de error + return sin tocar la UI.

### Fix 7 — División por cero en barra de progreso
```javascript
// ANTES — produce NaN si monto_inicial = 0
const pct = Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100);
// DESPUES
const pct = d.monto_inicial > 0 ? Math.round(...) : 0;
```

### Fix 8 — Bloqueo de montos negativos y NaN
- `guardarNuevaDeuda`: `!monto || monto <= 0 || !isFinite(monto)`
- `addDeuda` (onboarding): misma guarda
- `agregarFilaPago`: valida `parseInt` y `parseFloat` antes del push; rechaza NaN y valores <= 0

---

## PASO 4 — UI: Reemplazo de BoxIcons por Lucide

### Fix 9 — `chart-line` -> `line-chart` en `deudas.js`

### Fix 10 — 7 iconos de `GASTOS_DIARIOS_CATALOGO` migrados

| BoxIcon | Lucide |
|---|---|
| `bx bx-restaurant` | `utensils` |
| `bx bx-car` | `car` |
| `bx bx-home-alt` | `home` |
| `bx bx-party` | `party-popper` |
| `bx bx-heart` | `heart` |
| `bx bx-book` | `book-open` |
| `bx bx-grid-alt` | `grid-2x2` |

Renderizado cambiado de `class="${grupo.icono}"` a `data-lucide="${grupo.icono}"`.

### Fix 11 — Chevrones del acordeón migrados
`bx-chevron-up/down` -> `chevron-up/chevron-down` (Lucide)

### Fix 12 — Plus y Send migrados
- `bx bx-plus` (2 lugares) -> `data-lucide="plus"`
- `bx bx-send` (catch block) -> `data-lucide="send"` + `renderLucideIcons()`

### Fix 13 — Fallback de icono en `guardarGdCustom`
`'bx bx-grid-alt'` -> `'grid-2x2'`

---

**Sin cambios de estilos. Sin refactoring de estado. Historial anterior intacto.**

---

# Changelog Diario — JM Finance
**Fecha:** 2026-04-28
**Archivos modificados:** `js/onboarding.js`
**Sesión:** Corrección de UI Rota y Selector Faltante — XSS Delegation + Tipo Selector

---

## Fix 1 — XSS: Delegación de eventos en cards de ingresos (Step 2)

**Problema:** La función `card()` inyectaba `item.nombre` directamente en atributos `onclick` usando `enc = item.nombre.replace(/'/g,"\\'")`. Un nombre con comillas dobles o secuencias especiales podía escapar del contexto JS.

**Solución:** Se migró a `data-*` + delegación de eventos:

- `card()`: eliminado `const enc = item.nombre.replace(...)`. Los dos botones ahora usan:
  - Botón principal: `class="ingreso-toggle-btn" data-nombre="${escapeHtml(item.nombre)}" data-icono="${item.icono}"`
  - Botón expansión: `class="ingreso-expansion-btn" data-nombre="${escapeHtml(item.nombre)}"`
- El listener en `#onboarding-body` ya incluía los handlers para `.ingreso-toggle-btn` y `.ingreso-expansion-btn` (agregados previamente en esta sesión).

## Fix 2 — UI: Selector de tipo de cuenta en Step 4 (formulario mini)

**Problema:** Al crear una cuenta custom (`seleccionarBancoCustom`), el tipo se hardcodeaba a `'otro'` (tipo eliminado de la taxonomía). El usuario no tenía forma de especificar si la cuenta es débito, crédito o ahorro.

**Solución:**
- Añadido `<select id="c-tipo">` con opciones `debito`, `credito`, `ahorro` (sin efectivo) al mini-form de cuentas.
- `_abrirFormCuenta()`: muestra el select solo cuando `!sinCancelar && !readOnly` (cuenta custom). En efectivo y en institución preseleccionada permanece oculto.
- `addCuenta()`: lee `window._selectedBancoTipo || document.getElementById('c-tipo')?.value || 'debito'`. El icono se deriva de `TIPO_ICONOS[tipo]` cuando no hay institución preseleccionada.
- `seleccionarBancoCustom()`: eliminadas líneas `window._selectedBancoTipo = 'otro'` y `window._selectedBancoIcono = 'credit-card'`. Ambos se resuelven en `addCuenta()`.
- `cancelarFormCuenta()`: oculta `#cuenta-tipo-wrap` al cancelar.

---

# Changelog Diario — JM Finance
**Fecha:** 2026-04-28
**Archivos modificados:** `js/cuentas.js`, `js/onboarding.js`
**Base de datos:** Supabase — migración `cuentas_taxonomia_financiera`
**Sesión:** Cirugía Módulo Cuentas — Seguridad, Estabilidad y Taxonomía Financiera

---

## PASO 1 — Base de Datos: Migración aplicada exitosamente

**Estado: COMPLETADO en Supabase (proyecto rzanhkfmwvbngbpjefec)**

```sql
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS es_disponible BOOLEAN DEFAULT true;
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS es_pasivo     BOOLEAN DEFAULT false;
UPDATE cuentas SET es_disponible = false, es_pasivo = true  WHERE tipo = 'credito';
UPDATE cuentas SET es_disponible = false, es_pasivo = false WHERE tipo = 'ahorro';
```

Las cuentas existentes de efectivo y débito mantienen `es_disponible = true` y `es_pasivo = false` por el DEFAULT, sin necesidad de migración adicional.

---

## PASO 2 — Seguridad y Estabilidad

### Fix 1 — XSS: `cuentas.js`
- `cuenta.nombre` y `cuenta.tipoLabel` en la lista renderizada → `escapeHtml()`
- `cuenta.nombre` en el `value` del input de edición → `escapeHtml()`
- Se agregó función `escapeHtml()` al inicio del archivo

### Fix 2 — XSS: `onboarding.js` (3 ubicaciones)
- Step 4 lista — `c.nombre` → `escapeHtml(c.nombre)`
- Step 6 selector de cuentas para metas — `<option value="${c.nombre}">` → `escapeHtml(c.nombre)` en value y texto
- Step 7 resumen — `<span>${c.nombre}</span>` → `escapeHtml(c.nombre)`

### Fix 3 — Crash: `window._regNombre`
Se agregó inicialización explícita en el bloque de estado global de `onboarding.js`:
```javascript
if (typeof window._regNombre === 'undefined') window._regNombre = '';
```
La función `finishOnboarding` ya tenía fallback `|| (user.email ? ... : 'Usuario')` — ambas capas son ahora explícitas y documentadas.

### Fix 4 — Protección de Efectivo
**`cuentas.js` — `eliminarCuenta()`:** Lee el tipo de cuenta antes de proceder. Si es `'efectivo'`, muestra snackbar de bloqueo y detiene la ejecución.
**`onboarding.js` — `removeCuenta()`:** Valida índice (guard clause) y bloquea eliminación si el tipo es `'efectivo'`.

### Fix 5 — Validaciones matemáticas en `addCuenta()` y `guardarNuevaCuenta()`
- Saldo negativo → snackbar de error y return
- Saldo mayor a `$999,999,999` → snackbar de error y return
- Nombre vacío o mayor a 100 caracteres → snackbar de error
- Tipo de cuenta validado contra lista permitida `['efectivo','debito','credito','ahorro']`
- Atributo `max="999999999"` añadido al input HTML de saldo

### Fix 6 — CSS bug: `btn-add-otra-cuenta`
Antes: `style="${efectivoAgregado ? '' : 'display:none'}margin-top:4px"` → generaba `display:nonemargin-top:4px` (inválido)
Después: `style="${efectivoAgregado ? 'margin-top:4px' : 'display:none;margin-top:4px'}"` (válido)

---

## PASO 3 — Taxonomía Financiera

### Nueva clasificación de cuentas (4 tipos)

| Tipo | Label UI | es_disponible | es_pasivo | Descripción |
|------|----------|:---:|:---:|---|
| `efectivo` | Efectivo | true | false | Dinero líquido en mano |
| `debito` | Débito / Nómina | true | false | Cuenta bancaria activa |
| `credito` | Tarjeta de Crédito | false | true | Pasivo circulante |
| `ahorro` | Ahorro / Inversión | false | false | Fondos comprometidos (CETES, etc.) |

### Archivos actualizados
- `cuentas.js` — `getCuentaIcon()`, `getCuentaTipos()`, `getEsDisponiblePasivo()` (nuevo helper), SELECT de `loadCuentas` y `openEditarCuenta`, payloads de `guardarNuevaCuenta` y `guardarEdicionCuenta`
- `onboarding.js` — `TIPO_LABELS` en `renderStep4Body`, lista `INSTITUCIONES`, payload de `finishOnboarding`

### Remapeo de INSTITUCIONES

| Institución | Tipo anterior | Tipo nuevo | Razón |
|---|---|---|---|
| Mercado Pago | `negocio` | `debito` | Billetera digital con saldo propio |
| PayPal | `negocio` | `debito` | Billetera digital con saldo propio |
| Stori | `debito` | `credito` | Es una tarjeta de crédito en México |
| Vexi | `debito` | `credito` | Es una tarjeta de crédito en México |
| Nu | `debito` | `credito` | Producto principal es tarjeta de crédito |
| Bitso | `otro` | `ahorro` | Plataforma de inversión/cripto |
| Otro digital | `otro` | `debito` | Reclasificado a tipo base |

---

## Verificación final

```
Grep "tipo: 'negocio'|tipo: 'otro'" en js/*.js → 0 coincidencias
Grep "escapeHtml" en cuentas.js → 3 puntos de aplicación
XSS en onboarding.js (cuentas) → 3 puntos cubiertos
```

**Sin cambios de estilos generales. Sin refactoring de estado. Historial anterior intacto.**

---

# Changelog Diario — JM Finance
**Fecha:** 2026-04-27
**Archivos modificados:** `js/gastos.js`, `js/onboarding.js`
**Sesión:** Correcciones críticas post-auditoría

---

## Fix 1 — Seguridad: Protección contra XSS
**Severidad original:** CRITICO
**Archivos:** `js/gastos.js`, `js/onboarding.js`

### Problema
Los valores provenientes de la base de datos (`g.descripcion`, `g.categorias.nombre`) y del input del usuario (`item.nombre`) se insertaban directamente en cadenas de template HTML sin escapar. Un atacante podría haber inyectado etiquetas `<script>` o atributos de evento maliciosos.

### Solución
Se agregó la función `escapeHtml(str)` al inicio de cada archivo (antes de cualquier uso). La función convierte los cinco caracteres HTML peligrosos (`& < > " '`) a sus entidades seguras.

### Puntos de aplicación
- `gastos.js:292` — `g.descripcion` en la lista de gastos fijos
- `gastos.js:763` — `g.descripcion` en la lista de gastos variables
- `gastos.js:764` — `g.categorias?.nombre` en el detalle de gastos variables
- `onboarding.js:276` — `item.nombre` en las cards de tipos de ingreso

---

## Fix 2 — Estabilidad: Crash de sesión en `finishOnboarding`
**Severidad original:** CRITICO
**Archivo:** `js/onboarding.js`

### Problema
La desestructuración `const { data: { user } } = await db.auth.getUser()` seguida de `user.id` lanzaba una excepción no manejada si la sesión había expirado o si Supabase devolvía un error. El proceso de guardado quedaba roto sin aviso al usuario.

### Solución
Se agregó validación explícita antes de usar `user.id`:
```javascript
if (!user?.id || authError) {
  showSnackbar('Sesión expirada. Vuelve a iniciar sesión.', 'error');
  btn.textContent = 'Finalizar';
  btn.disabled = false;
  return;
}
```
Si la sesión no es válida, se informa al usuario y se restaura el botón.

---

## Fix 3 — Lógica Core: Regla 4 Cuadrantes documentada y verificada
**Severidad original:** ALTA
**Archivos:** `js/gastos.js`, `js/onboarding.js`

### Problema reportado
El agente auditor reportó un mapeo invertido de `monto_variable` y `es_aproximado` entre ambos archivos.

### Hallazgo real
Tras revisión directa del código fuente, **el mapeo ya era correcto y consistente** en ambos archivos. El reporte del agente confundió dos variables distintas (`mv` de lectura de BD y `esFlex` de guardado) dentro de funciones separadas.

### Acción tomada
Se agregó un bloque de comentario explícito en los tres puntos del código donde se calcula el mapeo (`setFijoTipoMonto` en onboarding.js y `guardarNuevoGastoFijo` / `guardarEdicionGastoFijo` en gastos.js), documentando la regla de los 4 cuadrantes para prevenir regresiones:

| Tipo UI       | monto_variable | es_aproximado |
|---------------|----------------|---------------|
| exacto        | false          | false         |
| monto-variable| false          | true          |
| fecha-flexible| true           | false         |
| aproximado    | true           | true          |

---

## Fix 4 — Bug UI: Campo fantasma `d-quincena`
**Severidad original:** MEDIA
**Archivo:** `js/onboarding.js`

### Problema
En `addDeuda()`, el flujo `quincenal` intentaba leer `document.getElementById('d-quincena')`, pero `renderCamposDeudaOnboarding()` para ese caso vaciaba el contenedor (`campos.innerHTML = ''`) sin crear ningún elemento con ese ID. El valor siempre era `NaN`, lo que activaba el snackbar de error y bloqueaba el guardado de la deuda quincenal.

### Solución
Se reemplazó el `campos.innerHTML = ''` del caso `quincenal` por el select faltante:

```html
<select class="form-select" id="d-quincena" style="width:100%">
  <option value="1">Primera quincena (día 15)</option>
  <option value="2">Segunda quincena (último día)</option>
</select>
```

El hint también fue actualizado para ser informativo sobre la selección.

---

## Resumen de cambios por archivo

| Archivo | Líneas añadidas | Líneas modificadas |
|---------|----------------|-------------------|
| `js/gastos.js` | 9 (función `escapeHtml` + comentarios) | 3 (aplicar escape) |
| `js/onboarding.js` | 22 (función `escapeHtml`, validación sesión, select quincena, comentarios) | 2 (aplicar escape) |

**Sin cambios de estilos, sin refactoring de estado.**

---

---

# Changelog Diario — JM Finance
**Fecha:** 2026-04-28
**Archivos modificados:** `js/gastos.js`, `js/onboarding.js`, `js/app.js`, `js/balance.js`, `js/ingresos.js`
**Base de datos:** Supabase — proyecto `rzanhkfmwvbngbpjefec` (Contabilidad Personal)
**Sesión:** Refactorización Semántica Integral — Dictamen Auditor Financiero y Contable

---

## PASO 1 — Base de Datos: Migración aplicada exitosamente

**Estado: COMPLETADO en Supabase**

Se aplicó la migración `rename_gastos_fijos_semantic_fields` sobre la tabla `gastos_fijos`:

```sql
-- 1. Renombrar columna (corrección semántica)
ALTER TABLE gastos_fijos RENAME COLUMN monto_variable TO fecha_flexible;

-- 2. Nueva columna para distinguir si el monto es estimado
ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS monto_estimado BOOLEAN DEFAULT false;
```

### Hallazgo durante la migración
Al inspeccionar la estructura real de la tabla en Supabase, se descubrió que `es_aproximado` **nunca existió en la base de datos**. El código lo enviaba en los payloads, pero Supabase lo ignoraba silenciosamente. Lo mismo ocurre con `ultima_fecha_pago`. El fallback legacy en el código (que excluye estas columnas en un segundo intento) existía precisamente por esta razón.

**Consecuencia:** `monto_estimado` se crea con valor `false` para todos los registros existentes (correcto: ningún gasto fijo había sido marcado como estimado en la BD).

---

## PASO 2 — Refactorización de Código: Reemplazo Global

**Estado: COMPLETADO — 0 referencias antiguas en el codebase**

### Regla de sustitución aplicada

| Campo antiguo | Campo nuevo | Semántica correcta |
|---|---|---|
| `monto_variable` | `fecha_flexible` | Indica si la **fecha de pago** es incierta |
| `es_aproximado` | `monto_estimado` | Indica si el **monto** es una estimación |

### Regla 4 Cuadrantes actualizada en documentación de código

| Tipo UI | `fecha_flexible` | `monto_estimado` |
|---|---|---|
| exacto | false | false |
| monto-variable | false | true |
| fecha-flexible | true | false |
| aproximado | true | true |

### Regla de Oro del Monto implementada

En `finishOnboarding` (payload de inserción a Supabase):
```javascript
// ANTES (incorrecto):
monto: f.monto_variable ? null : (f.monto ?? null)
// Problema: si fecha_flexible=true pero el monto ES conocido, lo borraba

// DESPUÉS (correcto):
monto: f.monto_estimado && !Number.isFinite(f.monto) ? null : (f.monto ?? null)
// El monto solo es null si el monto ES estimado Y no hay valor capturado
```

### Archivos y puntos modificados

| Archivo | Cambios |
|---|---|
| `js/gastos.js` | `openEditarGastoFijo` (lectura DB), payloads de `guardarEdicionGastoFijo` y `guardarNuevoGastoFijo`, destructuring legacy en ambas funciones, comentarios 4 cuadrantes |
| `js/onboarding.js` | `renderCamposOnboarding3` (lectura estado), `nextStep3nuevo` (validación), resumen paso 6, `finishOnboarding` (payload + legacy + Regla de Oro), push catálogo, push custom, `setFijoTipoMonto`, `updateGastoFijo` (2 referencias prevType) |
| `js/app.js` | Comentario SQL histórico, renderizado de pagos pendientes |
| `js/balance.js` | Cálculo `esVariable` para pendientes, campo en objeto pendiente |
| `js/ingresos.js` | Renderizado de monto en lista de pagos |

### Verificación final
```
Grep "monto_variable|es_aproximado" en js/*.js → 0 coincidencias
```
