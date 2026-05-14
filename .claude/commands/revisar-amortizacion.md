Invoca al agente `auditor-financiero` con modelo opus para auditar los cálculos de amortización de deudas.

Instrucciones para el agente:
- Verifica que las deudas tipo `simple` usen el método francés: M = P * [r(1+r)^n] / [(1+r)^n - 1]
- Confirma que `tasa_interes_anual` se convierte correctamente a tasa mensual (/ 12 / 100)
- Revisa que deudas tipo `tabla` usen `pagos_programados` y no un cálculo genérico
- Detecta proyecciones absurdas para deudas tipo `unico` (sin plazo definido)
- Verifica que `num_pagos_restantes` se actualice tras cada pago en `pagos_deuda`
- Reporta en tabla: Archivo:Línea | Tipo deuda | Problema | Fórmula correcta
