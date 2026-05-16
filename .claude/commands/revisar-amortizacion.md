Invoca al agente `auditor-financiero` con model: **opus** para auditar los cálculos de amortización de deudas.

Razón del modelo: los errores en amortización tienen impacto financiero directo en el usuario. Opus verifica cadenas de razonamiento multi-paso (capital → interés → IVA → saldo) que Sonnet puede aproximar incorrectamente.

Instrucciones para el agente:
- Verifica `generarTablaAmortizacion(capital, tasaMensual, numPagos)` en balance.js:
  - Fórmula francesa: `cuota = capital × [r(1+r)^n] / [(1+r)^n - 1]`; si r=0: `cuota = capital/n`
  - Desglose por fila: `interes_k = saldo × r`, `capital_k = cuota - interes_k`, `iva_k = interes_k × 0.16`
  - Guarda `saldo -= capital_k`, nunca `saldo -= cuota`
- Verifica `calcularDesgloseAmortizacion()`: devuelve solo la fila 0 de la tabla, no recalcula
- En deudas.js: al registrar pago con amortización, verifica que se guarden `monto_capital`, `monto_interes`, `monto_iva` en `pagos_deuda`, y que `deuda.monto_actual -= capital_k` (no el total pagado)
- Detecta deudas tipo `tabla` que usen cálculo genérico en lugar de leer `pagos_programados`
- Verifica detección de deuda inliquidable: si `monto_pago <= saldo × (tasa_anual/12/100)`, debe mostrar alerta especial
- Verifica que `tasa_interes_anual` se convierta a mensual con `/ 12` antes de usarse en fórmulas
- Reporta en tabla: Archivo:Línea | Tipo deuda | Problema | Fórmula correcta
