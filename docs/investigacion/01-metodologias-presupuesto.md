# Investigación: Metodologías de Presupuesto Personal Probadas

## 1. Método YNAB (You Need A Budget) — Las 4 reglas

| Regla | Descripción | Aplicación en JM Finance |
|---|---|---|
| "Dale trabajo a cada peso" | Cada peso que entra se asigna ANTES de gastarse | Motor de distribución: al registrar ingreso, la app asigna automáticamente |
| "Abraza tus gastos reales" | Gastos irregulares se dividen en cuotas mensuales y se apartan | Sinking funds: CFE bimestral, predial, colegiatura → apartar cada quincena |
| "Rueda con los golpes" | Cuando una categoría se agota, se mueve de otra conscientemente | El usuario ve el trade-off real: "si gastas en X, le quitas a Y" |
| "Envejece tu dinero" | Objetivo: el dinero que gastas hoy entró hace 30+ días | El ciclo quincenal/semanal converge en estabilidad mensual |

**Dato clave YNAB**: usuarios nuevos ahorran promedio $600 USD en el primer mes. El mecanismo es la **fricción consciente**: ver en tiempo real el trade-off entre "café" vs "deuda".

**Diferencia crítica con apps de registro**: registro = descriptivo (qué pasó). YNAB = prescriptivo (qué hacer). JM Finance debe ser prescriptivo.

---

## 2. Método de Sobres (Envelope Budgeting) — Adaptado a México

### El problema que resuelve para el usuario mexicano:
Cobra quincenal ($6,000 cada 15 días), renta mensual $3,000 el día 1.

**Sin la app**: llega el cobro, gasta libremente, llega el día 1 y no tiene para la renta.

**Con sinking fund automático**: la app calcula que debe apartar $1,500 de cada quincena → cuando llega el día 1 el sobre ya está lleno.

### Gastos mexicanos que requieren sinking funds:
- Renta/hipoteca (mensual)
- CFE (bimestral)
- Agua (bimestral o mensual)
- Predial (anual, algunas ciudades semestrales)
- Colegiaturas (mensual, 10 meses)
- IMSS voluntario / seguro de gastos médicos
- Placas / tenencia vehicular (anual)
- Cuotas de deuda (mensual/quincenal)

**Implementación**: la app conoce frecuencia del ingreso del usuario y frecuencia de cada gasto → calcula automáticamente cuánto apartar de cada cobro.

---

## 3. Pago de Deudas: Bola de Nieve vs. Avalancha

| | Bola de Nieve | Avalancha |
|---|---|---|
| Orden | Deuda más pequeña primero | Deuda con mayor tasa primero |
| Costo total | Mayor (más intereses) | Menor (óptimo matemático) |
| Adherencia psicológica | Alta — victorias frecuentes | Baja al inicio si la primera deuda es grande |

**Evidencia (HBR 2016, Kellogg School 2012)**: para usuarios sin disciplina financiera previa, la bola de nieve produce mayor tasa de adherencia. La motivación de eliminar una deuda (aunque pequeña) genera momentum que compensa el costo extra.

**Decisión para JM Finance**: 
- Default = **bola de nieve**
- Mostrar siempre cuánto ahorraría cambiando a avalancha ("Si pagas Coppel primero, ahorras $X en intereses")
- El usuario elige con información, no por tecnicismo

---

## 4. Apps Existentes — Brechas Identificadas

| App | Fortaleza | Lo que le falta |
|---|---|---|
| **Finerio** (MX) | Open Banking mexicano, categorización auto, español | Sin método de sobres, sin amortización real, conexión bancaria inestable |
| **Goodbudget** | Mejor implementación digital de sobres, sin banco requerido | Sin conexión bancaria, límite de sobres en gratis, sin amortización |
| **Mobills** | UI moderna, maneja TDC con corte | Módulo de deudas básico, sin sinking funds, sin amortización |
| **Wallet** (BudgetBakers) | Presupuestos sólidos, exportación | Conexión MX inconsistente, caro, curva de aprendizaje alta |
| **YNAB** | La metodología más probada del mundo | En inglés, $14/mes, complejo para usuario objetivo |

### La brecha que nadie cubre en México:
Ninguna app combina:
1. ✅ Sinking funds automáticos para ciclo quincenal/semanal mexicano
2. ✅ Tabla de amortización con simulador de abono extra a capital
3. ✅ UI simple para usuarios sin educación financiera
4. ✅ Manejo correcto del ciclo TDC (corte + MSI + impacto en ingreso)
5. ✅ Lenguaje coloquial mexicano, sin tecnicismos

---

## 5. Amortización Francesa — Fórmulas para Implementación

### Cuota fija mensual:
```
M = P × [r(1+r)^n] / [(1+r)^n - 1]

P = capital inicial (ej. $20,000)
r = tasa mensual (ej. 2% = 0.02)
n = número de pagos (ej. 36)
```

### Desglose de cada cuota (mes k):
```
interés_k = saldo_k × r
capital_k = M - interés_k
saldo_k+1 = saldo_k - capital_k
```

### Impacto de abono extra a capital (MUY IMPORTANTE para la app):
- Si el usuario abona $1,000 extra al capital en el mes 3 de un préstamo de $20,000 al 2% mensual, 36 cuotas:
  - Ahorra aproximadamente $800–$1,200 en intereses
  - Reduce el plazo en 2–3 meses
- **Mostrar este impacto en tiempo real genera el comportamiento deseado** (motivación para abonar más)

### Para usuarios de caja popular:
- El 70–80% de los primeros pagos es interés. Un usuario que lleva 12 meses pagando $20,000 al 2% ha pagado ~$3,200 de capital y ~$4,200 en intereses. Sin visualización, percibe que "pagué mucho y debo casi lo mismo" → desmotivación.

---

## Conclusiones para el Diseño

| Prioridad | Feature | Fundamento |
|---|---|---|
| 1 | Sinking funds quincenales automáticos | Realidad del calendario mexicano |
| 2 | Bola de nieve como modo default | Adherencia psicológica comprobada |
| 3 | Amortización real con simulador de abono extra | Motivación y educación financiera |
| 4 | Asignación de ingreso ANTES de gastar | Diferenciador vs. apps de registro |
| 5 | "Si abonas $X extra, te ahorras $Y en intereses" | Refuerzo positivo inmediato |
