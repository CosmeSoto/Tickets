/**
 * API: Exportación de Reportes
 * Soporta CSV, Excel (XLSX) y PDF
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReportService } from '@/lib/services/report-service'
import { PDFGenerator } from '@/lib/services/export/pdf-generator'
import { ExcelGenerator } from '@/lib/services/export/excel-generator'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { z } from 'zod'

const exportSchema = z.object({
  reportType: z.enum(['tickets', 'technicians', 'categories']),
  format: z.enum(['csv', 'excel', 'pdf']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  categoryId: z.string().optional(),
  assigneeId: z.string().optional(),
  clientId: z.string().optional(),
  departmentId: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Solo ADMIN y TECHNICIAN pueden exportar
    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para exportar reportes' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = exportSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { reportType, format, ...filters } = validation.data

    // Convertir fechas
    const reportFilters: any = {}
    if (filters.startDate) reportFilters.startDate = new Date(filters.startDate)
    if (filters.endDate) reportFilters.endDate = new Date(filters.endDate)
    if (filters.status) reportFilters.status = filters.status
    if (filters.priority) reportFilters.priority = filters.priority
    if (filters.categoryId) reportFilters.categoryId = filters.categoryId
    if (filters.assigneeId) reportFilters.assigneeId = filters.assigneeId
    if (filters.clientId) reportFilters.clientId = filters.clientId
    if (filters.departmentId) reportFilters.departmentId = filters.departmentId

    // Si es técnico, solo puede ver sus propios reportes
    if (session.user.role === 'TECHNICIAN') {
      reportFilters.assigneeId = session.user.id
    }

    console.log(`[EXPORT] Generando reporte: ${reportType} en formato ${format}`)

    let buffer: Buffer
    let filename: string
    let contentType: string

    // Generar reporte según tipo
    switch (reportType) {
      case 'tickets': {
        const report = await ReportService.generateTicketReport(reportFilters)
        
        switch (format) {
          case 'csv':
            buffer = Buffer.from(this.generateTicketsCSV(report.detailedTickets || []))
            filename = `tickets-${Date.now()}.csv`
            contentType = 'text/csv'
            break
          case 'excel':
            buffer = ExcelGenerator.generateTicketsReport(report.detailedTickets || [], report)
            filename = `tickets-${Date.now()}.xlsx`
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            break
          case 'pdf':
            buffer = await PDFGenerator.generateTicketsReport(report.detailedTickets || [], report)
            filename = `tickets-${Date.now()}.pdf`
            contentType = 'application/pdf'
            break
        }
        break
      }

      case 'technicians': {
        const report = await ReportService.generateTechnicianReport(reportFilters)
        
        switch (format) {
          case 'csv':
            buffer = Buffer.from(this.generateTechniciansCSV(report))
            filename = `technicians-${Date.now()}.csv`
            contentType = 'text/csv'
            break
          case 'excel':
            buffer = ExcelGenerator.generateTechniciansReport(report)
            filename = `technicians-${Date.now()}.xlsx`
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            break
          case 'pdf':
            buffer = await PDFGenerator.generateTechniciansReport(report)
            filename = `technicians-${Date.now()}.pdf`
            contentType = 'application/pdf'
            break
        }
        break
      }

      case 'categories': {
        const report = await ReportService.generateCategoryReport(reportFilters)
        
        switch (format) {
          case 'csv':
            buffer = Buffer.from(this.generateCategoriesCSV(report))
            filename = `categories-${Date.now()}.csv`
            contentType = 'text/csv'
            break
          case 'excel':
            buffer = ExcelGenerator.generateCategoriesReport(report)
            filename = `categories-${Date.now()}.xlsx`
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            break
          case 'pdf':
            buffer = await PDFGenerator.generateCategoriesReport(report)
            filename = `categories-${Date.now()}.pdf`
            contentType = 'application/pdf'
            break
        }
        break
      }
    }

    // Registrar en auditoría
    await AuditServiceComplete.logAction({
      userId: session.user.id,
      action: AuditActionsComplete.REPORT_EXPORTED,
      entityType: 'system',
      entityId: filename,
      details: {
        reportType,
        format,
        filters: reportFilters,
        fileSize: buffer.length
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    // Retornar archivo
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      }
    })
  } catch (error) {
    console.error('[EXPORT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte' },
      { status: 500 }
    )
  }
}

// Métodos auxiliares para CSV
function generateTicketsCSV(tickets: any[]): string {
  const headers = ['ID', 'Número', 'Título', 'Estado', 'Prioridad', 'Cliente', 'Técnico', 'Categoría', 'Creado', 'Resuelto']
  const rows = tickets.map(t => [
    t.id,
    t.ticketNumber || 'N/A',
    `"${t.title.replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    `"${t.client?.name || 'N/A'}"`,
    `"${t.assignee?.name || 'Sin asignar'}"`,
    `"${t.category?.name || 'N/A'}"`,
    new Date(t.createdAt).toLocaleDateString('es-ES'),
    t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString('es-ES') : 'N/A'
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

function generateTechniciansCSV(technicians: any[]): string {
  const headers = ['ID', 'Nombre', 'Email', 'Asignados', 'Resueltos', 'Tasa', 'Rating']
  const rows = technicians.map(t => [
    t.technicianId,
    `"${t.technicianName}"`,
    t.email,
    t.assignedTickets,
    t.resolvedTickets,
    `${t.resolutionRate}%`,
    t.avgRating || 'N/A'
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

function generateCategoriesCSV(categories: any[]): string {
  const headers = ['ID', 'Nombre', 'Nivel', 'Total', 'Abiertos', 'Resueltos', 'Tiempo Promedio']
  const rows = categories.map(c => [
    c.categoryId,
    `"${c.categoryName}"`,
    c.level,
    c.totalTickets,
    c.openTickets,
    c.resolvedTickets,
    c.avgResolutionTime
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}
