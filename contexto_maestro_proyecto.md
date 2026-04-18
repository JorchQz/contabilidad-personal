# Contexto Maestro — JM Finance (contabilidad-personal)

## 1. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript Vanilla (sin framework) |
| Backend | Supabase (PostgreSQL + Auth) |
| SDK | @supabase/supabase-js v2 |
| Íconos | Lucide (local, minificado) |
| Tipografía | Plus Jakarta Sans (Google Fonts) |
| PWA | manifest.json + service-worker-ready |
| Gestor de paquetes | npm |

**Dependencias npm relevantes:**
- `lucide ^1.8.0` — sistema de íconos SVG
- `jsdom ^29.0.2` — utilidades de prueba
- `puppeteer-core ^24.41.0` — pruebas automatizadas

**Credenciales Supabase** (embebidas en `js/supabase.js`):
- URL: `https://rzanhkfmwvbngbpjefec.supabase.co`
- ANON KEY: embebida en el cliente (pública)

**Restricciones de diseño:**
- Mobile-first, max-width 430px
- Dark mode por defecto; light mode como alternativa con CSS variables
- Color tokens: primary `#3b82f6`, income `#22c55e`, expense `#ef4444`, warning `#f59e0b`
- Border-radius sistema: 6 / 10 / 14 / 20px

---

## 2. Árbol de Directorios

```
/contabilidad-personal/
│
├── index.html                  # Punto de entrada PWA; contiene splash + contenedor de app
├── manifest.json               # Config PWA (standalone, theme, icons)
├── package.json                # Dependencias npm
│
├── css/
│   └── main.css                # Sistema de diseño completo (~1700 LOC)
│                               # Variables CSS dark/light, componentes, animaciones
│
├── js/
│   ├── supabase.js             # Init del cliente Supabase + helper getUsuarioId()
│   ├── router.js               # Sistema de navegación: showPage(), renderNav()
│   └── app.js                  # Lógica principal de la app (~6000 LOC)
│                               # Contiene: auth, onboarding, páginas, modales,
│                               # catálogos, cálculos de balance, flujos CRUD
│
├── test.js                     # Tests generales
├── test-lucide.js              # Tests de íconos Lucide
└── test-lucide-jsdom.js        # Tests con jsdom
```

**Responsabilidades clave de `app.js`** (módulos lógicos internos, sin separación física de archivos):
- `AUTH` — login/registro/logout con Supabase Auth
- `ONBOARDING` — flujo de 6 pasos con transacción de seed a la BD
- `PAGE LOADERS` — `loadDashboard()`, `loadCuentas()`, `loadGastos()`, `loadIngresos()`, `loadDeudas()`, `loadFijos()`, `loadMetas()`, `loadAjustes()`
- `BALANCE ENGINE` — `calcularCuentasConSaldo()`, `getSaldoDisponibleTotal()`
- `CATEGORY SYSTEM` — catálogos `GASTOS_FIJOS_CATALOGO`, `GASTOS_VARIABLES_CATALOGO`, selector modal
- `FAB SYSTEM` — botón flotante contextual por página
- `UI COMPONENTS` — snackbar, modales/bottom-sheets, swipe navigation

---

## 3. Base de Datos — Modelos y Relaciones

### Tablas y esquema

**`usuarios`**
- `id` UUID PK (= Supabase auth UID)
- `nombre` text
- `onboarding_completo` boolean — controla si se muestra onboarding o la app

**`cuentas`** (cuentas bancarias / billeteras)
- `id` UUID PK
- `usuario_id` FK → usuarios
- `nombre` text (ej. "BBVA", "Efectivo", "Mercado Pago")
- `tipo` enum: `efectivo | debito | negocio | otro`
- `saldo_inicial` decimal
- `activa` boolean

**`categorias`** (catálogo de categorías de gasto e ingreso)
- `id` UUID PK
- `usuario_id` FK → usuarios
- `nombre` text
- `emoji` text (nombre de ícono Lucide en kebab-case o literal emoji)
- `tipo` enum: `gasto | ingreso`
- `es_default` boolean — `true` = sembrado por el sistema; `false` = creado por el usuario

**`gastos`** (transacciones de gasto variables/eventuales)
- `id` UUID PK
- `usuario_id` FK → usuarios
- `categoria_id` FK → categorias
- `cuenta_id` FK → cuentas
- `descripcion` text nullable
- `monto` decimal
- `fecha` date

**`gastos_fijos`** (gastos recurrentes programados)
- `id` UUID PK
- `usuario_id` FK → usuarios
- `categoria_id` FK → categorias
- `descripcion` text
- `monto` decimal nullable
- `monto_variable` boolean — `true` en servicios cuyo monto cambia (luz, agua)
- `frecuencia` enum: `semanal | quincenal | mensual | bimestral | trimestral | semestral | anual`
- `dia_pago` int (1–31)
- `dia_semana` int (0=Dom … 6=Sáb)
- `proximo_pago` date — calculado al marcar como pagado
- `ultimo_pago` date

**`ingresos`** (transacciones de ingreso puntuales)
- `id` UUID PK
- `usuario_id` FK → usuarios
- `categoria_id` FK → categorias
- `cuenta_id` FK → cuentas
- `tipo` enum: `salario | beca | extra | prestamo | otro`
- `descripcion` text nullable
- `monto` decimal
- `fecha` date

**`ingresos_programados`** (ingresos recurrentes esperados)
- `id` UUID PK
- `usuario_id` FK → usuarios
- `descripcion` text
- `monto_estimado` decimal
- `frecuencia` enum: `semanal | quincenal | mensual`
- `dia_pago` int
- `dia_semana` int
- `activo` boolean

**`deudas`**
- `id` UUID PK
- `usuario_id` FK → usuarios
- `acreedor` text
- `monto_inicial` decimal
- `monto_actual` decimal
- `tipo_deuda` enum: `simple | variable | tabla`
- `tipo_pago` enum: `semanal | quincenal | mensual | libre | unico`
- `monto_pago` decimal
- `dia_pago` int
- `dia_semana` int
- `activa` boolean
- `monto_ultimo_pago` decimal

**`pagos_deuda`**
- `id` UUID PK
- `usuario_id` FK → usuarios
- `deuda_id` FK → deudas
- `cuenta_id` FK → cuentas
- `monto` decimal
- `fecha` date

**`metas_ahorro`**
- `id` UUID PK
- `usuario_id` FK → usuarios
- `nombre` text
- `emoji` text
- `monto_objetivo` decimal
- `monto_actual` decimal
- `cuenta_id` FK → cuentas (nullable)
- `activa` boolean

**`transferencias`**
- `id` UUID PK
- `usuario_id` FK → usuarios
- `cuenta_origen_id` FK → cuentas
- `cuenta_destino_id` FK → cuentas
- `monto` decimal
- `fecha` date
- `nota` text nullable

---

### Algoritmo de balance por cuenta

```
saldo_cuenta = saldo_inicial
  + SUM(ingresos WHERE cuenta_id = cuenta)
  - SUM(gastos WHERE cuenta_id = cuenta)
  - SUM(pagos_deuda WHERE cuenta_id = cuenta)
  - SUM(transferencias WHERE cuenta_origen_id = cuenta)
  + SUM(transferencias WHERE cuenta_destino_id = cuenta)

saldo_total = SUM(saldo_cuenta) para todas las cuentas activas
```

Todo el cálculo es **client-side** tras fetching de datos crudos de Supabase.

---

### Estructura de categorías — separación Hogar vs Servicios

La app mantiene **dos catálogos** de categorías hardcodeados en `app.js`:

#### `GASTOS_FIJOS_CATALOGO` (gastos recurrentes programados)
Grupos y subcategorías que se convierten en registros `gastos_fijos`:

| Grupo | Ejemplos | `monto_variable` |
|-------|----------|-----------------|
| Vivienda | Renta, Hipoteca | false |
| **Servicios** | Luz/CFE (`zap`), Agua (`droplets`), Internet (`wifi`), Teléfono (`smartphone`) | **true** (monto cambia cada bimestre/mes) |
| Streaming | Netflix, Spotify, Disney+, HBO, Amazon, YouTube, Apple Music | false |
| Salud | Seguro médico, Gimnasio | false |
| Auto | Seguro de auto | false |
| Educación | Colegiatura | false |
| Créditos | Tarjeta de crédito | true |

#### `GASTOS_VARIABLES_CATALOGO` (gastos cotidianos registrados en `gastos`)
10 grupos con subcategorías; los relevantes para la distinción hogar/servicios:

| Grupo | Subcategorías | Diferencia semántica |
|-------|--------------|----------------------|
| **Hogar** | Renta, Mantenimiento, Muebles y decoración, Otro hogar | Gastos de **mantenimiento y equipamiento** del hogar (compras únicas o irregulares) |
| **Servicios** | Luz, Agua, Gas, Internet y telefonía, Otro servicio | Pagos **periódicos de suministros** (cuando se registra el pago real, no el programado) |

**Clave**: en `gastos_fijos`, Luz y Agua son servicios con `monto_variable = true` (el monto varía entre períodos). En `gastos` (variables), los mismos rubros existen como subcategorías de "Servicios" para cuando el usuario registra el pago efectivo fuera del flujo de fijos. No se solapan a nivel de BD — son flujos UX distintos con diferente tabla de destino.

Otros grupos de `GASTOS_VARIABLES_CATALOGO`:
- Alimentación (Súper, Restaurantes, Cafés, Domicilio)
- Transporte (Gasolina, Mantenimiento auto, Transporte público)
- Entretenimiento, Educación, Salud y cuidado, Personas, Finanzas, Negocio

Subcategorías especiales en grupo **Finanzas**:
- `Ahorro` → tipo interno `'ahorro'`
- `Pago de deudas` → tipo interno `'pago_deuda'`

---

## 4. Estado Actual del Desarrollo

### Flujos completamente implementados ✅

| Módulo | Estado |
|--------|--------|
| Autenticación (login / registro / logout) | ✅ Funcional |
| Onboarding 6 pasos (nombre → ingresos → fijos → cuentas → deudas → metas) | ✅ Funcional con seed transaccional |
| Dashboard (balance hero, stats, pagos próximos con lógica de fecha inteligente) | ✅ Funcional |
| Gestión de cuentas (CRUD completo + balance calculado) | ✅ Funcional |
| Registro de gastos variables (con selector de categoría y cuenta) | ✅ Funcional |
| Historial de gastos (últimos 50, delete con confirmación) | ✅ Funcional |
| Ingresos programados (CRUD, frecuencias weekly/biweekly/monthly) | ✅ Funcional |
| Historial de ingresos | ✅ Funcional |
| Gastos fijos (lista, marcar como pagado, recalcular `proximo_pago`) | ✅ Funcional |
| Gestión de deudas (3 tipos, registro de pagos a `pagos_deuda`) | ✅ Funcional |
| Metas de ahorro (progreso, emoji, link a cuenta) | ✅ Funcional |
| Transferencias entre cuentas | ✅ Funcional |
| Dark/Light mode con persistencia | ✅ Funcional |
| Navegación por tabs (8 páginas) + swipe + FAB contextual | ✅ Funcional |

### Pendiente / No implementado ❌

| Módulo | Detalle |
|--------|---------|
| Gráficas y analítica | Sin charts; no hay comparativa mes a mes ni por categoría |
| Exportación de datos | Sin CSV/PDF |
| Notificaciones push | Manifest listo para PWA pero sin service worker ni push |
| Presupuestos mensuales por categoría | Sin lógica de budget caps ni alertas de gasto |
| Multi-moneda | Solo MXN (Intl.NumberFormat es-MX) |
| Edición de gastos variables | Solo delete, no edit |
| Edición de deudas | Sin modal de edición post-creación |
| Edición de metas | Sin edición post-creación |
| Sincronización offline | Sin service worker activo |
| Real-time Supabase | No suscripciones activas |
| `pagos_programados` | Tabla referenciada en esquema, sin uso activo en UI |

### Observaciones arquitectónicas para desarrollo futuro

- Todo el código de negocio está en un único `app.js` (~6000 LOC). Refactorizar en módulos ES (`gastos.js`, `cuentas.js`, etc.) reduciría acoplamiento.
- Los catálogos de categorías son arrays hardcodeados en el cliente; migrar a tabla `categorias_sistema` en Supabase permitiría gestión sin deploy.
- La lógica de `proximo_pago` (scheduling de frecuencias) está duplicada entre gastos fijos y deudas — candidata a función utilitaria compartida.
- No hay validación server-side (RLS en Supabase); se asume que `usuario_id` se filtra en cada query client-side.
