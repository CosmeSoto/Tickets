/**
 * Exportación de informe completo de lote (resumen + equipos) vía impresión/PDF.
 */

import { EQUIPMENT_CONDITION_LABELS, ACQUISITION_MODE_LABELS } from '@/lib/utils/equipment-display'

const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'Mantenimiento',
  RETIRED: 'Retirado',
  DAMAGED: 'Dañado',
  FOR_SALE: 'En venta',
  SOLD: 'Vendido',
}

export interface BatchReportEquipmentRow {
  code: string
  serialNumber?: string | null
  status: string
  location?: string | null
  physicalLocation?: string | null
  warehouse?: { name: string } | null
  department?: { name: string } | null
}

export interface BatchReportSummary {
  batchCode: string
  brandModel: string
  typeName?: string
  quantity: number
  purchaseDate: string | Date
  unitPrice: number
  totalPrice: number
  supplierName?: string
  departmentName?: string
  warehouseName?: string
  condition?: string
  propertyType?: string
  metrics: {
    total: number
    available: number
    assigned: number
    maintenance: number
    retired: number
    utilizationRate: number
  }
}

export interface BatchReportHistoryRow {
  date: string | Date
  description: string
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(status: string): string {
  return EQUIPMENT_STATUS_LABELS[status] ?? status
}

export function exportBatchReportToPDF(params: {
  summary: BatchReportSummary
  equipment: BatchReportEquipmentRow[]
  history?: BatchReportHistoryRow[]
  filename: string
}): void {
  const { summary, equipment, history = [], filename } = params
  const date = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const equipmentRows = equipment
    .map(
      e => `
    <tr>
      <td>${e.code}</td>
      <td>${e.serialNumber || '—'}</td>
      <td>${statusLabel(e.status)}</td>
      <td>${e.physicalLocation || e.location || '—'}</td>
      <td>${e.warehouse?.name || '—'}</td>
      <td>${e.department?.name || '—'}</td>
    </tr>`
    )
    .join('')

  const historyRows =
    history.length > 0
      ? history
          .slice(0, 15)
          .map(
            h => `
    <tr>
      <td>${fmtDate(h.date)}</td>
      <td>${h.description}</td>
    </tr>`
          )
          .join('')
      : '<tr><td colspan="2">Sin eventos registrados</td></tr>'

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${summary.batchCode}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; font-size: 11px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 13px; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .meta { color: #555; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin-bottom: 16px; }
    .grid div label { display: block; font-size: 9px; color: #666; text-transform: uppercase; }
    .grid div span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
    th { background: #f3f4f6; font-size: 10px; }
    .footer { margin-top: 24px; font-size: 9px; color: #888; text-align: center; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>Informe de lote — ${summary.batchCode}</h1>
  <p class="meta">${summary.brandModel}${summary.typeName ? ` · ${summary.typeName}` : ''} · Generado ${date}</p>

  <div class="grid">
    <div><label>Fecha compra</label><span>${fmtDate(summary.purchaseDate)}</span></div>
    <div><label>Precio unitario</label><span>$${summary.unitPrice.toFixed(2)}</span></div>
    <div><label>Total</label><span>$${summary.totalPrice.toFixed(2)}</span></div>
    <div><label>Proveedor</label><span>${summary.supplierName || '—'}</span></div>
    <div><label>Departamento</label><span>${summary.departmentName || '—'}</span></div>
    <div><label>Bodega</label><span>${summary.warehouseName || '—'}</span></div>
    <div><label>Condición</label><span>${summary.condition ? (EQUIPMENT_CONDITION_LABELS[summary.condition] ?? summary.condition) : '—'}</span></div>
    <div><label>Modalidad</label><span>${summary.propertyType ? (ACQUISITION_MODE_LABELS[summary.propertyType] ?? summary.propertyType) : '—'}</span></div>
    <div><label>Cantidad registrada</label><span>${summary.quantity}</span></div>
  </div>

  <h2>Utilización del lote</h2>
  <div class="grid">
    <div><label>Equipos vinculados</label><span>${summary.metrics.total}</span></div>
    <div><label>Disponibles</label><span>${summary.metrics.available}</span></div>
    <div><label>Asignados</label><span>${summary.metrics.assigned}</span></div>
    <div><label>Mantenimiento</label><span>${summary.metrics.maintenance}</span></div>
    <div><label>Retirados</label><span>${summary.metrics.retired}</span></div>
    <div><label>Utilización</label><span>${summary.metrics.utilizationRate.toFixed(0)}%</span></div>
  </div>

  <h2>Equipos del lote (${equipment.length})</h2>
  <table>
    <thead><tr><th>Código</th><th>Serial</th><th>Estado</th><th>Ubicación</th><th>Bodega</th><th>Depto.</th></tr></thead>
    <tbody>${equipmentRows}</tbody>
  </table>

  <h2>Historial reciente</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Evento</th></tr></thead>
    <tbody>${historyRows}</tbody>
  </table>

  <p class="footer">Sistema de Gestión de Inventario</p>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)

  // Evitar warning de filename no usado — el usuario guarda desde el diálogo de impresión
  void filename
}
