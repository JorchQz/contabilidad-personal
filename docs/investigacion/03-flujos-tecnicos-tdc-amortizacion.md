# Investigación: Flujos Técnicos — TDC y Amortización

## FLUJO 1 — Tarjeta de Crédito con Ciclo Correcto

### Campos requeridos en la cuenta TDC
```sql
cuentas:
  fecha_corte        INT  -- día del mes (1-28)
  fecha_limite_pago  INT  -- día del mes siguiente para pagar
  limite_credito     NUMERIC
  saldo_disponible   NUMERIC (= limite - saldo_usado, calculado)
```

### Regla de corte: a qué período pertenece cada compra
```js
function getPeriodoEstadoCuenta(fechaGasto, fechaCorte) {
  const dia = new Date(fechaGasto).getDate();
  const base = new Date(fechaGasto);
  if (dia > fechaCorte) base.setMonth(base.getMonth() + 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
}
// Si fecha_corte = 20:
// compra el día 18 → período del mes actual
// compra el día 22 → período del mes siguiente
```

### Compras a MSI (Meses Sin Intereses)
Nueva tabla `gastos_diferidos`:
```sql
id, descripcion, monto_total, num_meses, monto_cuota,
fecha_primer_cargo DATE, cuenta_id UUID, usuario_id UUID, activo BOOL
-- monto_cuota = monto_total / num_meses (MSI = 0% interés)
-- Los cargos mensuales se "materializan" en gastos cuando llega su fecha
```

### Cálculo de "¿cuánto apartar de este ingreso para la TDC?"
```js
function calcularReservaTDC(cuentaId, fechaIngreso) {
  const { fecha_corte, fecha_limite_pago } = getCuentaTDC(cuentaId);
  // Próxima fecha límite de pago después del ingreso
  const proximoPago = getProximaFechaLimitePago(fecha_limite_pago, fechaIngreso);
  // Suma de todos los cargos del período de corte correspondiente
  const cargosDelPeriodo = getGastosEnPeriodo(cuentaId, proximoPago);
  const msiDelPeriodo = getMSIDelPeriodo(cuentaId, proximoPago);
  return cargosDelPeriodo + msiDelPeriodo;
}
```

---

## FLUJO 2 — Amortización Francesa Correcta

### Fórmula de cuota fija mensual
```
C = P × [r(1+r)^n] / [(1+r)^n - 1]

P = capital inicial
r = tasa mensual (tasa_anual / 12)
n = número de pagos restantes
```

### Ejemplo completo: $20,000 al 2% mensual, 36 cuotas
```
C = 20,000 × [0.02 × (1.02)^36] / [(1.02)^36 - 1]
C ≈ $785.00 / mes
Total pagado: $28,260 | Intereses totales: $8,260
```

### Tabla de amortización (primeras 5 cuotas)
| # | Cuota | Interés (2%) | Capital | Saldo |
|---|-------|-------------|---------|-------|
| 1 | $785 | $400.00 | $385.00 | $19,615 |
| 2 | $785 | $392.30 | $392.70 | $19,222 |
| 3 | $785 | $384.44 | $400.56 | $18,822 |
| 4 | $785 | $376.44 | $408.56 | $18,413 |
| 5 | $785 | $368.26 | $416.74 | $17,996 |

**Observación clave**: en el mes 1, el 51% de la cuota es interés. En el mes 36, menos del 2% es interés. El usuario que no entiende esto cree que "pagó mucho y casi no bajó la deuda".

### Desglose por cuota en JS
```js
function generarTablaAmortizacion(capital, tasaMensual, numPagos) {
  const r = tasaMensual / 100;
  const cuota = capital * (r * Math.pow(1+r, numPagos)) / (Math.pow(1+r, numPagos) - 1);
  let saldo = capital;
  const tabla = [];
  for (let i = 1; i <= numPagos; i++) {
    const interes = saldo * r;
    const abonoCapital = cuota - interes;
    saldo -= abonoCapital;
    tabla.push({ num: i, cuota, interes, capital: abonoCapital, saldo: Math.max(0, saldo) });
  }
  return tabla;
}
```

### Abono extra a capital — Dos opciones
```js
// Opción A: Mantiene cuota, bajan los períodos (RECOMENDADA — ahorra más intereses)
function recalcularConAbonoExtra_A(saldoNuevo, tasaMensual, cuotaActual) {
  const r = tasaMensual / 100;
  // n = -log(1 - r*P/C) / log(1+r)
  const n = -Math.log(1 - (r * saldoNuevo) / cuotaActual) / Math.log(1 + r);
  return Math.ceil(n); // nuevos períodos restantes
}

// Opción B: Mantiene períodos, baja la cuota (mejora flujo mensual)
function recalcularConAbonoExtra_B(saldoNuevo, tasaMensual, periodosRestantes) {
  const r = tasaMensual / 100;
  const nuevaCuota = saldoNuevo * (r * Math.pow(1+r, periodosRestantes)) / (Math.pow(1+r, periodosRestantes) - 1);
  return nuevaCuota;
}
```

### Visualización para el usuario (inspirada en Copilot Money)
```
[████████████░░░░░] Capital: $385 (49%) | Intereses: $400 (51%)
"De cada $785 que pagas, $385 reducen tu deuda real"

Si abonas $1,000 extra HOY:
  → Te liberas 3 meses antes (febrero 2028 en lugar de mayo 2028)
  → Te ahorras $680 en intereses
```

---

## FLUJO 3 — Motor de Distribución de Ingresos (Zero-Based Budgeting)

### Jerarquía de asignación (orden de prioridades)
```
Ingreso que entra
  1. Gastos fijos del período (renta, servicios, colegiaturas)    ← sin esto no funciona el hogar
  2. Cuotas de deuda con fecha próxima (≤ 30 días)               ← sin esto acumulan intereses
  3. Sinking funds (apartar para gastos futuros irregulares)      ← sin esto llegan sorpresas
  4. Presupuestos de categorías variables (comida, transporte)    ← sin esto no vive
  5. Metas de ahorro (abono proporcional)                         ← deseable
  6. Remanente → "libre para gastar" o "sugerir abonar a capital" ← oportunidad de mejora
```

### Algoritmo sugerido
```js
function distribuirIngreso(monto, userId, fechaIngreso) {
  const fijos = getGastosFijosActivos(userId);
  const deudas = getPagosPendientes(userId, fechaIngreso, 30); // próximos 30 días
  const sinkingFunds = calcularSinkingFunds(userId, fechaIngreso);
  const metas = getMetasActivasConFrecuencia(userId);

  let restante = monto;
  const asignaciones = [];

  for (const compromiso of [...fijos, ...deudas, ...sinkingFunds, ...metas]) {
    const asignar = Math.min(compromiso.monto_periodo, restante);
    asignaciones.push({ label: compromiso.nombre, monto: asignar, tipo: compromiso.tipo });
    restante -= asignar;
  }

  return {
    asignaciones,
    libre: Math.max(0, restante),
    deficit: Math.min(0, restante), // negativo = ingreso insuficiente para cubrir todo
    sugerencia: restante > 0 ? getSugerenciaAbonoExtra(userId, restante) : null
  };
}
```

### Sinking Funds automáticos (clave para México)
```js
function calcularSinkingFunds(userId, fechaIngreso) {
  // Para cada gasto con frecuencia != ingreso del usuario:
  // Ej: CFE bimestral $800, usuario cobra quincenal
  // → apartar $800 / (2*2) = $200 por quincena
  const gastosFijos = getGastosFijosConFrecuencia(userId);
  const frecuenciaIngreso = getFrecuenciaIngresoPrincipal(userId);
  
  return gastosFijos.map(g => ({
    nombre: g.descripcion,
    monto_periodo: calcularApartadoPorPeriodo(g.monto, g.frecuencia, frecuenciaIngreso),
    tipo: 'sinking_fund'
  }));
}
```

---

## Tablas de BD Nuevas Requeridas

| Tabla | Para qué | Nueva / Modificar |
|---|---|---|
| `gastos_diferidos` | Compras MSI con sus cuotas mensuales | **Nueva** |
| `cuentas.fecha_corte` | Ciclo TDC | Agregar columna |
| `cuentas.fecha_limite_pago` | Ciclo TDC | Agregar columna |
| `cuentas.limite_credito` | % utilización TDC | Agregar columna |
| `ingresos_programados.frecuencia` | Sinking funds | Ya existe parcialmente |
| `deudas.num_pagos_restantes` | Amortización correcta | **Ya migrado** ✓ |
| `deudas.abonos_extra[]` | Historial de abonos a capital | Considerar tabla separada |
