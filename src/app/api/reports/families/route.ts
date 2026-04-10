import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReportService } from '@/lib/services/report.service'
import prisma from '@/lib/prisma'

// GET /api/reports/families — Resumen ejecutivo comparativo de todas las familias
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'executive'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const granularity = (searchParams.get('granularity') ?? 'month') as 'day' | 'week' | 'month'

    const dateRange =
      startDate || endDate
        ? {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
          }
        : undefined

    // Determinar scope: super admin ve todo, admin restringido solo sus familias
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    let familyScope: string = 'all'
    if (!currentUser?.isSuperAdmin) {
      const assignments = await prisma.admin_family_assignments.findMany({
        where: { adminId: session.user.id, isActive: true },
        select: { familyId: true },
      })
      if (assignments.length > 0) {
        // Pasar la primera familia asignada como scope (el ReportService filtrará)
        // Para "all" con restricción, usamos el primer ID y el servicio maneja el array
        familyScope = assignments.map((a) => a.familyId).join(',')
      }
    }

    let data: unknown
    switch (type) {
      case 'technicians':
        data = await ReportService.getTechnicianPerformance(familyScope, dateRange)
        break
      case 'trends':
        data = await ReportService.getTemporalTrends(familyScope, granularity, dateRange)
        break
      case 'sla':
        data = await ReportService.getSLACompliance(familyScope, dateRange)
        break
      case 'satisfaction':
        data = await ReportService.getSatisfactionReport(familyScope, dateRange)
        break
      default:
        data = await ReportService.getExecutiveSummary(familyScope, dateRange)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GET /api/reports/families]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener reporte de familias' },
      { status: 500 }
    )
  }
}
