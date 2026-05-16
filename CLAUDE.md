# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Serve files over HTTP — opening `index.html` directly fails due to ES module CORS restrictions.

```bash
python3 -m http.server 8080
# or VS Code Live Server → right-click index.html → Open with Live Server
```

No tests, no linting, no package.json. All dependencies are loaded via CDN in `index.html`.

## Architecture

**Stack:** Vanilla JS (ES modules) + Supabase (auth + Postgres) + CSS custom properties. No framework, no bundler. PWA installable from the browser.

**CDN dependencies loaded in `index.html`:**
- `@supabase/supabase-js@2.45.4`
- `chart.js@4.4.4`
- `jspdf@2.5.1` + `jspdf-autotable@3.8.2`
- `js/lucide.min.js` (bundled locally, not CDN)
- `Plus Jakarta Sans` (Google Fonts)
- BoxIcons CSS (loaded but **must not** be used in JS templates — Lucide only)

**Boot sequence** (`index.html` → `js/app.js`):
1. `app.js` checks Supabase auth state → routes to `renderAuth()`, `renderOnboarding()`, or `renderApp()`
2. `renderApp()` builds the shell (bottom nav, page divs, FAB) and loads dashboard data

**Page model:** All pages (`#page-dashboard`, `#page-gastos`, etc.) exist simultaneously in the DOM. `router.js:showPage()` toggles `.active` class and calls the page's `load*()` function on each activation.

**Module responsibilities:**

| File | Role |
|---|---|
| `app.js` | Boot, auth gate, dashboard, shared helpers, category selector state |
| `router.js` | Page switching, bottom nav render, swipe navigation |
| `auth.js` | Login/register screens, Supabase auth events |
| `onboarding.js` | 7-step wizard; bulk-inserts on finish |
| `balance.js` | Pure calculation engine — no DOM. Balance formulas, date utils, amortization |
| `distribucion.js` | Zero-Based Budgeting engine (RN-07) — no DOM. Distributes an income amount across all commitments |
| `cuentas.js` | Account CRUD + `calcularCuentasConSaldo` |
| `deudas.js` | Debt CRUD + payment registration + pagos programados |
| `metas.js` | Savings goal CRUD + abonar flow |
| `gastos.js` | Variable and fixed expense CRUD; also manages `gastos_diferidos` (MSI) |
| `ingresos.js` | Income registration; calls `distribuirIngreso()` after each income |
| `presupuestos.js` | Category budget limits with spending progress |
| `graficas.js` | Chart.js pie chart for monthly spending |
| `export.js` | CSV + PDF export |

**Shared helpers exported from `app.js`** (imported by all modules):
- `formatMXN(amount)` — formats as MXN currency
- `showSnackbar(msg, type)` — toast notification
- `openModal(title, bodyHtml)` / `closeModal()`
- `openActionSheet(title, actions)` — bottom sheet with buttons
- `renderLucideIcons()` — calls `lucide.createIcons()`
- `renderEmojiOrIcon(value, fallback, size)` — renders either a Lucide icon name or an emoji literal
- `loadDashboard()` — refreshes the dashboard (called after any mutation)
- `actualizarBotonCategoriaSelector()`, `setCatState()`, `getCurrentCatId()` — shared category picker state

## Supabase schema (key tables)

```
usuarios              id, nombre, onboarding_completo
cuentas               id, nombre, tipo, saldo_inicial, es_disponible, es_pasivo, activa,
                      fecha_corte, fecha_limite_pago, limite_credito, usuario_id
ingresos              id, monto, fecha, descripcion, categoria_id, cuenta_id, usuario_id
ingresos_programados  id, frecuencia, dia_pago, dia_semana, monto_estimado, activo, usuario_id
gastos                id, monto, fecha, descripcion, categoria_id, cuenta_id,
                      es_ahorro, meta_id, usuario_id
gastos_fijos          id, descripcion, monto, monto_variable, frecuencia, dia_pago, dia_semana,
                      fecha_flexible, proximo_pago, ultimo_pago, activo, usuario_id
gastos_diferidos      id, descripcion, monto_total, num_meses, monto_cuota, tasa_mensual,
                      fecha_primer_cargo, cuotas_pagadas, cuenta_id, activo, usuario_id
categorias            id, nombre, emoji, tipo ('ingreso'|'gasto'), es_default, usuario_id
deudas                id, acreedor, monto_inicial, monto_actual, tipo_deuda, tipo_pago,
                      monto_pago, dia_pago, dia_semana, activa, tasa_interes_anual,
                      num_pagos_restantes, usuario_id
pagos_deuda           id, deuda_id, monto, monto_capital, monto_interes, monto_iva,
                      fecha, cuenta_id, nota, usuario_id
pagos_programados     id, deuda_id, numero_pago, fecha_vencimiento, monto_esperado,
                      pagado, usuario_id
metas_ahorro          id, nombre, emoji, monto_objetivo, monto_actual, cuenta_id, activa,
                      fecha_limite, frecuencia_ahorro, usuario_id
presupuestos          id, categoria_id, monto_limite, periodo ('YYYY-MM'), usuario_id
transferencias        id, cuenta_origen_id, cuenta_destino_id, monto, fecha, usuario_id
```

**Column naming gotcha:** `gastos_fijos` uses `activo` (not `activa`); all other tables use `activa`.

**Pending SQL to apply** (commented in `app.js`, not yet in Supabase):
```sql
-- Allow 'unico' in tipo_pago
ALTER TABLE deudas DROP CONSTRAINT IF EXISTS deudas_tipo_pago_check;
ALTER TABLE deudas ADD CONSTRAINT deudas_tipo_pago_check
  CHECK (tipo_pago = ANY (ARRAY['semanal','quincenal','mensual','libre','unico']));

-- Extended gastos_fijos schema
ALTER TABLE gastos_fijos ALTER COLUMN monto DROP NOT NULL;
ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS monto_variable BOOLEAN DEFAULT false;
ALTER TABLE gastos_fijos ADD COLUMN IF NOT EXISTS proximo_pago DATE;
ALTER TABLE gastos_fijos DROP CONSTRAINT IF EXISTS gastos_fijos_frecuencia_check;
ALTER TABLE gastos_fijos ADD CONSTRAINT gastos_fijos_frecuencia_check
  CHECK (frecuencia = ANY (ARRAY['semanal','quincenal','mensual','bimestral','trimestral','semestral','anual']));
```

## Account taxonomy (drives all balance logic)

| `tipo` | `es_disponible` | `es_pasivo` |
|---|---|---|
| `efectivo` / `debito` | `true` | `false` |
| `ahorro` | `false` | `false` |
| `credito` | `false` | `true` |

**Balance formula** (`balance.js`):
```
saldo = saldo_inicial + ingresos - gastos - pagos_deuda - traspasosSalida + traspasosEntrada
```
Always recalculated from raw transactions — no running balance column.

**Credit card rule (RN-04):** A purchase on TDC does NOT subtract from the account balance at purchase time — only when the statement payment is registered. TDC accounts accumulate debt (`es_pasivo=true`).

## Debt types

`tipo_deuda` values:
- `simple` — fixed amount, fixed schedule (préstamo)
- `variable` — changing amount, fixed schedule (tarjeta)
- `tabla` — custom schedule from `pagos_programados` (hipoteca/auto)
- `flexible` — no fixed schedule (informal)

`tipo_pago` (payment frequency): `mensual`, `quincenal`, `semanal`, `unico`, `libre`

## Amortization (French method)

`balance.js` exports:
- `generarTablaAmortizacion(capital, tasaMensual, numPagos)` — full schedule
- `calcularDesgloseAmortizacion(saldoActual, tasaMensual, numPagosRestantes)` — breakdown of next payment only

IVA on interest = 16%. `tasa_interes_anual` stored in DB; modules convert to monthly by dividing by 12.

Payment breakdown stored per row: `monto_capital`, `monto_interes`, `monto_iva` in `pagos_deuda`.

## Income distribution engine (RN-07)

`distribucion.js:distribuirIngreso(montoIngreso, usuarioId)` returns `{ asignaciones, libre, deficit, sugerenciaAbonoExtra, frecuenciaIngreso }`.

Priority hierarchy for assignment:
1. Urgent fixed expenses (due before next paycheck)
2. Debt payments due in next 30 days
3. MSI installments (`gastos_diferidos`)
4. Sinking funds (proportional savings for future expenses)
5. Savings goals with deadline

If income doesn't cover all commitments, the engine reports the deficit and asks the user to prioritize — it never decides for the user.

## Security patterns (mandatory)

Every module must define `escapeHtml` locally (not exported from `app.js`):

```js
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
```

Never interpolate user data into `innerHTML` without `escapeHtml`. Use `data-*` attributes for event delegation — never string arguments in `onclick`:

```js
// Wrong
`<button onclick="open('${item.nombre}')">…</button>`

// Correct
`<button data-action="open" data-id="${escapeHtml(item.id)}">…</button>`
// Then: element.addEventListener('click', e => { const btn = e.target.closest('[data-action]'); … })
```

## Window globals pattern

Modules expose functions to `onclick` attributes via `window.*`:
```js
window.openMenuDeuda = openMenuDeuda;
```

Onboarding-specific globals must be prefixed to avoid collisions: `window.toggleOnboardingMetaIconPanel` vs `window.toggleMetaIconPanel` (metas.js). Same for state variables: `window._onbMetaIcono` vs `window._metaIcono`.

## CSS design system

All tokens in `css/main.css`. Key variables:
```
--font              Plus Jakarta Sans (the ONLY valid font variable)
--accent            Primary blue (#3b82f6 dark / #2563eb light)
--bg-card / --bg-elevated / --bg-hover
--text / --text-secondary / --text-muted
--border / --border-light
--green / --red / --yellow  (with -soft and -border variants)
--radius-xl / --radius / --radius-sm / --radius-xs
```

Dark mode is the default. Light mode: `<html data-theme="light">`. Toggle stored in `localStorage` as `jmf_theme`.

**Icon rule:** Lucide only — `<i data-lucide="icon-name">` + `renderLucideIcons()`. `chart-line` does not exist; use `line-chart`. BoxIcons (`bx bx-*`) are loaded but must not appear in JS-generated templates.

## Validation rules

```js
// Montos
!isNaN(val) && isFinite(val) && val > 0 && val <= 999_999_999

// Tasas
!isNaN(val) && isFinite(val) && val >= 0 && val <= 1200

// Días
Number.isInteger(val) && val >= 1 && val <= 9999

// Porcentajes — always guard denominator
denom > 0 ? Math.round(num / denom * 100) : 0

// parseInt — always base 10
parseInt(str, 10)
```

Always destructure `{ error }` from Supabase writes and check before updating UI.

## Business rules reference

Full rules in `docs/producto/05-reglas-de-negocio.md`. Key ones:

- **RN-01** — Registering a loan = income (adds to account balance) + creates a `deuda` record simultaneously. Both effects or neither.
- **RN-04** — TDC purchase cycle: if purchase day ≤ `fecha_corte`, it belongs to current month's statement; otherwise next month's.
- **RN-08** — Financial health traffic light: commitments/income ratio ≤ 0.30 green, ≤ 0.50 yellow, > 0.50 red.
- **RN-13** — No Open Banking. All data entered manually. RLS enforced: every query filters by `usuario_id`.
