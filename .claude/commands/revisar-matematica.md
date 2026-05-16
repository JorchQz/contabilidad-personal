Invoca al agente `auditor-qa-seguridad` con model: **sonnet** para auditar robustez matemática de montos y cálculos.

Razón del modelo: análisis sistemático de patrones matemáticos — Sonnet maneja esto eficientemente sin necesitar el razonamiento profundo de Opus.

Instrucciones para el agente:
- Busca con Grep: `parseFloat`, `parseInt`, `Number(` en js/*.js
- Verifica que todos los montos pasen: `!isNaN(val) && isFinite(val) && val > 0 && val <= 999_999_999`
  — `isFinite` es crítico: rechaza Infinity. Sin él, `Infinity` pasa `val > 0`.
- Detecta divisiones donde el denominador puede ser 0 o null (progreso %, tasas, plazos, semáforo)
  — el patrón correcto es: `denom > 0 ? Math.round(num/denom*100) : 0`
- Busca `parseInt` sin base 10 — deben ser `parseInt(str, 10)` siempre
- Busca `await db.from(...).update/insert/delete` sin verificar `{ error }` antes de actualizar UI
- Verifica en balance.js: condición de deuda inliquidable → `monto_pago <= saldo × (tasa_anual/12/100)` debe mostrar alerta
- Reporta en tabla: Severidad | Archivo:Línea | Problema | Fix
