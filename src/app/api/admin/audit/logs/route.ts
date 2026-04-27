import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { withCache, buildCacheKey } from '@/lib/api-cache'

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
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 500),
      offset: Math.max(0, parseInt(searchParams.get('offset') || '0')),
    }
    const days = parseInt(searchParams.get('days') || '30')

    // No cachear búsquedas activas — solo listados sin filtro de texto
    const shouldCache = !filters.search
    const cacheKey = buildCacheKey('audit:logs', {
      entityType: filters.entityType,
      action: filters.action,
      userId: filters.userId,
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
