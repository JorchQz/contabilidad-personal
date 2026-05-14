Invoca al agente `auditor-financiero` con modelo opus para auditar la lógica de balances y saldos del proyecto.

Instrucciones para el agente:
- Verifica que `getSaldoDisponibleTotal()` en balance.js incluya traspasos correctamente
- Confirma que cuentas de crédito (`es_pasivo = true`) no se sumen como activos en "Disponible ahora"
- Revisa que el algoritmo `saldo = saldo_inicial + ingresos - gastos - pagos_deuda - traspasosSalida + traspasosEntrada` sea consistente en todos los módulos
- Verifica separación estricta Activos vs Pasivos en el dashboard
- Reporta en tabla: Área | Problema | Impacto financiero | Corrección
