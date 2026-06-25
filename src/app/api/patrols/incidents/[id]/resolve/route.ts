/**
 * POST /api/patrols/incidents/[id]/resolve — Marca novedad como resuelta
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PatrolIncidentService } from '@/lib/services/patrol-incident.service'
import { checkPatrolFamilyAccess, checkPatrolFamilyOperate } from '@/lib/patrol/patrol-access'

// Acceso al modelo patrol_incidents hasta regenerar el Prisma Client
const db = prisma as any

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo ADMIN o TECHNICIAN pueden resolver
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params

    // Obtener el incidente para verificar acceso a la familia
    const incident = await db.patrol_incidents.findUnique({
      where: { id },
      include: { patrol: { select: { familyId: true } } },
    })

    if (!incident) {
      return NextResponse.json({ error: 'Novedad no encontrada' }, { status: 404 })
    }

    // Verificar acceso a la familia de la patrulla
    const sessionUser = session.user as any
    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      incident.patrol.familyId,
      session.user.role,
      sessionUser.isSuperAdmin ?? false
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Resolver la novedad
    const updatedIncident = await PatrolIncidentService.resolve(id, session.user.id)

    return NextResponse.json({ success: true, data: updatedIncident })
  } catch (error: any) {
    console.error('[patrols/incidents/[id]/resolve] POST:', error)

    const message = error?.message ?? ''

    if (message === 'Novedad no encontrada') {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    if (message === 'La novedad ya fue resuelta o escalada') {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
