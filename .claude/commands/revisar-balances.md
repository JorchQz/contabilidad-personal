Invoca al agente `auditor-financiero` con modelo opus para auditar la lógica de balances y saldos del proyecto.

Instrucciones para el agente:
- Verifica que `getSaldoDisponibleTotal()` en balance.js filtre correctamente por `es_pasivo = false` — cuentas de crédito nunca se suman al disponible
- Verifica que `getSaldoCuentaEspecifica()` aplique la misma fórmula: `saldo_inicial + ingresos - gastos - pagos_deuda - traspasosSalida + traspasosEntrada`
- Confirma que `calcularCuentasConSaldo()` en cuentas.js no mezcle activos y pasivos en el total
- Revisa el dashboard en app.js: el widget "Disponible ahora" no debe incluir cuentas con `es_pasivo = true`
- Verifica que `calcularSaludFinanciera()` normalice frecuencias correctamente (quincenal × 2, semanal × 4.33)
- Reporta en tabla: Área | Problema | Impacto financiero | Corrección
