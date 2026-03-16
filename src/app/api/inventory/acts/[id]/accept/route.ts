import { NextRequest, NextResponse } from 'next/server'
import { DeliveryActService } from '@/lib/services/delivery-act.service'
import { DigitalSignatureService } from '@/lib/services/digital-signature.service'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const acceptActSchema = z.object({
  token: z.string().min(1, 'Token es requerido'),
  acceptedTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones'
  }),
})

/**
 * POST /api/inventory/acts/[id]/accept
 * Acepta un acta de entrega
 * Captura IP y user agent para firma digital
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // Validar datos
    const validatedData = acceptActSchema.parse(body)

    // Verificar que el token corresponde al acta
    const act = await DeliveryActService.getActByToken(validatedData.token)
    
    if (!act || act.id !== id) {
      return NextResponse.json(
        { error: 'Acta no encontrada o token inválido' },
        { status: 404 }
      )
    }

    // Capturar IP y user agent del request
    const ipAddress = DigitalSignatureService.extractIpAddress(request.headers)
    const userAgent = DigitalSignatureService.extractUserAgent(request.headers)

    // Aceptar acta
    const acceptedAct = await DeliveryActService.acceptAct(
      id,
      ipAddress,
      userAgent
    )

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.ACT_ACCEPTED,
      entityType: 'inventory',
      entityId: id,
      userId: act.receiverInfo.id,
      details: {
        folio: act.folio,
        equipmentCode: act.equipmentSnapshot.code,
        ipAddress,
      },
    })

    return NextResponse.json({
      act: acceptedAct,
      message: 'Acta aceptada exitosamente',
    })
  } catch (error) {
    console.error('Error en POST /api/inventory/acts/[id]/accept:', error)
    
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
      { error: 'Error al aceptar acta' },
      { status: 500 }
    )
  }
}
