import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildCacheKey } from '@/lib/api-cache'
import { getAdminStats } from './_lib/admin-stats'
import { getTechnicianStats } from './_lib/technician-stats'
import { getClientStats } from './_lib/client-stats'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const role = session.user.role

    const ttl = role === 'CLIENT' ? 180 : 120
    const cacheKey = buildCacheKey('dashboard', { role, uid: userId })

    try {
      const { getCached } = await import('@/lib/redis')
      const cached = await getCached<any>(cacheKey)
      if (cached) return NextResponse.json(cached)
    } catch {
      /* Redis no disponible — continuar sin caché */
    }

    let stats: any

    if (role === 'ADMIN') {
      const isSuperAdmin = (session.user as any).isSuperAdmin === true
      stats = await getAdminStats(userId, isSuperAdmin)
    } else if (role === 'TECHNICIAN') {
      const canManageInventory = (session.user as any).canManageInventory === true
      stats = await getTechnicianStats(userId, canManageInventory)
    } else if (role === 'CLIENT') {
      const canManageInventory = (session.user as any).canManageInventory === true
      stats = await getClientStats(userId, canManageInventory)
    }

    try {
      const { setCache } = await import('@/lib/redis')
      await setCache(cacheKey, stats, ttl)
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
