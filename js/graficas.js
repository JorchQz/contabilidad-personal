// js/graficas.js — Gráficas y analítica visual
import { db, getUsuarioId } from './supabase.js';

const PALETTE = [
  '#6C63FF', '#FF6584', '#43C6AC', '#F7971E', '#56CCF2',
  '#BB6BD9', '#F2994A', '#27AE60', '#EB5757', '#2F80ED'
];

export async function renderGraficaGastos(canvas) {
  if (!canvas) return;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const uid = await getUsuarioId();
  if (!uid) return;

  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [{ data: gastos }, { data: categorias }] = await Promise.all([
    db.from('gastos')
      .select('monto, categoria_id')
      .eq('usuario_id', uid)
      .neq('es_ahorro', true)
      .gte('fecha', inicioMes)
      .lte('fecha', finMes),
    db.from('categorias')
      .select('id, nombre')
      .eq('usuario_id', uid)
      .eq('tipo', 'gasto')
  ]);

  if (!gastos || gastos.length === 0) {
    canvas.style.display = 'none';
    const msg = canvas.parentElement?.querySelector('.graficas-empty');
    if (msg) msg.style.display = 'block';
    return;
  }

  const sumaPorCategoria = {};
  for (const g of gastos) {
    const key = g.categoria_id || 'sin-categoria';
    sumaPorCategoria[key] = (sumaPorCategoria[key] || 0) + Number(g.monto);
  }

  const catMap = Object.fromEntries((categorias || []).map(c => [c.id, c.nombre]));

  const labels = [];
  const valores = [];
  const colores = [];
  let colorIdx = 0;

  for (const [catId, suma] of Object.entries(sumaPorCategoria)) {
    labels.push(catMap[catId] || 'Sin categoría');
    valores.push(suma);
    colores.push(PALETTE[colorIdx % PALETTE.length]);
    colorIdx++;
  }

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: colores,
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e0e0e0',
            font: { size: 12, family: 'Plus Jakarta Sans' },
            boxWidth: 12,
            padding: 14
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}
