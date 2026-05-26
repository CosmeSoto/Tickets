/**
 * Export utilities for Reports module (CSV and PDF)
 */

import type {
  Family,
  FamilyExecutiveSummary,
  TechnicianPerformance,
  TemporalTrendPoint,
  SLAComplianceRow,
  SatisfactionReport,
} from './report-types'
import { formatMinutes, priorityLabel, getTabLabel } from './report-formatters'

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]): void {
  const content = rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const bom = '\uFEFF'
  const encoded = encodeURIComponent(bom + content)
  const a = document.createElement('a')
  a.href = `data:text/csv;charset=utf-8,${encoded}`
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  if (a && a.parentNode) a.parentNode.removeChild(a)
}

export function exportExecutiveCSV(data: FamilyExecutiveSummary[], familyName: string): void {
  const header = [
    'Familia',
    'Código',
    'Total Tickets',
    'Abiertos',
    'En Progreso',
    'Resueltos',
    'Cerrados',
    'Tiempo Prom. Resolución',
    'Cumplimiento SLA (%)',
  ]
  const rows = data.map(r => [
    r.familyName,
    r.familyCode,
    String(r.totalTickets),
    String(r.openTickets),
    String(r.inProgressTickets),
    String(r.resolvedTickets),
    String(r.closedTickets),
    formatMinutes(r.avgResolutionTimeMinutes),
    String(r.slaComplianceRate),
  ])
  downloadCSV(`resumen-ejecutivo-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [
    header,
    ...rows,
  ])
}

export function exportTechniciansCSV(data: TechnicianPerformance[], familyName: string): void {
  const header = [
    'Técnico',
    'Email',
    'Tickets Asignados',
    'Tickets Resueltos',
    'Tiempo Prom. Resolución',
    'Calificación Promedio',
  ]
  const rows = data.map(r => [
    r.technicianName,
    r.technicianEmail,
    String(r.assignedTickets),
    String(r.resolvedTickets),
    formatMinutes(r.avgResolutionTimeMinutes),
    r.avgRating !== null ? String(r.avgRating) : '—',
  ])
  downloadCSV(`rendimiento-tecnicos-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [
    header,
    ...rows,
  ])
}

export function exportTrendsCSV(data: TemporalTrendPoint[], familyName: string): void {
  const header = ['Período', 'Familia', 'Cantidad de Tickets']
  const rows = data.map(r => [r.period, r.familyName ?? familyName, String(r.count)])
  downloadCSV(`tendencias-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [
    header,
    ...rows,
  ])
}

export function exportSLACSV(data: SLAComplianceRow[], familyName: string): void {
  const header = [
    'Familia',
    'Prioridad',
    'Total',
    'Cumplidos',
    'Incumplidos',
    'Tasa de Cumplimiento (%)',
  ]
  const rows = data.map(r => [
    r.familyName,
    priorityLabel(r.priority),
    String(r.total),
    String(r.compliant),
    String(r.breached),
    String(r.complianceRate),
  ])
  downloadCSV(`cumplimiento-sla-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [
    header,
    ...rows,
  ])
}

export function exportSatisfactionCSV(data: SatisfactionReport, familyName: string): void {
  const header = [
    'Familia',
    'Total Calificaciones',
    'Promedio',
    'Tasa Satisfacción (%)',
    '★1',
    '★2',
    '★3',
    '★4',
    '★5',
  ]
  const rows =
    data.byFamily.length > 0
      ? data.byFamily.map(r => [
          r.familyName,
          String(r.totalRatings),
          String(r.avgRating),
          String(r.satisfactionRate),
          '—',
          '—',
          '—',
          '—',
          '—',
        ])
      : [
          [
            familyName,
            String(data.totalRatings),
            data.avgRating !== null ? String(data.avgRating) : '—',
            data.satisfactionRate !== null ? String(data.satisfactionRate) : '—',
            String(data.distribution[1] ?? 0),
            String(data.distribution[2] ?? 0),
            String(data.distribution[3] ?? 0),
            String(data.distribution[4] ?? 0),
            String(data.distribution[5] ?? 0),
          ],
        ]
  downloadCSV(`satisfaccion-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [
    header,
    ...rows,
  ])
}

// ─── PDF / Print Export ───────────────────────────────────────────────────────

export function exportPDF(
  family: Family | null,
  tab: string,
  executiveData: FamilyExecutiveSummary[],
  techniciansData: TechnicianPerformance[],
  trendsData: TemporalTrendPoint[],
  slaData: SLAComplianceRow[],
  satisfactionData: SatisfactionReport | null,
  granularity: string
): void {
  const familyName = family ? family.name : 'Todas las familias'
  const familyCode = family ? family.code : 'ALL'
  const familyColor = family?.color ?? '#6B7280'
  const date = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let tableHTML = ''

  if (tab === 'executive') {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Familia</th><th>Código</th><th>Total</th><th>Abiertos</th>
          <th>Resueltos</th><th>Tiempo Prom.</th><th>SLA %</th>
        </tr></thead>
        <tbody>
          ${executiveData
            .map(
              r => `<tr>
            <td>${r.familyName}</td><td>${r.familyCode}</td><td>${r.totalTickets}</td>
            <td>${r.openTickets}</td><td>${r.resolvedTickets}</td>
            <td>${formatMinutes(r.avgResolutionTimeMinutes)}</td>
            <td>${r.slaComplianceRate}%</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>`
  } else if (tab === 'technicians') {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Técnico</th><th>Email</th><th>Asignados</th><th>Resueltos</th>
          <th>Tiempo Prom.</th><th>Calificación</th>
        </tr></thead>
        <tbody>
          ${techniciansData
            .map(
              r => `<tr>
            <td>${r.technicianName}</td><td>${r.technicianEmail}</td>
            <td>${r.assignedTickets}</td><td>${r.resolvedTickets}</td>
            <td>${formatMinutes(r.avgResolutionTimeMinutes)}</td>
            <td>${r.avgRating ?? '—'}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>`
  } else if (tab === 'trends') {
    tableHTML = `
      <table>
        <thead><tr><th>Período</th><th>Familia</th><th>Tickets</th></tr></thead>
        <tbody>
          ${trendsData
            .map(
              r => `<tr>
            <td>${r.period}</td><td>${r.familyName ?? familyName}</td><td>${r.count}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>`
  } else if (tab === 'sla') {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Familia</th><th>Prioridad</th><th>Total</th>
          <th>Cumplidos</th><th>Incumplidos</th><th>Tasa %</th>
        </tr></thead>
        <tbody>
          ${slaData
            .map(
              r => `<tr>
            <td>${r.familyName}</td><td>${priorityLabel(r.priority)}</td>
            <td>${r.total}</td><td>${r.compliant}</td><td>${r.breached}</td>
            <td>${r.complianceRate}%</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>`
  }

  if (tab === 'satisfaction' && satisfactionData) {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Familia</th><th>Calificaciones</th><th>Promedio</th><th>Satisfacción %</th>
        </tr></thead>
        <tbody>
          ${
            satisfactionData.byFamily.length > 0
              ? satisfactionData.byFamily
                  .map(
                    r => `<tr>
                <td>${r.familyName}</td><td>${r.totalRatings}</td>
                <td>★ ${r.avgRating}</td><td>${r.satisfactionRate}%</td>
              </tr>`
                  )
                  .join('')
              : `<tr><td colspan="4">Total: ${satisfactionData.totalRatings} calificaciones · Promedio: ★ ${satisfactionData.avgRating ?? '—'} · Satisfacción: ${satisfactionData.satisfactionRate ?? '—'}%</td></tr>`
          }
        </tbody>
      </table>`
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte — ${familyName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; }
    .header { border-left: 6px solid ${familyColor}; padding: 12px 16px; margin-bottom: 24px; background: #f9fafb; }
    .header h1 { margin: 0 0 4px; font-size: 20px; }
    .header p { margin: 0; color: #6b7280; font-size: 13px; }
    .badge { display: inline-block; background: ${familyColor}22; color: ${familyColor}; border: 1px solid ${familyColor}55; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; margin-left: 8px; }
    h2 { font-size: 16px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }
    .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: right; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Sistema de Tickets — ${getTabLabel(tab, granularity)} <span class="badge">${familyCode}</span></h1>
    <p>${familyName} &nbsp;·&nbsp; Generado el ${date}</p>
  </div>
  <h2>${getTabLabel(tab, granularity)}</h2>
  ${tableHTML}
  <div class="footer">Reporte generado automáticamente · ${date}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

  // Usar Blob en lugar de data: URL (Chrome bloquea data: URLs en window.open)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.focus()
    // Revocar el URL del blob después de que la ventana cargue
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
