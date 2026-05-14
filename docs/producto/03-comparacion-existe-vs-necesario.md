# Qué Existe vs. Qué Necesitamos

## Código actual como referencia — no como plan

El código actual tiene ~10 meses de desarrollo. Funciona como app de REGISTRO. 
Lo que necesitamos es una app de DECISIÓN. Son categorías distintas.

---

## Inventario: Qué sirve, qué ajustar, qué descartar

### ✅ CONSERVAR SIN CAMBIOS (o mínimos)
| Módulo | Por qué conservar |
|---|---|
| Auth (login/registro) | Funciona, Supabase Auth es correcto |
| Categorías de gastos | Estructura sólida, catálogo mexicano ya en onboarding |
| Registro de gastos variables | Funciona bien, auditado en seguridad |
| Exportación CSV/PDF | Funciona, no es prioridad cambiar |
| PWA / Service Worker | Buen trabajo, conservar |
| CSS design system | Variables limpias, dark/light mode, conservar |
| Supabase + RLS | Arquitectura correcta |

### 🔧 CONSERVAR Y CORREGIR
| Módulo | Qué corregir |
|---|---|
| `deudas.js` — registro de pago | Bug crítico: descuenta total en lugar de capital. Necesita separar capital/interés |
| `balance.js` — saldo disponible | No filtra `es_pasivo=false`, mezcla activos y crédito |
| `deudas.js` — proyección liquidación | Funciona para sin-tasa. Con tasa necesita `num_pagos_restantes` para ser exacta |
| `gastos_fijos.js` — sinking funds | Existe la estructura pero no calcula el apartado por período de ingreso |
| Dashboard — "real para gastar" | Concepto correcto, fórmula incompleta (no incluye sinking funds pendientes) |
| Onboarding paso 4 (deudas) | **YA MEJORADO en sesión anterior** ✓ |
| Motor distribución | Existe parcialmente en `loadDashboard` — necesita volverse interactivo |

### 🗑️ REEMPLAZAR COMPLETAMENTE
| Módulo | Por qué reemplazar | Qué lo reemplaza |
|---|---|---|
| Registro de pago de deuda (flujo actual) | No separa capital/interés, no actualiza tabla de amortización | Nuevo flujo: pago = capital + gasto interés automático |
| `calcularProyeccionLiquidacion` | Solo aproxima, no usa tabla real | Generador de tabla de amortización + simulador |
| Plan bola de nieve (UI actual) | Muestra el orden pero no guía la acción | Integrado al motor de distribución con sugerencia activa |

### 🆕 CONSTRUIR DESDE CERO
| Módulo | Complejidad | Dependencias |
|---|---|---|
| Motor de distribución de ingresos (pantalla central) | Alta | Necesita: gastos_fijos, deudas, sinking funds, presupuestos todos cargados |
| Tabla de amortización automática | Media | Migración de `num_pagos_restantes` (ya aplicada ✓) |
| Simulador abono extra a capital | Media | Requiere tabla de amortización |
| Ciclo completo TDC (fecha corte, MSI) | Muy alta | Nueva tabla `gastos_diferidos` + columnas en `cuentas` |
| Sinking funds como concepto UI | Media | Reutiliza `metas_ahorro` o nuevo módulo |
| Sugerencias proactivas post-ingreso | Media | Motor de distribución completo |

---

## Migraciones de BD Requeridas (en orden)

```sql
-- 1. Ya aplicada ✓
ALTER TABLE deudas ADD COLUMN IF NOT EXISTS num_pagos_restantes INTEGER;

-- 2. TDC ciclo completo
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS fecha_corte INTEGER DEFAULT NULL;
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS fecha_limite_pago INTEGER DEFAULT NULL;
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS limite_credito NUMERIC DEFAULT NULL;

-- 3. Compras diferidas (MSI y a meses con interés)
CREATE TABLE IF NOT EXISTS gastos_diferidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  monto_total NUMERIC NOT NULL,
  num_meses INTEGER NOT NULL,
  monto_cuota NUMERIC NOT NULL, -- monto_total / num_meses para MSI
  tasa_mensual NUMERIC DEFAULT 0, -- 0 para MSI
  fecha_primer_cargo DATE NOT NULL,
  cuotas_pagadas INTEGER DEFAULT 0,
  cuenta_id UUID REFERENCES cuentas(id),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Separar intereses de capital en pagos de deuda
ALTER TABLE pagos_deuda ADD COLUMN IF NOT EXISTS monto_capital NUMERIC DEFAULT NULL;
ALTER TABLE pagos_deuda ADD COLUMN IF NOT EXISTS monto_interes NUMERIC DEFAULT NULL;
ALTER TABLE pagos_deuda ADD COLUMN IF NOT EXISTS monto_iva NUMERIC DEFAULT NULL;
-- Si monto_capital IS NULL → comportamiento anterior (100% capital)

-- 5. Historial de apartados (sinking funds)
-- Por ahora: metas_ahorro con tipo='sinking_fund' puede servir
ALTER TABLE metas_ahorro ADD COLUMN IF NOT EXISTS tipo VARCHAR DEFAULT 'meta';
-- Valores: 'meta' (ahorro libre), 'sinking_fund' (para gasto futuro conocido)
ALTER TABLE metas_ahorro ADD COLUMN IF NOT EXISTS gasto_fijo_id UUID REFERENCES gastos_fijos(id) DEFAULT NULL;
```

---

## Plan de Fases de Desarrollo

### Fase 1 — Correctitud (bug fixes críticos)
Tiempo estimado: 1 sesión
- Corregir `guardarPagoDeuda`: separar capital/interés en el registro
- Corregir `getSaldoDisponibleTotal`: filtrar `es_pasivo=false`
- Generar tabla de amortización al crear préstamo fijo con tasa

### Fase 2 — Motor de Distribución Básico
Tiempo estimado: 2–3 sesiones
- Al registrar ingreso: mostrar distribución sugerida
- Sinking funds calculados automáticamente desde gastos_fijos
- Pantalla "¿Qué hago con lo que cobré?"

### Fase 3 — Amortización Visual y Simulador
Tiempo estimado: 1–2 sesiones
- Pantalla de detalle de deuda con tabla completa
- Visualización capital/interés por cuota
- Simulador: "si abono $X extra → ahorras $Y en intereses, terminas antes"

### Fase 4 — TDC Ciclo Completo
Tiempo estimado: 3–4 sesiones (la más compleja)
- Campos de fecha corte y límite en cuentas TDC
- Clasificación automática de compras por período
- Gestión de MSI
- Integración con motor de distribución

### Fase 5 — Consejero Proactivo y UX Final
Tiempo estimado: 2 sesiones
- Sugerencias al recibir ingreso variable
- Mensajes motivadores / alertas de riesgo
- Pantalla de salud financiera completa

---

## Qué no se va a construir (al menos en v1)

- Conexión bancaria automática (Open Banking) — complejidad y desconfianza del usuario
- Inversiones (CETES, fondos) — fuera del público objetivo
- División de gastos entre personas (splitwise-like)
- Múltiples monedas
- Escaneo de tickets / OCR
