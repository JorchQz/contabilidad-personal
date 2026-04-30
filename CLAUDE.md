# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Running the app

No build step. Serve files over HTTP — opening `index.html` directly fails due to ES module CORS restrictions.

```bash
# Python (built-in)
python3 -m http.server 8080

# VS Code: Live Server extension → right-click index.html → Open with Live Server
```

There are no tests, no linting pipeline, and no package.json. All dependencies are loaded via CDN in `index.html`.

## Architecture

**Stack:** Vanilla JS (ES modules) + Supabase (auth + Postgres) + CSS custom properties. No framework, no bundler. The app is a PWA installable from the browser.

**Boot sequence** (`index.html` → `js/app.js`):
1. `index.html` loads Supabase CDN, Lucide icons, and `app.js` as a module
2. `app.js` checks Supabase auth state → routes to `renderAuth()`, `renderOnboarding()`, or `renderApp()`
3. `renderApp()` builds the shell (bottom nav, page divs, FAB) and loads dashboard data

**Page model:** All pages (`#page-dashboard`, `#page-gastos`, etc.) exist simultaneously in the DOM. `router.js:showPage()` toggles the `.active` class. Page content is rendered by calling the module's `load*()` function each time the page is activated.

**Module responsibilities:**

| File | Role |
|---|---|
| `app.js` | Boot, auth gate, dashboard, shared helpers (`formatMXN`, `showSnackbar`, `openModal`, `renderLucideIcons`, `openActionSheet`, `renderEmojiOrIcon`, `loadDashboard`) |
| `router.js` | Page switching, bottom nav render, swipe navigation |
| `auth.js` | Login/register screens, Supabase auth events |
| `onboarding.js` | 7-step onboarding wizard; writes to `onboardingData` object then bulk-inserts on finish |
| `balance.js` | Pure calculation engine — no DOM. `getSaldoCuentaEspecifica`, `getSaldoDisponibleTotal`, `getPagosPendientes` |
| `cuentas.js` | Account CRUD + `calcularCuentasConSaldo` (used by dashboard) |
| `deudas.js` | Debt CRUD + payment registration + tabla de pagos programados |
| `metas.js` | Savings goal CRUD + abonar flow |
| `gastos.js` | Variable and fixed expense CRUD |
| `ingresos.js` | Income registration |
| `presupuestos.js` | Category budget limits with spending progress |
| `graficas.js` | Chart.js pie chart for monthly spending |
| `export.js` | CSV export of gastos, ingresos, gastos_fijos |

## Supabase schema (key tables)

```
usuarios          id, nombre, onboarding_completo
cuentas           id, nombre, tipo, saldo_inicial, es_disponible, es_pasivo, activa, usuario_id
ingresos          id, monto, fecha, descripcion, categoria_id, cuenta_id, usuario_id
gastos            id, monto, fecha, descripcion, categoria_id, cuenta_id, usuario_id
gastos_fijos      id, descripcion, monto, frecuencia, dia_pago, fecha_flexible, monto_estimado, proximo_pago, usuario_id
categorias        id, nombre, emoji, tipo ('ingreso'|'gasto'), es_default, usuario_id
deudas            id, acreedor, monto_inicial, monto_actual, tipo_deuda, tipo_pago, monto_pago,
                  dia_pago, dia_semana, activa, tasa_interes_anual, usuario_id
pagos_deuda       id, deuda_id, monto, fecha, cuenta_id, nota, usuario_id
pagos_programados id, deuda_id, numero_pago, fecha_vencimiento, monto_esperado, pagado, usuario_id
metas_ahorro      id, nombre, emoji, monto_objetivo, monto_actual, cuenta_id, activa,
                  fecha_limite, frecuencia_ahorro, usuario_id
presupuestos      id, categoria_id, monto_limite, periodo ('YYYY-MM'), usuario_id
transferencias    id, cuenta_origen_id, cuenta_destino_id, monto, fecha, usuario_id
```

**Account taxonomy** (critical — drives balance logic):
- `efectivo` / `debito`: `es_disponible = true`, `es_pasivo = false`
- `ahorro`: `es_disponible = false`, `es_pasivo = false`
- `credito`: `es_disponible = false`, `es_pasivo = true`

**Balance formula** (from `balance.js`):
`saldo = saldo_inicial + ingresos - gastos - pagos_deuda - traspasosSalida + traspasosEntrada`

Balances are always recalculated from raw transactions — there is no running balance column.

## Mandatory security patterns

Every module must define `escapeHtml` locally (it is not exported from `app.js`):

```js
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
```

**Never** interpolate user-controlled data into `innerHTML` without `escapeHtml`. This includes field names like `acreedor`, `nombre`, `descripcion`, account names, category names.

**Never** pass user data as string arguments inside `onclick="fn('${value}')"`. Use `data-*` attributes and delegated listeners:

```js
// Wrong
`<button onclick="open('${item.nombre}')">…</button>`

// Correct
`<button data-action="open" data-id="${escapeHtml(item.id)}" data-nombre="${escapeHtml(item.nombre)}">…</button>`
// Then: element.onclick = e => { const btn = e.target.closest('[data-action="open"]'); … }
```

## Window globals pattern

Modules expose functions to HTML `onclick` attributes via `window.*`:

```js
window.openMenuDeuda = openMenuDeuda;
window.guardarPagoDeuda = guardarPagoDeuda;
```

**Naming rule:** onboarding-specific globals must be prefixed to avoid collisions with app-module globals of the same name. Example: `window.toggleOnboardingMetaIconPanel` (onboarding) vs `window.toggleMetaIconPanel` (metas.js).

Onboarding state variables that mirror app-module globals must also be prefixed: `window._onbMetaIcono` vs `window._metaIcono`.

## CSS design system

Single token set in `css/main.css`. Key variables:

```
--font              Plus Jakarta Sans (the ONLY valid font variable — --font-body and --font-display do not exist)
--accent            Primary blue (#3b82f6 dark / #2563eb light)
--bg-card / --bg-elevated / --bg-hover
--text / --text-secondary / --text-muted
--border / --border-light
--green / --red / --yellow (with -soft and -border variants)
--radius-xl / --radius / --radius-sm / --radius-xs
```

Dark mode is the default. Light mode: `<html data-theme="light">`. All color variables automatically swap.

**Icon system:** Lucide only — `<i data-lucide="icon-name">` followed by `renderLucideIcons()`. BoxIcons (`bx bx-*`) are loaded in `index.html` but must **not** be used in JS templates. The icon `chart-line` does not exist in Lucide; use `line-chart`.

## Debt types

`tipo_deuda` values and their semantics:
- `simple`: fixed amount, fixed schedule
- `variable`: changing amount, fixed schedule
- `tabla`: fully custom schedule loaded as `pagos_programados` rows
- `flexible`: no fixed schedule or amount

`tipo_pago` (payment frequency): `mensual`, `quincenal`, `semanal`, `unico`, `libre`

## Validation rules (enforced everywhere)

- Montos: `!isNaN(val) && isFinite(val) && val > 0`. Never allow negative, NaN, or Infinity through to Supabase.
- Progress percentages: always guard denominator — `denom > 0 ? Math.round(num/denom * 100) : 0`.
- `parseInt` calls must use base 10: `parseInt(str, 10)`.
- Supabase writes must destructure `{ error }` and check it before updating UI.

## Pending migrations (apply in Supabase SQL editor)

```sql
-- Deudas (done 2026-04-28)
ALTER TABLE deudas ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;
ALTER TABLE deudas ADD COLUMN IF NOT EXISTS tasa_interes_anual NUMERIC DEFAULT 0;

-- Metas (required — not yet applied as of 2026-04-29)
ALTER TABLE metas_ahorro ADD COLUMN IF NOT EXISTS fecha_limite DATE;
ALTER TABLE metas_ahorro ADD COLUMN IF NOT EXISTS frecuencia_ahorro VARCHAR;

-- Older migrations documented inline in app.js lines 39-51
```
