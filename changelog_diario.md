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
