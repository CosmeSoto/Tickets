import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryDepartmentService } from '@/lib/services/inventory-department.service'

/**
 * GET /api/inventory/managers/[managerId]/scope
 * Retorna el scope de gestión de un gestor de inventario.
 * Cualquier usuario autenticado puede consultar el scope.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ managerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { managerId } = await params

    const scope = await InventoryDepartmentService.getManagerScope(managerId)

    return NextResponse.json({ success: true, data: scope }, { status: 200 })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener el scope del gestor' },
      { status: 500 }
    )
  }
}
