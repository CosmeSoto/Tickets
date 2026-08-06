/**
 * @deprecated Preferir POST `/api/admin/users/:id/family-access` { module: 'tickets', familyId }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { invalidateCache, buildCacheKey } from '@/lib/api-cache'
import { NotificationService } from '@/lib/services/notification-service'
import { assignUserModuleFamily } from '@/lib/auth/user-family-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id: technicianId } = await params
    const body = await request.json()
    const { familyId } = body

    if (!familyId) return NextResponse.json({ error: 'familyId es requerido' }, { status: 400 })

    const targetUser = await prisma.users.findUnique({
      where: { id: technicianId },
      select: { id: true, name: true, role: true },
    })
    if (!targetUser || targetUser.role !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'Usuario no encontrado o no es técnico' }, { status: 404 })
    }

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    if (!viewer?.isSuperAdmin) {
      const { getUserFamilyScope } = await import('@/lib/auth/admin-scope')
      const scope = await getUserFamilyScope(session.user.id, 'ADMIN', false)
      if (scope.familyIds && !scope.familyIds.includes(familyId)) {
        return NextResponse.json({ error: 'No tienes acceso a esta familia' }, { status: 403 })
      }
    }

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    const existing = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: technicianId, familyId, module: 'tickets' },
      },
    })
    if (existing?.isActive) {
      return NextResponse.json(
        { error: 'El técnico ya está asignado a esta familia' },
        { status: 409 }
      )
    }

    await assignUserModuleFamily({
      userId: technicianId,
      familyId,
      moduleInput: 'tickets',
      role: 'TECHNICIAN',
    })

    const row = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: technicianId, familyId, module: 'tickets' },
      },
    })

    const assignment = {
      id: row?.id ?? technicianId,
      technicianId,
      familyId,
      isActive: true,
    }

    AuditServiceComplete.log({
      action: AuditActionsComplete.TECHNICIAN_FAMILY_ASSIGNED,
      entityType: 'assignment',
      entityId: assignment.id,
      userId: session.user.id,
      details: {
        targetUserId: technicianId,
        targetUserName: targetUser.name,
        familyId,
        familyName: family.name,
        targetRole: 'TECHNICIAN',
      },
    }).catch(err => console.error('[AUDIT] Failed to log technician_family_assigned:', err))

    NotificationService.push({
      userId: technicianId,
      type: 'INFO',
      title: 'Nueva familia asignada',
      message: `Se te ha asignado a la familia ${family.name}.`,
      metadata: { type: 'technician_family_assigned', familyId, familyName: family.name },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify technician:', err))

    await invalidateCache(buildCacheKey('user:modules', { userId: technicianId })).catch(() => {})

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error: any) {
    console.error('Error assigning technician to family:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 400 }
    )
  }
}
