import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReturnActService } from '@/lib/services/return-act.service'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { notifyUser } from '@/lib/api/notify'

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
    const body = await request.json()

    const {
      returnCondition,
      inspectionNotes,
      missingAccessories,
      damageDescription,
      returnDate,
    } = body

    if (!returnCondition) {
      return NextResponse.json({ error: 'La condición de devolución es requerida' }, { status: 400 })
    }

    const validConditions = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']
    if (!validConditions.includes(returnCondition)) {
      return NextResponse.json({ error: 'Condición de devolución inválida' }, { status: 400 })
    }

    if ((returnCondition === 'DAMAGED' || returnCondition === 'POOR') && !damageDescription?.trim()) {
      return NextResponse.json(
        { error: 'La descripción de daños es requerida cuando la condición es Malo o Dañado' },
        { status: 400 }
      )
    }

    // Verificar que la asignación existe y está activa
    const assignment = await prisma.equipment_assignments.findUnique({
      where: { id: assignmentId },
      include: {
        equipment: { select: { id: true, code: true, brand: true, model: true } },
        receiver: { select: { id: true, name: true, email: true } },
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
        { error: 'La asignación no tiene un acta de entrega aceptada. No se puede registrar la devolución.' },
        { status: 422 }
      )
    }

    // Verificar que no haya ya un acta de devolución pendiente
    const existingReturn = await (prisma.return_acts as any).findFirst({
      where: { assignmentId, status: 'PENDING' },
    })
    if (existingReturn) {
      return NextResponse.json(
        { error: 'Ya existe un acta de devolución pendiente para esta asignación' },
        { status: 409 }
      )
    }

    // Crear el acta de devolución
    const returnAct = await ReturnActService.generateReturnAct({
      assignmentId,
      returnCondition,
      inspectionNotes: inspectionNotes?.trim() || undefined,
      missingAccessories: Array.isArray(missingAccessories) ? missingAccessories : [],
      damageDescription: damageDescription?.trim() || undefined,
      returnDate: returnDate ? new Date(returnDate) : new Date(),
    })

    // Notificar al receptor (quien devuelve) que se generó el acta
    const equipmentLabel = `${assignment.equipment.code} — ${assignment.equipment.brand} ${assignment.equipment.model}`
    await notifyUser(
      assignment.receiver.id,
      'INFO',
      `Acta de devolución generada — ${assignment.equipment.code}`,
      `Se generó el acta de devolución ${(returnAct as any).folio} para el equipo ${equipmentLabel}. Revisa y firma el acta.`,
      {
        metadata: { link: `/inventory/acts?tab=return` },
        email: {
          to: assignment.receiver.email,
          subject: `Acta de devolución generada — ${assignment.equipment.code}`,
          html: buildReturnActEmail(
            assignment.receiver.name,
            equipmentLabel,
            (returnAct as any).folio,
            session.user.name || session.user.email || 'Administrador'
          ),
        },
      }
    )

    return NextResponse.json({ returnAct }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear acta de devolución'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function buildReturnActEmail(
  receiverName: string,
  equipmentLabel: string,
  folio: string,
  adminName: string
): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#7C3AED;color:white;padding:20px;border-radius:5px 5px 0 0}.content{background:#f9fafb;padding:20px;border:1px solid #e5e7eb}.info-box{background:white;padding:15px;margin:15px 0;border-left:4px solid #7C3AED}.footer{text-align:center;margin-top:20px;color:#6b7280;font-size:12px}</style>
</head><body><div class="container">
<div class="header"><h2>📦 Acta de Devolución Generada</h2></div>
<div class="content"><p>Hola <strong>${receiverName}</strong>,</p>
<p>Se ha generado un acta de devolución para el equipo que tienes asignado.</p>
<div class="info-box"><p><strong>Equipo:</strong> ${equipmentLabel}</p><p><strong>Folio:</strong> ${folio}</p><p><strong>Generado por:</strong> ${adminName}</p></div>
<p>Ingresa al sistema para revisar y firmar el acta de devolución.</p></div>
<div class="footer"><p>Mensaje automático del Sistema de Gestión de Inventario</p></div>
</div></body></html>`
}
