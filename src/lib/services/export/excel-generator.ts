/**
 * Generador de Archivos Excel (XLSX)
 * Usa la librería xlsx para crear archivos Excel reales
 */

import * as XLSX from 'xlsx'

export interface ExcelSheet {
  name: string
  data: any[]
  columns?: string[]
}

export class ExcelGenerator {
  /**
   * Genera un archivo Excel con múltiples hojas
   */
  static generate(sheets: ExcelSheet[], metadata?: Record<string, any>): Buffer {
    const workbook = XLSX.utils.book_new()

    // Agregar metadata como propiedades del workbook
    if (metadata) {
      workbook.Props = {
        Title: metadata.title || 'Reporte',
        Subject: metadata.subject || 'Sistema de Tickets',
        Author: metadata.author || 'Sistema de Tickets',
        CreatedDate: new Date()
      }
    }

    // Agregar cada hoja
    sheets.forEach(sheet => {
      const worksheet = this.createWorksheet(sheet.data, sheet.columns)
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
    })

    // Generar buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    })

    return buffer
  }

  /**
   * Crea una hoja de trabajo con formato
   */
  private static createWorksheet(data: any[], columns?: string[]): XLSX.WorkSheet {
    // Si se especifican columnas, filtrar y ordenar datos
    let processedData = data
    if (columns && columns.length > 0) {
      processedData = data.map(row => {
        const filteredRow: any = {}
        columns.forEach(col => {
          filteredRow[col] = row[col]
        })
        return filteredRow
      })
    }

    // Crear worksheet desde JSON
    const worksheet = XLSX.utils.json_to_sheet(processedData)

    // Aplicar formato a las columnas
    this.applyColumnFormatting(worksheet, processedData)

    // Auto-ajustar ancho de columnas
    this.autoSizeColumns(worksheet, processedData)

    return worksheet
  }

  /**
   * Aplica formato a las columnas (fechas, números, etc.)
   */
  private static applyColumnFormatting(worksheet: XLSX.WorkSheet, data: any[]) {
    if (data.length === 0) return

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    const firstRow = data[0]
    const keys = Object.keys(firstRow)

    keys.forEach((key, colIndex) => {
      const value = firstRow[key]
      
      // Detectar tipo de dato y aplicar formato
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex })
        const cell = worksheet[cellAddress]
        
        if (!cell) continue

        // Formato para fechas
        if (value instanceof Date || this.isDateString(value)) {
          cell.t = 'd'
          cell.z = 'dd/mm/yyyy hh:mm'
        }
        // Formato para números
        else if (typeof value === 'number') {
          cell.t = 'n'
          if (Number.isInteger(value)) {
            cell.z = '#,##0'
          } else {
            cell.z = '#,##0.00'
          }
        }
        // Formato para porcentajes
        else if (typeof value === 'string' && value.includes('%')) {
          cell.t = 'n'
          cell.z = '0.00%'
        }
      }
    })
  }

  /**
   * Auto-ajusta el ancho de las columnas
   */
  private static autoSizeColumns(worksheet: XLSX.WorkSheet, data: any[]) {
    if (data.length === 0) return

    const keys = Object.keys(data[0])
    const colWidths: number[] = []

    keys.forEach((key, index) => {
      // Ancho basado en el header
      let maxWidth = key.length

      // Verificar ancho de los datos
      data.forEach(row => {
        const value = String(row[key] || '')
        maxWidth = Math.max(maxWidth, value.length)
      })

      // Limitar ancho máximo a 50 caracteres
      colWidths[index] = Math.min(maxWidth + 2, 50)
    })

    worksheet['!cols'] = colWidths.map(w => ({ wch: w }))
  }

  /**
   * Verifica si un string es una fecha
   */
  private static isDateString(value: any): boolean {
    if (typeof value !== 'string') return false
    const date = new Date(value)
    return !isNaN(date.getTime())
  }

  /**
   * Genera Excel para reporte de tickets
   */
  static generateTicketsReport(tickets: any[], summary?: any): Buffer {
    const sheets: ExcelSheet[] = []

    // Hoja 1: Resumen
    if (summary) {
      sheets.push({
        name: 'Resumen',
        data: [
          { Métrica: 'Total de Tickets', Valor: summary.totalTickets },
          { Métrica: 'Tickets Abiertos', Valor: summary.openTickets },
          { Métrica: 'Tickets en Progreso', Valor: summary.inProgressTickets },
          { Métrica: 'Tickets Resueltos', Valor: summary.resolvedTickets },
          { Métrica: 'Tickets Cerrados', Valor: summary.closedTickets },
          { Métrica: 'Tiempo Promedio de Resolución', Valor: summary.avgResolutionTime },
          { Métrica: 'Tasa de Cumplimiento SLA', Valor: `${summary.slaMetrics?.slaComplianceRate || 0}%` }
        ]
      })
    }

    // Hoja 2: Tickets Detallados
    const ticketData = tickets.map(ticket => ({
      'ID': ticket.id,
      'Número': ticket.ticketNumber || 'N/A',
      'Título': ticket.title,
      'Estado': ticket.status,
      'Prioridad': ticket.priority,
      'Cliente': ticket.client?.name || 'N/A',
      'Técnico': ticket.assignee?.name || 'Sin asignar',
      'Categoría': ticket.category?.name || 'N/A',
      'Creado': ticket.createdAt,
      'Actualizado': ticket.updatedAt,
      'Resuelto': ticket.resolvedAt || 'N/A',
      'Tiempo de Resolución': ticket.resolutionTime || 'N/A',
      'SLA': ticket.slaStatus || 'N/A',
      'Origen': ticket.source,
      'Descripción': ticket.description
    }))

    sheets.push({
      name: 'Tickets',
      data: ticketData
    })

    // Hoja 3: Por Categoría (si hay datos)
    if (summary?.ticketsByCategory) {
      sheets.push({
        name: 'Por Categoría',
        data: summary.ticketsByCategory.map((cat: any) => ({
          'Categoría': cat.categoryName,
          'Cantidad': cat.count,
          'Porcentaje': `${cat.percentage}%`
        }))
      })
    }

    return this.generate(sheets, {
      title: 'Reporte de Tickets',
      subject: 'Análisis de Tickets del Sistema',
      author: 'Sistema de Tickets'
    })
  }

  /**
   * Genera Excel para reporte de técnicos
   */
  static generateTechniciansReport(technicians: any[]): Buffer {
    const sheets: ExcelSheet[] = []

    const technicianData = technicians.map(tech => ({
      'ID': tech.technicianId,
      'Nombre': tech.technicianName,
      'Email': tech.email,
      'Departamento': tech.department,
      'Tickets Asignados': tech.assignedTickets,
      'Tickets Resueltos': tech.resolvedTickets,
      'Tickets Activos': tech.activeTickets,
      'Tasa de Resolución': `${tech.resolutionRate}%`,
      'Tiempo Promedio': tech.avgResolutionTime,
      'Calificación Promedio': tech.avgRating || 'N/A',
      'Carga de Trabajo': `${tech.workload}%`
    }))

    sheets.push({
      name: 'Técnicos',
      data: technicianData
    })

    return this.generate(sheets, {
      title: 'Reporte de Técnicos',
      subject: 'Rendimiento de Técnicos',
      author: 'Sistema de Tickets'
    })
  }

  /**
   * Genera Excel para reporte de categorías
   */
  static generateCategoriesReport(categories: any[]): Buffer {
    const sheets: ExcelSheet[] = []

    const categoryData = categories.map(cat => ({
      'ID': cat.categoryId,
      'Nombre': cat.categoryName,
      'Nivel': cat.level,
      'Total Tickets': cat.totalTickets,
      'Tickets Abiertos': cat.openTickets,
      'Tickets Resueltos': cat.resolvedTickets,
      'Tiempo Promedio': cat.avgResolutionTime,
      'Técnicos Asignados': cat.assignedTechnicians,
      'Tasa de Resolución': `${cat.resolutionRate}%`
    }))

    sheets.push({
      name: 'Categorías',
      data: categoryData
    })

    return this.generate(sheets, {
      title: 'Reporte de Categorías',
      subject: 'Análisis por Categorías',
      author: 'Sistema de Tickets'
    })
  }
}
