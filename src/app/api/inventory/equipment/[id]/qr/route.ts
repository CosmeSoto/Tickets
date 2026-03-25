import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { QRCodeService } from '@/lib/services/qr-code.service'
import { equipmentIdSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'

/**
 * GET /api/inventory/equipment/[id]/qr
 * Obtiene el código QR de un equipo.
 * Usa el host del request para que la URL del QR funcione en cualquier red
 * (localhost, IP local, dominio de producción).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

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

    // Detectar el base URL desde el request para que funcione en cualquier red
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${proto}://${host}`

    // Generar QR code con la URL correcta para esta red
    const qrCode = await QRCodeService.generateEquipmentQR(
      equipment.id,
      equipment.code,
      baseUrl
    )

    return NextResponse.json({
      qrCode,
      equipmentCode: equipment.code,
      equipmentId: equipment.id,
      verifyUrl: `${baseUrl}/inventory/equipment/${equipment.id}/verify`,
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
