import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { invalidateCache, buildCacheKey } from '@/lib/api-cache'
import { NotificationService } from '@/lib/services/notification-service'
import { unassignUserModuleFamily, userHasFamilyInModule } from '@/lib/auth/user-family-access'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id: clientId, familyId } = await params

    const targetUser = await prisma.users.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, role: true },
    })
    if (!targetUser || targetUser.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Usuario no encontrado o no es cliente' }, { status: 404 })
    }

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    if (!viewer?.isSuperAdmin) {
      const hasAccess = await userHasFamilyInModule(session.user.id, 'tickets', familyId, 'canView')
      if (!hasAccess) {
        return NextResponse.json({ error: 'No tienes acceso a esta familia' }, { status: 403 })
      }
    }

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    const row = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: clientId, familyId, module: 'tickets' },
      },
    })
    if (!row?.isActive) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    const deletedRecord = { ...row }

    await unassignUserModuleFamily({
      userId: clientId,
      familyId,
      moduleInput: 'tickets',
      role: 'CLIENT',
    })

    AuditServiceComplete.log({
      action: AuditActionsComplete.CLIENT_FAMILY_UNASSIGNED,
      entityType: 'assignment',
      entityId: row.id,
      userId: session.user.id,
      details: {
        targetUserId: clientId,
        targetUserName: targetUser.name,
        familyId,
        familyName: family.name,
        targetRole: 'CLIENT',
      },
      oldValues: { ...deletedRecord },
    }).catch(err => console.error('[AUDIT] Failed to log client_family_unassigned:', err))

    NotificationService.push({
      userId: clientId,
      type: 'WARNING',
      title: 'Familia desasignada',
      message: `Se te ha desasignado de la familia ${family.name}.`,
      metadata: { type: 'client_family_unassigned', familyId, familyName: family.name },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify client:', err))

    await invalidateCache(buildCacheKey('user:modules', { userId: clientId })).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unassigning client from family:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
