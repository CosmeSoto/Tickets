import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { isManagerOfFamily } from '@/lib/inventory-access'
import { notifyAdmins } from '@/lib/api/notify'

/**
 * POST /api/inventory/decommission-acts/[id]/elevate
 *
 * El GESTOR de la familia eleva la solicitud al administrador.
 * Transición: TECHNICAL_REVIEW → MANAGER_REVIEW
 *
 * Body: { notes?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  const isAdmin = session.user.role === 'ADMIN'

  // Solo gestores (canManageInventory) o admins pueden elevar
  const canManage = (session.user as any).canManageInventory === true
  if (!isAdmin && !canManage) {
    return NextResponse.json(
      { error: 'Solo gestores de inventario o administradores pueden elevar solicitudes de baja' },
      { status: 403 }
    )
  }

  const { id: requestId } = await params
  const body = await request.json()
  const { notes } = body

  const decommissionRequest = await prisma.decommission_requests.findUnique({
    where: { id: requestId },
    include: {
      equipment: { select: { id: true, code: true, brand: true, model: true, type: { select: { familyId: true } } } },
      license: { select: { id: true, name: true, licenseType: { select: { familyId: true } } } },
      requester: { select: { id: true, name: true } },
    },
  }) as any

  if (!decommissionRequest) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  }

  // Admins pueden elevar desde PENDING o TECHNICAL_REVIEW
  // Gestores solo desde TECHNICAL_REVIEW
  const allowedStatuses = isAdmin ? ['PENDING', 'TECHNICAL_REVIEW'] : ['TECHNICAL_REVIEW']
  if (!allowedStatuses.includes(decommissionRequest.status)) {
    return NextResponse.json(
      { error: `La solicitud está en estado "${decommissionRequest.status}". ${isAdmin ? 'Solo se puede elevar desde PENDING o TECHNICAL_REVIEW.' : 'Solo se puede elevar desde TECHNICAL_REVIEW.'}` },
      { status: 409 }
    )
  }

  // Verificar que el gestor pertenece a la familia del activo
  const familyId = decommissionRequest.assetType === 'EQUIPMENT'
    ? decommissionRequest.equipment?.type?.familyId
    : decommissionRequest.license?.licenseType?.familyId

  if (!isAdmin && familyId) {
    const isManager = await isManagerOfFamily(session.user.id, familyId)
    if (!isManager) {
      return NextResponse.json(
        { error: 'No eres gestor de la familia de este activo' },
        { status: 403 }
      )
    }
  }

  const assetName = decommissionRequest.assetType === 'EQUIPMENT'
    ? `${decommissionRequest.equipment?.code} — ${decommissionRequest.equipment?.brand} ${decommissionRequest.equipment?.model}`
    : decommissionRequest.license?.name ?? 'Activo'

  const managerName = session.user.name || session.user.email || 'Gestor'

  await prisma.decommission_requests.update({
    where: { id: requestId },
    data: {
      status: 'MANAGER_REVIEW',
      managerId: session.user.id,
      managerNotes: notes?.trim() || null,
      managerElevatedAt: new Date(),
    } as any,
  })

  // Notificar a los admins de la familia
  await notifyAdmins(
    'WARNING',
    `Solicitud de baja elevada — ${assetName}`,
    `${managerName} elevó la solicitud de baja de "${assetName}" para tu aprobación.${notes ? ` Notas: ${notes.trim().substring(0, 100)}` : ''}`,
    { metadata: { link: `/inventory/acts?tab=decommission` } }
  )

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'DECOMMISSION_ELEVATED',
      entityType: 'inventory',
      entityId: requestId,
      userId: session.user.id,
      details: { notes: notes?.trim(), assetName, familyId },
      createdAt: new Date(),
    },
  }).catch(() => {})

  return NextResponse.json({
    message: 'Solicitud elevada al administrador para aprobación',
    status: 'MANAGER_REVIEW',
  })
}
