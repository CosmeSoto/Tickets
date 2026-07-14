import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'

const decommissionInclude = {
  requester: { select: { id: true, name: true, email: true, department: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  equipment: {
    select: {
      id: true,
      code: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      photoUrl: true,
      type: { select: { familyId: true, family: { select: { id: true, name: true } } } },
    },
  },
  license: {
    select: {
      id: true,
      name: true,
      vendor: true,
      licenseType: { select: { familyId: true, family: { select: { id: true, name: true } } } },
    },
  },
  attachments: true,
  act: {
    include: {
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  },
}

/**
 * GET /api/inventory/decommission-acts/[id]
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
  const isAdmin = session.user.role === 'ADMIN'
  const canManage = await canManageInventory(session.user.id, session.user.role)

  const request = await prisma.decommission_requests.findUnique({
    where: { id },
    include: decommissionInclude,
  })

  if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  if (!isSuperAdmin && !isAdmin && !canManage && request.requestedById !== session.user.id) {
    return NextResponse.json(
      { error: 'No tienes permiso para ver esta solicitud' },
      { status: 403 }
    )
  }

  if (canManage && !isSuperAdmin && !isAdmin) {
    const familyId =
      request.assetType === 'EQUIPMENT'
        ? request.equipment?.type?.familyId ?? null
        : request.license?.licenseType?.familyId ?? null

    const ctx = await getInventorySessionContext(session.user)
    if (ctx.scope.noAccess) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta solicitud' },
        { status: 403 }
      )
    }
    if (ctx.scope.familyIds?.length && familyId && !ctx.scope.familyIds.includes(familyId)) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver solicitudes fuera de tus familias' },
        { status: 403 }
      )
    }
  }

  const attachmentsWithUrls = request.attachments.map((att: { filename: string }) => ({
    ...att,
    url: `/api/uploads/decommission/${request.id}/${att.filename}`,
  }))

  return NextResponse.json({ ...request, attachments: attachmentsWithUrls })
}

/**
 * DELETE /api/inventory/decommission-acts/[id]
 * Elimina una solicitud de baja. Solo SuperAdmin.
 * La auditoría se mantiene en audit_logs.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (!isSuperAdmin) {
    return NextResponse.json(
      { error: 'Solo el Super Administrador puede eliminar solicitudes de baja' },
      { status: 403 }
    )
  }

  const { id } = await params

  const request = await prisma.decommission_requests.findUnique({
    where: { id },
    include: { equipment: { select: { code: true } }, act: { select: { folio: true } } },
  })

  if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  try {
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DELETE',
        entityType: 'decommission_request',
        entityId: id,
        userId: session.user.id,
        details: {
          equipmentCode: (request as any).equipment?.code,
          folio: (request as any).act?.folio,
          status: request.status,
          deletedBy: session.user.email,
          reason: 'Eliminación por Super Administrador',
        },
      },
    })

    if ((request as any).act) {
      await prisma.decommission_acts.delete({ where: { requestId: id } })
    }

    await prisma.decommission_requests.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando solicitud de baja:', error)
    return NextResponse.json({ error: 'Error al eliminar solicitud' }, { status: 500 })
  }
}
