import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'

/**
 * DELETE /api/inventory/equipment/[id]/permanent
 * Elimina permanentemente un equipo.
 * SOLO Super Admin puede ejecutar esta acción.
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

    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    // Solo Super Admin puede eliminar permanentemente
    if (session.user.role !== 'ADMIN' || !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede eliminar equipos permanentemente' },
        { status: 403 }
      )
    }

    const { id } = await params

    // SuperAdmin puede omitir el check de estado RETIRED (skipStatusCheck = true)
    await EquipmentService.permanentDeleteEquipment(id, session.user.id, true)

    return NextResponse.json({ message: 'Equipo eliminado permanentemente' })
  } catch (error) {
    console.error('Error en DELETE permanent:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al eliminar equipo' }, { status: 500 })
  }
}
