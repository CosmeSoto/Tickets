import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'

/**
 * DELETE /api/inventory/equipment/[id]/permanent
 * Elimina permanentemente un equipo (solo ADMIN, solo si está RETIRED)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar equipos permanentemente' }, { status: 403 })
    }

    const { id } = await params

    await EquipmentService.permanentDeleteEquipment(id, session.user.id)

    return NextResponse.json({ message: 'Equipo eliminado permanentemente' })
  } catch (error) {
    console.error('Error en DELETE permanent:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al eliminar equipo' }, { status: 500 })
  }
}
