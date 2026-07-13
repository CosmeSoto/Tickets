import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'

const EMPTY_SUMMARY = {
  total: 0,
  available: 0,
  assigned: 0,
  maintenance: 0,
  damaged: 0,
  retired: 0,
  byType: {},
  byCondition: {},
  totalValue: 0,
}

/**
 * GET /api/inventory/equipment/summary
 * Obtiene resumen de equipos para el dashboard
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const ctx = await getInventorySessionContext(session.user)
    if (ctx.scope.noAccess) {
      return NextResponse.json(EMPTY_SUMMARY, { status: 200 })
    }

    const familyIds = ctx.user.isSuperAdmin ? undefined : ctx.scope.familyIds
    const summary = await EquipmentService.getEquipmentSummary(familyIds)

    return NextResponse.json(summary, { status: 200 })
  } catch (error) {
    console.error('Error en GET /api/inventory/equipment/summary:', error)

    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    return NextResponse.json(
      {
        error: 'Error al obtener resumen de equipos',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}
