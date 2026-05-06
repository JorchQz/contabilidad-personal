# User Stories — JM Finance

## Cómo leer este documento
Formato: **"Como [usuario], cuando [contexto], quiero [acción] para [beneficio]"**
Cada story tiene: criterios de aceptación (qué tiene que pasar para que sea "done"), casos borde, y notas de UX.

---

## ÉPICA 1: Motor de Distribución de Ingresos

### US-01 — Distribución al cobrar
**Como** usuario que acaba de cobrar su quincena,
**cuando** registro mi ingreso en la app,
**quiero** ver de inmediato cómo dividir ese dinero entre todos mis compromisos
**para** no gastar lo que necesito para pagar y no quedarme corto a fin de mes.

**Criterios de aceptación:**
- [ ] Al guardar un ingreso, la app muestra automáticamente la pantalla de distribución
- [ ] La distribución incluye: gastos fijos del período, cuotas de deuda próximas (≤30 días), sinking funds calculados, presupuestos de categorías, metas de ahorro, remanente libre
- [ ] Cada ítem muestra: nombre, monto sugerido, por qué (ej. "Renta — pago el día 1")
- [ ] Si el ingreso no alcanza para todo, muestra déficit en rojo con la opción de priorizar
- [ ] El usuario puede ajustar los montos antes de confirmar
- [ ] Si hay remanente, sugiere abonar a la deuda de mayor costo

**Casos borde:**
- Ingreso = $0: no mostrar distribución, mostrar mensaje de apoyo
- Sin compromisos registrados: "Registra tus gastos fijos y deudas para que puedas usar esta función"
- Déficit total: "Tus compromisos de este período son $X pero cobras $Y. Faltan $Z. ¿Cuál pospones?"

**UX:**
- Esta es la pantalla más importante de la app — diseñar como "moment of joy", no como planilla
- Mostrar primero el total libre: "Te quedan $2,215 libres después de todos tus compromisos"
- Usar lenguaje de soporte: "tienes cubierto", "falta apartar", no jerga financiera

---

### US-02 — Sinking fund automático para gasto irregular
**Como** usuario que cobra quincenal pero paga la renta mensual,
**cuando** la app calcula mi distribución,
**quiero** que me diga cuánto apartar de cada quincena para la renta
**para** que cuando llegue el día 1 ya tenga el dinero sin que "duela".

**Criterios de aceptación:**
- [ ] La app detecta automáticamente qué gastos fijos tienen frecuencia mayor al ingreso (mensual vs. quincenal, bimestral, anual)
- [ ] Calcula el apartado proporcional: monto_gasto / (frecuencia_gasto / frecuencia_ingreso)
- [ ] Muestra el sobre con: "Renta — tienes $1,500 de $3,000 — faltan 1 quincena"
- [ ] Cuando el sobre está completo: "✓ Tu sobre de Renta está listo. Paga con confianza."
- [ ] Si el usuario no aparta en un período: el siguiente periodo sugiere compensar

**Casos borde:**
- Gasto bimestral (CFE): dividir entre 4 quincenas → apartar 25% cada quincena
- Gasto anual (predial): dividir entre 24 quincenas → apartar 4.17% cada quincena
- Usuario que cobra mensual pero tiene gasto quincenal: apartar la mitad cada mes

---

## ÉPICA 2: Créditos con Amortización Real

### US-03 — Registrar préstamo de caja popular correctamente
**Como** usuario que pidió $20,000 a la caja popular,
**cuando** registro ese préstamo,
**quiero** que la app genere mi tabla de amortización automáticamente
**para** saber exactamente cuánto pago de capital vs. interés cada mes y cuándo termino.

**Criterios de aceptación:**
- [ ] Al registrar tipo "Préstamo fijo" con monto, tasa mensual y número de pagos → app genera tabla completa
- [ ] Pantalla de detalle muestra: saldo actual, próximo pago, desglose capital/interés/IVA
- [ ] Barra visual: "De tu cuota de $785, $385 reducen tu deuda y $400 son intereses"
- [ ] Fecha estimada de liquidación al ritmo actual
- [ ] Al registrar el ingreso del préstamo: suma el monto al efectivo Y crea la deuda simultáneamente

**Casos borde:**
- Usuario no sabe su tasa → funciona con tasa=0, proyección sin interés, nota: "Agrega tu tasa para una proyección exacta"
- Usuario no sabe número de pagos → funciona sin él, proyección aproximada

---

### US-04 — Pagar cuota de préstamo correctamente
**Como** usuario que va a pagar su cuota mensual de caja popular,
**cuando** registro el pago,
**quiero** que la app sepa cuánto de ese pago es capital y cuánto es interés
**para** que mi saldo de deuda baje el monto correcto y el interés quede registrado como gasto.

**Criterios de aceptación:**
- [ ] El modal de pago muestra automáticamente: "Esta cuota = $556 capital + $413 intereses + $66 IVA = $1,035 total"
- [ ] Al confirmar: descuenta $556 del saldo de la deuda (no $1,035)
- [ ] Crea un gasto automático de $479 (interés+IVA) en categoría "Intereses bancarios"
- [ ] Descuenta $1,035 de la cuenta seleccionada (el monto real que sale del bolsillo)
- [ ] El progreso de la deuda muestra % correcto basado en capital pagado

**Casos borde:**
- Pago mayor al esperado (abono extra): ver US-05
- Pago menor al esperado: marcar como pago parcial, recalcular deuda
- Sin tabla de amortización: funciona como antes (descuenta el total de la deuda) con nota de advertencia

---

### US-05 — Simular y registrar abono extra a capital
**Como** usuario que quiere salir más rápido de su deuda de caja popular,
**cuando** tengo dinero extra este mes,
**quiero** ver qué pasa si abono más del mínimo
**para** decidir si vale la pena y cuánto me ahorro.

**Criterios de aceptación:**
- [ ] Botón "Abonar extra a capital" visible en la tarjeta de deuda
- [ ] Simulador: "Si abonas $1,000 extra: terminas 3 meses antes (feb 2028 vs. mayo 2028) y ahorras $680 en intereses"
- [ ] Dos opciones: "Quiero terminar antes (cuota igual)" o "Quiero pagar menos cada mes (mismos periodos)"
- [ ] Al confirmar: regenera tabla de amortización desde el nuevo saldo
- [ ] Celebración visual: "¡Avanzaste 3 meses de golpe! 🎯"

---

## ÉPICA 3: Tarjeta de Crédito Ciclo Completo

### US-06 — Configurar ciclo de TDC
**Como** usuario con tarjeta de crédito,
**cuando** registro mi tarjeta en la app,
**quiero** configurar mi fecha de corte y fecha límite de pago
**para** que la app sepa en qué período cae cada compra y cuándo debo pagar.

**Criterios de aceptación:**
- [ ] Al crear cuenta tipo "crédito": campo adicional "Fecha de corte (día del mes)" y "Fecha límite de pago (día del mes siguiente)"
- [ ] La app explica en lenguaje simple: "Todo lo que compres del día 21 al día 20 del siguiente mes va en ese estado de cuenta"
- [ ] Campo "Límite de crédito" para mostrar % de utilización

---

### US-07 — Compra a meses sin intereses
**Como** usuario que compró un celular a 12 MSI en Coppel,
**cuando** registro esa compra en la app,
**quiero** que los 12 cargos mensuales aparezcan automáticamente en mis gastos futuros
**para** que el motor de distribución incluya esas cuotas en cada ingreso próximo.

**Criterios de aceptación:**
- [ ] Al registrar gasto con TDC: opción "¿A cuántos meses?" (1, 3, 6, 9, 12, 18, 24)
- [ ] Si elige "12 MSI": crea 12 cargos de (monto/12) en los 12 períodos de corte siguientes
- [ ] Esos cargos aparecen en el motor de distribución en cada quincena/mes correspondiente
- [ ] Pantalla de TDC muestra: compras del período actual + MSI activos con meses restantes
- [ ] Alerta si la promoción MSI termina y no se ha pagado el total: "¡Atención! Tu MSI de $8,000 vence en 30 días. Si no pagas el total antes, Coppel cobrará intereses retroactivos."

**Casos borde:**
- Compra después del corte: va al período siguiente (no al actual)
- Cancelación de MSI: preguntar si ya se pagó algo y ajustar
- Compra a meses CON interés (no MSI): calcular la cuota con la fórmula de amortización

---

## ÉPICA 4: Ingresos Variables y Sugerencias Proactivas

### US-08 — Sugerencia con ingreso no programado
**Como** usuario al que le cayó un bono o hizo una venta extra,
**cuando** registro ese ingreso como "ingreso extraordinario",
**quiero** que la app me sugiera qué hacer con ese dinero
**para** aprovecharlo para salir de deudas en lugar de gastarlo sin plan.

**Criterios de aceptación:**
- [ ] La app detecta que es un ingreso fuera del patrón habitual
- [ ] Calcula si ya están cubiertos todos los compromisos del mes
- [ ] Si hay superávit: "Ya tienes cubierto todo este mes. Te sobran $2,500. ¿Qué prefieres?"
  - Opción A: "Abonar a [deuda X] → te ahorras $Y en intereses"
  - Opción B: "Guardar en sobre [meta]"
  - Opción C: "Gastar libremente"
- [ ] Si el usuario elige abonar: lo registra como abono extra directamente

---

## ÉPICA 5: Consejero de Salud Financiera

### US-09 — Ver cuándo termino de pagar todo
**Como** usuario con múltiples deudas,
**cuando** abro la pantalla de "mis deudas",
**quiero** ver cuándo termino de pagar cada una al ritmo actual
**para** mantenerme motivado y saber qué priorizar.

**Criterios de aceptación:**
- [ ] Cada deuda muestra: "Libre en X meses · [mes año]"
- [ ] Si paga solo el mínimo de TDC: "A este ritmo terminas en 14 años y pagas $18,000 en intereses. Pagando $500 extra/mes terminas en 2 años."
- [ ] Panel general: "Tu deuda más cara: Coppel (CAT ~120%). Atacarla primero te ahorra $X."
- [ ] Fecha en que estaría libre de TODAS sus deudas si sigue el plan actual

### US-10 — Alerta de pago mínimo que no cubre intereses
**Como** usuario con tarjeta de crédito con saldo alto,
**cuando** el pago mínimo de esta quincena es menor a los intereses del período,
**quiero** una alerta clara
**para** entender que mi deuda está creciendo aunque esté "pagando".

**Criterios de aceptación:**
- [ ] Si monto_pago_minimo < interes_del_periodo: mostrar alerta amarilla en la tarjeta de deuda
- [ ] Mensaje: "Tu deuda con Coppel creció $320 este mes aunque pagaste el mínimo. Necesitas pagar al menos $850 para que deje de crecer."
- [ ] No juzgar — informar con datos y solución

---

## ÉPICA 7: Simulador de Compras

### US-12 — Simular compra antes de hacerla
**Como** usuario que quiere comprar algo,
**antes de comprarlo o endeudarse**,
**quiero** ver el impacto real en mis finanzas
**para** no arrepentirme después de registrarlo y descubrir que no me alcanzaba.

**Criterios de aceptación:**
- [ ] Accesible desde el FAB principal como "Simular compra" (sin registrar nada todavía)
- [ ] Pregunta primero: ¿Cómo lo vas a pagar? Efectivo / TDC al contado / MSI / Crédito
- [ ] **Efectivo**: muestra saldo libre real (disponible - sobres comprometidos) vs. precio. Veredicto claro.
- [ ] **TDC al contado**: verifica si el pago total cabe antes de la fecha límite con el ingreso proyectado
- [ ] **MSI**: muestra cuota mensual, % del ingreso comprometido, duración, equivalente en quincenas de trabajo, nuevo semáforo
- [ ] **Crédito**: muestra cuota con amortización, total a pagar, diferencia vs. ahorrarlo
- [ ] Siempre muestra el semáforo de salud financiera actual vs. el que resultaría con la compra
- [ ] El simulador NO registra nada — es 100% hipotético. Botón "Registrar esta compra" al final si el usuario decide hacerla.
- [ ] Si el veredicto es negativo: NO prohibir, informar. "Puedes hacerlo, pero considera que..."

**Casos borde:**
- Sin ingresos registrados: "Registra tus ingresos primero para que la simulación sea precisa"
- Monto = $0: no simular
- Monto mayor al límite de crédito de la TDC: alerta de límite excedido

**UX crítico:**
- Esta pantalla debe ser rápida — si tarda más de 2 segundos el usuario ya compró
- Lenguaje coloquial: "te quedan X pesos libres" no "saldo disponible post-asignación"
- La métrica de "quincenas de trabajo" es la que más impacto emocional tiene — mostrarla siempre

---

## ÉPICA 6: Onboarding

### US-11 — Primera configuración sin frustración
**Como** usuario nuevo que nunca ha usado una app de finanzas,
**cuando** abro la app por primera vez,
**quiero** que configurar lo básico me tome menos de 10 minutos
**para** empezar a ver valor real sin abrumarme.

**Criterios de aceptación:**
- [ ] Flujo de 7 pasos con barra de progreso siempre visible
- [ ] Cada paso opcional excepto nombre e ingreso principal
- [ ] Lenguaje 100% coloquial, sin términos financieros técnicos
- [ ] "Puedes agregar esto después" en cada sección compleja
- [ ] Al terminar: mostrar inmediatamente el motor de distribución con sus datos reales

**Notas UX:**
- El paso de deudas (paso 4) no debe abrumar — máximo 2 deudas en el onboarding, las demás se agregan después
- Normalizar tener deudas desde el primer mensaje: "La mayoría de los mexicanos tiene al menos una"
