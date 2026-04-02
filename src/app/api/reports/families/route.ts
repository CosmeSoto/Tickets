import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReportService } from '@/lib/services/report.service'

// GET /api/reports/families — Resumen ejecutivo comparativo de todas las familias
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateRange =
      startDate || endDate
        ? {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
          }
        : undefined

    const data = await ReportService.getExecutiveSummary('all', dateRange)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GET /api/reports/families]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener reporte de familias' },
      { status: 500 }
    )
  }
}
