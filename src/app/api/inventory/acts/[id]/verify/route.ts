import { NextRequest, NextResponse } from 'next/server'
import { DeliveryActService } from '@/lib/services/delivery-act.service'

/**
 * GET /api/inventory/acts/[id]/verify
 * Verifica la autenticidad de un acta usando el hash SHA-256
 * Acceso público (no requiere autenticación)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Obtener acta
    const act = await DeliveryActService.getActById(id)
    
    if (!act) {
      return NextResponse.json(
        { 
          isValid: false,
          message: 'Acta no encontrada'
        },
        { status: 404 }
      )
    }

    // Solo se pueden verificar actas aceptadas
    if (act.status !== 'ACCEPTED') {
      return NextResponse.json(
        {
          isValid: false,
          message: 'Solo se pueden verificar actas aceptadas',
          act: {
            folio: act.folio,
            status: act.status,
          }
        }
      )
    }

    // Verificar autenticidad
    const isValid = DeliveryActService.verifyActAuthenticity(act)

    if (isValid) {
      return NextResponse.json({
        isValid: true,
        message: 'Acta auténtica y válida',
        act: {
          folio: act.folio,
          status: act.status,
          acceptedAt: act.acceptedAt,
          equipmentSnapshot: act.equipmentSnapshot,
          delivererInfo: act.delivererInfo,
          receiverInfo: act.receiverInfo,
          signatureTimestamp: act.signatureTimestamp,
          verificationHash: act.verificationHash,
        }
      })
    } else {
      return NextResponse.json({
        isValid: false,
        message: 'El hash de verificación no coincide. El acta puede haber sido alterada.',
        act: {
          folio: act.folio,
          status: act.status,
        }
      })
    }
  } catch (error) {
    console.error('Error en GET /api/inventory/acts/[id]/verify:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          isValid: false,
          message: error.message 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        isValid: false,
        message: 'Error al verificar acta' 
      },
      { status: 500 }
    )
  }
}
