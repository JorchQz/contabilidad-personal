Invoca al agente `auditor-ui-ux` con model: **haiku** para detectar iconos no Lucide en las plantillas JS.

Razón del modelo: matching de patrones de texto puro — tarea ideal para Haiku: rápido, económico, sin necesidad de razonamiento profundo.

Instrucciones para el agente:
- Busca con Grep en js/*.js: `bx bx-`, `bx bxl-`, `fa fa-`, `fas fa-`, `far fa-`, `bi bi-` — sistemas de iconos prohibidos en templates JS
  - Excepción conocida: `app.js` usa `bx bx-sun` y `bx bx-moon` en el toggle de tema (legacy permitido, no reportar)
  - Excepción conocida: `gastos.js` GASTOS_FIJOS_CATALOGO puede tener `bx bxl-youtube` — SÍ reportar, necesita reemplazo
- Busca el ícono `chart-line` — no existe en Lucide; el correcto es `line-chart`
- Verifica que todo ícono Lucide use el patrón: `<i data-lucide="nombre"></i>` con `style="width:Xpx;height:Xpx;stroke-width:1.75"`
- Confirma que después de cada bloque innerHTML que incluya `data-lucide` se llame `renderLucideIcons()` o `lucide.createIcons()`
- Reporta: Archivo | Línea | Ícono incorrecto | Reemplazo Lucide correcto
