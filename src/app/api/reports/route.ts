import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReportService } from '@/lib/services/report-service'
import { ExportService } from '@/lib/services/export-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'tickets'
    const format = searchParams.get('format') || 'json'
    
    // Parámetros de límites de seguridad
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : undefined
    
    // Límites máximos por seguridad
    const MAX_LIMITS = {
      tickets: 10000,
      technicians: 2000,
      categories: 1000
    }

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
        maxLimit: MAX_LIMITS[reportType as keyof typeof MAX_LIMITS],
        filtrosAplicados: filters
      })
    }

    // Aplicar límite máximo por seguridad
    const finalLimit = limit ? Math.min(limit, MAX_LIMITS[reportType as keyof typeof MAX_LIMITS]) : undefined
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
