Invoca al agente `auditor-financiero` con model: **opus** para auditar la lógica de metas de ahorro.

Razón del modelo: las proyecciones de meta involucran cálculos de tiempo/tasa que requieren razonamiento multi-paso para verificar correctamente.

Instrucciones para el agente:
- Verifica que al abonar a una meta, el gasto se cree con `es_ahorro = true` y `meta_id` apuntando a la meta, y que `metas_ahorro.monto_actual` se actualice correctamente
- Confirma que el progreso use denominador guardado: `meta.monto_objetivo > 0 ? Math.round(monto_actual/monto_objetivo*100) : 0`
- Verifica que la estimación de ritmo (cuándo se alcanza la meta) use `created_at` + aportes históricos, no un cálculo estático
- Revisa que `fecha_limite` y `frecuencia_ahorro` se usen para calcular el aporte sugerido por período
- Verifica en export.js que los aportes a metas (`es_ahorro = true`) se traten igual que gastos normales en el CSV, o que estén excluidos coherentemente
- Detecta el caso: meta con `monto_actual > monto_objetivo` — ¿muestra correctamente "Meta alcanzada"?
- Reporta en tabla: Área | Problema | Impacto | Corrección
