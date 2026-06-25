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
import { checkPatrolFamilyOperate } from '@/lib/patrol/patrol-access'
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

    // Si NO es super admin, verificar que tiene acceso a al menos una de las familias
    // de las programaciones del agente
    if (!isSuperAdmin) {
      const agentFamilies = await prisma.patrol_schedules.findMany({
        where: { agentId, isActive: true },
        select: { familyId: true },
        distinct: ['familyId'],
      })

      for (const { familyId } of agentFamilies) {
        const hasAccess = await checkPatrolFamilyOperate(
          session.user.id,
          familyId,
          session.user.role,
          false
        )
        if (!hasAccess) {
          return NextResponse.json(
            { error: `No tienes acceso a todas las áreas del agente` },
            { status: 403 }
          )
        }
      }
    }

    // 1. Desactivar todas las programaciones activas del agente
    const deactivatedSchedules = await prisma.patrol_schedules.updateMany({
      where: { agentId, isActive: true },
      data: { isActive: false },
    })

    // 2. Cancelar todas las rondas PENDING del agente → MISSED
    const cancelledPatrols = await prisma.patrols.updateMany({
      where: { agentId, status: 'PENDING' },
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
