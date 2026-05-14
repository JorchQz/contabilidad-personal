// js/graficas.js — Gráficas y analítica visual
import { db, getUsuarioId } from './supabase.js';

const PALETTE = [
  '#6C63FF', '#FF6584', '#43C6AC', '#F7971E', '#56CCF2',
  '#BB6BD9', '#F2994A', '#27AE60', '#EB5757', '#2F80ED'
];

export async function renderGraficaGastos(canvas) {
  if (!canvas) return;

  // Cleanup explícito usando referencia global para evitar leak en SPA
  if (window._chartGastos) { window._chartGastos.destroy(); window._chartGastos = null; }
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const uid = await getUsuarioId();
  if (!uid) return;

  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [
    { data: gastos, error: errGastos },
    { data: categorias, error: errCats }
  ] = await Promise.all([
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

  if (errGastos || errCats) {
    const msg = canvas.parentElement?.querySelector('.graficas-empty');
    if (msg) { msg.textContent = 'No se pudieron cargar los datos.'; msg.style.display = 'block'; }
    canvas.style.display = 'none';
    return;
  }

  if (!gastos || gastos.length === 0) {
    canvas.style.display = 'none';
    const msg = canvas.parentElement?.querySelector('.graficas-empty');
    if (msg) msg.style.display = 'block';
    return;
  }

  const sumaPorCategoria = {};
  for (const g of gastos) {
    if (!g.categoria_id) continue; // ignorar gastos sin categoría
    sumaPorCategoria[g.categoria_id] = (sumaPorCategoria[g.categoria_id] || 0) + Number(g.monto);
  }

  const catMap = Object.fromEntries((categorias || []).map(c => [c.id, c.nombre]));

  const labels = [];
  const valores = [];
  const colores = [];
  const entries = Object.entries(sumaPorCategoria);
  const n = entries.length;

  entries.forEach(([catId, suma], i) => {
    labels.push(catMap[catId] || 'Sin categoría');
    valores.push(suma);
    // HSL dinámico para evitar repetición de colores con >10 categorías
    colores.push(n <= PALETTE.length ? PALETTE[i] : `hsl(${Math.round(i * 360 / n)}, 62%, 55%)`);
  });

  window._chartGastos = new Chart(canvas, {
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
