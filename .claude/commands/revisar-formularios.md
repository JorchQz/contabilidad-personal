Invoca al agente `auditor-ui-ux` con modelo haiku para auditar la consistencia visual de formularios y modales.

Instrucciones para el agente:
- Lee los archivos js/*.js y busca plantillas HTML con formularios (innerHTML con form, input, select)
- Verifica que inputs usen las variables CSS correctas del sistema de diseño (no clases Tailwind — este proyecto usa CSS custom properties)
- Detecta variables CSS inexistentes: --font-body, --font-display, --text-primary no existen; las correctas son --font, --text, --text-secondary
- Busca colores legacy hardcodeados: rgba(124,108,252,...) y rgba(240,93,110,...) en deudas.js
- Detecta labels sin atributo for= correspondiente al id del input
- Verifica que FAB menu no se salga de pantalla en viewports < 430px
- Reporta en tabla: Archivo | Línea | Problema | Corrección sugerida
