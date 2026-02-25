import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditExportService } from '@/lib/services/audit-export-service'

export const maxDuration = 300 // 5 minutos máximo para exportaciones grandes

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      format = 'csv',
      includeHeaders = true,
      includeMetadata = true,
      filters = {}
    } = body

    console.log(`📤 Iniciando exportación de auditoría - Formato: ${format}`)
    console.log(`🔍 Filtros aplicados:`, filters)

    // Construir query con filtros
    const where: any = {}

    // Filtro de búsqueda
    if (filters.search) {
      where.OR = [
        { action: { contains: filters.search, mode: 'insensitive' } },
        { entityType: { contains: filters.search, mode: 'insensitive' } },
        { entityId: { contains: filters.search, mode: 'insensitive' } },
        { users: { name: { contains: filters.search, mode: 'insensitive' } } },
        { users: { email: { contains: filters.search, mode: 'insensitive' } } }
      ]
    }

    // Filtro de tipo de entidad
    if (filters.entityType && filters.entityType !== 'all') {
      where.entityType = filters.entityType
    }

    // Filtro de acción
    if (filters.action) {
      where.action = { contains: filters.action, mode: 'insensitive' }
    }

    // Filtro de usuario
    if (filters.userId) {
      where.userId = filters.userId
    }

    // Filtro de fecha (días)
    if (filters.days) {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(filters.days))
      where.createdAt = { gte: daysAgo }
    }

    // Obtener logs con límite de seguridad
    const limit = parseInt(filters.limit || '50000') // Máximo 50K por defecto
    const offset = parseInt(filters.offset || '0')

    console.log(`📊 Consultando base de datos - Límite: ${limit}, Offset: ${offset}`)

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100000), // Máximo absoluto 100K
        skip: offset
      }),
      prisma.audit_logs.count({ where })
    ])

    console.log(`✅ Logs obtenidos: ${logs.length} de ${total} total`)

    // Exportar usando el servicio
    const result = await AuditExportService.exportAuditLogs(
      logs,
      filters,
      {
        format: format as 'csv' | 'json',
        includeHeaders,
        includeMetadata,
        filename: filters.filename
      }
    )

    console.log(`✅ Exportación completada - Tamaño: ${(result.content.length / 1024).toFixed(2)}KB`)

    // Si hay advertencias, incluirlas en la respuesta
    if (result.warnings && result.warnings.length > 0) {
      console.warn(`⚠️ Advertencias de exportación:`, result.warnings)
    }

    // Retornar archivo para descarga
    return new NextResponse(result.content, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Total-Records': total.toString(),
        'X-Exported-Records': logs.length.toString(),
        'X-Warnings': result.warnings ? JSON.stringify(result.warnings) : '[]'
      }
    })

  } catch (error) {
    console.error('❌ Error en exportación de auditoría:', error)
    return NextResponse.json(
      { 
        error: 'Error al exportar logs de auditoría',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
