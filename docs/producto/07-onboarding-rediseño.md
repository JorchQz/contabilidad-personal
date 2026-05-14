# Rediseño del Onboarding — 7 Pasos

## Principio rector
El onboarding tiene un solo trabajo: en menos de 10 minutos, dar suficiente información para que el motor de distribución funcione la primera vez que el usuario cobra. Todo lo que no sirve para eso, sale del onboarding.

**Lo que SÍ debe salir del onboarding:**
- Nombre del usuario
- Ingreso principal (monto + frecuencia)
- Al menos 1 cuenta (dónde vive su dinero)
- Gastos fijos principales (los 2-3 que más duelen)
- Deudas activas (para el motor de distribución)

**Lo que NO debe estar en el onboarding:**
- Configuración detallada de tarjetas (ciclo de corte, límite) → después
- Tabla de amortización completa → después
- Múltiples cuentas → después
- Presupuestos por categoría → después

---

## Paso 1 de 7: Bienvenida + Nombre

**Objetivo:** Crear conexión emocional y establecer el tono no juzgador.

**Encabezado:** "Hola, ¿cómo te llamas?"

**Subtítulo (una sola vez, en la bienvenida):**
> "JM Finance te ayuda a saber exactamente qué hacer con tu dinero cada vez que cobras, para que no te falte para pagar y puedas salir adelante."

**Campo único:** Primer nombre (máx. 20 caracteres)

**Nota de privacidad (pequeña, al pie):** "Solo tu primer nombre, sin apellidos. Tus datos nunca se comparten."

**Botón:** "Empecemos →"

---

## Paso 2 de 7: Tu Ingreso Principal

**Objetivo:** Conocer el ingreso base para los cálculos del motor de distribución.

**Encabezado:** "¿Cuánto cobras normalmente?"

**Subtítulo:** "Solo el ingreso principal. Si tienes extras, los agregas después."

**Campos:**
1. "¿Cuánto recibes cada vez?" — input de monto
2. "¿Cada cuándo cobras?" — opciones visuales grandes:
   - Cada semana
   - Cada quincena *(selección por defecto)*
   - Cada mes
   - Me pagan irregular

**Si elige "irregular":** mostrar campo adicional: "¿Cuánto recibes al mes aproximado?"

**Hint educativo (primera vez):**
> "No te preocupes si varía un poco. Ponemos un promedio y lo ajustamos después."

---

## Paso 3 de 7: ¿Dónde vives tu dinero?

**Objetivo:** Registrar al menos 1 cuenta para que los saldos sean reales.

**Encabezado:** "¿Dónde guardas tu dinero?"

**Subtítulo:** "Registra la cuenta o lugar donde tienes tu dinero ahora."

**Opciones predefinidas (botones grandes con icono):**
- 💵 Efectivo / guardado en casa
- 🏦 Cuenta de banco (BBVA, Banamex, Bancomer...)
- 📱 Cuenta digital (Nu, Klar, Mercado Pago, OXXO Pay)
- 💰 Caja popular o cooperativa

**Al seleccionar:** pedir nombre y saldo aproximado actual.

**Nota clave:** "No te pedimos tu número de cuenta ni contraseña. Solo cuánto tienes aproximadamente."

**Botón saltar:** "No sé cuánto tengo exactamente — lo ajusto después"

---

## Paso 4 de 7: Tus Gastos Fijos

**Objetivo:** Los compromisos de dinero que no se pueden evitar cada mes.

**Encabezado:** "¿Qué tienes que pagar sí o sí cada mes?"

**Subtítulo:** "Estos son los gastos que siempre tienen que estar cubiertos."

**Catálogo de selección rápida (chips seleccionables, NO formulario):**
```
[Renta] [Hipoteca] [Luz (CFE)] [Agua] [Gas]
[Internet] [Celular] [Colegiatura] [Transporte]
[Seguro] [Mercado/Despensa] [Otro]
```

Al tocar un chip → aparece un campo de monto debajo.
Al desactivar → desaparece.

**Frecuencias que no son mensuales:**
- CFE y Agua: preguntar "¿Lo pagas mensual o bimestral?"
- La app calcula automáticamente el sinking fund

**Límite en onboarding:** máximo 5 gastos fijos. El resto se agrega en la app principal.

**Mensaje motivador:** "Con esto la app sabrá cuánto necesitas guardar de cada cobro para estos pagos."

---

## Paso 5 de 7: Tus Deudas

**Objetivo:** Los compromisos de pago de deuda para incluirlos en la distribución.

**Encabezado:** "¿Tienes deudas activas?"

**Subtítulo:** "No te juzgamos — la mayoría de los mexicanos tiene al menos una. Registrarlas es el primer paso para salir de ellas."

**Tipo selector (igual al rediseñado en sesión anterior):**
- Préstamo fijo (Caja popular, nómina, SOFOM)
- Tarjeta de crédito (BBVA, Coppel, Liverpool...)
- Tengo mi tabla de pagos
- Familiar o amigo

**Límite en onboarding:** máximo 3 deudas. Mensaje: "Puedes agregar más en 'Mis deudas' cuando termines."

**Si no tiene deudas:** botón grande "No tengo deudas ahora" → continuar directamente.

**Hint para tipos:**
- Al elegir "Préstamo fijo": "Como el préstamo de caja popular o nómina — siempre pagas lo mismo"
- Al elegir "Tarjeta": "El pago cambia cada mes según tu saldo"

---

## Paso 6 de 7: Tu Primera Meta (Opcional)

**Objetivo:** Darle esperanza y una razón para volver a la app.

**Encabezado:** "¿Para qué quieres ahorrar?"

**Subtítulo:** "Una meta pequeña al principio. Puede ser cualquier cosa."

**Opciones predefinidas (botones visuales):**
- 🆘 Fondo de emergencia *(recomendado)*
- 📱 Tecnología / gadget
- 🎒 Viaje / vacaciones
- 📚 Educación / cursos
- 🏠 Algo para el hogar
- 💰 Otro

**Al seleccionar:** solo pedir nombre y monto objetivo. Fecha opcional.

**Mensaje si elige "Fondo de emergencia":**
> "Excelente elección. Un fondo de emergencia de 3 meses te protege cuando el dinero escasea. Tu meta: $[3 × gasto_mensual]. Vamos poco a poco."

**Botón saltar:** "Lo hago después" → continúa

---

## Paso 7 de 7: Resumen + Primera Distribución

**Objetivo:** Mostrar de inmediato el valor real de la app.

**Encabezado:** "[Nombre], aquí está tu panorama"

**Contenido del resumen:**

```
┌─────────────────────────────────────────┐
│  Cobras: $4,750 cada quincena           │
│                                         │
│  De tu próxima quincena, aparta:        │
│  ─────────────────────────────────────  │
│  🏠 Renta (mitad del mes)      $1,500   │
│  💳 Caja Popular                $  556   │
│  ⚡ CFE (sinking fund)         $  200   │
│  ─────────────────────────────────────  │
│  ✅ Libre para gastar          $2,494   │
└─────────────────────────────────────────┘
```

**Semáforo de salud:**
- Si ratio < 30%: "🟢 Tienes buena base — [X]% de tu ingreso va a compromisos"
- Si ratio 30-50%: "🟡 Zona de precaución — [X]% comprometido. Hay que ser cuidadosos."
- Si ratio > 50%: "🔴 Zona de riesgo — tus compromisos superan la mitad de lo que cobras. Vamos a trabajar en esto juntos."

**Mensaje motivador final:**
> "Ya tienes el panorama completo. Cada vez que cobres, la app te dirá exactamente qué hacer con ese dinero. ¿Listo?"

**Botón:** "Comenzar a usar JM Finance →"

---

## Notas de Implementación

- Paso 7 requiere que el motor de distribución esté funcional
- Si el motor de distribución no está listo para v1: mostrar solo el resumen de datos sin la distribución calculada
- El indicador de paso ("Paso 4 de 7 · Deudas") debe ser visible siempre
- Cada paso debe tener botón "Atrás" excepto el paso 1
- Datos se guardan en Supabase solo al presionar "Comenzar" en el paso 7 — no antes (evitar datos huérfanos de onboardings incompletos)
