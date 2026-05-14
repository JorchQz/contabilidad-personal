// js/distribucion.js — Motor de distribución de ingresos (Zero-Based Budgeting)
// Cálculo puro, sin DOM. Retorna datos estructurados para que la UI los renderice.
import { db, getUsuarioId } from './supabase.js';
import { getPagosPendientes } from './balance.js';

const DIAS_FRECUENCIA = {
  semanal: 7, quincenal: 15, mensual: 30,
  bimestral: 60, trimestral: 90, semestral: 180, anual: 365
};

/**
 * Calcula cómo distribuir un ingreso entre todos los compromisos del usuario.
 *
 * Jerarquía de asignación (RN-07):
 *   1. Gastos fijos urgentes (vencen antes del próximo cobro)
 *   2. Cuotas de deuda próximas
 *   3. Sinking funds (adelanto proporcional para gastos futuros)
 *   4. Metas de ahorro con fecha límite
 *
 * @param {number} montoIngreso
 * @param {string} usuarioId
 * @returns {Promise<{
 *   asignaciones: Array,
 *   libre: number,
 *   deficit: number,
 *   sugerenciaAbonoExtra: object|null,
 *   frecuenciaIngreso: string
 * }>}
 */
export async function distribuirIngreso(montoIngreso, usuarioId) {
  if (!montoIngreso || montoIngreso <= 0 || !isFinite(montoIngreso)) {
    return { asignaciones: [], libre: 0, deficit: 0, sugerenciaAbonoExtra: null, frecuenciaIngreso: 'quincenal' };
  }

  // ── 1. Compromisos urgentes (gastos_fijos + deudas próximos al cobro) ──
  const pendientes = await getPagosPendientes();
  const idsFijosUrgentes = new Set(
    pendientes.filter(p => p.gasto_fijo_id).map(p => p.gasto_fijo_id)
  );

  const urgentes = pendientes
    .filter(p => p.monto > 0)
    .map(p => ({
      nombre:   p.nombre,
      monto:    Number(p.monto),
      tipo:     p.tipo === 'fijo' ? 'fijo_urgente' : 'deuda_urgente',
      urgente:  true,
      item_id:  p.item_id
    }));

  // ── 2. Inferir frecuencia del ingreso principal ──
  const { data: ingresosProg } = await db
    .from('ingresos_programados')
    .select('frecuencia, monto_estimado')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .order('monto_estimado', { ascending: false })
    .limit(1);

  const frecuenciaIngreso = ingresosProg?.[0]?.frecuencia || 'quincenal';
  const diasIngreso = DIAS_FRECUENCIA[frecuenciaIngreso] || 15;

  // ── 3. Sinking funds — gastos fijos NO urgentes, apartar proporción ──
  const { data: gastosFijos } = await db
    .from('gastos_fijos')
    .select('id, descripcion, monto, monto_estimado, frecuencia')
    .eq('usuario_id', usuarioId)
    .eq('activo', true);

  const sinkingFunds = [];
  for (const gf of (gastosFijos || [])) {
    if (idsFijosUrgentes.has(gf.id)) continue;
    const montoGasto = Number(gf.monto || gf.monto_estimado || 0);
    if (montoGasto <= 0) continue;
    const diasGasto = DIAS_FRECUENCIA[gf.frecuencia] || 30;
    const cuota = parseFloat(((montoGasto * diasIngreso) / diasGasto).toFixed(2));
    if (cuota <= 0) continue;
    sinkingFunds.push({
      nombre:  gf.descripcion,
      monto:   cuota,
      tipo:    'sinking_fund',
      urgente: false
    });
  }

  // ── 3.5. Gastos diferidos (MSI activos) ──
  const { data: gastosDiferidos } = await db
    .from('gastos_diferidos')
    .select('id, descripcion, monto_cuota, num_meses, cuotas_pagadas, fecha_primer_cargo, cuenta_id')
    .eq('usuario_id', usuarioId)
    .eq('activo', true);

  const hoyFecha = new Date(); hoyFecha.setHours(0, 0, 0, 0);
  for (const gd of (gastosDiferidos || [])) {
    const cuotasPendientes = gd.num_meses - (gd.cuotas_pagadas || 0);
    if (cuotasPendientes <= 0) continue;
    const fechaPrimer = new Date(gd.fecha_primer_cargo + 'T00:00:00');
    const mesProxima  = new Date(fechaPrimer);
    mesProxima.setMonth(mesProxima.getMonth() + (gd.cuotas_pagadas || 0));
    const diasHastaProxima = Math.ceil((mesProxima.getTime() - hoyFecha.getTime()) / 86400000);
    if (diasHastaProxima <= diasIngreso + 5) {
      // Vence dentro de este periodo de ingreso — urgente
      urgentes.push({ nombre: `${gd.descripcion} (MSI)`, monto: Number(gd.monto_cuota), tipo: 'fijo_urgente', urgente: true });
    } else if (diasHastaProxima <= diasIngreso * 3) {
      // Próxima cuota en los próximos 3 periodos — sinking fund
      sinkingFunds.push({ nombre: `${gd.descripcion} (MSI)`, monto: Number(gd.monto_cuota), tipo: 'sinking_fund', urgente: false });
    }
  }

  // ── 4. Metas de ahorro con fecha límite ──
  const { data: metas } = await db
    .from('metas_ahorro')
    .select('id, nombre, emoji, monto_objetivo, monto_actual, fecha_limite, frecuencia_ahorro')
    .eq('usuario_id', usuarioId)
    .eq('activa', true);

  const hoyMs = new Date().setHours(0, 0, 0, 0);
  const metasCuota = (metas || [])
    .filter(m => m.fecha_limite && m.frecuencia_ahorro && m.frecuencia_ahorro !== 'libre')
    .map(m => {
      const restante = Math.max(Number(m.monto_objetivo || 0) - Number(m.monto_actual || 0), 0);
      if (restante <= 0) return null;
      const diasRestantes = Math.max(Math.ceil((new Date(m.fecha_limite + 'T00:00:00').getTime() - hoyMs) / 86400000), 1);
      const diasPorAporte = DIAS_FRECUENCIA[m.frecuencia_ahorro] || 30;
      const periodos = Math.max(Math.ceil(diasRestantes / diasPorAporte), 1);
      return {
        nombre:  m.nombre,
        emoji:   m.emoji,
        monto:   parseFloat((restante / periodos).toFixed(2)),
        tipo:    'meta',
        urgente: false
      };
    })
    .filter(Boolean);

  // ── 5. Asignación en orden de jerarquía ──
  const todoCompromisos = [...urgentes, ...sinkingFunds, ...metasCuota];
  let restante = montoIngreso;

  const asignaciones = todoCompromisos.map(c => {
    const asignar = Math.min(c.monto, Math.max(0, restante));
    restante = parseFloat((restante - asignar).toFixed(2));
    return {
      ...c,
      asignado:  parseFloat(asignar.toFixed(2)),
      cubierto:  asignar >= c.monto - 0.01
    };
  });

  const libre   = Math.max(0, parseFloat(restante.toFixed(2)));
  const totalCompromisos = todoCompromisos.reduce((s, c) => s + c.monto, 0);
  const deficit = Math.max(0, parseFloat((totalCompromisos - montoIngreso).toFixed(2)));

  // ── 6. Sugerencia de abono extra si hay sobrante > $100 ──
  let sugerenciaAbonoExtra = null;
  if (libre >= 100) {
    const { data: deudas } = await db
      .from('deudas')
      .select('id, acreedor, monto_actual, tasa_interes_anual, tipo_pago')
      .eq('usuario_id', usuarioId)
      .eq('activa', true)
      .gt('tasa_interes_anual', 0)
      .order('tasa_interes_anual', { ascending: false })
      .limit(1);

    if (deudas?.[0]) {
      const d = deudas[0];
      const r = (d.tasa_interes_anual / 100) / 12;
      const interesEvitado = r > 0 ? parseFloat((libre * r).toFixed(2)) : 0;
      sugerenciaAbonoExtra = {
        acreedor:       d.acreedor,
        deudaId:        d.id,
        monto:          libre,
        interesEvitado,
        tasaAnual:      d.tasa_interes_anual
      };
    }
  }

  return { asignaciones, libre, deficit, sugerenciaAbonoExtra, frecuenciaIngreso };
}
