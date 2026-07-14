import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { InventorySavedReportService } from '@/lib/services/inventory-saved-report.service'
import { reorderPinnedSavedReportsSchema } from '@/lib/validations/inventory-saved-report'

/**
 * PATCH /api/inventory/reports/saved/reorder
 * Body: { ids: string[] } — orden completo de reportes anclados del usuario
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    await resolveReportScope(session.user)

    const body = reorderPinnedSavedReportsSchema.parse(await request.json())
    const ok = await InventorySavedReportService.reorderPinned(session.user.id, body.ids)
    if (!ok) {
      return NextResponse.json(
        { error: 'Lista de reportes anclados inválida' },
        { status: 400 }
      )
    }

    const savedReports = await InventorySavedReportService.listByUser(session.user.id, {
      pinned: true,
    })
    return NextResponse.json({ savedReports })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('Error en PATCH /api/inventory/reports/saved/reorder:', error)
    return NextResponse.json({ error: 'Error al reordenar reportes anclados' }, { status: 500 })
  }
}
