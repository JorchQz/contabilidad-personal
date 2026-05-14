Invoca al agente `auditor-logica-js` con modelo sonnet para auditar variables globales y fugas de memoria.

Instrucciones para el agente:
- Busca con Grep: `window\.` en todos los archivos js/*.js
- Clasifica cada window.* como: función expuesta para onclick (válido) vs variable de estado temporal (riesgo)
- Verifica que onboarding.js use prefijo `_onb` para sus globals (ej. window._onbMetaIcono) para no colisionar con metas.js
- Busca `addEventListener` sin su correspondiente `removeEventListener`
- Busca `setInterval` / `setTimeout` sin su `clearInterval` / `clearTimeout`
- Detecta variables declaradas fuera de funciones en scope de módulo que muten estado global
- Reporta: Severidad | Archivo:Línea | Problema | Impacto | Corrección
