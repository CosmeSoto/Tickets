/**
 * Utilidades compartidas para los endpoints de reportes de inventario.
 */
import { prisma } from '@/lib/prisma'

export interface ReportSummaryItem {
  title: string
  value: string | number
  description: string
}

export interface ReportResponse<T> {
  summary: ReportSummaryItem[]
  data: T[]
  filters: Record<string, unknown>
  generatedAt: string
  totalCount: number
}

/** Mapeo de estados de equipo a español */
export const EQUIPMENT_STATUS_ES: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'En mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Dado de baja',
}

/** Mapeo de estados de consumible a español */
export const CONSUMABLE_STATUS_ES: Record<string, string> = {
  ACTIVE: 'Activo',
  LOW_STOCK: 'Stock bajo',
  OUT_OF_STOCK: 'Sin stock',
  EXPIRED: 'Caducado',
  RETIRED: 'Dado de baja',
}

/** Mapeo de estados de licencia a español */
export const LICENSE_STATUS_ES: Record<string, string> = {
  ACTIVE: 'Activo',
  EXPIRING_SOON: 'Por vencer',
  EXPIRED: 'Vencido',
  INACTIVE: 'Inactivo',
}

/** Mapeo de estados de mantenimiento a español */
export const MAINTENANCE_STATUS_ES: Record<string, string> = {
  REQUESTED: 'Solicitado',
  SCHEDULED: 'Programado',
  ACCEPTED: 'Aceptado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

/** Mapeo de motivos de baja a español */
export const DECOMMISSION_REASON_ES: Record<string, string> = {
  DAMAGED: 'Daño irreparable',
  OBSOLETE: 'Obsolescencia',
  LOST: 'Pérdida',
  STOLEN: 'Robo',
  END_OF_LIFE: 'Fin de vida útil',
  OTHER: 'Otro',
  EXPIRED: 'Caducado',
}

/** Formatea una fecha a DD/MM/YYYY */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/** Calcula días restantes desde hoy hasta una fecha */
export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/** Formatea un valor monetario */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}

/**
 * Obtiene los IDs de familias accesibles para un usuario.
 * ADMIN → null (sin restricción)
 * Gestor → array de familyIds asignados
 */
export async function getAccessibleFamilyIds(
  userId: string,
  role: string
): Promise<string[] | null> {
  if (role === 'ADMIN') return null

  const assignments = await prisma.inventory_manager_families.findMany({
    where: { managerId: userId },
    select: { familyId: true },
  })
  return assignments.map((a) => a.familyId)
}

/**
 * Construye el filtro de familyId para Prisma según acceso del usuario.
 * Retorna undefined si no hay restricción, o { in: [...] } si hay restricción.
 */
export function buildFamilyFilter(
  accessibleFamilyIds: string[] | null,
  requestedFamilyId?: string | null
): { in: string[] } | string | undefined {
  if (requestedFamilyId) {
    // Si el usuario no es ADMIN, verificar que la familia solicitada esté en sus familias
    if (accessibleFamilyIds !== null && !accessibleFamilyIds.includes(requestedFamilyId)) {
      return { in: [] } // Sin acceso → retorna filtro vacío
    }
    return requestedFamilyId
  }
  if (accessibleFamilyIds !== null) {
    return { in: accessibleFamilyIds }
  }
  return undefined
}

/** Convierte un array de objetos a CSV */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h]
          if (val == null) return ''
          const str = String(val)
          // Escapar comillas y envolver en comillas si contiene coma, comilla o salto de línea
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    ),
  ]
  return lines.join('\n')
}

/**
 * Genera un PDF simple de reporte usando PDFKit.
 * Retorna un ArrayBuffer con el contenido del PDF.
 */
export async function generateReportPDF(
  title: string,
  summary: ReportSummaryItem[],
  headers: string[],
  rows: string[][]
): Promise<ArrayBuffer> {
  // Importación dinámica para evitar problemas con SSR
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

    // Encabezado
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' })
    doc.fontSize(10).font('Helvetica').text(`Generado: ${formatDate(new Date())}`, { align: 'center' })
    doc.moveDown()

    // Resumen ejecutivo
    if (summary.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Resumen Ejecutivo')
      doc.moveDown(0.3)
      summary.forEach((item) => {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`${item.title}: `, { continued: true })
          .font('Helvetica')
          .text(`${item.value} — ${item.description}`)
      })
      doc.moveDown()
    }

    // Tabla de datos
    if (rows.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Datos del Reporte')
      doc.moveDown(0.3)

      const colWidth = Math.floor((doc.page.width - 80) / headers.length)

      // Encabezados de tabla
      doc.fontSize(8).font('Helvetica-Bold')
      headers.forEach((h, i) => {
        doc.text(h, 40 + i * colWidth, doc.y, { width: colWidth, lineBreak: false })
      })
      doc.moveDown(0.5)

      // Filas
      doc.font('Helvetica').fontSize(8)
      rows.forEach((row) => {
        const y = doc.y
        row.forEach((cell, i) => {
          doc.text(String(cell ?? ''), 40 + i * colWidth, y, { width: colWidth, lineBreak: false })
        })
        doc.moveDown(0.5)

        // Nueva página si es necesario
        if (doc.y > doc.page.height - 80) {
          doc.addPage()
        }
      })
    } else {
      doc.fontSize(10).font('Helvetica').text('No hay datos para mostrar con los filtros aplicados.')
    }

    doc.end()
  })
}
