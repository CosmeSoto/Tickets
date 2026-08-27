import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { AuditServiceComplete, type AuditLogFilter } from '@/lib/services/audit-service-complete'
import { buildAuditLogWhere } from '@/lib/services/audit-query-builder'
import { withCache, buildCacheKey, invalidateCache } from '@/lib/api-cache'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN' || !(session.user as any).isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = {
      search: searchParams.get('search') || undefined,
      entityType:
        searchParams.get('entityType') === 'all'
          ? undefined
          : searchParams.get('entityType') || undefined,
      action: searchParams.get('action') || undefined,
      userId: searchParams.get('userId') || undefined,
      familyId: searchParams.get('familyId') || undefined,
      configModule:
        searchParams.get('configModule') === 'all'
          ? undefined
          : searchParams.get('configModule') || undefined,
      actionPreset: searchParams.get('actionPreset') || undefined,
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 500),
      offset: Math.max(0, parseInt(searchParams.get('offset') || '0')),
    }
    const days = parseInt(searchParams.get('days') || '30')

    const shouldCache =
      !filters.search &&
      !filters.action &&
      !filters.userId &&
      !filters.familyId &&
      !filters.configModule &&
      !filters.actionPreset &&
      !filters.entityType
    const cacheKey = buildCacheKey('audit:logs', {
      entityType: filters.entityType,
      action: filters.action,
      userId: filters.userId,
      familyId: filters.familyId,
      configModule: filters.configModule,
      actionPreset: filters.actionPreset,
      limit: filters.limit,
      offset: filters.offset,
      days,
    })

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const result = shouldCache
      ? await withCache(cacheKey, 60, () => AuditServiceComplete.getLogs({ ...filters, startDate }))
      : await AuditServiceComplete.getLogs({ ...filters, startDate })

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore,
    })
  } catch (error) {
    console.error('[AUDIT API] Error fetching audit logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Eliminar logs de auditoría — solo Super Administrador.
 * Body: { ids: string[] } para borrar registros puntuales, o
 *       { filters: AuditLogFilter, days?: string } para vaciar según el filtro actual
 *       (mismo criterio con el que se calcula el "total" mostrado en el GET).
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const check = await requireSuperAdmin(session)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: check.status })
    }

    const body = await request.json().catch(() => null)
    const ids: unknown = body?.ids
    const filters: AuditLogFilter | undefined = body?.filters

    let where: Record<string, unknown>
    let mode: 'ids' | 'filter'
    let idsArr: string[] = []

    if (Array.isArray(ids) && ids.length > 0) {
      if (!ids.every(id => typeof id === 'string')) {
        return NextResponse.json(
          { success: false, error: 'ids debe ser un arreglo de strings' },
          { status: 400 }
        )
      }
      mode = 'ids'
      idsArr = ids as string[]
      where = { id: { in: idsArr } }
    } else if (filters && typeof filters === 'object') {
      mode = 'filter'
      const days = body?.days ? parseInt(body.days, 10) : undefined
      const startDate = days
        ? (() => {
            const d = new Date()
            d.setDate(d.getDate() - days)
            return d
          })()
        : undefined
      where = await buildAuditLogWhere({
        ...filters,
        entityType: filters.entityType === 'all' ? undefined : filters.entityType,
        configModule: filters.configModule === 'all' ? undefined : filters.configModule,
        startDate,
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Debe indicar ids o filters para eliminar' },
        { status: 400 }
      )
    }

    const result = await prisma.audit_logs.deleteMany({ where })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'audit_logs_purged',
        entityType: 'system',
        entityId: 'audit_logs',
        userId: session?.user?.id ?? null,
        userEmail: session?.user?.email ?? null,
        details: JSON.parse(
          JSON.stringify({
            deletedCount: result.count,
            mode,
            ...(mode === 'ids'
              ? { ids: idsArr }
              : { filters: filters ?? null, days: body?.days ?? null }),
          })
        ),
        createdAt: new Date(),
      },
    })

    await invalidateCache('audit:logs:*')

    return NextResponse.json({ success: true, deletedCount: result.count })
  } catch (error) {
    console.error('[AUDIT API] Error deleting audit logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
