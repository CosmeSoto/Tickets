import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReportService } from '@/lib/services/report.service'
import prisma from '@/lib/prisma'

// GET /api/reports/families/[id]?type=executive|technicians|trends|sla&granularity=day|week|month&startDate=&endDate=
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
    const { searchParams } = new URL(request.url)

    // Verificar scope: si no es super admin, debe tener acceso a esta familia
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      const assignment = await prisma.admin_family_assignments.findFirst({
        where: { adminId: session.user.id, familyId: id, isActive: true },
      })
      // Si tiene asignaciones pero no incluye esta familia, denegar
      const totalAssignments = await prisma.admin_family_assignments.count({
        where: { adminId: session.user.id, isActive: true },
      })
      if (totalAssignments > 0 && !assignment) {
        return NextResponse.json({ success: false, message: 'No tienes acceso a esta familia' }, { status: 403 })
      }
    }

    const type = searchParams.get('type') ?? 'executive'
    const granularity = (searchParams.get('granularity') ?? 'month') as 'day' | 'week' | 'month'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateRange =
      startDate || endDate
        ? {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
          }
        : undefined

    let data: unknown

    switch (type) {
      case 'executive':
        data = await ReportService.getExecutiveSummary(id, dateRange)
        break
      case 'technicians':
        data = await ReportService.getTechnicianPerformance(id, dateRange)
        break
      case 'trends':
        data = await ReportService.getTemporalTrends(id, granularity, dateRange)
        break
      case 'sla':
        data = await ReportService.getSLACompliance(id, dateRange)
        break
      case 'satisfaction':
        data = await ReportService.getSatisfactionReport(id, dateRange)
        break
      default:
        return NextResponse.json(
          {
            success: false,
            message: 'Tipo de reporte inválido. Use: executive, technicians, trends, sla, satisfaction',
          },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GET /api/reports/families/[id]]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener reporte' },
      { status: 500 }
    )
  }
}
