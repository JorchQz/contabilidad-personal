Invoca al agente `auditor-financiero` con modelo opus para auditar la lógica de metas de ahorro.

Instrucciones para el agente:
- Verifica que cada meta tenga `fecha_limite` y `frecuencia_ahorro` para proyectar alcance
- Confirma que los aportes a metas (`es_ahorro = true` en gastos) se contabilicen correctamente
- Revisa que `monto_actual` de la meta se actualice al abonar
- Detecta denominadores cero en cálculos de progreso: usar `denom > 0 ? Math.round(num/denom * 100) : 0`
- Verifica consistencia entre export.js y el flujo de metas (aportes tratados igual en CSV)
- Reporta en tabla: Área | Problema | Impacto | Corrección
