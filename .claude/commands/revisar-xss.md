Invoca al agente `auditor-qa-seguridad` con model: **opus** para escanear vulnerabilidades XSS.

Razón del modelo: XSS en app financiera = crítico. Opus no omite vectores de ataque que Sonnet puede pasar por alto en contextos ambiguos.

Instrucciones para el agente:
- Busca con Grep todos los `innerHTML` en js/*.js — para cada uno: ¿el dato viene de Supabase (controlado por usuario)? ¿pasó por `escapeHtml`?
- Priorizar: gastos.js (descripcion), deudas.js (acreedor), metas.js (nombre), onboarding.js (nombre de usuario, buscador de bancos)
- Busca `<option>` con datos raw: c.nombre, d.acreedor, m.nombre sin escapeHtml
- Busca chips/selectors donde cat.nombre o cat.emoji se inserten en innerHTML sin escape
- Busca `onclick="fn('${val}')"` — dato de usuario como string en onclick es inyección confirmada
- Verifica que la implementación de `escapeHtml` en cada módulo sea idéntica a la del proyecto:
  `return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')`
- Reporta en tabla: Severidad | Archivo:Línea | Tipo | Vector de ataque | Fix
- Niveles: CRITICO (XSS confirmado) / ALTO (XSS potencial) / MEDIO / BAJO
