/**
 * Generador de Archivos PDF
 * Usa PDFKit para crear PDFs profesionales (importado dinámicamente)
 */

import { Readable } from 'stream'
import { loadPDFKit } from '@/lib/utils/load-pdfkit'

export interface PDFOptions {
  title: string
  author?: string
  subject?: string
  orientation?: 'portrait' | 'landscape'
}

export class PDFGenerator {
  /**
   * Genera un PDF con tabla de datos
   */
  static async generate(
    data: any[],
    columns: { key: string; label: string; width?: number }[],
    options: PDFOptions
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const PDFDocument = loadPDFKit()
        const doc = new PDFDocument({
          size: 'A4',
          layout: options.orientation || 'portrait',
          margin: 50,
          info: {
            Title: options.title,
            Author: options.author || 'Sistema de Tickets',
            Subject: options.subject || options.title
          }
        })

        const chunks: Buffer[] = []
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // Header
        this.addHeader(doc, options.title)

        // Metadata
        this.addMetadata(doc, data.length)

        // Tabla de datos
        this.addTable(doc, data, columns)

        // Footer
        this.addFooter(doc)

        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Agrega header al PDF
   */
  private static addHeader(doc: PDFKit.PDFDocument, title: string) {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(title, { align: 'center' })
      .moveDown()

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generado: ${new Date().toLocaleString('es-ES')}`, { align: 'center' })
      .moveDown(2)

    // Línea separadora
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke()
      .moveDown()
  }

  /**
   * Agrega metadata
   */
  private static addMetadata(doc: PDFKit.PDFDocument, recordCount: number) {
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total de registros: ${recordCount}`, { align: 'left' })
      .moveDown()
  }

  /**
   * Agrega tabla de datos
   */
  private static addTable(
    doc: PDFKit.PDFDocument,
    data: any[],
    columns: { key: string; label: string; width?: number }[]
  ) {
    const startY = doc.y
    const pageWidth = doc.page.width - 100
    const rowHeight = 25
    const headerHeight = 30

    // Calcular anchos de columnas
    const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0)
    const scaleFactor = pageWidth / totalWidth
    const columnWidths = columns.map(col => (col.width || 100) * scaleFactor)

    // Header de tabla
    let x = 50
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#4B5563')

    columns.forEach((col, i) => {
      doc.text(col.label, x, startY, {
        width: columnWidths[i],
        align: 'left'
      })
      x += columnWidths[i]
    })

    // Línea bajo header
    doc
      .moveTo(50, startY + headerHeight - 5)
      .lineTo(doc.page.width - 50, startY + headerHeight - 5)
      .stroke()

    // Datos
    let y = startY + headerHeight
    doc.fontSize(8).font('Helvetica').fillColor('#000000')

    data.forEach((row, rowIndex) => {
      // Verificar si necesitamos nueva página
      if (y > doc.page.height - 100) {
        doc.addPage()
        y = 50
        
        // Re-dibujar header en nueva página
        x = 50
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#4B5563')
        columns.forEach((col, i) => {
          doc.text(col.label, x, y, {
            width: columnWidths[i],
            align: 'left'
          })
          x += columnWidths[i]
        })
        doc
          .moveTo(50, y + headerHeight - 5)
          .lineTo(doc.page.width - 50, y + headerHeight - 5)
          .stroke()
        y += headerHeight
        doc.fontSize(8).font('Helvetica').fillColor('#000000')
      }

      // Fondo alternado para filas
      if (rowIndex % 2 === 0) {
        doc
          .rect(50, y - 2, pageWidth, rowHeight)
          .fillAndStroke('#F9FAFB', '#E5E7EB')
      }

      x = 50
      columns.forEach((col, i) => {
        const value = this.formatValue(row[col.key])
        doc.text(value, x, y, {
          width: columnWidths[i],
          align: 'left',
          ellipsis: true
        })
        x += columnWidths[i]
      })

      y += rowHeight
    })
  }

  /**
   * Agrega footer al PDF
   */
  private static addFooter(doc: PDFKit.PDFDocument) {
    const pages = doc.bufferedPageRange()
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      
      // Línea separadora
      doc
        .moveTo(50, doc.page.height - 50)
        .lineTo(doc.page.width - 50, doc.page.height - 50)
        .stroke()

      // Texto del footer
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(
          `Página ${i + 1} de ${pages.count}`,
          50,
          doc.page.height - 40,
          { align: 'center' }
        )

      doc.text(
        `© ${new Date().getFullYear()} Sistema de Tickets`,
        50,
        doc.page.height - 30,
        { align: 'center' }
      )
    }
  }

  /**
   * Formatea valores para mostrar en PDF
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) return 'N/A'
    if (value instanceof Date) return value.toLocaleString('es-ES')
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  /**
   * Genera PDF para reporte de tickets
   */
  static async generateTicketsReport(tickets: any[], summary?: any): Promise<Buffer> {
    const columns = [
      { key: 'ticketNumber', label: '#', width: 50 },
      { key: 'title', label: 'Título', width: 150 },
      { key: 'status', label: 'Estado', width: 80 },
      { key: 'priority', label: 'Prioridad', width: 80 },
      { key: 'clientName', label: 'Cliente', width: 100 },
      { key: 'assigneeName', label: 'Técnico', width: 100 },
      { key: 'createdAt', label: 'Creado', width: 90 }
    ]

    const data = tickets.map(ticket => ({
      ticketNumber: ticket.ticketNumber || 'N/A',
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      clientName: ticket.client?.name || 'N/A',
      assigneeName: ticket.assignee?.name || 'Sin asignar',
      createdAt: new Date(ticket.createdAt).toLocaleDateString('es-ES')
    }))

    return this.generate(data, columns, {
      title: 'Reporte de Tickets',
      subject: 'Análisis de Tickets del Sistema',
      orientation: 'landscape'
    })
  }

  /**
   * Genera PDF para reporte de técnicos
   */
  static async generateTechniciansReport(technicians: any[]): Promise<Buffer> {
    const columns = [
      { key: 'name', label: 'Nombre', width: 150 },
      { key: 'email', label: 'Email', width: 150 },
      { key: 'assignedTickets', label: 'Asignados', width: 80 },
      { key: 'resolvedTickets', label: 'Resueltos', width: 80 },
      { key: 'resolutionRate', label: 'Tasa', width: 70 },
      { key: 'avgRating', label: 'Rating', width: 70 }
    ]

    const data = technicians.map(tech => ({
      name: tech.technicianName,
      email: tech.email,
      assignedTickets: tech.assignedTickets,
      resolvedTickets: tech.resolvedTickets,
      resolutionRate: `${tech.resolutionRate}%`,
      avgRating: tech.avgRating || 'N/A'
    }))

    return this.generate(data, columns, {
      title: 'Reporte de Técnicos',
      subject: 'Rendimiento de Técnicos',
      orientation: 'landscape'
    })
  }
}
