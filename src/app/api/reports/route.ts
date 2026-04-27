import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReportService } from '@/lib/services/report-service'
import { ExportService } from '@/lib/services/export-service'
import { RateLimiters } from '@/lib/rate-limit'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { REPORT_LIMITS, ERROR_MESSAGES, AUDIT_CONFIG } from '@/config/reports.config'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 })
    }

    // Rate limiting - 10 exportaciones por minuto
    const rateLimitResult = await RateLimiters.reports(session.user.id)
    
    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: ERROR_MESSAGES.rateLimitExceeded,
        message: `Has excedido el límite de ${rateLimitResult.limit} exportaciones por minuto. Intenta nuevamente en ${rateLimitResult.retryAfter} segundos.`,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: new Date(rateLimitResult.reset).toISOString(),
        retryAfter: rateLimitResult.retryAfter
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': (rateLimitResult.retryAfter || 60).toString()
        }
      })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'tickets'
    const format = searchParams.get('format') || 'json'
    
    // Parámetros de límites de seguridad (usar configuración global)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : undefined

    // Construir filtros con validación
    const filters: any = {}
    
    // Fechas con validación
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    
    if (startDateStr && startDateStr.trim() !== '') {
      filters.startDate = new Date(startDateStr + 'T00:00:00.000Z')
    }
    if (endDateStr && endDateStr.trim() !== '') {
      filters.endDate = new Date(endDateStr + 'T23:59:59.999Z')
    }
    
    // Otros filtros con validación de valores no vacíos
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const categoryId = searchParams.get('categoryId')
    const assigneeId = searchParams.get('assigneeId')
    const clientId = searchParams.get('clientId')
    const departmentId = searchParams.get('departmentId')
    
    if (status && status.trim() !== '' && status !== 'all') filters.status = status.trim()
    if (priority && priority.trim() !== '' && priority !== 'all') filters.priority = priority.trim()
    if (categoryId && categoryId.trim() !== '' && categoryId !== 'all') filters.categoryId = categoryId.trim()
    if (assigneeId && assigneeId.trim() !== '' && assigneeId !== 'all') filters.assigneeId = assigneeId.trim()
    if (clientId && clientId.trim() !== '' && clientId !== 'all') filters.clientId = clientId.trim()
    if (departmentId && departmentId.trim() !== '' && departmentId !== 'all') filters.departmentId = departmentId.trim()

    if (process.env.NODE_ENV === 'development') {
      console.log('📊 API Reports - Solicitud procesada:', {
        type: reportType,
        format,
        limit,
        maxLimit: REPORT_LIMITS[reportType as keyof typeof REPORT_LIMITS],
        filtrosAplicados: filters
      })
    }

    // Aplicar límite máximo por seguridad (usar configuración global)
    const finalLimit = limit ? Math.min(limit, REPORT_LIMITS[reportType as keyof typeof REPORT_LIMITS]) : undefined
    const options = finalLimit ? { limit: finalLimit } : {}

    // Generar datos del reporte
    let reportData: any
    let warnings: string[] = []

    switch (reportType) {
      case 'tickets':
        reportData = await ReportService.generateTicketReport(filters, options)
        
        // Agregar advertencias si hay limitaciones
        if (reportData.metadata?.wasLimited) {
          warnings.push(`Se limitaron los resultados a ${reportData.metadata.returnedRecords} de ${reportData.metadata.totalRecords} tickets totales. Use filtros más específicos para obtener datos más precisos.`)
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 API Reports - Tickets generados:', {
            total: reportData.totalTickets,
            detailedCount: reportData.detailedTickets?.length || 0,
            wasLimited: reportData.metadata?.wasLimited,
            warnings: warnings.length
          })
        }
        break
        
      case 'technicians':
        reportData = await ReportService.generateTechnicianReport(filters, options)
        
        if (finalLimit && reportData.length >= finalLimit) {
          warnings.push(`Se limitaron los resultados a ${reportData.length} técnicos. Use filtros de departamento para obtener datos más específicos.`)
        }
        
        console.log('📊 API Reports - Técnicos generados:', {
          count: reportData.length,
          limitApplied: finalLimit,
          warnings: warnings.length
        })
        break
        
      case 'categories':
        reportData = await ReportService.generateCategoryReport(filters, options)
        
        if (finalLimit && reportData.length >= finalLimit) {
          warnings.push(`Se limitaron los resultados a ${reportData.length} categorías. Use filtros de departamento para obtener datos más específicos.`)
        }
        
        console.log('📊 API Reports - Categorías generadas:', {
          count: reportData.length,
          limitApplied: finalLimit,
          warnings: warnings.length
        })
        break
        
      case 'departments':
        reportData = await ReportService.generateDepartmentReport(filters, options)
        
        if (finalLimit && reportData.length >= finalLimit) {
          warnings.push(`Se limitaron los resultados a ${reportData.length} departamentos.`)
        }
        
        console.log('📊 API Reports - Departamentos generados:', {
          count: reportData.length,
          limitApplied: finalLimit,
          warnings: warnings.length
        })
        break
        
      default:
        return NextResponse.json({ error: 'Tipo de reporte inválido' }, { status: 400 })
    }

    // Si es JSON, retornar datos con metadatos y advertencias
    if (format === 'json') {
      return NextResponse.json({
        data: reportData,
        warnings,
        metadata: {
          generatedAt: new Date().toISOString(),
          reportType,
          filtersApplied: Object.keys(filters).length,
          limitApplied: finalLimit,
          recordCount: Array.isArray(reportData) ? reportData.length : reportData.metadata?.returnedRecords || 0
        }
      })
    }

    // Para otros formatos, usar el servicio de exportación
    try {
      const exportResult = await ExportService.exportReport(
        reportType as 'tickets' | 'technicians' | 'categories',
        reportData,
        filters,
        {
          format: format as 'csv' | 'excel' | 'pdf' | 'json',
          includeHeaders: true,
          includeMetadata: true
        }
      )

      console.log('📊 API Reports - Exportación generada:', {
        format,
        filename: exportResult.filename,
        contentLength: typeof exportResult.content === 'string' ? exportResult.content.length : 'blob'
      })

      return new NextResponse(exportResult.content, {
        headers: {
          'Content-Type': exportResult.contentType,
          'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      })
    } catch (exportError) {
      console.error('❌ Error en exportación:', exportError)
      return NextResponse.json({ 
        error: 'Error al generar el archivo de exportación',
        details: exportError instanceof Error ? exportError.message : 'Error desconocido'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Error general en API Reports:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

/**
 * POST - Exportación de reportes con validación Zod
 * Alternativa al GET para exportaciones complejas
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      )
    }

    // Solo ADMIN y TECHNICIAN pueden exportar
    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: ERROR_MESSAGES.forbidden },
        { status: 403 }
      )
    }

    // Rate limiting
    const rateLimitResult = await RateLimiters.reports(session.user.id)
    
    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: ERROR_MESSAGES.rateLimitExceeded,
        message: `Has excedido el límite de ${rateLimitResult.limit} exportaciones por minuto.`,
        retryAfter: rateLimitResult.retryAfter
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'Retry-After': (rateLimitResult.retryAfter || 60).toString()
        }
      })
    }

    const body = await request.json()
    const { reportType, format, ...filters } = body

    // Convertir fechas
    const reportFilters: any = {}
    if (filters.startDate) reportFilters.startDate = new Date(filters.startDate)
    if (filters.endDate) reportFilters.endDate = new Date(filters.endDate)
    if (filters.status && filters.status !== 'all') reportFilters.status = filters.status
    if (filters.priority && filters.priority !== 'all') reportFilters.priority = filters.priority
    if (filters.categoryId && filters.categoryId !== 'all') reportFilters.categoryId = filters.categoryId
    if (filters.assigneeId && filters.assigneeId !== 'all') reportFilters.assigneeId = filters.assigneeId
    if (filters.clientId && filters.clientId !== 'all') reportFilters.clientId = filters.clientId
    if (filters.departmentId && filters.departmentId !== 'all') reportFilters.departmentId = filters.departmentId

    // Si es técnico, solo puede ver sus propios reportes
    if (session.user.role === 'TECHNICIAN') {
      reportFilters.assigneeId = session.user.id
    }

    // Reutilizar la lógica de GET
    const reportData = await (async () => {
      switch (reportType) {
        case 'tickets':
          return await ReportService.generateTicketReport(reportFilters)
        case 'technicians':
          return await ReportService.generateTechnicianReport(reportFilters)
        case 'categories':
          return await ReportService.generateCategoryReport(reportFilters)
        case 'departments':
          return await ReportService.generateDepartmentReport(reportFilters)
        default:
          throw new Error('Tipo de reporte inválido')
      }
    })()

    // Exportar usando ExportService
    const exportResult = await ExportService.exportReport(
      reportType as 'tickets' | 'technicians' | 'categories',
      reportData,
      reportFilters,
      {
        format: format as 'csv' | 'excel' | 'pdf' | 'json',
        includeHeaders: true,
        includeMetadata: true
      }
    )

    // Registrar en auditoría (si está habilitado)
    if (AUDIT_CONFIG.logExports) {
      await AuditServiceComplete.log({
        action: 'report_exported',
        entityType: 'system',
        entityId: exportResult.filename,
        userId: session.user.id,
        details: {
          reportType,
          format,
          ...(AUDIT_CONFIG.includeFilters ? { filters: reportFilters } : {}),
          fileSize: typeof exportResult.content === 'string' 
            ? exportResult.content.length 
            : exportResult.content.size
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      })
    }

    return new NextResponse(exportResult.content, {
      headers: {
        'Content-Type': exportResult.contentType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })

  } catch (error) {
    console.error('❌ Error en POST /api/reports:', error)
    return NextResponse.json({ 
      error: 'Error al generar reporte',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
