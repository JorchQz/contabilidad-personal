# Índice de Documentación — JM Finance

## ⚡ LEER PRIMERO (en este orden)
1. [01 — Visión y Problema](01-vision-y-problema.md) — El problema real, el usuario objetivo, propuesta de valor en 1 frase.
2. [06 — Personas de Usuario](06-personas-usuario.md) — Lupita, Don Ernesto y Karla: quiénes son, qué necesitan, qué los frustra.
3. [02 — Features Completos](02-features-completos.md) — Los 6 módulos con flujos completos y estado actual del código.

## 📐 DISEÑO DE PRODUCTO
- [04 — User Stories](04-user-stories.md) — 11 historias de usuario con criterios de aceptación y casos borde.
- [05 — Reglas de Negocio](05-reglas-de-negocio.md) — TODAS las fórmulas, cálculos y reglas (amortización, sinking funds, ciclo TDC, distribución ZBB).
- [07 — Onboarding Rediseño](07-onboarding-rediseño.md) — 7 pasos rediseñados desde cero con el nuevo enfoque.
- [03 — Qué Existe vs Qué Necesitamos](03-comparacion-existe-vs-necesario.md) — Qué conservar, corregir, reemplazar y construir del código actual.

## 🔬 INVESTIGACIÓN (con datos reales)
- [Mercado México](../investigacion/02-mercado-mexico.md) — Datos CNBV/CONDUSEF/Bravo 2026: 77% al límite, deuda promedio $193K, 47% no sabe cuánto tarda en pagar. **Leer para entender al usuario.**
- [Metodologías de Presupuesto](../investigacion/01-metodologias-presupuesto.md) — YNAB, sobres, bola de nieve/avalancha, análisis de competidores.
- [Flujos Técnicos TDC y Amortización](../investigacion/03-flujos-tecnicos-tdc-amortizacion.md) — Fórmulas, algoritmos, código de referencia, tablas de BD.

## 🏗️ TÉCNICO
- [Arquitectura Nueva](../tecnico/01-arquitectura-nueva.md) — Módulos JS redefinidos, esquema BD v2 completo, flujos de datos, orden de implementación.

---

## Estado de la documentación

| Documento | Estado | Última actualización |
|---|---|---|
| Visión y problema | ✅ Completo | Sesión 2 |
| Personas de usuario | ✅ Completo | Sesión 3 |
| Features completos | ✅ Completo | Sesión 2 |
| User stories con criterios | ✅ Completo | Sesión 3 |
| Reglas de negocio | ✅ Completo | Sesión 3 |
| Onboarding rediseñado | ✅ Completo | Sesión 3 |
| Comparación existe vs necesario | ✅ Completo | Sesión 2 |
| Mercado México (datos reales) | ✅ Completo con fuentes | Sesión 3 |
| Metodologías de presupuesto | ✅ Completo | Sesión 2 |
| Flujos técnicos TDC + amortización | ✅ Completo | Sesión 2 |
| Arquitectura nueva | ✅ Completo | Sesión 2 |
| Wireframes / flujos visuales | ⏳ Siguiente sesión | — |
| Especificación completa DB v2 (SQL) | ⏳ Siguiente sesión | — |
| Plan de migración del código actual | ⏳ Siguiente sesión | — |

---

## El dato más importante de toda la investigación

**47% de los deudores mexicanos no sabe cuánto tiempo les tomará pagar sus deudas pagando solo el mínimo.** — Bravo Radiografía 2026

Este es el problema central que JM Finance resuelve: no el registro de lo que pasó, sino la visibilidad de a dónde va el usuario si sigue como está, y la herramienta para cambiarlo.
