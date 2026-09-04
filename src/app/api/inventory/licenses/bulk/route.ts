/**
 * POST /api/inventory/licenses/bulk
 *
 * Crea varias licencias en una sola operación, cada una con su propio tipo
 * (plan) y colaborador asignado — a diferencia de /api/inventory/equipment/bulk,
 * que crea unidades idénticas. Ver bulk-license.service.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import { bulkLicenseInputSchema } from '@/lib/validations/bulk-license'
import { createBulkLicenses } from '@/lib/services/bulk-license.service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar inventario' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = bulkLicenseInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const result = await createBulkLicenses(parsed.data, session.user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error en alta masiva de licencias:', error)
    return NextResponse.json(
      {
        error: 'Error al crear licencias por lote',
        message: error?.message || 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
