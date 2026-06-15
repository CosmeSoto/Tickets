/**
 * POST /api/users/[id]/clear-blockers
 *
 * Limpia los bloqueadores más comunes que impiden el cambio de rol:
 * - Rondas: desactiva programaciones + cancela rondas PENDING → MISSED
 * - Tickets asignados: desasigna (assigneeId = null) y vuelve a OPEN
 * - Asignaciones de categorías: elimina todas
 *
 * Solo ADMIN puede ejecutar. Requiere body: { modules: string[] }
 * donde modules es un array con los nombres de los módulos a limpiar.
 *
 * No toca: Inventario (requiere acta), Tickets de cliente (requiere revisión), Solicitudes de Activos.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { z } from 'zod'

const bodySchema = z.object({
  modules: z.array(z.string()).min(1),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: userId } = await params
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { modules } = parsed.data
    const results: Record<string, any> = {}

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // ── Rondas y Patrullajes ──────────────────────────────────────────────
    if (
      modules.some(m => m.toLowerCase().includes('ronda') || m.toLowerCase().includes('patrull'))
    ) {
      const deactivatedSchedules = await prisma.patrol_schedules.updateMany({
        where: { agentId: userId, isActive: true },
        data: { isActive: false },
      })
      const cancelledPatrols = await prisma.patrols.updateMany({
        where: { agentId: userId, status: 'PENDING' },
        data: { status: 'MISSED' },
      })
      results.patrols = {
        deactivatedSchedules: deactivatedSchedules.count,
        cancelledPatrols: cancelledPatrols.count,
      }
    }

    // ── Tickets asignados ─────────────────────────────────────────────────
    if (modules.some(m => m.toLowerCase() === 'tickets')) {
      const unassigned = await prisma.tickets.updateMany({
        where: { assigneeId: userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        data: { assigneeId: null, status: 'OPEN' },
      })
      results.tickets = { unassigned: unassigned.count }
    }

    // ── Asignaciones de Categorías ────────────────────────────────────────
    if (
      modules.some(
        m => m.toLowerCase().includes('categor') || m.toLowerCase().includes('asignacion')
      )
    ) {
      const deleted = await prisma.technician_assignments.deleteMany({
        where: { technicianId: userId, isActive: true },
      })
      results.categoryAssignments = { deleted: deleted.count }
    }

    // ── Solicitudes de Activos ────────────────────────────────────────────
    if (
      modules.some(m => m.toLowerCase().includes('solicitud') || m.toLowerCase().includes('activo'))
    ) {
      const cancelled = await prisma.asset_requests.updateMany({
        where: { requesterId: userId, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'CANCELLED' },
      })
      results.assetRequests = { cancelled: cancelled.count }
    }

    // Auditoría
    await AuditServiceComplete.log({
      action: 'USER_BLOCKERS_CLEARED',
      entityType: 'user',
      entityId: userId,
      userId: session.user.id,
      details: {
        userName: user.name,
        modules,
        results,
        reason: 'role_change_preparation',
      },
      request,
    })

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Elementos pendientes resueltos exitosamente.',
    })
  } catch (error) {
    console.error('[users/[id]/clear-blockers] POST:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
