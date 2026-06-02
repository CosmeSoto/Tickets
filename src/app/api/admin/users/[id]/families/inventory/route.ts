import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { invalidateCache, buildCacheKey } from '@/lib/api-cache'
import { NotificationService } from '@/lib/services/notification-service'

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

    // Verify target user exists
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

    // RBAC: Admin Normal solo puede asignar familias dentro de su scope general.
    // Super Admin puede asignar cualquier familia sin restricción.
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

    // Fetch current inventory_manager_families for the user
    const currentAssignments = await prisma.inventory_manager_families.findMany({
      where: { managerId: userId },
      select: { id: true, familyId: true },
    })
    const currentFamilyIds = new Set(currentAssignments.map(a => a.familyId))
    const newFamilyIds = new Set(familyIds)

    // Compute added and removed sets
    const added = familyIds.filter(id => !currentFamilyIds.has(id))
    const removed = currentAssignments.filter(a => !newFamilyIds.has(a.familyId))

    // Fetch family names for audit/notification
    const allFamilyIds = [...new Set([...added, ...removed.map(r => r.familyId)])]
    const families = await prisma.families.findMany({
      where: { id: { in: allFamilyIds } },
      select: { id: true, name: true },
    })
    const familyMap = new Map(families.map(f => [f.id, f.name]))

    // Execute in a transaction: delete removed, create added
    const assignments = await prisma.$transaction(async tx => {
      // Delete removed records
      if (removed.length > 0) {
        await tx.inventory_manager_families.deleteMany({
          where: { id: { in: removed.map(r => r.id) } },
        })
      }

      // Create added records
      const created = await Promise.all(
        added.map(familyId =>
          tx.inventory_manager_families.create({
            data: { managerId: userId, familyId },
          })
        )
      )

      // Return all current assignments after the transaction
      return tx.inventory_manager_families.findMany({
        where: { managerId: userId },
      })
    })

    // Fire-and-forget: audit + notify for each added family
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

    // Fire-and-forget: audit + notify for each removed family
    for (const record of removed) {
      const familyName = familyMap.get(record.familyId) ?? record.familyId
      AuditServiceComplete.log({
        action: AuditActionsComplete.MANAGER_FAMILY_UNASSIGNED,
        entityType: 'assignment',
        entityId: record.id,
        userId: session.user.id,
        details: {
          targetUserId: userId,
          targetUserName: targetUser.name,
          familyId: record.familyId,
          familyName,
          targetRole: targetUser.role,
        },
        oldValues: { ...record },
      }).catch(err => console.error('[AUDIT] Failed to log manager_family_unassigned:', err))

      NotificationService.push({
        userId,
        type: 'WARNING',
        title: 'Familia de inventario desasignada',
        message: `Se te ha desasignado de la familia ${familyName}.`,
        metadata: { type: 'manager_family_unassigned', familyId: record.familyId, familyName },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify manager (unassign):', err))
    }

    // Cache invalidation: user:modules and perm:inv
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
