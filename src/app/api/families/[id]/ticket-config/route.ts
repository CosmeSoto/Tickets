import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TicketFamilyConfigService } from '@/lib/services/ticket-family-config.service'

// GET /api/families/[id]/ticket-config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const config = await TicketFamilyConfigService.getByFamilyId(id)

    if (!config) {
      return NextResponse.json(
        { success: false, message: 'Configuración de tickets no encontrada para esta familia' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('[GET /api/families/[id]/ticket-config]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener configuración de tickets' },
      { status: 500 }
    )
  }
}

// PUT /api/families/[id]/ticket-config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const updated = await TicketFamilyConfigService.update(id, body, session.user.id)

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Configuración de tickets actualizada exitosamente',
    })
  } catch (error) {
    console.error('[PUT /api/families/[id]/ticket-config]', error)
    return NextResponse.json(
      { success: false, message: 'Error al actualizar configuración de tickets' },
      { status: 500 }
    )
  }
}
