Invoca al agente `auditor-qa-seguridad` con modelo opus para escanear vulnerabilidades XSS en todos los módulos JS.

Instrucciones para el agente:
- Busca con Grep todos los `innerHTML` en js/*.js
- Para cada uno: ¿el dato viene del usuario? ¿pasó por `escapeHtml`?
- Priorizar: gastos.js (descripcion en edición), onboarding.js (nombre usuario, query buscador bancos)
- Busca `<option>` con datos raw: c.nombre, d.acreedor, m.nombre sin escape
- Busca chips/selectors donde cat.nombre o cat.emoji se inserten sin escapeHtml
- Verifica que onclick con datos de usuario use data-* en lugar de string interpolado
- Reporta en tabla: Severidad | Archivo:Línea | Tipo | Vector de ataque | Fix
- Niveles: CRITICO (XSS confirmado) / ALTO (XSS potencial) / MEDIO / BAJO
