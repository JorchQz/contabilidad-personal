Invoca al agente `auditor-ui-ux` con model: **haiku** para auditar consistencia visual de formularios y modales.

Razón del modelo: detección de patrones CSS y HTML — alta velocidad, sin necesidad de razonamiento complejo.

Instrucciones para el agente:
- Lee los archivos js/*.js y busca plantillas HTML con formularios (innerHTML con `form`, `input`, `select`, `label`)
- Verifica que inputs usen variables CSS del sistema de diseño. Las variables válidas son: `--bg-card`, `--bg-elevated`, `--border`, `--text`, `--text-secondary`, `--accent`, `--radius-sm`, `--radius`, `--radius-xl`
- Detecta variables CSS inexistentes:
  - `--font-body` → correcto: `--font`
  - `--font-display` → correcto: `--font`
  - `--text-primary` → correcto: `--text`
  - `--bg-primary` → no existe
- Verifica que los `<label>` tengan atributo `for=` apuntando al `id` del input correspondiente
- Verifica que botones usen las clases: `btn btn-primary` / `btn btn-secondary` / `btn btn-danger` — no estilos inline de color
- Detecta colores hardcodeados en templates: `rgba(`, `#[0-9a-fA-F]` — deben usar variables CSS para respetar dark/light mode
- Verifica que el FAB menu no se salga de pantalla en viewports angostos (posición absoluta vs viewport)
- Reporta en tabla: Archivo | Línea | Problema | Corrección sugerida
