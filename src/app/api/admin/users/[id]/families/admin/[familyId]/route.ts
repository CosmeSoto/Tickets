import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { invalidateCache, buildCacheKey } from '@/lib/api-cache'
import { NotificationService } from '@/lib/services/notification-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    // Only SUPER_ADMIN can unassign families from admins
    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    if (!viewer?.isSuperAdmin) {
      return NextResponse.json(
        {
          error: 'Solo el administrador principal puede gestionar asignaciones de administradores',
        },
        { status: 403 }
      )
    }

    const { id: adminId, familyId } = await params

    // Verify target user is an ADMIN
    const targetUser = await prisma.users.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, role: true },
    })
    if (!targetUser || targetUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Usuario no encontrado o no es administrador' },
        { status: 404 }
      )
    }

    // Get family name for audit/notification
    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    // Find the assignment record
    const assignment = await prisma.admin_family_assignments.findFirst({
      where: { adminId, familyId },
    })
    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    // Delete the assignment record
    const deletedRecord = { ...assignment }
    await prisma.admin_family_assignments.delete({
      where: { id: assignment.id },
    })

    // Audit log (fire and forget)
    AuditServiceComplete.log({
      action: AuditActionsComplete.ADMIN_FAMILY_UNASSIGNED,
      entityType: 'assignment',
      entityId: assignment.id,
      userId: session.user.id,
      details: {
        targetUserId: adminId,
        targetUserName: targetUser.name,
        familyId,
        familyName: family.name,
        targetRole: 'ADMIN',
      },
      oldValues: { ...deletedRecord },
    }).catch(err => console.error('[AUDIT] Failed to log admin_family_unassigned:', err))

    // In-app notification (fire and forget)
    NotificationService.push({
      userId: adminId,
      type: 'WARNING',
      title: 'Familia desasignada',
      message: `Se te ha desasignado de la familia ${family.name}.`,
      metadata: { type: 'admin_family_unassigned', familyId, familyName: family.name },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify admin:', err))

    // Cache invalidation
    await invalidateCache(buildCacheKey('user:modules', { userId: adminId })).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unassigning admin from family:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
