# Arquitectura Técnica — JM Finance v2

## Principio guía
El código actual es una buena base técnica pero con el modelo mental equivocado. No tiramos todo — redirigimos el enfoque de "registro" a "decisión".

---

## Stack (sin cambios)
- **Frontend**: Vanilla JS (ES modules) + CSS custom properties
- **Backend**: Supabase (Auth + Postgres + RLS)
- **Sin framework**: mantener — la complejidad adicional no justifica el overhead para este equipo
- **PWA**: mantener service worker existente

---

## Nuevo Modelo Mental de la App

### ANTES (app de registro)
```
Usuario gasta → registra → ve historial → saca conclusiones (tarde)
```

### AHORA (app de decisión)
```
Usuario cobra → app distribuye → usuario aparta → usuario gasta dentro de límites → app confirma
```

---

## Módulos JS — Responsabilidades Redefinidas

| Archivo | Responsabilidad actual | Responsabilidad nueva |
|---|---|---|
| `app.js` | Boot + dashboard + helpers | Boot + **motor de distribución** como función central |
| `balance.js` | Cálculos de saldo | Extender con: `calcularTablaAmortizacion()`, `calcularSinkingFundPorPeriodo()`, `distribuirIngreso()` |
| `ingresos.js` | Registro de ingresos | Al guardar ingreso → **llamar motor de distribución y mostrar pantalla de asignación** |
| `deudas.js` | CRUD de deudas + pagos | Agregar: generador de tabla amortización, simulador abono extra, separación capital/interés en pagos |
| `cuentas.js` | CRUD de cuentas | Agregar: campos TDC (fecha_corte, limite), lógica de período de corte |
| `gastos.js` | Registro de gastos | Agregar: compras a MSI → crea `gastos_diferidos`; al gastar con TDC respetar período de corte |
| `metas.js` → `sobres.js` | Metas de ahorro | Renombrar concepto a "Sobres". Agregar tipo 'sinking_fund' vinculado a gasto fijo |
| `distribucion.js` | **NO EXISTE** | **Nuevo módulo**: motor ZBB — calcula asignación de ingresos |
| `amortizacion.js` | **NO EXISTE** | **Nuevo módulo**: tabla de amortización, simulador, recalculador por abono extra |

---

## Esquema de BD Completo v2

```sql
-- TABLAS EXISTENTES (con modificaciones)

usuarios          -- sin cambios
categorias        -- sin cambios
gastos            -- sin cambios (ya tiene es_ahorro, meta_id)
ingresos          -- sin cambios
transferencias    -- sin cambios
presupuestos      -- sin cambios

cuentas           -- MODIFICAR: +fecha_corte, +fecha_limite_pago, +limite_credito
gastos_fijos      -- MODIFICAR: revisar si puede vincularse a sinking fund
metas_ahorro      -- MODIFICAR: +tipo ('meta'|'sinking_fund'), +gasto_fijo_id
deudas            -- MODIFICAR: ya tiene num_pagos_restantes ✓
pagos_deuda       -- MODIFICAR: +monto_capital, +monto_interes, +monto_iva
pagos_programados -- MODIFICAR: recalculables al hacer abono extra

-- TABLAS NUEVAS

gastos_diferidos (
  id, descripcion, monto_total, num_meses, monto_cuota,
  tasa_mensual DEFAULT 0,   -- 0 = MSI, >0 = con interés
  fecha_primer_cargo DATE,
  cuotas_pagadas INT DEFAULT 0,
  cuenta_id UUID, usuario_id UUID, activo BOOL
)

-- TABLAS A CONSIDERAR EN FASES FUTURAS
distribucion_sugerida  -- guardar la distribución calculada al registrar ingreso
alertas_usuario        -- mensajes proactivos pendientes de leer
```

---

## Flujo de Datos: Motor de Distribución

```
[ingresos.js] guardarIngreso()
      │
      ▼
[distribucion.js] distribuirIngreso(monto, userId, fecha)
      │
      ├─ getGastosFijosActivos()      → gastos_fijos
      ├─ getPagosPendientes()         → deudas + pagos_programados
      ├─ calcularSinkingFunds()       → gastos_fijos con frecuencia != ingreso
      ├─ getMetasActivasConAporte()   → metas_ahorro
      │
      ▼
  resultado: { asignaciones[], libre, deficit, sugerencia }
      │
      ▼
[UI] Pantalla "¿Qué hago con lo que cobré?"
  → Usuario confirma o ajusta
  → Si confirma: se crean los "apartados" en sobres correspondientes
```

---

## Flujo de Datos: Pago de Crédito con Amortización

```
[deudas.js] openPagarDeuda()
      │
      ├─ Si deuda tiene num_pagos_restantes y tasa:
      │    calcularDesgloseAmortizacion(saldo, tasa, periodos)
      │    → muestra: capital $X / intereses $Y / IVA $Z
      │
[deudas.js] guardarPagoDeuda()
      │
      ├─ INSERT pagos_deuda { monto: total, monto_capital: X, monto_interes: Y, monto_iva: Z }
      ├─ UPDATE deudas SET monto_actual = monto_actual - monto_capital  ← SOLO CAPITAL
      ├─ INSERT gastos { monto: Y+Z, categoria: 'Intereses bancarios', es_ahorro: false }
      │
      ▼
  Deuda baja solo el capital. Interés registrado como gasto.
```

---

## Convenciones a Mantener (del código actual)

- `escapeHtml()` local en cada módulo
- `data-*` attributes + delegación (nunca `onclick="${valor_usuario}"`)
- Validación: `!isNaN && isFinite && > 0`
- Supabase writes: siempre `const { error } = await ...` + check
- `parseInt` siempre base 10
- Iconos: solo Lucide con `data-lucide="nombre"` + `renderLucideIcons()`
- Variables CSS del sistema (nunca hardcodear colores)
- ES modules — cada módulo exporta lo mínimo necesario

---

## Orden de Implementación Recomendado

```
Sesión 1: Correctitud (bugs críticos en deudas + balance)
Sesión 2: Generador de tabla de amortización + UI de desglose por cuota
Sesión 3: Motor de distribución básico (sin sinking funds complejos)
Sesión 4: Sinking funds automáticos + pantalla de sobres
Sesión 5-6: Simulador de abono extra + sugerencias proactivas
Sesión 7-8: TDC ciclo completo (fecha corte + clasificación)
Sesión 9: TDC + MSI (gastos_diferidos)
Sesión 10: Consejero de salud financiera + pantalla de resumen mensual
```
