import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'

const decommissionInclude = {
  requester: { select: { id: true, name: true, email: true, department: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  equipment: {
    select: {
      id: true, code: true, brand: true, model: true,
      serialNumber: true, status: true, photoUrl: true,
    },
  },
  license: { select: { id: true, name: true, vendor: true } },
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
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const isAdmin = session.user.role === 'ADMIN'
  const canManage = await canManageInventory(session.user.id, session.user.role)

  const request = await prisma.decommission_requests.findUnique({
    where: { id },
    include: decommissionInclude,
  })

  if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  // Gestor/Técnico solo puede ver sus propias solicitudes
  if (!isAdmin && !canManage && request.requestedById !== session.user.id) {
    return NextResponse.json({ error: 'No tienes permiso para ver esta solicitud' }, { status: 403 })
  }
  if (canManage && !isAdmin && request.requestedById !== session.user.id) {
    return NextResponse.json({ error: 'No tienes permiso para ver esta solicitud' }, { status: 403 })
  }

  // Agregar URLs públicas a los adjuntos
  const attachmentsWithUrls = request.attachments.map((att: any) => ({
    ...att,
    url: `/api/uploads/decommission/${request.id}/${att.filename}`,
  }))

  return NextResponse.json({ ...request, attachments: attachmentsWithUrls })
}
