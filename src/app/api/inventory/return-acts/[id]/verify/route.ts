import { NextRequest, NextResponse } from 'next/server'
import { ReturnActService } from '@/lib/services/return-act.service'

/**
 * GET /api/inventory/return-acts/[id]/verify
 * Verifica la autenticidad de un acta de devolución usando el hash SHA-256.
 * Acceso público — usado por el QR del PDF.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const act = await ReturnActService.getActById(id)

    if (!act) {
      return NextResponse.json({ isValid: false, message: 'Acta no encontrada' }, { status: 404 })
    }

    if (act.status !== 'ACCEPTED') {
      return NextResponse.json({
        isValid: false,
        message: 'Solo se pueden verificar actas aceptadas',
        act: { folio: act.folio, status: act.status },
      })
    }

    const isValid = ReturnActService.verifyActAuthenticity(act)

    if (isValid) {
      return NextResponse.json({
        isValid: true,
        message: 'Acta de devolución auténtica y válida',
        act: {
          folio: act.folio,
          status: act.status,
          acceptedAt: act.acceptedAt,
          returnCondition: (act as any).returnCondition,
          equipmentSnapshot: (act as any).equipmentSnapshot,
          receiverInfo: act.receiverInfo,
          delivererInfo: act.delivererInfo,
          signatureTimestamp: act.signatureTimestamp,
          verificationHash: act.verificationHash,
        },
      })
    }

    return NextResponse.json({
      isValid: false,
      message: 'El hash de verificación no coincide. El acta puede haber sido alterada.',
      act: { folio: act.folio, status: act.status },
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/return-acts/[id]/verify:', error)
    return NextResponse.json(
      { isValid: false, message: 'Error al verificar acta' },
      { status: 500 }
    )
  }
}
