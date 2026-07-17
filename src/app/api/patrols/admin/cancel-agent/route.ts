/**
 * POST /api/patrols/admin/cancel-agent
 *
 * Cancela todas las rondas PENDING de un agente específico marcándolas como MISSED.
 * También desactiva todas sus programaciones activas.
 *
 * Solo ADMIN puede ejecutar esta acción.
 * Diseñado para usarse antes de cambiar el rol de un usuario que tiene rondas activas.
 *
 * Body: { agentId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { z } from 'zod'

const bodySchema = z.object({
  agentId: z.string().uuid('agentId debe ser un UUID válido'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo los administradores pueden ejecutar esta acción' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { agentId } = parsed.data
    const sessionUser = session.user as any
    const isSuperAdmin: boolean = sessionUser.isSuperAdmin ?? false

    // Verificar que el agente existe
    const agent = await prisma.users.findUnique({
      where: { id: agentId },
      select: { id: true, name: true },
    })
    if (!agent) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    }

    // Scope: Super Admin → todas; admin normal → solo familias que puede operar
    let familyScopeFilter: { familyId?: { in: string[] } } = {}
    if (!isSuperAdmin) {
      const { getPatrolOperationalFamilyIds } = await import('@/lib/auth/family-scope')
      const operationalIds = await getPatrolOperationalFamilyIds(
        session.user.id,
        session.user.role,
        false
      )
      if (!operationalIds || operationalIds.length === 0) {
        return NextResponse.json(
          { error: 'No tienes áreas de rondas donde operar' },
          { status: 403 }
        )
      }
      familyScopeFilter = { familyId: { in: operationalIds } }

      // Si el agente tiene programaciones fuera del scope, no permitir cleanup global
      const outOfScope = await prisma.patrol_schedules.count({
        where: {
          agentId,
          isActive: true,
          familyId: { notIn: operationalIds },
        },
      })
      if (outOfScope > 0) {
        // Solo limpiar dentro del scope (no bloquear)
      }
    }

    const deactivatedSchedules = await prisma.patrol_schedules.updateMany({
      where: { agentId, isActive: true, ...familyScopeFilter },
      data: { isActive: false },
    })

    const cancelledPatrols = await prisma.patrols.updateMany({
      where: { agentId, status: 'PENDING', ...familyScopeFilter },
      data: { status: 'MISSED' },
    })

    // 3. Auditoría
    await AuditServiceComplete.log({
      action: 'PATROL_AGENT_CLEANUP',
      entityType: 'user',
      entityId: agentId,
      userId: session.user.id,
      details: {
        agentName: agent.name,
        deactivatedSchedules: deactivatedSchedules.count,
        cancelledPatrols: cancelledPatrols.count,
        reason: 'role_change_preparation',
      },
      request,
    })

    return NextResponse.json({
      success: true,
      data: {
        deactivatedSchedules: deactivatedSchedules.count,
        cancelledPatrols: cancelledPatrols.count,
      },
      message: `Se desactivaron ${deactivatedSchedules.count} programación(es) y se cancelaron ${cancelledPatrols.count} ronda(s) pendiente(s).`,
    })
  } catch (error) {
    console.error('[patrols/admin/cancel-agent] POST:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
