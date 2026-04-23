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
    const days = parseInt(searchParams.get('days') || '30')

    // Caché 2 minutos — stats de auditoría son costosas y cambian poco
    const cacheKey = buildCacheKey('audit:stats', { days })
    const stats = await withCache(cacheKey, 120, () => AuditServiceComplete.getStats(days))

    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    console.error('Error fetching audit stats:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
