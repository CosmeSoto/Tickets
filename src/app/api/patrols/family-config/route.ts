import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/patrols/family-config
 * Devuelve patrolsEnabled de las familias accesibles para el usuario.
 * Super Admin ve todas. Admin Normal solo ve las de su scope de patrullas.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Leer isSuperAdmin directamente de la BD (la sesión puede estar desactualizada)
    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    const isSuperAdmin = dbUser?.isSuperAdmin === true

    let configs: Array<{ familyId: string; patrolsEnabled: boolean }>
    if (isSuperAdmin) {
      configs = await prisma.patrol_family_config.findMany({
        select: { familyId: true, patrolsEnabled: true },
      })
    } else {
      // Admin Normal: solo configs de sus familias de patrullas
      const { getPatrolAccessibleFamilyIds } = await import('@/lib/patrol/patrol-access')
      const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
        session.user.id,
        session.user.role,
        false
      )
      if (accessibleFamilyIds && accessibleFamilyIds.length > 0) {
        configs = await prisma.patrol_family_config.findMany({
          where: { familyId: { in: accessibleFamilyIds } },
          select: { familyId: true, patrolsEnabled: true },
        })
      } else {
        configs = []
      }
    }

    const map: Record<string, boolean> = {}
    for (const c of configs) {
      map[c.familyId] = c.patrolsEnabled
    }

    return NextResponse.json({ success: true, data: map })
  } catch (error) {
    console.error('[patrol/family-config] GET all:', error)
    return NextResponse.json({ error: 'Error al obtener configuraciones' }, { status: 500 })
  }
}
