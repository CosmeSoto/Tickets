import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { withCache, buildCacheKey } from '@/lib/api-cache'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (
      !session ||
      session.user.role !== 'ADMIN' ||
      !(session.user as { isSuperAdmin?: boolean }).isSuperAdmin
    ) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const filter = {
      days,
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
      search: searchParams.get('search') || undefined,
    }

    const hasExtraFilters = Boolean(
      filter.entityType ||
      filter.action ||
      filter.userId ||
      filter.familyId ||
      filter.configModule ||
      filter.actionPreset ||
      filter.search
    )

    const cacheKey = buildCacheKey('audit:stats', filter)
    const stats = hasExtraFilters
      ? await AuditServiceComplete.getStats(filter)
      : await withCache(cacheKey, 120, () => AuditServiceComplete.getStats(filter))

    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    console.error('Error fetching audit stats:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
