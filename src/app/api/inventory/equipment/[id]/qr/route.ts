import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { QRCodeService } from '@/lib/services/qr-code.service'
import { equipmentIdSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'

/**
 * GET /api/inventory/equipment/[id]/qr
 * Obtiene el código QR de un equipo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Validar ID
    const { id } = equipmentIdSchema.parse({ id: params.id })

    // Obtener equipo
    const equipment = await EquipmentService.getEquipmentById(id)

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }

    // Si es CLIENT, verificar que sea su equipo
    if (session.user.role === 'CLIENT') {
      const detail = await EquipmentService.getEquipmentDetail(id)
      const isAssignedToUser = detail.currentAssignment?.receiverId === session.user.id
      
      if (!isAssignedToUser) {
        return NextResponse.json(
          { error: 'No tienes acceso a este equipo' },
          { status: 403 }
        )
      }
    }

    // Generar QR code
    const qrCode = await QRCodeService.generateEquipmentQR(
      equipment.id,
      equipment.code
    )

    return NextResponse.json({
      qrCode,
      equipmentCode: equipment.code,
      equipmentId: equipment.id
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/equipment/[id]/qr:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'ID inválido', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al generar código QR' },
      { status: 500 }
    )
  }
}
