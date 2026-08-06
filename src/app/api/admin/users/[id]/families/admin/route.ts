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

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    if (!viewer?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el administrador principal puede asignar familias a administradores' },
        { status: 403 }
      )
    }

    const { id: adminId } = await params
    const body = await request.json()
    const { familyId } = body

    if (!familyId) return NextResponse.json({ error: 'familyId es requerido' }, { status: 400 })

    const targetUser = await prisma.users.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, role: true, isSuperAdmin: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    if (targetUser.isSuperAdmin) {
      return NextResponse.json(
        { error: 'No se pueden asignar familias a un super administrador' },
        { status: 400 }
      )
    }

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    const existing = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: adminId, familyId, module: 'tickets' },
      },
    })
    if (existing?.isActive) {
      return NextResponse.json(
        { error: 'El administrador ya está asignado a esta familia' },
        { status: 409 }
      )
    }

    await assignUserModuleFamily({
      userId: adminId,
      familyId,
      moduleInput: 'tickets',
      role: 'ADMIN',
    })

    const row = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: adminId, familyId, module: 'tickets' },
      },
    })

    const assignment = {
      id: row?.id ?? adminId,
      adminId,
      familyId,
      isActive: true,
    }

    AuditServiceComplete.log({
      action: AuditActionsComplete.ADMIN_FAMILY_ASSIGNED,
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
    }).catch(err => console.error('[AUDIT] Failed to log admin_family_assigned:', err))

    NotificationService.push({
      userId: adminId,
      type: 'INFO',
      title: 'Nueva familia asignada',
      message: `Se te ha asignado a la familia ${family.name}.`,
      metadata: { type: 'admin_family_assigned', familyId, familyName: family.name },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify admin:', err))

    await invalidateCache(buildCacheKey('user:modules', { userId: adminId })).catch(() => {})

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error: any) {
    console.error('Error assigning admin to family:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 400 }
    )
  }
}
