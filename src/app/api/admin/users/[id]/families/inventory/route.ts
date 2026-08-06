import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { invalidateCache, buildCacheKey } from '@/lib/api-cache'
import { NotificationService } from '@/lib/services/notification-service'
import { getUserModuleFamilyGrantIds, setUserModuleFamilies } from '@/lib/auth/user-family-access'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id: userId } = await params
    const body = await request.json()
    const { familyIds } = body as { familyIds: string[] }

    if (!Array.isArray(familyIds)) {
      return NextResponse.json({ error: 'familyIds debe ser un array' }, { status: 400 })
    }

    const targetUser = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        canManageInventory: true,
        inventoryEnabled: true,
      },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    if (!viewer?.isSuperAdmin && familyIds.length > 0) {
      const { getUserFamilyScope } = await import('@/lib/auth/admin-scope')
      const scope = await getUserFamilyScope(session.user.id, 'ADMIN', false)
      if (scope.familyIds) {
        const allowedSet = new Set(scope.familyIds)
        const unauthorized = familyIds.filter((id: string) => !allowedSet.has(id))
        if (unauthorized.length > 0) {
          return NextResponse.json(
            { error: 'No tienes acceso a algunas de las familias solicitadas' },
            { status: 403 }
          )
        }
      }
    }

    const currentFamilyIds = await getUserModuleFamilyGrantIds(userId, 'inventory')
    const currentSet = new Set(currentFamilyIds)
    const newSet = new Set(familyIds)
    const added = familyIds.filter(id => !currentSet.has(id))
    const removed = currentFamilyIds.filter(id => !newSet.has(id))

    const allFamilyIds = [...new Set([...added, ...removed])]
    const families = await prisma.families.findMany({
      where: { id: { in: allFamilyIds } },
      select: { id: true, name: true },
    })
    const familyMap = new Map(families.map(f => [f.id, f.name]))

    await setUserModuleFamilies({
      userId,
      moduleInput: 'inventory',
      familyIds,
      role: targetUser.role,
    })

    const assignments = await prisma.user_family_access.findMany({
      where: { userId, module: 'inventory', isActive: true },
      select: { id: true, familyId: true },
    })

    for (const familyId of added) {
      const familyName = familyMap.get(familyId) ?? familyId
      AuditServiceComplete.log({
        action: AuditActionsComplete.MANAGER_FAMILY_ASSIGNED,
        entityType: 'assignment',
        entityId: userId,
        userId: session.user.id,
        details: {
          targetUserId: userId,
          targetUserName: targetUser.name,
          familyId,
          familyName,
          targetRole: targetUser.role,
        },
      }).catch(err => console.error('[AUDIT] Failed to log manager_family_assigned:', err))

      NotificationService.push({
        userId,
        type: 'INFO',
        title: 'Nueva familia de inventario asignada',
        message: `Se te ha asignado a la familia ${familyName}.`,
        metadata: { type: 'manager_family_assigned', familyId, familyName },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify manager (assign):', err))
    }

    for (const familyId of removed) {
      const familyName = familyMap.get(familyId) ?? familyId
      AuditServiceComplete.log({
        action: AuditActionsComplete.MANAGER_FAMILY_UNASSIGNED,
        entityType: 'assignment',
        entityId: userId,
        userId: session.user.id,
        details: {
          targetUserId: userId,
          targetUserName: targetUser.name,
          familyId,
          familyName,
          targetRole: targetUser.role,
        },
      }).catch(err => console.error('[AUDIT] Failed to log manager_family_unassigned:', err))

      NotificationService.push({
        userId,
        type: 'WARNING',
        title: 'Familia de inventario desasignada',
        message: `Se te ha desasignado de la familia ${familyName}.`,
        metadata: { type: 'manager_family_unassigned', familyId, familyName },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify manager (unassign):', err))
    }

    await Promise.allSettled([
      invalidateCache(buildCacheKey('user:modules', { userId })),
      invalidateCache(buildCacheKey('perm:inv', { userId })),
    ])

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error updating inventory manager family assignments:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
