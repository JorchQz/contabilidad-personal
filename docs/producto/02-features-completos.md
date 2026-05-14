# Features Completos — JM Finance v2

## Módulo 1: Motor de Distribución de Ingresos ⭐ NÚCLEO

**El corazón de la app. Todo lo demás lo alimenta o consume.**

### Qué hace
Cuando el usuario registra cualquier ingreso, la app calcula automáticamente cómo distribuirlo según sus compromisos y objetivos. No le dice cuánto ganó — le dice qué hacer con lo que ganó.

### Flujo de usuario
1. Usuario abre la app al cobrar
2. Registra el ingreso ("cobré mi quincena $6,500")
3. La app muestra inmediatamente:
   ```
   De tu quincena de $6,500 aparta:
   ─────────────────────────────────
   🏠 Renta (sinking fund)     $1,500
   💳 Caja Popular (cuota)     $  785
   ⚡ CFE (sinking fund)       $  200
   🛒 Despensa (presupuesto)   $1,200
   🚌 Transporte               $  600
   ─────────────────────────────────
   ✅ Libre para gastar        $2,215
   ```
4. Si hay remanente después de cubrir todo: sugerir abonar a capital o meta de ahorro

### Reglas de negocio
- Jerarquía: gastos fijos → deudas próximas → sinking funds → presupuestos → metas → libre
- Si el ingreso no alcanza para todo: mostrar déficit y sugerir qué recortar
- Sinking fund = (monto_gasto / períodos_entre_pago_y_cobro) por cada ingreso

### Estado actual en el código
- Existe `loadDashboard()` con semáforo de salud
- Existe `getPagosPendientes()` en balance.js
- **Falta**: el motor de distribución proactivo al registrar un ingreso

---

## Módulo 2: Sobres / Apartado Gradual

**Resuelve el problema de "cobro semanal, pago mensual".**

### Qué hace
Muestra cuánto tiene apartado para cada compromiso futuro y cuánto falta, en tiempo real.

### Flujo de usuario
- "Renta $3,000 — tienes apartado $1,875 — faltan $1,125 — 4 quincenas"
- Barra de progreso visual por cada sobre
- Al llegar la fecha de pago: "Tu sobre de Renta está listo ✓ Paga con confianza"

### Reglas de negocio
- Los apartados son virtuales (no mueven dinero real, solo contabilizan)
- La cuenta fuente del apartado se configura por sobre
- Si el usuario tiene ingreso variable y no apartó suficiente: alerta de déficit proyectado

### Estado actual en el código
- Existe `metas_ahorro` con `frecuencia_ahorro` — puede reutilizarse para sobres
- **Falta**: la lógica de sinking fund automático ligada a gastos fijos

---

## Módulo 3: Créditos con Amortización Real

**El módulo de deudas actual es incorrecto para caja popular y SOFOM.**

### Qué hace
- Al registrar un préstamo: genera automáticamente la tabla de amortización completa
- Muestra en cada cuota: capital / interés / IVA
- Simula en tiempo real el impacto de abonar extra a capital
- Cuando el usuario paga: descuenta solo el CAPITAL del saldo de la deuda; el interés + IVA se registran como gasto separado ("Intereses pagados")

### Flujo para el préstamo de Caja Pio 12 ($20,000, 2% mensual, 36 cuotas)
1. Usuario registra: tipo "Préstamo fijo", $20,000, 2% mensual, 36 pagos
2. App genera tabla automáticamente (como el PDF que tiene)
3. Al pagar la cuota 1 ($1,035): registra capital $556 como pago de deuda + interés $413 + IVA $66 como gasto "Intereses bancarios"
4. Saldo de la deuda baja de $20,000 a $19,444 (correcto)
5. Simulador: "Si abonas $500 extra este mes → te liberas en 33 meses en lugar de 36 → ahorras $680"

### Abono extra a capital
- Modal especial: "¿Quieres abonar más del mínimo?"
- Muestra: ahorro en intereses y meses que se acorta
- Dos opciones: "Quiero pagar menos cada mes" o "Quiero terminar antes"
- Regenera la tabla de pagos futuros

### Estado actual en el código
- Existe `calcularProyeccionLiquidacion()` — funciona pero incompleta
- Existe tipo 'tabla' — se puede reutilizar la lógica
- **Bug crítico**: `guardarPagoDeuda()` descuenta el total en lugar del capital → DEBE CORREGIRSE
- **Falta**: separación automática capital/interés/IVA al registrar pago; generador de tabla desde parámetros

---

## Módulo 4: Tarjeta de Crédito — Ciclo Completo

**El más complejo. Requiere diseño cuidadoso.**

### Qué hace
- Registra fecha de corte y fecha límite de pago
- Clasifica cada compra al período correcto (antes/después del corte)
- Maneja MSI: distribuye la compra en cuotas mensuales
- Calcula cuánto apartar de cada ingreso para el próximo pago

### Flujo MSI
1. Usuario: "Compré celular $8,000 a 12 MSI en Coppel"
2. App pregunta: "¿Cuándo fue la compra?" → "¿Entró antes o después del corte?"
3. Crea 12 cargos de $667/mes en el período correspondiente
4. El motor de distribución automáticamente incluye estas cuotas en los sobres futuros

### Estado actual en el código
- NO existe ningún manejo de ciclo TDC
- Las tarjetas se registran como `tipo='credito'` con `es_pasivo=true` — base correcta
- **Falta**: columnas `fecha_corte`, `fecha_limite_pago`, `limite_credito` en cuentas; tabla `gastos_diferidos`; lógica de clasificación por período

---

## Módulo 5: Ingresos Variables y Sugerencias Proactivas

### Qué hace
Cuando llega un ingreso no programado (venta, bono, regalo):
- Calcula si ya están cubiertos todos los compromisos del mes
- Si hay superávit: "Tienes $2,000 libres este mes. ¿Qué haces con ellos?"
  - Opción A: Abonar a [deuda de mayor costo] → "Te ahorras $X en intereses"
  - Opción B: Guardar en sobre [meta]
  - Opción C: Gastar libremente

### Mensajes proactivos adicionales
- "Llevas 3 meses pagando solo el mínimo de Coppel. A este ritmo terminas en 18 años y pagas $12,000 en intereses."
- "Si subes $200/quincena a tu cuota de Caja Popular, terminas 8 meses antes."
- "¡Liquidaste tu deuda con mamá! 🎉 Esos $500 mensuales ahora pueden ir a Coppel."

---

## Módulo 6: Consejero de Salud Financiera

### Indicadores en tiempo real
- **Ratio de endeudamiento**: cuotas/ingreso. Saludable < 30%, precaución 30–40%, crítico > 40%
- **Fondo de emergencia**: meta automática = 3 meses de gastos fijos. Indica cuánto falta.
- **Costo total de deudas**: suma de intereses proyectados al ritmo actual
- **Fecha de libertad financiera**: cuándo termina de pagar todas sus deudas al ritmo actual

### Pantalla de resumen mensual
Al cierre de cada mes, la app muestra:
- Cuánto pagó de capital vs. intereses
- Si mejoró o empeoró su ratio de endeudamiento
- La deuda que más le cuesta (mayor interés) y qué pasaría si la ataca primero

---

---

## Módulo 7: Simulador de Compras ⭐ DIFERENCIADOR

**Responde la pregunta antes de que sea un error: "¿Puedo permitirme esto?"**

### El problema que resuelve
El 63% de mexicanos hace presupuesto pero igual cae en deudas (Bravo 2026). La causa: el dinero *estaba* disponible pero *ya estaba comprometido*. El simulador hace visible ese compromiso antes de la compra.

### Los 4 escenarios

**A — Compra en efectivo:**
Muestra cuánto queda realmente libre después de descontar todos los sobres y compromisos activos. Veredicto: ✅ Cómodo / ⚠️ Justo / 🔴 No alcanza.

**B — TDC al contado (pagar en el corte):**
Calcula si el total cabe en la distribución del ingreso antes de la fecha límite de pago. Si no cabe, avisa cuánto quedaría libre y cuándo sería el mejor momento.

**C — TDC a MSI:**
El más importante. Muestra:
- Cuota mensual real ($800/mes)
- % del ingreso comprometido durante X meses ("8.4% de tu ingreso por 12 meses")
- Equivalente en quincenas de trabajo ("Esta compra = 3.2 quincenas")
- Nuevo semáforo de salud si se hace la compra
- Alerta si la promoción MSI tiene riesgo de intereses retroactivos

**D — Comprar a crédito (pedir prestado):**
- Cuota mensual calculada con amortización francesa
- Total real que se pagará (capital + intereses)
- "Pagas $3,480 extra por comprar hoy en lugar de ahorrar"
- Comparativa: ¿cuánto tardarías en ahorrarlo vs. cuánto cuesta pedirlo prestado?

### La métrica clave: "ingresos sacrificados"
> "Para pagar esto a 12 MSI comprometes el 8.4% de tus ingresos durante 1 año completo."
> "Esta compra equivale a 3.2 quincenas de trabajo."

Conecta emocionalmente — no es un número abstracto, es tiempo de vida.

### Implementación
- **No requiere tablas nuevas en BD** — es lógica pura en JS
- Corre el motor de distribución con un gasto hipotético adicional
- **Versión básica (efectivo)**: disponible desde Fase 1 junto al motor de distribución
- **Versión completa (MSI + crédito)**: disponible desde Fase 3 junto al ciclo TDC

### Estado actual
No existe. Construcción en dos etapas integradas a Fases 1 y 3.

---

## Resumen de Features por Prioridad

| # | Feature | Impacto | Complejidad | Estado |
|---|---------|---------|-------------|--------|
| 1 | Motor de distribución de ingresos | ⭐⭐⭐ | Alta | No existe |
| 2 | Amortización real (capital vs interés) | ⭐⭐⭐ | Alta | Parcial (bug) |
| 3 | TDC ciclo completo (corte + MSI) | ⭐⭐⭐ | Muy alta | No existe |
| 4 | Sinking funds automáticos | ⭐⭐⭐ | Media | Parcial |
| 5 | Simulador abono extra a capital | ⭐⭐ | Media | Parcial |
| 6 | Sugerencias proactivas con ingreso variable | ⭐⭐ | Media | No existe |
| 7 | Consejero salud financiera (dashboard) | ⭐⭐ | Media | Parcial |
| 8 | Registro de gastos y categorías | ⭐ | Baja | Completo ✓ |
| 9 | Metas de ahorro (sobres) | ⭐ | Baja | Completo ✓ |
| 10 | Exportación CSV/PDF | ⭐ | Baja | Completo ✓ |
