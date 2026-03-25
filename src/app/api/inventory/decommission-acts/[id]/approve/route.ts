import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { generateDecommissionActPDF } from '@/lib/templates/decommission-act-pdf.template'
import { getUploadDir } from '@/lib/upload-path'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'

/**
 * POST /api/inventory/decommission-acts/[id]/approve
 * Solo ADMIN puede aprobar
 */
export async function POST(
  _request: NextRequest,
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

  const decommissionRequest = await prisma.decommission_requests.findUnique({
    where: { id: requestId },
    include: {
      equipment: { select: { id: true, code: true, brand: true, model: true, serialNumber: true } },
      license: { select: { id: true, name: true, vendor: true } },
      requester: { select: { id: true, name: true, email: true } },
      attachments: true,
    },
  }) as any

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
  const currentYear = new Date().getFullYear()
  const actId = randomUUID()

  try {
    const act = await prisma.$transaction(async (tx) => {
      // Folio BAJA
      let counter = await tx.folio_counters.findUnique({
        where: { year_type: { year: currentYear, type: 'BAJA' } },
      })
      if (!counter) {
        counter = await tx.folio_counters.create({
          data: { year: currentYear, type: 'BAJA', lastNumber: 1 },
        })
      } else {
        counter = await tx.folio_counters.update({
          where: { year_type: { year: currentYear, type: 'BAJA' } },
          data: { lastNumber: { increment: 1 } },
        })
      }
      const folio = `BAJA-${currentYear}-${counter.lastNumber.toString().padStart(5, '0')}`

      // Actualizar solicitud
      await tx.decommission_requests.update({
        where: { id: requestId },
        data: { status: 'APPROVED', reviewedById: session.user.id, reviewedAt: new Date() },
      })

      // Actualizar activo
      if (decommissionRequest.assetType === 'EQUIPMENT' && decommissionRequest.equipmentId) {
        await tx.equipment.update({ where: { id: decommissionRequest.equipmentId }, data: { status: 'RETIRED' } })
      } else if (decommissionRequest.assetType === 'LICENSE' && decommissionRequest.licenseId) {
        await tx.software_licenses.update({
          where: { id: decommissionRequest.licenseId },
          data: { expirationDate: new Date('2000-01-01') },
        })
      }

      // Crear acta
      const newAct = await tx.decommission_acts.create({
        data: { id: actId, folio, requestId, approvedById: session.user.id, approvedAt: new Date() },
      })

      return newAct
    })

    // Generar PDF (fuera de la transacción — fallo no revierte la aprobación)
    try {
      const systemContent = await prisma.landing_page_content.findFirst({ where: { id: 'default' } })
      const systemInfo = {
        logoUrl: (systemContent as any)?.companyLogoLightUrl || null,
        logoDarkUrl: (systemContent as any)?.companyLogoDarkUrl || null,
        companyName: (systemContent as any)?.companyName || 'Sistema de Inventario',
      }

      const attachmentPaths = (decommissionRequest.attachments || []).map((a: any) => a.path)

      const pdfDoc = await generateDecommissionActPDF({
        folio: act.folio,
        approvedAt: act.approvedAt,
        request: {
          reason: decommissionRequest.reason,
          condition: decommissionRequest.condition,
          assetType: decommissionRequest.assetType,
          requester: decommissionRequest.requester,
        },
        equipment: decommissionRequest.equipment,
        license: decommissionRequest.license,
        approvedBy: { name: session.user.name || session.user.email || 'Admin', email: session.user.email || '' },
        attachmentPaths,
        systemInfo,
      })

      const pdfDir = getUploadDir('decommission-acts')
      if (!existsSync(pdfDir)) await mkdir(pdfDir, { recursive: true })
      const pdfFilename = `${act.folio.replace(/\//g, '-')}_${Date.now()}.pdf`
      const pdfPath = getUploadDir('decommission-acts', pdfFilename)

      await new Promise<void>((resolve, reject) => {
        const stream = fs.createWriteStream(pdfPath)
        pdfDoc.pipe(stream)
        pdfDoc.end()
        stream.on('finish', resolve)
        stream.on('error', reject)
      })

      await prisma.decommission_acts.update({
        where: { id: actId },
        data: { pdfPath: `/uploads/decommission-acts/${pdfFilename}` },
      })
    } catch (pdfError) {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'DECOMMISSION_PDF_ERROR',
          entityType: 'inventory',
          entityId: actId,
          userId: session.user.id,
          details: { error: String(pdfError) },
          createdAt: new Date(),
        },
      }).catch(() => {})
    }

    // Notificaciones
    const requesterId = decommissionRequest.requester.id
    const requesterEmail = decommissionRequest.requester.email
    const requesterName = decommissionRequest.requester.name || requesterEmail

    await prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId: requesterId,
        type: 'SUCCESS',
        title: 'Solicitud de Baja Aprobada',
        message: `Tu solicitud de baja para "${assetName}" fue aprobada por ${adminName}. Folio: ${act.folio}`,
        metadata: { link: `/inventory/decommission/${requestId}` },
        isRead: false,
      },
    }).catch(() => {})

    await prisma.email_queue.create({
      data: {
        id: randomUUID(),
        toEmail: requesterEmail,
        subject: `Solicitud de Baja Aprobada - ${act.folio}`,
        body: buildApprovalEmail(requesterName, assetName, act.folio, adminName),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date(),
      },
    }).catch(() => {})

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DECOMMISSION_APPROVED',
        entityType: 'inventory',
        entityId: requestId,
        userId: session.user.id,
        details: { descripcion: `${adminName} aprobó la baja de "${assetName}". Folio: ${act.folio}` },
        createdAt: new Date(),
      },
    }).catch(() => {})

    return NextResponse.json({ act, folio: act.folio })
  } catch (error) {
    return NextResponse.json({ error: 'Error al aprobar la solicitud de baja' }, { status: 500 })
  }
}

function buildApprovalEmail(requesterName: string, assetName: string, folio: string, adminName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#1E40AF;color:white;padding:20px;border-radius:5px 5px 0 0}.content{background:#f9fafb;padding:20px;border:1px solid #e5e7eb}.info-box{background:white;padding:15px;margin:15px 0;border-left:4px solid #22C55E}.footer{text-align:center;margin-top:20px;color:#6b7280;font-size:12px}</style>
</head><body><div class="container">
<div class="header"><h2>✅ Solicitud de Baja Aprobada</h2></div>
<div class="content"><p>Hola ${requesterName},</p><p>Tu solicitud de baja ha sido <strong>aprobada</strong> por ${adminName}.</p>
<div class="info-box"><p><strong>Activo:</strong> ${assetName}</p><p><strong>Folio:</strong> ${folio}</p><p><strong>Aprobado por:</strong> ${adminName}</p></div>
<p>El activo ha sido marcado como dado de baja en el sistema.</p></div>
<div class="footer"><p>Mensaje automático del Sistema de Gestión de Inventario</p></div>
</div></body></html>`
}
