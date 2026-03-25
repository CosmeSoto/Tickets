import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * POST /api/inventory/decommission-acts/[id]/reject
 * Solo ADMIN puede rechazar
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Solo el administrador puede aprobar o rechazar solicitudes de baja' },
      { status: 403 }
    )
  }

  const { id: requestId } = await params
  const body = await request.json()
  const { rejectionReason } = body

  if (!rejectionReason || rejectionReason.trim().length < 10) {
    return NextResponse.json(
      { error: 'El motivo de rechazo debe tener al menos 10 caracteres' },
      { status: 400 }
    )
  }

  const decommissionRequest = await prisma.decommission_requests.findUnique({
    where: { id: requestId },
    include: {
      equipment: { select: { id: true, code: true, brand: true, model: true } },
      license: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true, email: true } },
    },
  })

  if (!decommissionRequest) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  }
  if (decommissionRequest.status !== 'PENDING') {
    return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 409 })
  }

  const assetName = decommissionRequest.assetType === 'EQUIPMENT'
    ? `${decommissionRequest.equipment?.code} - ${decommissionRequest.equipment?.brand} ${decommissionRequest.equipment?.model}`
    : decommissionRequest.license?.name || 'Activo'

  const adminName = session.user.name || session.user.email || 'Administrador'

  await prisma.decommission_requests.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      rejectionReason: rejectionReason.trim(),
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  })

  const requesterId = decommissionRequest.requester.id
  const requesterEmail = decommissionRequest.requester.email
  const requesterName = decommissionRequest.requester.name || requesterEmail

  // Campanita
  await prisma.notifications.create({
    data: {
      id: randomUUID(),
      userId: requesterId,
      type: 'ERROR',
      title: 'Solicitud de Baja Rechazada',
      message: `Tu solicitud de baja para "${assetName}" fue rechazada. Motivo: ${rejectionReason.trim().substring(0, 150)}`,
      metadata: { link: `/inventory/decommission/${requestId}` },
      isRead: false,
    },
  }).catch(() => {})

  // Email
  await prisma.email_queue.create({
    data: {
      id: randomUUID(),
      toEmail: requesterEmail,
      subject: `Solicitud de Baja Rechazada - ${assetName}`,
      body: generateRejectionEmail(requesterName, assetName, rejectionReason.trim(), adminName),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: new Date(),
    },
  }).catch(() => {})

  // Audit log
  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'DECOMMISSION_REJECTED',
      entityType: 'inventory',
      entityId: requestId,
      userId: session.user.id,
      details: { descripcion: `${adminName} rechazó la solicitud de baja de "${assetName}". Motivo: ${rejectionReason.trim().substring(0, 200)}` },
      createdAt: new Date(),
    },
  }).catch(() => {})

  return NextResponse.json({ message: 'Solicitud rechazada correctamente' })
}

function generateRejectionEmail(requesterName: string, assetName: string, reason: string, adminName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background-color: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
  .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
  .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc2626; }
  .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>❌ Solicitud de Baja Rechazada</h2></div>
    <div class="content">
      <p>Hola ${requesterName},</p>
      <p>Tu solicitud de baja ha sido <strong>rechazada</strong> por ${adminName}.</p>
      <div class="info-box">
        <p><strong>Activo:</strong> ${assetName}</p>
        <p><strong>Motivo del rechazo:</strong> ${reason}</p>
        <p><strong>Revisado por:</strong> ${adminName}</p>
      </div>
      <p>El activo permanece activo en el sistema. Si tienes dudas, contacta al administrador.</p>
    </div>
    <div class="footer"><p>Mensaje automático del Sistema de Gestión de Inventario</p></div>
  </div>
</body>
</html>`.trim()
}
