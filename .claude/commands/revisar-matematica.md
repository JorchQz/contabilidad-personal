Invoca al agente `auditor-qa-seguridad` con modelo sonnet para auditar robustez matemática de montos y cálculos.

Instrucciones para el agente:
- Busca con Grep: parseFloat, parseInt, Number( en js/*.js
- Verifica que todos los montos pasen: `!isNaN(val) && isFinite(val) && val > 0`
- Detecta dónde `Infinity` puede pasar la validación (5 funciones conocidas: guardarTraspaso, guardarPagoDeuda, guardarGasto, abonarMeta, guardarGastoFijo)
- Busca `parseInt` sin base 10 — deben ser `parseInt(str, 10)` siempre
- Busca divisiones donde el denominador puede ser 0 (progreso %, tasas, plazos)
- Verifica que porcentajes guarden denominador: `denom > 0 ? Math.round(num/denom*100) : 0`
- Reporta en tabla: Severidad | Archivo:Línea | Problema | Fix
