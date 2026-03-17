import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DeliveryActService } from '@/lib/services/delivery-act.service'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const rejectActSchema = z.object({
  token: z.string().min(1, 'Token es requerido'),
  reason: z.string().min(10, 'La razón debe tener al menos 10 caracteres'),
})

/**
 * POST /api/inventory/acts/[id]/reject
 * Rechaza un acta de entrega
 * Requiere token válido
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validar datos
    const validatedData = rejectActSchema.parse(body)

    // Verificar que el token corresponde al acta
    const act = await DeliveryActService.getActByToken(validatedData.token)
    
    if (!act || act.id !== id) {
      return NextResponse.json(
        { error: 'Acta no encontrada o token inválido' },
        { status: 404 }
      )
    }

    // Obtener userId del receptor (quien rechaza)
    const userId = act.receiverInfo.id

    // Rechazar acta
    const rejectedAct = await DeliveryActService.rejectAct(
      id,
      validatedData.reason,
      userId
    )

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.ACT_REJECTED,
      entityType: 'inventory',
      entityId: id,
      userId,
      details: {
        folio: act.folio,
        reason: validatedData.reason,
        equipmentCode: act.equipmentSnapshot.code,
      },
    })

    return NextResponse.json({
      act: rejectedAct,
      message: 'Acta rechazada exitosamente',
    })
  } catch (error) {
    console.error('Error en POST /api/inventory/acts/[id]/reject:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al rechazar acta' },
      { status: 500 }
    )
  }
}
