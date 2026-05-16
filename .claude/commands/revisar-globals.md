Invoca al agente `auditor-logica-js` con modelo sonnet para auditar variables globales y fugas de memoria.

Instrucciones para el agente:
- Busca con Grep: `window\.` en todos los archivos js/*.js
- Clasifica cada `window.X`:
  - Función expuesta para onclick → válido
  - Variable de estado o datos temporales → problema
- Verifica que onboarding.js use prefijo `_onb` en sus globals para no colisionar con metas.js: `window._onbMetaIcono` vs `window._metaIcono`, `window.toggleOnboardingMetaIconPanel` vs `window.toggleMetaIconPanel`
- Busca `addEventListener` añadido dentro de funciones de render (loadDeudas, loadMetas, loadGastos, etc.) — si se llama repetidamente sin cleanup, se acumulan listeners
- Busca `setInterval` / `setTimeout` sin su `clearInterval` / `clearTimeout` correspondiente
- Verifica que balance.js y distribucion.js no accedan a `document.*` — deben ser módulos de cálculo puro
- Reporta: Severidad | Archivo:Línea | Problema | Impacto | Corrección
