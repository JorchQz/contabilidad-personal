// js/export.js — Exportación de datos financieros a CSV y PDF
import { db, getUsuarioId } from './supabase.js';

export async function exportarReportePDF() {
  if (!window.jspdf) { alert('El módulo PDF no está cargado. Recarga la app.'); return; }
  const uid = await getUsuarioId();
  if (!uid) return;

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const finMes    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

  const [
    { data: gastosMes },
    { data: ingresosMes },
    { data: deudas },
    { data: metas }
  ] = await Promise.all([
    db.from('gastos').select('fecha, monto, descripcion, categorias(nombre)').eq('usuario_id', uid).neq('es_ahorro', true).gte('fecha', inicioMes).lte('fecha', finMes).order('fecha', { ascending: false }),
    db.from('ingresos').select('fecha, monto, descripcion').eq('usuario_id', uid).gte('fecha', inicioMes).lte('fecha', finMes).order('fecha', { ascending: false }),
    db.from('deudas').select('acreedor, monto_inicial, monto_actual').eq('usuario_id', uid).eq('activa', true).order('monto_actual', { ascending: false }),
    db.from('metas_ahorro').select('nombre, monto_objetivo, monto_actual, fecha_limite').eq('usuario_id', uid).eq('activa', true).order('nombre', { ascending: true })
  ]);

  const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n || 0);
  const totalGastos   = (gastosMes  || []).reduce((s, g) => s + Number(g.monto), 0);
  const totalIngresos = (ingresosMes || []).reduce((s, i) => s + Number(i.monto), 0);
  const totalDeuda    = (deudas || []).reduce((s, d) => s + Number(d.monto_actual), 0);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const M  = 14;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const AZUL = [37, 99, 235];
  const GRIS = [100, 100, 100];

  // Encabezado
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, PW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text('Reporte Financiero — JM Finance', M, 14);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(hoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), PW - M, 14, { align: 'right' });

  // Cajas de resumen
  doc.setTextColor(0, 0, 0);
  const cajas = [
    { label: 'Ingresos del mes', valor: fmt(totalIngresos) },
    { label: 'Gastos del mes',   valor: fmt(totalGastos) },
    { label: 'Deuda total',      valor: fmt(totalDeuda) },
  ];
  const cw = (PW - M * 2 - 8) / 3;
  cajas.forEach((c, i) => {
    const x = M + i * (cw + 4);
    doc.setFillColor(248, 250, 252); doc.setDrawColor(200, 200, 200);
    doc.roundedRect(x, 27, cw, 18, 2, 2, 'FD');
    doc.setFontSize(7); doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal');
    doc.text(c.label, x + cw / 2, 33, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
    doc.text(c.valor, x + cw / 2, 40, { align: 'center' });
  });

  const pie = (data) => {
    const n = doc.internal.getCurrentPageInfo().pageNumber;
    const t = doc.internal.getNumberOfPages();
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS);
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
    doc.line(M, PH - 12, PW - M, PH - 12);
    doc.text('JM Finance · Reporte generado automáticamente', M, PH - 7);
    doc.text(`Página ${n} de ${t}`, PW - M, PH - 7, { align: 'right' });
  };

  const tituloSeccion = (y, texto) => {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL);
    doc.text(texto, M, y);
    doc.setDrawColor(...AZUL); doc.setLineWidth(0.4);
    doc.line(M, y + 2, PW - M, y + 2);
    doc.setTextColor(0,0,0);
    return y + 6;
  };

  // Movimientos del mes
  let startY = tituloSeccion(56, `Movimientos — ${hoy.toLocaleDateString('es-MX', {month:'long', year:'numeric'})}`);
  const movRows = [
    ...(ingresosMes || []).map(i => [i.fecha || '', i.descripcion || 'Ingreso', '+' + fmt(i.monto)]),
    ...(gastosMes  || []).map(g => [g.fecha || '', g.descripcion || g.categorias?.nombre || 'Gasto', '-' + fmt(g.monto)]),
  ].sort((a, b) => b[0].localeCompare(a[0]));

  doc.autoTable({
    startY, margin: { left: M, right: M },
    head: [['Fecha', 'Concepto', 'Monto']],
    body: movRows.length ? movRows : [['—', 'Sin movimientos este mes', '—']],
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: AZUL, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248,250,252] },
    columnStyles: { 0: { cellWidth: 25 }, 2: { cellWidth: 32, halign: 'right' } },
    didDrawPage: pie,
  });

  // Deudas
  startY = tituloSeccion(doc.lastAutoTable.finalY + 8, 'Progreso de deudas');
  doc.autoTable({
    startY, margin: { left: M, right: M },
    head: [['Acreedor', 'Saldo inicial', 'Saldo actual', '% Pagado']],
    body: (deudas || []).length ? (deudas || []).map(d => {
      const pct = d.monto_inicial > 0 ? Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100) : 0;
      return [d.acreedor || '', fmt(d.monto_inicial), fmt(d.monto_actual), `${pct}%`];
    }) : [['—', '—', 'Sin deudas activas', '—']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: AZUL, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248,250,252] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center', cellWidth: 22 } },
    didDrawPage: pie,
  });

  // Metas
  startY = tituloSeccion(doc.lastAutoTable.finalY + 8, 'Metas de ahorro');
  doc.autoTable({
    startY, margin: { left: M, right: M },
    head: [['Meta', 'Ahorrado', 'Objetivo', '% Completado', 'Fecha límite']],
    body: (metas || []).length ? (metas || []).map(m => {
      const pct = m.monto_objetivo > 0 ? Math.round((m.monto_actual / m.monto_objetivo) * 100) : 0;
      return [m.nombre || '', fmt(m.monto_actual), fmt(m.monto_objetivo), `${pct}%`, m.fecha_limite || '—'];
    }) : [['—', '—', '—', 'Sin metas activas', '—']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: AZUL, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248,250,252] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center', cellWidth: 26 } },
    didDrawPage: pie,
  });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const nombre = `jm_finance_${hoy.toISOString().slice(0, 7)}.pdf`;
  if (isIOS) { window.open(doc.output('bloburl'), '_blank'); }
  else { doc.save(nombre); }
}

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
    { data: gastosFijos },
    { data: deudas },
    { data: pagosDeuda },
    { data: metas }
  ] = await Promise.all([
    db.from('gastos')
      .select('fecha, monto, descripcion, es_ahorro, categorias(nombre), cuentas(nombre)')
      .eq('usuario_id', uid)
      .order('fecha', { ascending: false }),
    db.from('ingresos')
      .select('fecha, monto, descripcion, tipo, categorias(nombre), cuentas(nombre)')
      .eq('usuario_id', uid)
      .order('fecha', { ascending: false }),
    db.from('gastos_fijos')
      .select('proximo_pago, monto, descripcion, frecuencia, categorias(nombre)')
      .eq('usuario_id', uid)
      .eq('activo', true),
    db.from('deudas')
      .select('acreedor, monto_inicial, monto_actual, tipo_deuda, tipo_pago, monto_pago, tasa_interes_anual, created_at')
      .eq('usuario_id', uid)
      .eq('activa', true)
      .order('monto_actual', { ascending: false }),
    db.from('pagos_deuda')
      .select('fecha, monto, nota, deudas(acreedor), cuentas(nombre)')
      .eq('usuario_id', uid)
      .order('fecha', { ascending: false }),
    db.from('metas_ahorro')
      .select('nombre, monto_objetivo, monto_actual, fecha_limite, frecuencia_ahorro')
      .eq('usuario_id', uid)
      .eq('activa', true)
      .order('nombre', { ascending: true })
  ]);

  const filas = [];
  const hoy = new Date().toISOString().split('T')[0];

  // --- SECCIÓN 1: Movimientos ---
  filas.push(csvRow(['=== MOVIMIENTOS ===', '', '', '', '', '']));
  filas.push(csvRow(['Fecha', 'Tipo', 'Categoría', 'Monto', 'Cuenta', 'Descripción']));

  for (const g of gastos || []) {
    filas.push(csvRow([
      g.fecha || '',
      g.es_ahorro ? 'Aporte a Meta' : 'Gasto',
      g.categorias?.nombre || 'Sin categoría',
      g.monto,
      g.cuentas?.nombre || '',
      g.descripcion || ''
    ]));
  }

  for (const i of ingresos || []) {
    filas.push(csvRow([
      i.fecha || '',
      i.tipo === 'prestamo' ? 'Préstamo recibido' : 'Ingreso',
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
      `${f.descripcion || ''} (${f.frecuencia || ''})`
    ]));
  }

  filas.push(csvRow(['', '', '', '', '', '']));

  // --- SECCIÓN 2: Progreso de Deudas ---
  filas.push(csvRow(['=== DEUDAS ===', '', '', '', '', '']));
  filas.push(csvRow(['Acreedor', 'Tipo', 'Monto Inicial', 'Saldo Actual', '% Pagado', 'Cuota', 'Frecuencia', 'Tasa %']));

  for (const d of deudas || []) {
    const pct = d.monto_inicial > 0
      ? Math.round(((d.monto_inicial - d.monto_actual) / d.monto_inicial) * 100)
      : 0;
    filas.push(csvRow([
      d.acreedor || '',
      d.tipo_deuda || '',
      d.monto_inicial || 0,
      d.monto_actual || 0,
      `${pct}%`,
      d.monto_pago || '',
      d.tipo_pago || '',
      d.tasa_interes_anual || 0
    ]));
  }

  filas.push(csvRow(['', '', '', '', '', '', '', '']));
  filas.push(csvRow(['=== PAGOS A DEUDAS ===', '', '', '', '', '']));
  filas.push(csvRow(['Fecha', 'Acreedor', 'Monto', 'Cuenta', 'Nota', '']));

  for (const p of pagosDeuda || []) {
    filas.push(csvRow([
      p.fecha || '',
      p.deudas?.acreedor || '',
      p.monto || 0,
      p.cuentas?.nombre || '',
      p.nota || '',
      ''
    ]));
  }

  filas.push(csvRow(['', '', '', '', '', '']));

  // --- SECCIÓN 3: Metas de Ahorro ---
  filas.push(csvRow(['=== METAS DE AHORRO ===', '', '', '', '', '']));
  filas.push(csvRow(['Meta', 'Objetivo', 'Ahorrado', '% Completado', 'Fecha Límite', 'Frecuencia']));

  for (const m of metas || []) {
    const pct = m.monto_objetivo > 0
      ? Math.round((m.monto_actual / m.monto_objetivo) * 100)
      : 0;
    filas.push(csvRow([
      m.nombre || '',
      m.monto_objetivo || 0,
      m.monto_actual || 0,
      `${pct}%`,
      m.fecha_limite || '',
      m.frecuencia_ahorro || ''
    ]));
  }

  const csv = filas.join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jm_finance_${hoy}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
