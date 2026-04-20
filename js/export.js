// js/export.js — Exportación de datos financieros a CSV
import { db, getUsuarioId } from './supabase.js';

function csvCell(value) {
  const str = value == null ? '' : String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function csvRow(cols) {
  return cols.map(csvCell).join(',');
}

export async function exportarDatosCSV() {
  const uid = await getUsuarioId();
  if (!uid) return;

  const [
    { data: gastos },
    { data: ingresos },
    { data: gastosFijos }
  ] = await Promise.all([
    db.from('gastos')
      .select('fecha, monto, descripcion, categorias(nombre), cuentas(nombre)')
      .eq('usuario_id', uid)
      .order('fecha', { ascending: false }),
    db.from('ingresos')
      .select('fecha, monto, descripcion, categorias(nombre), cuentas(nombre)')
      .eq('usuario_id', uid)
      .order('fecha', { ascending: false }),
    db.from('gastos_fijos')
      .select('proximo_pago, monto, descripcion, categorias(nombre)')
      .eq('usuario_id', uid)
      .eq('activo', true)
  ]);

  const filas = [
    csvRow(['Fecha', 'Tipo', 'Categoría', 'Monto', 'Cuenta', 'Descripción'])
  ];

  for (const g of gastos || []) {
    filas.push(csvRow([
      g.fecha || '',
      'Gasto',
      g.categorias?.nombre || 'Sin categoría',
      g.monto,
      g.cuentas?.nombre || '',
      g.descripcion || ''
    ]));
  }

  for (const i of ingresos || []) {
    filas.push(csvRow([
      i.fecha || '',
      'Ingreso',
      i.categorias?.nombre || 'Sin categoría',
      i.monto,
      i.cuentas?.nombre || '',
      i.descripcion || ''
    ]));
  }

  for (const f of gastosFijos || []) {
    filas.push(csvRow([
      f.proximo_pago || '',
      'Gasto Fijo',
      f.categorias?.nombre || 'Sin categoría',
      f.monto || '',
      '',
      f.descripcion || ''
    ]));
  }

  const csv = filas.join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jm_finance_export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
