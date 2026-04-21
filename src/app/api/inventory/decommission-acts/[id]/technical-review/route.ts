import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getAssetFamilyId, isTechnicianOfFamily } from '@/lib/inventory-access'
import { notifyUser, notifyAdmins } from '@/lib/api/notify'

/**
 * POST /api/inventory/decommission-acts/[id]/technical-review
 *
 * El TÉCNICO asignado a la familia emite su dictamen técnico.
 * Transición: PENDING → TECHNICAL_REVIEW
 *
 * Body: { opinion: string, recommend: 'APPROVE' | 'REJECT' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Solo TECHNICIAN puede emitir dictamen técnico
  if (session.user.role !== 'TECHNICIAN') {
    return NextResponse.json(
      { error: 'Solo un técnico puede emitir el dictamen técnico de baja' },
      { status: 403 }
    )
  }

  const { id: requestId } = await params
  const body = await request.json()
  const { opinion, recommend } = body

  if (!opinion || opinion.trim().length < 10) {
    return NextResponse.json(
      { error: 'El dictamen técnico debe tener al menos 10 caracteres' },
      { status: 400 }
    )
  }

  if (!['APPROVE', 'REJECT'].includes(recommend)) {
    return NextResponse.json(
      { error: 'El campo recommend debe ser APPROVE o REJECT' },
      { status: 400 }
    )
  }

  const decommissionRequest = await prisma.decommission_requests.findUnique({
    where: { id: requestId },
    include: {
      equipment: { select: { id: true, code: true, brand: true, model: true, type: { select: { familyId: true } } } },
      license: { select: { id: true, name: true, licenseType: { select: { familyId: true } } } },
      requester: { select: { id: true, name: true, email: true } },
    },
  }) as any

  if (!decommissionRequest) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  }

  if (decommissionRequest.status !== 'PENDING') {
    return NextResponse.json(
      { error: `La solicitud está en estado "${decommissionRequest.status}" y no puede recibir dictamen técnico` },
      { status: 409 }
    )
  }

  // Verificar que el técnico pertenece a la familia del activo
  const familyId = decommissionRequest.assetType === 'EQUIPMENT'
    ? decommissionRequest.equipment?.type?.familyId
    : decommissionRequest.license?.licenseType?.familyId

  if (familyId) {
    const isAssigned = await isTechnicianOfFamily(session.user.id, familyId)
    if (!isAssigned) {
      return NextResponse.json(
        { error: 'No estás asignado a la familia de este activo. Solo técnicos de la familia pueden emitir el dictamen.' },
        { status: 403 }
      )
    }
  }

  const assetName = decommissionRequest.assetType === 'EQUIPMENT'
    ? `${decommissionRequest.equipment?.code} — ${decommissionRequest.equipment?.brand} ${decommissionRequest.equipment?.model}`
    : decommissionRequest.license?.name ?? 'Activo'

  const technicianName = session.user.name || session.user.email || 'Técnico'

  // Si el técnico recomienda rechazar, se rechaza directamente
  if (recommend === 'REJECT') {
    await prisma.decommission_requests.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        technicianId: session.user.id,
        technicianOpinion: opinion.trim(),
        technicianReviewAt: new Date(),
        rejectionReason: `Dictamen técnico desfavorable: ${opinion.trim()}`,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      } as any,
    })

    await notifyUser(
      decommissionRequest.requester.id,
      'ERROR',
      'Solicitud de baja rechazada por dictamen técnico',
      `El técnico ${technicianName} emitió un dictamen desfavorable para la baja de "${assetName}". Motivo: ${opinion.trim().substring(0, 150)}`,
      { metadata: { link: `/inventory/acts?tab=decommission` } }
    )

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DECOMMISSION_TECHNICAL_REJECTED',
        entityType: 'inventory',
        entityId: requestId,
        userId: session.user.id,
        details: { opinion: opinion.trim(), recommend, assetName },
        createdAt: new Date(),
      },
    }).catch(() => {})

    return NextResponse.json({ message: 'Dictamen técnico emitido — solicitud rechazada', status: 'REJECTED' })
  }

  // Técnico recomienda aprobar → pasa a TECHNICAL_REVIEW para que el gestor eleve
  await prisma.decommission_requests.update({
    where: { id: requestId },
    data: {
      status: 'TECHNICAL_REVIEW',
      technicianId: session.user.id,
      technicianOpinion: opinion.trim(),
      technicianReviewAt: new Date(),
    } as any,
  })

  // Notificar a los gestores de la familia
  if (familyId) {
    const managers = await prisma.inventory_manager_families.findMany({
      where: { familyId },
      include: { manager: { select: { id: true, name: true } } },
    })

    for (const m of managers) {
      await notifyUser(
        m.manager.id,
        'INFO',
        `Dictamen técnico emitido — ${assetName}`,
        `El técnico ${technicianName} emitió dictamen favorable para la baja de "${assetName}". Revisa y eleva al administrador si estás de acuerdo.`,
        { metadata: { link: `/inventory/acts?tab=decommission` } }
      )
    }
  }

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'DECOMMISSION_TECHNICAL_REVIEW',
      entityType: 'inventory',
      entityId: requestId,
      userId: session.user.id,
      details: { opinion: opinion.trim(), recommend, assetName, familyId },
      createdAt: new Date(),
    },
  }).catch(() => {})

  return NextResponse.json({
    message: 'Dictamen técnico emitido — pendiente de elevación por el gestor',
    status: 'TECHNICAL_REVIEW',
  })
}
