import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/patrols/family-config
 * Devuelve patrolsEnabled de todas las familias que ya tienen fila en patrol_family_config.
 * Familias sin fila se interpretan como enabled (true) en el cliente — igual que inventario.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const configs = await prisma.patrol_family_config.findMany({
      select: { familyId: true, patrolsEnabled: true },
    })

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
