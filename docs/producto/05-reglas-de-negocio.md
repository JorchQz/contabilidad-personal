# Reglas de Negocio — JM Finance

## Propósito
Este documento define TODAS las reglas que gobiernan los cálculos y comportamientos de la app. Antes de implementar cualquier feature, verificar que las reglas aquí descritas están cubiertas.

---

## RN-01: Ingreso de Préstamo a la Cuenta

Cuando el usuario registra que pidió un préstamo:
```
EFECTO 1: saldo_cuenta += monto_prestamo
EFECTO 2: CREATE deuda { monto_inicial: monto_prestamo, monto_actual: monto_prestamo }
```
**Ambos efectos son simultáneos e inseparables.** Si uno falla, revertir el otro.

El préstamo NO es un ingreso en el sentido de la distribución — es un pasivo que crea liquidez temporal. No debe incluirse en el cálculo del semáforo de ingresos/deudas como ingreso recurrente.

---

## RN-02: Pago de Cuota de Préstamo con Amortización

Cuando el usuario registra un pago de deuda con tabla de amortización:
```
capital_k   = cuota_fija - (saldo_k × tasa_mensual)
interes_k   = saldo_k × tasa_mensual
iva_k       = interes_k × 0.16

EFECTO 1: deuda.monto_actual -= capital_k           (solo el capital)
EFECTO 2: cuenta.saldo      -= (capital_k + interes_k + iva_k)  (salida real)
EFECTO 3: CREATE gasto { monto: interes_k + iva_k, categoria: 'Intereses bancarios' }
EFECTO 4: CREATE pagos_deuda { monto: total_pagado, monto_capital: capital_k, monto_interes: interes_k, monto_iva: iva_k }
```

**Si no hay tabla de amortización (tasa=0 o sin num_pagos_restantes):**
```
EFECTO 1: deuda.monto_actual -= monto_pagado  (comportamiento anterior)
EFECTO 2: cuenta.saldo      -= monto_pagado
EFECTO 3: No crear gasto de intereses
```

---

## RN-03: Abono Extra a Capital

Cuando el usuario abona más del mínimo:
- **Opción A — Terminar antes** (recomendada): `nueva_cuota = misma`, recalcular `n` → `n' = ceil(-log(1 - r×saldo'/cuota) / log(1+r))`
- **Opción B — Pagar menos cada mes**: `nuevos_periodos = mismos`, recalcular `cuota'` → `cuota' = saldo' × r(1+r)^n / ((1+r)^n - 1)`

En ambos casos: regenerar `pagos_programados` desde el período siguiente, preservando los ya marcados como `pagado=true`.

---

## RN-04: Ciclo de Corte de Tarjeta de Crédito

```
SI día_de_compra <= fecha_corte:
    período = mes_actual
SINO:
    período = mes_siguiente
```

**Fecha límite de pago** = fecha_limite_pago del mes siguiente al período de corte.

Un gasto en TDC NO descuenta saldo de cuenta en el momento de la compra — descuenta cuando se registra el pago del estado de cuenta. La cuenta TDC acumula su saldo pendiente (es_pasivo=true).

---

## RN-05: Compra a MSI

```
monto_cuota_MSI = monto_total / num_meses  (interés = 0)
cargo_mes_1 = período en que entra la compra (regla RN-04)
cargo_mes_2..n = meses subsecuentes
```

Si la promoción MSI vence y no se pagó el total: el sistema calcula intereses retroactivos = `monto_total × (CAT_mensual) × meses_de_la_compra`. Mostrar alerta 30 días antes del vencimiento.

**Nota**: Para compras a meses CON interés (no MSI), usar fórmula de amortización:
`cuota = monto × [r(1+r)^n / ((1+r)^n - 1)]`

---

## RN-06: Sinking Fund — Cálculo del Apartado por Período

```
frecuencia_ingreso: dias entre cobros (7=semanal, 15=quincenal, 30=mensual)
frecuencia_gasto:   dias del ciclo del gasto (30=mensual, 60=bimestral, 365=anual)

apartado_por_ingreso = monto_gasto / (frecuencia_gasto / frecuencia_ingreso)
```

Ejemplos:
- Renta $3,000/mensual, ingreso quincenal: `3000 / (30/15) = $1,500 por quincena`
- CFE $800/bimestral, ingreso quincenal: `800 / (60/15) = $200 por quincena`
- Predial $4,000/anual, ingreso quincenal: `4000 / (365/15) = $164 por quincena`

---

## RN-07: Motor de Distribución — Jerarquía y Cálculo

Al registrar cualquier ingreso, el motor calcula:

```
PASO 1: compromisos = [
  ...gastos_fijos_del_periodo(),     // frecuencia ≤ periodo_ingreso
  ...sinking_funds_del_periodo(),    // gastos de mayor frecuencia, su cuota proporcional
  ...cuotas_deuda_proximas_30d(),    // deudas con vencimiento en los próximos 30 días
  ...cuotas_MSI_activas(),           // cargos de TDC diferidos del período
]

PASO 2: asignaciones = []
         restante = monto_ingreso
         para cada compromiso en PASO 1:
           asignar = min(compromiso.monto, restante)
           asignaciones.push({ nombre, asignar, tipo })
           restante -= asignar

PASO 3: si restante > 0:
          sugerencia = getSugerenciaAbonoExtra(restante)
        si restante < 0:
          deficit = |restante|
          mostrar alerta de insuficiencia de ingreso

RESULTADO: { asignaciones, libre: max(0, restante), deficit: max(0, -restante), sugerencia }
```

**Regla de insuficiencia**: si el ingreso no alcanza para todos los compromisos, el sistema NO decide por el usuario qué posponer — muestra el déficit y pregunta al usuario qué priorizar.

---

## RN-08: Semáforo de Salud Financiera

```
total_compromisos_mensuales = sum(cuotas_deuda_normalizadas) + sum(gastos_fijos_normalizados)
ingreso_mensual_total = sum(ingresos_programados_normalizados)

ratio = total_compromisos / ingreso_mensual

VERDE:   ratio <= 0.30   ("Vas bien — tus compromisos son manejables")
AMARILLO: 0.30 < ratio <= 0.50  ("Precaución — más de la mitad comprometida")
ROJO:    ratio > 0.50   ("Zona de riesgo — tus ingresos no dan abasto")
```

**Normalización a mensual:**
- Quincenal × 2
- Semanal × 4.33
- Único / libre: no incluir en el cálculo periódico

---

## RN-09: Proyección de Liquidación

Para cada deuda con tasa > 0 y monto_pago > 0:
```
r = tasa_anual / 12 / 100
n_proyectado = ceil(-log(1 - r × monto_actual / monto_pago) / log(1 + r))
fecha_liquidacion = hoy + n_proyectado × días_por_periodo
intereses_totales = n_proyectado × monto_pago - monto_actual
```

**Condición sin salida**: si `monto_pago <= monto_actual × r` → el pago no cubre ni los intereses → mostrar alerta especial.

Para deudas sin tasa:
```
n_proyectado = ceil(monto_actual / monto_pago)
```

---

## RN-10: Saldo Disponible Real

```
saldo_disponible = sum(cuentas WHERE es_disponible=true AND es_pasivo=false)
                 - sum(sinking_funds_pendientes)   // dinero ya "reservado" pero no gastado

"Real para gastar HOY" = saldo_disponible - pagos_deuda_proximos_7d
```

**Importante**: las cuentas de crédito (es_pasivo=true) NUNCA se incluyen en el saldo disponible.

---

## RN-11: Alertas Automáticas

| Condición | Alerta | Urgencia |
|---|---|---|
| ratio > 0.50 | "Zona de riesgo financiero — tus compromisos superan la mitad de tu ingreso" | Roja |
| pago_mínimo < interés_período (TDC) | "Tu deuda con X crece aunque estés pagando" | Amarilla |
| MSI vence en 30 días sin pagar el total | "¡Atención! Si no pagas tu MSI en X días, se cobran intereses retroactivos" | Roja |
| Sobre de sinking fund con < 80% y faltan ≤ 7 días para el gasto | "Tu sobre de [Renta] necesita $X más — faltan 7 días" | Amarilla |
| Deuda pagada al 100% | "¡Liquidaste tu deuda con [X]! 🎉 $Y mensuales libres ahora" | Celebración |
| Sin ingresos registrados en 30 días | "No hemos visto ingresos este mes — ¿todo bien?" | Suave |

---

## RN-12: Validaciones Universales de Montos

En todo input de monto, sin excepción:
```js
monto_valido(v) = !isNaN(v) && isFinite(v) && v > 0 && v <= 999_999_999
tasa_valida(v)  = !isNaN(v) && isFinite(v) && v >= 0 && v <= 1200  // 100% mensual × 12
dias_valido(v)  = Number.isInteger(v) && v >= 1 && v <= 9999
```

Nunca almacenar en Supabase sin pasar estas validaciones.

---

## RN-14: Simulador de Compras

El simulador corre el motor de distribución en modo hipotético. Nunca escribe en la BD.

### Efectivo
```js
function simularCompraEfectivo(precio, userId) {
  const saldoReal = getSaldoDisponibleTotal(userId);       // cuentas disponibles
  const comprometido = getSinkingFundsPendientes(userId)  // sobres no completados
                     + getPagosPendientes(userId, 30);    // deudas próximas 30d
  const libreReal = saldoReal - comprometido;

  return {
    precio,
    libreAntes: libreReal,
    libreDespues: libreReal - precio,
    veredicto: libreReal - precio > libreReal * 0.10 ? 'comodo'
              : libreReal - precio > 0               ? 'justo'
              : 'no_alcanza'
  };
}
```

### MSI
```js
function simularCompraMSI(precio, numMeses, userId) {
  const cuotaMensual = precio / numMeses;
  const cuotaQuincenal = cuotaMensual / 2;
  const ingresoQuincenal = getIngresoPromedioQuincenal(userId);
  const compromisoActual = getCompromisoMensualTotal(userId);
  const compromisoNuevo = compromisoActual + cuotaMensual;
  const ingresoMensual = ingresoQuincenal * 2;

  return {
    cuotaMensual,
    cuotaQuincenal,
    meses: numMeses,
    porcentajeIngreso: (cuotaMensual / ingresoMensual * 100).toFixed(1),
    quincenasDeTrabajo: (precio / ingresoQuincenal).toFixed(1),
    semaforoActual: calcularSemaforo(compromisoActual, ingresoMensual),
    semaforoNuevo: calcularSemaforo(compromisoNuevo, ingresoMensual)
  };
}
```

### Crédito
```js
function simularCompraCredito(precio, tasaMensual, numPagos, userId) {
  const r = tasaMensual / 100;
  const cuota = r > 0
    ? precio * (r * Math.pow(1+r, numPagos)) / (Math.pow(1+r, numPagos) - 1)
    : precio / numPagos;
  const totalPagado = cuota * numPagos;
  const interesTotal = totalPagado - precio;

  // ¿Cuánto tardaría en ahorrar el mismo precio?
  const aporteMensualDisponible = getRemanenteMensual(userId);
  const mesesParaAhorrar = aporteMensualDisponible > 0
    ? Math.ceil(precio / aporteMensualDisponible) : null;

  return { cuota, totalPagado, interesTotal, mesesParaAhorrar, numPagos };
}
```

**Regla de veredicto universal**: el simulador NUNCA prohíbe. Siempre muestra el impacto y deja decidir al usuario. La app es un consejero, no un guardián.

---

## RN-13: Privacidad y Seguridad de Datos

- **Sin Open Banking**: la app no se conecta a bancos. El usuario ingresa manualmente todos los datos. Esto es intencional — la desconfianza al Open Banking es una barrera real para el usuario objetivo.
- **Sin datos bancarios sensibles**: no se almacenan números de cuenta, claves, ni credenciales.
- **RLS en Supabase**: cada query filtra por `usuario_id` de la sesión activa. Ningún usuario puede ver datos de otro.
- **escapeHtml obligatorio**: todo dato de usuario que se renderice en innerHTML debe pasar por `escapeHtml()`.
