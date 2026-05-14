Invoca al agente `auditor-ui-ux` con modelo haiku para detectar iconos que no sean Lucide en las plantillas JS.

Instrucciones para el agente:
- Busca con Grep en js/*.js: `bx bx-`, `fa fa-`, `fas fa-`, `far fa-`, `bi bi-` — estos son BoxIcons/FontAwesome prohibidos
- Busca uso del ícono `chart-line` — no existe en Lucide, el correcto es `line-chart`
- Verifica que todo ícono use el patrón: `<i data-lucide="nombre-icono"></i>` seguido de `renderLucideIcons()`
- Confirma que después de cada innerHTML que incluya íconos Lucide se llame renderLucideIcons()
- Reporta: Archivo | Línea | Ícono incorrecto | Reemplazo correcto
