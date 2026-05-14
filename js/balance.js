// js/balance.js — Motor de cálculo financiero (sin DOM)
import { db, getUsuarioId } from './supabase.js';

const FREQ_FACTOR_MENSUAL = {
  semanal: 4.33, quincenal: 2, mensual: 1,
  bimestral: 0.5, trimestral: 0.33, semestral: 0.167, anual: 0.083, unico: 0,
};

export async function getSaldoDisponibleTotal(usuarioId) {
  const [
    { data: cuentas, error: errorCuentas },
    { data: ingresos, error: errorIngresos },
    { data: gastos, error: errorGastos },
    { data: pagosDeuda, error: errorPagosDeuda },
    { data: traspasosSalida, error: errorTraspasosSalida },
    { data: traspasosEntrada, error: errorTraspasosEntrada }
  ] = await Promise.all([
    db.from('cuentas').select('saldo_inicial').eq('usuario_id', usuarioId).eq('activa', true).eq('es_pasivo', false),
    db.from('ingresos').select('monto').eq('usuario_id', usuarioId),
    db.from('gastos').select('monto').eq('usuario_id', usuarioId),
    db.from('pagos_deuda').select('monto').eq('usuario_id', usuarioId),
    db.from('transferencias').select('monto').eq('usuario_id', usuarioId),
    db.from('transferencias').select('monto').eq('usuario_id', usuarioId)
  ]);

  if (errorCuentas || errorIngresos || errorGastos || errorPagosDeuda) {
    return { error: true, saldoDisponible: null };
  }

  const totalSaldoInicial  = (cuentas       || []).reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);
  const totalIngresos      = (ingresos      || []).reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const totalGastos        = (gastos        || []).reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const totalPagosDeuda    = (pagosDeuda    || []).reduce((acc, m) => acc + Number(m.monto || 0), 0);

  return {
    error: false,
    saldoDisponible: totalSaldoInicial + totalIngresos - totalGastos - totalPagosDeuda
  };
}

export async function getSaldoCuentaEspecifica(usuarioId, cuentaId) {
  const [
    { data: cuenta, error: errorCuenta },
    { data: ingresos, error: errorIngresos },
    { data: gastos, error: errorGastos },
    { data: pagosDeuda, error: errorPagosDeuda },
    { data: traspasosSalida, error: errorTraspasosSalida },
    { data: traspasosEntrada, error: errorTraspasosEntrada }
  ] = await Promise.all([
    db.from('cuentas').select('saldo_inicial').eq('id', cuentaId).eq('usuario_id', usuarioId).eq('activa', true).maybeSingle(),
    db.from('ingresos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuentaId),
    db.from('gastos').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuentaId),
    db.from('pagos_deuda').select('monto').eq('usuario_id', usuarioId).eq('cuenta_id', cuentaId),
    db.from('transferencias').select('monto').eq('usuario_id', usuarioId).eq('cuenta_origen_id', cuentaId),
    db.from('transferencias').select('monto').eq('usuario_id', usuarioId).eq('cuenta_destino_id', cuentaId)
  ]);

  if (errorCuenta || errorIngresos || errorGastos || errorPagosDeuda || errorTraspasosSalida || errorTraspasosEntrada || !cuenta) {
    return { error: true, saldoDisponible: null };
  }

  const totalIngresos = (ingresos || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalGastos = (gastos || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalPagosDeuda = (pagosDeuda || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalTraspasosSalida = (traspasosSalida || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);
  const totalTraspasosEntrada = (traspasosEntrada || []).reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

  return {
    error: false,
    saldoDisponible: Number(cuenta.saldo_inicial || 0) + totalIngresos - totalGastos - totalPagosDeuda - totalTraspasosSalida + totalTraspasosEntrada
  };
}

// ---- UTILIDADES DE FECHA ----

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

function isSameMonth(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth();
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function isSameWeek(date1, date2) {
  const start1 = getWeekStart(date1);
  const start2 = getWeekStart(date2);
  return isSameDay(start1, start2);
}

function getQuincena(date) {
  return date.getDate() <= 15 ? 1 : 2;
}

function isSameQuincena(date1, date2) {
  return getQuincena(date1) === getQuincena(date2) && isSameMonth(date1, date2);
}

function getDayOfWeek(fechaStr) {
  const date = new Date(`${fechaStr}T00:00:00`);
  return date.getDay();
}

function getNextOccurrenceOfDayOfWeek(dayOfWeek) {
  const today = new Date();
  const currentDay = today.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead <= 0) daysAhead += 7;
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
}

function getNextOccurrenceOfDayOfMonth(dayOfMonth) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  let date = new Date(year, month, dayOfMonth);
  if (date < today) date = new Date(year, month + 1, dayOfMonth);
  return date;
}

function getNextOccurrenceOfQuincena(dayOfQuincena) {
  const today = new Date();
  const currentDay = today.getDate();
  const currentQuincena = currentDay <= 15 ? 1 : 2;

  let targetDay;
  if (currentQuincena === 1) {
    targetDay = dayOfQuincena;
  } else {
    targetDay = 15 + dayOfQuincena;
  }

  if (currentDay >= targetDay) {
    if (currentQuincena === 1) {
      targetDay = 15 + dayOfQuincena;
    } else {
      targetDay = dayOfQuincena;
      const nextDate = new Date(today);
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(targetDay);
      return nextDate;
    }
  }

  const nextDate = new Date(today);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  nextDate.setDate(Math.min(targetDay, daysInMonth));
  return nextDate;
}

export function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isDateInRange(date, start, end) {
  const d = normalizeDate(date).getTime();
  const s = normalizeDate(start).getTime();
  const e = normalizeDate(end).getTime();
  return d >= s && d <= e;
}

export function getNextWeeklyDate(dayOfWeek, fromDate) {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null;
  const base = normalizeDate(fromDate || new Date());
  const currentDay = base.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  const nextDate = new Date(base);
  nextDate.setDate(base.getDate() + daysAhead);
  return nextDate;
}

export function getNextMonthlyDate(dayOfMonth, fromDate) {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;
  const base = normalizeDate(fromDate || new Date());
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (day <= dayOfMonth) return new Date(year, month, Math.min(dayOfMonth, daysInMonth));
  const nextMonthDays = new Date(year, month + 2, 0).getDate();
  return new Date(year, month + 1, Math.min(dayOfMonth, nextMonthDays));
}

export function getNextQuincenalDate(dayOfQuincena, fromDate) {
  if (!Number.isInteger(dayOfQuincena) || dayOfQuincena < 1 || dayOfQuincena > 15) return null;
  const base = normalizeDate(fromDate || new Date());
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstHalf = new Date(year, month, Math.min(dayOfQuincena, daysInMonth));
  const secondHalf = new Date(year, month, Math.min(dayOfQuincena + 15, daysInMonth));
  if (firstHalf >= base) return firstHalf;
  if (secondHalf >= base) return secondHalf;
  const nextMonthDays = new Date(year, month + 2, 0).getDate();
  return new Date(year, month + 1, Math.min(dayOfQuincena, nextMonthDays));
}

export function getNextFijoDate(gf, fromDate) {
  const base = normalizeDate(fromDate || new Date());

  if (gf.proximo_pago) {
    const fecha = normalizeDate(new Date(gf.proximo_pago + 'T00:00:00'));
    const monthsByFreq = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
    const months = monthsByFreq[gf.frecuencia];
    let guard = 0;
    while (fecha < base && guard++ < 120) {
      if (gf.frecuencia === 'semanal') {
        fecha.setDate(fecha.getDate() + 7);
      } else if (gf.frecuencia === 'quincenal') {
        fecha.setDate(fecha.getDate() + 15);
      } else if (months) {
        fecha.setMonth(fecha.getMonth() + months);
      } else {
        break;
      }
    }
    return fecha;
  }

  if (gf.frecuencia === 'semanal' && Number.isInteger(gf.dia_semana)) {
    return getNextWeeklyDate(gf.dia_semana, base);
  }
  if (gf.frecuencia === 'quincenal' && gf.dia_pago) {
    return getNextQuincenalDate(gf.dia_pago, base);
  }
  if (gf.dia_pago) {
    return getNextMonthlyDate(gf.dia_pago, base);
  }
  return null;
}

function getProximaFechaCobro(ingresoProgramado, fechaBase) {
  const base = normalizeDate(fechaBase || new Date());
  if (!ingresoProgramado) return null;

  if (ingresoProgramado.frecuencia === 'semanal') {
    const diaSemana = ingresoProgramado.dia_semana;
    const currentDay = base.getDay();
    let daysAhead = diaSemana - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    const next = new Date(base);
    next.setDate(base.getDate() + daysAhead);
    return next;
  }

  if (ingresoProgramado.frecuencia === 'quincenal') {
    const diaPago = ingresoProgramado.dia_pago || 1;
    return getNextQuincenalDate(diaPago, base);
  }

  if (ingresoProgramado.frecuencia === 'mensual') {
    return getNextMonthlyDate(ingresoProgramado.dia_pago, base);
  }

  return null;
}

export async function calcularSaludFinanciera(usuarioId) {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const finMes   = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

  const [
    { data: cuentas },
    { data: todosIngresos },
    { data: todosGastos },
    { data: todosPagosDeuda },
    { data: ingresosDelMes },
    { data: gastosDelMes },
    { data: gastosFijos },
    { data: deudas }
  ] = await Promise.all([
    db.from('cuentas').select('saldo_inicial').eq('usuario_id', usuarioId).eq('activa', true),
    db.from('ingresos').select('monto').eq('usuario_id', usuarioId),
    db.from('gastos').select('monto').eq('usuario_id', usuarioId),
    db.from('pagos_deuda').select('monto').eq('usuario_id', usuarioId),
    db.from('ingresos').select('monto').eq('usuario_id', usuarioId).gte('fecha', inicioMes).lte('fecha', finMes),
    db.from('gastos').select('monto').eq('usuario_id', usuarioId).gte('fecha', inicioMes).lte('fecha', finMes),
    db.from('gastos_fijos').select('monto, frecuencia, monto_variable').eq('usuario_id', usuarioId).eq('activo', true),
    db.from('deudas').select('monto_actual, monto_pago').eq('usuario_id', usuarioId).eq('activa', true),
  ]);

  const saldoInicial   = (cuentas         || []).reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
  const sumIngresos    = (todosIngresos    || []).reduce((s, i) => s + Number(i.monto || 0), 0);
  const sumGastos      = (todosGastos      || []).reduce((s, g) => s + Number(g.monto || 0), 0);
  const sumPagosDeuda  = (todosPagosDeuda  || []).reduce((s, p) => s + Number(p.monto || 0), 0);
  const saldoTotal     = saldoInicial + sumIngresos - sumGastos - sumPagosDeuda;

  const ingresosTotal  = (ingresosDelMes || []).reduce((s, i) => s + Number(i.monto || 0), 0);
  const gastosTotal    = (gastosDelMes   || []).reduce((s, g) => s + Number(g.monto || 0), 0);

  const gastosFijosMensuales = (gastosFijos || []).reduce((s, gf) => {
    if (gf.monto_variable || !gf.monto) return s;
    return s + Number(gf.monto) * (FREQ_FACTOR_MENSUAL[gf.frecuencia] ?? 1);
  }, 0);

  const pagosMensualesDeuda = (deudas || []).reduce((s, d) => {
    return d.monto_pago ? s + Number(d.monto_pago) : s;
  }, 0);

  return {
    saldoTotal,
    ingresosTotal,
    gastosTotal,
    gastosFijosMensuales,
    pagosMensualesDeuda,
    fondoEmergenciaMeses: gastosFijosMensuales > 0
      ? Math.max(0, Math.round((saldoTotal / gastosFijosMensuales) * 10) / 10)
      : null,
    ratioDeuda: ingresosTotal > 0
      ? Math.round((pagosMensualesDeuda / ingresosTotal) * 100)
      : null,
    tasaAhorro: ingresosTotal > 0
      ? Math.round(((ingresosTotal - gastosTotal) / ingresosTotal) * 100)
      : null,
    tieneDatos: (cuentas?.length || 0) + (todosIngresos?.length || 0) + (gastosFijos?.length || 0) > 0,
  };
}

export async function getPagosPendientes() {
  const usuarioId = (await getUsuarioId());
  const hoy = normalizeDate(new Date());
  const pendientes = [];

  const { data: ingresosProgramados } = await db
    .from('ingresos_programados')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('activo', true);

  const fechasCobro = (ingresosProgramados || [])
    .map(ip => getProximaFechaCobro(ip, hoy))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const proximaFechaCobro = fechasCobro[0] || null;

  const fechaLimite = proximaFechaCobro || (() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 15);
    return d;
  })();

  const [
    { data: gastosFijos },
    { data: deudas }
  ] = await Promise.all([
    db.from('gastos_fijos').select('id,descripcion,monto,monto_estimado,frecuencia,dia_pago,dia_semana,proximo_pago,ultimo_pago,fecha_flexible').eq('usuario_id', usuarioId).eq('activo', true),
    db.from('deudas').select('id,acreedor,monto_actual,monto_pago,tipo_pago,tipo_deuda,dia_pago,dia_semana,activa').eq('usuario_id', usuarioId).eq('activa', true)
  ]);

  for (const gf of (gastosFijos || [])) {
    const fechaEsperada = getNextFijoDate(gf, hoy);
    if (!fechaEsperada) continue;
    if (!isDateInRange(fechaEsperada, hoy, fechaLimite)) continue;
    if (gf.ultimo_pago) {
      const ultimoPago = normalizeDate(new Date(gf.ultimo_pago + 'T00:00:00'));
      if (isDateInRange(ultimoPago, hoy, fechaLimite)) continue;
    }
    const esVariable = gf.fecha_flexible === true || gf.monto == null;
    pendientes.push({
      item_id: `fijo-${gf.id}`,
      gasto_fijo_id: gf.id,
      nombre: gf.descripcion,
      monto: Number(gf.monto || 0),
      fecha_flexible: esVariable,
      fecha_esperada: fechaEsperada,
      tipo: 'fijo',
      urgente: true
    });
  }

  for (const d of (deudas || [])) {
    if (d.tipo_deuda === 'tabla') {
      const { data: proximoPago } = await db.from('pagos_programados')
        .select('fecha_vencimiento, monto_esperado')
        .eq('deuda_id', d.id)
        .eq('pagado', false)
        .order('fecha_vencimiento')
        .limit(1)
        .maybeSingle();

      if (proximoPago) {
        const fechaVenc = normalizeDate(new Date(proximoPago.fecha_vencimiento + 'T00:00:00'));
        if (isDateInRange(fechaVenc, hoy, fechaLimite)) {
          pendientes.push({
            item_id: `deuda-${d.id}`,
            deuda_id: d.id,
            tipo_deuda: d.tipo_deuda || 'simple',
            monto_actual: Number(d.monto_actual || 0),
            monto_ultimo_pago: Number(d.monto_ultimo_pago || 0),
            nombre: d.acreedor,
            monto: Number(proximoPago.monto_esperado || 0),
            fecha_esperada: fechaVenc,
            tipo: 'deuda',
            urgente: true
          });
        }
      }
      continue;
    }

    // Deudas sin fecha fija (libre/flexible): siempre visibles como recordatorio
    if (d.tipo_pago === 'libre' || !d.tipo_pago) {
      pendientes.push({
        item_id: `deuda-${d.id}`,
        deuda_id: d.id,
        tipo_deuda: d.tipo_deuda || 'flexible',
        monto_actual: Number(d.monto_actual || 0),
        monto_ultimo_pago: Number(d.monto_ultimo_pago || 0),
        nombre: d.acreedor,
        monto: Number(d.monto_pago || 0),
        fecha_esperada: fechaLimite,
        sin_fecha: true,
        tipo: 'deuda',
        urgente: false
      });
      continue;
    }

    let fechaEsperada = null;
    if (d.tipo_pago === 'unico' && d.dia_pago) {
      fechaEsperada = getNextMonthlyDate(d.dia_pago, hoy);
    } else if (d.tipo_pago === 'semanal' && Number.isInteger(d.dia_semana)) {
      fechaEsperada = getNextWeeklyDate(d.dia_semana, hoy);
    } else if (d.tipo_pago === 'mensual' && d.dia_pago) {
      fechaEsperada = getNextMonthlyDate(d.dia_pago, hoy);
    } else if (d.tipo_pago === 'quincenal' && d.dia_pago) {
      fechaEsperada = getNextQuincenalDate(d.dia_pago, hoy);
    }

    if (!fechaEsperada) continue;
    if (!isDateInRange(fechaEsperada, hoy, fechaLimite)) continue;
    if (d.ultimo_pago) {
      const ultimoPago = normalizeDate(new Date(d.ultimo_pago + 'T00:00:00'));
      if (isDateInRange(ultimoPago, hoy, fechaLimite)) continue;
    }

    pendientes.push({
      item_id: `deuda-${d.id}`,
      deuda_id: d.id,
      tipo_deuda: d.tipo_deuda || 'simple',
      monto_actual: Number(d.monto_actual || 0),
      monto_ultimo_pago: Number(d.monto_ultimo_pago || 0),
      nombre: d.acreedor,
      monto: Number(d.monto_pago || 0),
      fecha_esperada: fechaEsperada,
      tipo: 'deuda',
      urgente: true
    });
  }

  pendientes.sort((a, b) => a.fecha_esperada - b.fecha_esperada);
  pendientes.proxima_fecha_cobro = proximaFechaCobro;
  pendientes.total_periodo = pendientes.reduce((acc, p) => {
    const m = Number(p.monto);
    return acc + (isFinite(m) ? m : 0);
  }, 0);
  return pendientes;
}

// ---- AMORTIZACIÓN FRANCESA ----

/**
 * Genera la tabla de amortización completa para un préstamo de cuota fija.
 * @param {number} capital        Saldo actual (no el original si ya se han hecho pagos)
 * @param {number} tasaMensual    Tasa mensual en % (ej: 2 para 2%)
 * @param {number} numPagos       Número de pagos restantes
 * @returns {Array} Filas con { num, cuota, interes, capital, iva, total, saldo }
 */
export function generarTablaAmortizacion(capital, tasaMensual, numPagos) {
  if (!capital || capital <= 0 || !numPagos || numPagos <= 0) return [];
  const r = (tasaMensual || 0) / 100;
  let cuota;
  if (r <= 0) {
    cuota = capital / numPagos;
  } else {
    cuota = capital * (r * Math.pow(1 + r, numPagos)) / (Math.pow(1 + r, numPagos) - 1);
  }
  if (!isFinite(cuota) || cuota <= 0) return [];

  let saldo = capital;
  const tabla = [];
  for (let i = 1; i <= numPagos; i++) {
    const interes     = saldo * r;
    const abonoCapital = Math.min(cuota - interes, saldo);
    const iva         = interes * 0.16;
    saldo = Math.max(0, saldo - abonoCapital);
    tabla.push({
      num:     i,
      cuota:   parseFloat(cuota.toFixed(2)),
      interes: parseFloat(interes.toFixed(2)),
      capital: parseFloat(abonoCapital.toFixed(2)),
      iva:     parseFloat(iva.toFixed(2)),
      total:   parseFloat((abonoCapital + interes + iva).toFixed(2)),
      saldo:   parseFloat(saldo.toFixed(2))
    });
    if (saldo === 0) break;
  }
  return tabla;
}

/**
 * Calcula el desglose de UN pago (el próximo) dado el saldo actual.
 * Devuelve null si no hay datos suficientes para amortización.
 * @param {number} saldoActual
 * @param {number} tasaMensual   En % (ej: 2)
 * @param {number} numPagosRestantes
 * @returns {{ capital, interes, iva, total, cuota } | null}
 */
export function calcularDesgloseAmortizacion(saldoActual, tasaMensual, numPagosRestantes) {
  if (!saldoActual || saldoActual <= 0) return null;
  if (!tasaMensual || tasaMensual <= 0 || !numPagosRestantes || numPagosRestantes <= 0) return null;
  const tabla = generarTablaAmortizacion(saldoActual, tasaMensual, numPagosRestantes);
  if (!tabla.length) return null;
  const fila = tabla[0];
  return {
    capital:  fila.capital,
    interes:  fila.interes,
    iva:      fila.iva,
    total:    fila.total,
    cuota:    fila.cuota
  };
}
