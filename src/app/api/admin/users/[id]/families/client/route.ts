import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { invalidateCache, buildCacheKey } from '@/lib/api-cache'
import { NotificationService } from '@/lib/services/notification-service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id: clientId } = await params
    const body = await request.json()
    const { familyId } = body

    if (!familyId) return NextResponse.json({ error: 'familyId es requerido' }, { status: 400 })

    // Verify target user is a CLIENT
    const targetUser = await prisma.users.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, role: true },
    })
    if (!targetUser || targetUser.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Usuario no encontrado o no es cliente' }, { status: 404 })
    }

    // RBAC: ADMIN can only assign families they have access to
    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    if (!viewer?.isSuperAdmin) {
      const adminAccess = await prisma.admin_family_assignments.findFirst({
        where: { adminId: session.user.id, familyId, isActive: true },
      })
      if (!adminAccess) {
        return NextResponse.json({ error: 'No tienes acceso a esta familia' }, { status: 403 })
      }
    }

    // Get family name for audit/notification
    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    // Check if assignment already exists
    const existing = await prisma.client_family_assignments.findFirst({
      where: { clientId, familyId },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'El cliente ya está asignado a esta familia' },
        { status: 409 }
      )
    }

    // Create assignment
    const assignment = await prisma.client_family_assignments.create({
      data: { clientId, familyId, isActive: true },
    })

    // Audit log (fire and forget)
    AuditServiceComplete.log({
      action: AuditActionsComplete.CLIENT_FAMILY_ASSIGNED,
      entityType: 'assignment',
      entityId: assignment.id,
      userId: session.user.id,
      details: {
        targetUserId: clientId,
        targetUserName: targetUser.name,
        familyId,
        familyName: family.name,
        targetRole: 'CLIENT',
      },
    }).catch(err => console.error('[AUDIT] Failed to log client_family_assigned:', err))

    // In-app notification (fire and forget)
    NotificationService.push({
      userId: clientId,
      type: 'INFO',
      title: 'Nueva familia asignada',
      message: `Se te ha asignado a la familia ${family.name}.`,
      metadata: { type: 'client_family_assigned', familyId, familyName: family.name },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify client:', err))

    // Cache invalidation
    await invalidateCache(buildCacheKey('user:modules', { userId: clientId })).catch(() => {})

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error('Error assigning client to family:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
