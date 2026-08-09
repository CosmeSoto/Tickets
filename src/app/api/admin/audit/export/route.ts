import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditExportService } from '@/lib/services/audit-export-service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN' || !(session.user as any).isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      format = 'csv',
      includeHeaders = true,
      includeMetadata = true,
      filters = {},
      columns,
      includeSensitive = false,
      maskPii = true,
    } = body

    if (!['csv', 'json', 'rows'].includes(format)) {
      return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 })
    }

    const days = parseInt(filters.days || '30', 10)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { buildAuditLogWhere } = await import('@/lib/services/audit-query-builder')
    const where = await buildAuditLogWhere({
      search: filters.search || undefined,
      entityType: filters.entityType !== 'all' ? filters.entityType : undefined,
      action: filters.action || undefined,
      userId: filters.userId || undefined,
      familyId: filters.familyId || undefined,
      configModule: filters.configModule !== 'all' ? filters.configModule : undefined,
      actionPreset: filters.actionPreset || undefined,
      startDate,
    })

    const limit = parseInt(filters.limit || '50000', 10)
    const offset = parseInt(filters.offset || '0', 10)

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100000),
        skip: offset,
      }),
      prisma.audit_logs.count({ where }),
    ])

    const result = await AuditExportService.exportAuditLogs(logs, filters, {
      format: format as 'csv' | 'json' | 'rows',
      includeHeaders,
      includeMetadata,
      filename: filters.filename,
      columns,
      includeSensitive: Boolean(includeSensitive),
      maskPii: maskPii !== false,
    })

    // Meta-auditoría: quién exportó qué (LOPDP / trazabilidad)
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined
    const userAgent = request.headers.get('user-agent') || undefined

    try {
      await AuditServiceComplete.log({
        action: 'AUDIT_LOGS_EXPORTED',
        entityType: 'system',
        entityId: 'audit-export',
        userId: session.user.id,
        request,
        ipAddress: clientIp,
        userAgent,
        details: {
          descripcion: `Exportación de auditoría (${format}) — ${logs.length} registros`,
          format,
          columns: result.columnKeys || columns || [],
          includeSensitive: Boolean(includeSensitive),
          maskPii: maskPii !== false,
          unmaskedInternalExport: includeSensitive === true && maskPii === false,
          exportedRecords: logs.length,
          totalMatching: total,
          filters,
        },
      })
    } catch (e) {
      console.warn('No se pudo registrar meta-auditoría de exportación:', e)
    }

    // Headers HTTP solo admiten ByteString (<=255). Codificar avisos por si hay Unicode.
    const warningsHeader = encodeURIComponent(JSON.stringify(result.warnings ?? []))

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Total-Records': total.toString(),
        'X-Exported-Records': logs.length.toString(),
        'X-Warnings': warningsHeader,
        'X-Lopdp-Minimized': includeSensitive ? '0' : '1',
      },
    })
  } catch (error) {
    console.error('Error en exportación de auditoría:', error)
    return NextResponse.json(
      {
        error: 'Error al exportar logs de auditoría',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
