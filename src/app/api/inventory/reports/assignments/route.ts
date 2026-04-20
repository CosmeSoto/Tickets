import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import {
  ReportResponse,
  EQUIPMENT_STATUS_ES,
  formatDate,
  getAccessibleFamilyIds,
  toCSV,
  generateReportPDF,
} from '@/lib/inventory/report-utils'

interface AssignmentRow {
  equipmentCode: string
  equipmentName: string
  familia: string
  estado: string
  usuarioAsignado: string
  departamento: string
  ubicacionFisica: string
  fechaAsignacion: string
  fechaFin: string
  tipoAsignacion: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const hasAccess = isAdmin || (await canManageInventory(user.id, user.role))
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes permiso para ver reportes' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const familyId = searchParams.get('familyId') || undefined
    const userId = searchParams.get('userId') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const format = searchParams.get('format') || undefined

    // Obtener familias accesibles
    const accessibleFamilyIds = await getAccessibleFamilyIds(user.id, user.role)

    // Construir filtro de familias
    let familyFilter: string[] | undefined
    if (accessibleFamilyIds !== null) {
      familyFilter = familyId
        ? accessibleFamilyIds.includes(familyId)
          ? [familyId]
          : []
        : accessibleFamilyIds
    } else if (familyId) {
      familyFilter = [familyId]
    }

    // Construir where para assignments
    const where: Record<string, unknown> = { isActive: true }

    if (userId) {
      where.receiverId = userId
    }

    if (dateFrom || dateTo) {
      where.startDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    }

    if (familyFilter) {
      where.equipment = { type: { familyId: { in: familyFilter } } }
    }

    const assignments = await (prisma.equipment_assignments.findMany as any)({
      where,
      include: {
        equipment: {
          select: {
            code: true,
            brand: true,
            model: true,
            status: true,
            physicalLocation: true,
            type: {
              select: {
                family: { select: { name: true } },
              },
            },
          },
        },
        receiver: {
          select: {
            name: true,
            departments: { select: { name: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    const rows: AssignmentRow[] = assignments.map((a: any) => ({
      equipmentCode: a.equipment.code,
      equipmentName: `${a.equipment.brand} ${a.equipment.model}`,
      familia: a.equipment.type?.family?.name ?? '—',
      estado: EQUIPMENT_STATUS_ES[a.equipment.status] ?? a.equipment.status,
      usuarioAsignado: a.receiver.name ?? '—',
      departamento: (a.receiver as any).departments?.name ?? '—',
      ubicacionFisica: (a.equipment as any).physicalLocation ?? '—',
      fechaAsignacion: formatDate(a.startDate),
      fechaFin: a.endDate ? formatDate(a.endDate) : 'Indefinida',
      tipoAsignacion: a.assignmentType === 'PERMANENT' ? 'Permanente' : a.assignmentType === 'TEMPORARY' ? 'Temporal' : 'Préstamo',
    }))

    // ── Indicadores ejecutivos ────────────────────────────────────────────────
    const totalAsignados = rows.length
    const uniqueUsers = new Set(assignments.map((a: any) => a.receiverId)).size
    const permanentes = assignments.filter((a: any) => a.assignmentType === 'PERMANENT').length

    const summary = [
      {
        title: 'Equipos asignados actualmente',
        value: totalAsignados,
        description: 'Asignaciones activas en este momento',
      },
      {
        title: 'Usuarios con equipos',
        value: uniqueUsers,
        description: 'Número de usuarios distintos con al menos un equipo asignado',
      },
      {
        title: 'Asignaciones permanentes',
        value: permanentes,
        description: `${permanentes} de ${totalAsignados} asignaciones son de tipo permanente`,
      },
    ]

    const filters: Record<string, unknown> = {
      familyId: familyId ?? null,
      userId: userId ?? null,
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
    }

    const response: ReportResponse<AssignmentRow> = {
      summary,
      data: rows,
      filters,
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    if (format === 'csv') {
      const csvRows = rows.map((r) => ({
        Código: r.equipmentCode,
        Equipo: r.equipmentName,
        Familia: r.familia,
        Estado: r.estado,
        'Usuario Asignado': r.usuarioAsignado,
        Departamento: r.departamento,
        'Ubicación Física': r.ubicacionFisica,
        'Fecha Asignación': r.fechaAsignacion,
        'Fecha Fin': r.fechaFin,
        'Tipo Asignación': r.tipoAsignacion,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-asignaciones.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Código', 'Equipo', 'Familia', 'Estado', 'Usuario', 'Fecha Asignación']
      const pdfRows = rows.map((r) => [
        r.equipmentCode,
        r.equipmentName,
        r.familia,
        r.estado,
        r.usuarioAsignado,
        r.fechaAsignacion,
      ])
      const pdfBuffer = await generateReportPDF('¿Quién tiene qué? — Asignaciones Activas', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-asignaciones.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/assignments:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
