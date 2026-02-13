import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    const filters = {
      search: searchParams.get('search') || undefined,
      entityType: searchParams.get('entityType') === 'all' ? undefined : searchParams.get('entityType') || undefined,
      action: searchParams.get('action') || undefined,
      userId: searchParams.get('userId') || undefined,
      limit: parseInt(searchParams.get('limit') || '50000'), // Límite por defecto para exportación
      offset: parseInt(searchParams.get('offset') || '0')
    }

    // Filtros de fecha
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    // Parámetros de exportación
    const format = searchParams.get('format') || 'csv'
    const includeDetails = searchParams.get('includeDetails') === 'true'
    const maxRecords = parseInt(searchParams.get('maxRecords') || '50000')
    
    const exportResult = await AuditServiceComplete.exportLogs({
      format: format as 'csv' | 'json' | 'excel',
      filters: {
        ...filters,
        startDate
      },
      includeDetails,
      maxRecords
    })

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        ...exportResult,
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.email
      })
    }

    // Generar CSV profesional
    const headers = [
      'Fecha y Hora',
      'Acción',
      'Módulo',
      'ID de Entidad',
      'Usuario',
      'Email del Usuario',
      'Rol',
      'Dirección IP',
      'Navegador'
    ]

    if (includeDetails) {
      headers.push('Detalles', 'Valores Anteriores', 'Valores Nuevos')
    }

    const csvRows = [
      // Header con información del reporte
      `# Reporte de Auditoría del Sistema`,
      `# Generado: ${new Date().toLocaleString('es-ES')}`,
      `# Por: ${session.user.name} (${session.user.email})`,
      `# Período: ${days} días`,
      `# Total de registros: ${exportResult.total}`,
      `# Registros exportados: ${exportResult.exported}`,
      exportResult.truncated ? `# NOTA: Reporte truncado por límite de ${maxRecords} registros` : '',
      '', // Línea vacía
      headers.join(','),
      ...exportResult.data.map(log => {
        const baseRow = [
          new Date(log.createdAt).toLocaleString('es-ES'),
          log.action.replace(/_/g, ' ').toUpperCase(),
          log.entityType.toUpperCase(),
          log.entityId || 'N/A',
          log.users?.name || 'Sistema',
          log.users?.email || 'N/A',
          log.users?.role || 'SYSTEM',
          log.ipAddress || 'N/A',
          log.userAgent ? log.userAgent.substring(0, 50) + '...' : 'N/A'
        ]

        if (includeDetails) {
          const details = log.details || {}
          baseRow.push(
            JSON.stringify(details.metadata || {}).replace(/"/g, '""'),
            JSON.stringify(details.oldValues || {}).replace(/"/g, '""'),
            JSON.stringify(details.newValues || {}).replace(/"/g, '""')
          )
        }

        return baseRow.map(field => `"${field}"`).join(',')
      })
    ].filter(row => row !== '') // Filtrar líneas vacías

    const csvContent = csvRows.join('\n')
    
    const filename = `audit-report-${new Date().toISOString().split('T')[0]}-${exportResult.exported}records.csv`
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Total-Records': exportResult.total.toString(),
        'X-Exported-Records': exportResult.exported.toString(),
        'X-Truncated': exportResult.truncated.toString()
      }
    })

  } catch (error) {
    console.error('Error exporting audit logs:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}