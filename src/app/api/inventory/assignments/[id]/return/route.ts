import { getSystemBranding } from '@/lib/branding'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReturnActService } from '@/lib/services/return-act.service'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { notifyUser } from '@/lib/api/notify'
import {
  assertInventoryResourceManage,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/inventory/assignments/[id]/return
 * Crea un acta de devolución para una asignación activa.
 * Solo ADMIN, TECHNICIAN o gestores de inventario pueden iniciar una devolución.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN'
    const canManage = await canManageInventory(session.user.id, session.user.role)

    if (!isAdmin && !canManage) {
      return NextResponse.json(
        { error: 'Solo administradores y gestores de inventario pueden registrar devoluciones' },
        { status: 403 }
      )
    }

    const { id: assignmentId } = await params

    try {
      await assertInventoryResourceManage(
        toInventoryAccessUser(session.user),
        'ASSIGNMENT',
        assignmentId
      )
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()

    const { returnCondition, inspectionNotes, missingAccessories, damageDescription, returnDate } =
      body

    if (!returnCondition) {
      return NextResponse.json(
        { error: 'La condición de devolución es requerida' },
        { status: 400 }
      )
    }

    const validConditions = ['NEW', 'USED', 'DAMAGED']
    if (!validConditions.includes(returnCondition)) {
      return NextResponse.json({ error: 'Condición de devolución inválida' }, { status: 400 })
    }

    if (returnCondition === 'DAMAGED' && !damageDescription?.trim()) {
      return NextResponse.json(
        { error: 'La descripción de daños es requerida cuando la condición es Dañado' },
        { status: 400 }
      )
    }

    // Verificar que la asignación existe y está activa
    const assignment = await prisma.equipment_assignments.findUnique({
      where: { id: assignmentId },
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            brand: true,
            modelDeprecated: true,
            model: { select: { model: true } },
          },
        },
        receiver: { select: { id: true, name: true, email: true } },
        deliverer: { select: { id: true, name: true, email: true } },
        deliveryAct: { select: { id: true, status: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    if (!assignment.isActive) {
      return NextResponse.json({ error: 'La asignación ya no está activa' }, { status: 409 })
    }

    if (!assignment.deliveryAct || assignment.deliveryAct.status !== 'ACCEPTED') {
      return NextResponse.json(
        {
          error:
            'La asignación no tiene un acta de entrega aceptada. No se puede registrar la devolución.',
        },
        { status: 422 }
      )
    }

    // Acta pendiente vigente: no crear otra; devolver id para que la UI redirija a firmar
    const existingPending = await prisma.return_acts.findFirst({
      where: { assignmentId, status: 'PENDING' },
      select: { id: true, folio: true, expirationDate: true },
    })
    if (existingPending) {
      const expired = new Date() > new Date(existingPending.expirationDate)
      if (!expired) {
        return NextResponse.json(
          {
            error:
              'Ya existe un acta de devolución pendiente. Debe firmarse para liberar el equipo, o el Super Admin puede eliminarla.',
            existingActId: existingPending.id,
            folio: existingPending.folio,
          },
          { status: 409 }
        )
      }
      // Expirada: marcar EXPIRED para liberar el unique assignmentId
      await prisma.return_acts.update({
        where: { id: existingPending.id },
        data: { status: 'EXPIRED' },
      })
    }

    // assignmentId es unique: retirar actas REJECTED/EXPIRED antes de recrear
    await prisma.return_acts.deleteMany({
      where: { assignmentId, status: { in: ['REJECTED', 'EXPIRED'] } },
    })

    // Crear el acta de devolución
    const returnAct = await ReturnActService.generateReturnAct({
      assignmentId,
      returnCondition,
      inspectionNotes: inspectionNotes?.trim() || undefined,
      missingAccessories: Array.isArray(missingAccessories) ? missingAccessories : [],
      damageDescription: damageDescription?.trim() || undefined,
      returnDate: returnDate ? new Date(returnDate) : new Date(),
    })

    // Notificar a quien debe firmar (deliverer = quien recibió la devolución en bodega)
    const { systemName } = await getSystemBranding()

    const equipmentModel =
      assignment.equipment.model?.model || assignment.equipment.modelDeprecated || ''
    const equipmentLabel = `${assignment.equipment.code} — ${assignment.equipment.brand} ${equipmentModel}`
    const actUrl = `/inventory/acts/return/${returnAct.id}`
    const signer = assignment.deliverer

    await notifyUser(
      signer.id,
      'INFO',
      `Firma requerida — devolución ${assignment.equipment.code}`,
      `Se generó el acta ${returnAct.folio} para devolver ${equipmentLabel}. Debes firmarla para liberar el equipo a bodega.`,
      {
        metadata: { link: actUrl },
        email: {
          to: signer.email,
          subject: `Firma requerida — devolución ${assignment.equipment.code}`,
          html: buildReturnActEmail(
            signer.name,
            equipmentLabel,
            returnAct.folio,
            session.user.name || session.user.email || 'Administrador',
            systemName,
            actUrl
          ),
        },
      }
    )

    // Aviso informativo a quien devuelve (custodio actual)
    if (assignment.receiver.id !== signer.id) {
      await notifyUser(
        assignment.receiver.id,
        'INFO',
        `Devolución iniciada — ${assignment.equipment.code}`,
        `Se generó el acta ${returnAct.folio}. Pendiente de firma de ${signer.name} para completar la devolución a bodega.`,
        { metadata: { link: actUrl } }
      )
    }

    return NextResponse.json(
      {
        returnAct,
        message: 'Acta de devolución generada. Debe firmarse para que el equipo pase a Disponible.',
        signUrl: actUrl,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear acta de devolución'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function buildReturnActEmail(
  signerName: string,
  equipmentLabel: string,
  folio: string,
  adminName: string,
  systemName: string,
  actPath: string
): string {
  const base = process.env.NEXTAUTH_URL || ''
  const link = `${base}${actPath}`
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#7C3AED;color:white;padding:20px;border-radius:5px 5px 0 0}.content{background:#f9fafb;padding:20px;border:1px solid #e5e7eb}.info-box{background:white;padding:15px;margin:15px 0;border-left:4px solid #7C3AED}.footer{text-align:center;margin-top:20px;color:#6b7280;font-size:12px}.btn{display:inline-block;margin-top:12px;padding:10px 16px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:6px}</style>
</head><body><div class="container">
<div class="header"><h2>📦 Firma requerida — Acta de Devolución</h2></div>
<div class="content"><p>Hola <strong>${signerName}</strong>,</p>
<p>Debes firmar el acta de devolución para liberar el equipo a bodega. Hasta firmar, el equipo seguirá como <strong>Asignado</strong>.</p>
<div class="info-box"><p><strong>Equipo:</strong> ${equipmentLabel}</p><p><strong>Folio:</strong> ${folio}</p><p><strong>Generado por:</strong> ${adminName}</p></div>
<p><a class="btn" href="${link}">Abrir y firmar acta</a></p></div>
<div class="footer"><p>Mensaje automático del ${systemName}</p></div>
</div></body></html>`
}
