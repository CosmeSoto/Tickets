import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { runSavedReportById } from '@/lib/inventory/reports/run-saved-report'
import { InventoryScheduledReportService } from '@/lib/services/inventory-scheduled-report.service'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/inventory/reports/schedules/[id]/run-now
 * Ejecuta ahora y devuelve preview (sin enviar email).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    await resolveReportScope(session.user)

    const schedule = await InventoryScheduledReportService.getByIdForUser(id, session.user.id)
    if (!schedule) {
      return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 })
    }

    const result = await runSavedReportById(schedule.savedReportId)
    if (!result) {
      return NextResponse.json({ error: 'No se pudo ejecutar el reporte' }, { status: 500 })
    }

    return NextResponse.json({
      preview: true,
      reportName: result.reportName,
      rowCount: result.rowCount,
      summary: result.summary,
      csvPreview: result.csv.slice(0, 2000),
    })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Error al ejecutar reporte' }, { status: 500 })
  }
}
