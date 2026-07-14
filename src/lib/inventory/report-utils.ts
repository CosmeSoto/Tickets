/**
 * Utilidades de servidor para endpoints de reportes de inventario.
 * Para formato puro (cliente + servidor) usar report-format.ts.
 */
export type {
  ReportResponse,
  ReportSummaryItem,
} from '@/lib/inventory/report-format'
export {
  CONSUMABLE_STATUS_ES,
  DECOMMISSION_REASON_ES,
  EQUIPMENT_STATUS_ES,
  LICENSE_STATUS_ES,
  MAINTENANCE_STATUS_ES,
  daysUntil,
  formatCurrency,
  formatDate,
  toCSV,
} from '@/lib/inventory/report-format'

import type { ReportSummaryItem } from '@/lib/inventory/report-format'
import { formatDate } from '@/lib/inventory/report-format'

/**
 * Obtiene los IDs de familias accesibles para reportes de inventario (scope visibility).
 * ADMIN super → null (sin restricción)
 */
export async function getAccessibleFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin = false,
  canManageInventory = false
): Promise<string[] | null> {
  const { getAccessibleFamilyIds: getInventoryFamilies } =
    await import('@/lib/inventory/family-access')
  const ids = await getInventoryFamilies(userId, role, isSuperAdmin, canManageInventory)
  if (ids === undefined) return null
  return ids
}

/**
 * Construye el filtro de familyId para Prisma según acceso del usuario.
 */
export function buildFamilyFilter(
  accessibleFamilyIds: string[] | null,
  requestedFamilyId?: string | null
): { in: string[] } | string | undefined {
  if (requestedFamilyId) {
    if (accessibleFamilyIds !== null && !accessibleFamilyIds.includes(requestedFamilyId)) {
      return { in: [] }
    }
    return requestedFamilyId
  }
  if (accessibleFamilyIds !== null) {
    return { in: accessibleFamilyIds }
  }
  return undefined
}

/**
 * Genera un PDF simple de reporte usando PDFKit.
 */
export async function generateReportPDF(
  title: string,
  summary: ReportSummaryItem[],
  headers: string[],
  rows: string[][]
): Promise<ArrayBuffer> {
  const PDFDocument = (await import('pdfkit')).default

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      const buf = Buffer.concat(chunks)
      resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    })
    doc.on('error', reject)

    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' })
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generado: ${formatDate(new Date())}`, { align: 'center' })
    doc.moveDown()

    if (summary.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Resumen Ejecutivo')
      doc.moveDown(0.3)
      summary.forEach(item => {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`${item.title}: `, { continued: true })
          .font('Helvetica')
          .text(`${item.value} — ${item.description}`)
      })
      doc.moveDown()
    }

    if (rows.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Datos del Reporte')
      doc.moveDown(0.3)

      const colWidth = Math.floor((doc.page.width - 80) / headers.length)

      doc.fontSize(8).font('Helvetica-Bold')
      headers.forEach((h, i) => {
        doc.text(h, 40 + i * colWidth, doc.y, { width: colWidth, lineBreak: false })
      })
      doc.moveDown(0.5)

      doc.font('Helvetica').fontSize(8)
      rows.forEach(row => {
        const y = doc.y
        row.forEach((cell, i) => {
          doc.text(String(cell ?? ''), 40 + i * colWidth, y, { width: colWidth, lineBreak: false })
        })
        doc.moveDown(0.5)

        if (doc.y > doc.page.height - 80) {
          doc.addPage()
        }
      })
    } else {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('No hay datos para mostrar con los filtros aplicados.')
    }

    doc.end()
  })
}
