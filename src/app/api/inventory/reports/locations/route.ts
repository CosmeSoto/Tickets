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

interface LocationRow {
  equipmentCode: string
  equipmentName: string
  familia: string
  estado: string
  ubicacionFisica: string
  bodega: string
  usuarioAsignado: string
  departamento: string
  fechaAsignacion: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { user } = session
    const hasAccess = user.role === 'ADMIN' || (await canManageInventory(user.id, user.role))
    if (!hasAccess) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const searchParams = request.nextUrl.searchParams
    const familyId = searchParams.get('familyId') || undefined
    const format = searchParams.get('format') || undefined
    const onlyWithLocation = searchParams.get('onlyWithLocation') === 'true'

    const accessibleFamilyIds = await getAccessibleFamilyIds(user.id, user.role)

    let familyFilter: string[] | undefined
    if (accessibleFamilyIds !== null) {
      familyFilter = familyId
        ? accessibleFamilyIds.includes(familyId) ? [familyId] : []
        : accessibleFamilyIds
    } else if (familyId) {
      familyFilter = [familyId]
    }

    const equipment = await (prisma.equipment.findMany as any)({
      where: {
        status: { not: 'RETIRED' },
        ...(familyFilter ? { type: { familyId: { in: familyFilter } } } : {}),
        ...(onlyWithLocation ? { physicalLocation: { not: null } } : {}),
      },
      select: {
        code: true,
        brand: true,
        model: true,
        status: true,
        physicalLocation: true,
        warehouse: { select: { name: true } },
        type: { select: { family: { select: { name: true } } } },
        assignments: {
          where: { isActive: true },
          take: 1,
          select: {
            startDate: true,
            receiver: {
              select: {
                name: true,
                departments: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ physicalLocation: 'asc' }, { code: 'asc' }],
    })

    const rows: LocationRow[] = equipment.map((e: any) => {
      const assignment = e.assignments[0]
      return {
        equipmentCode: e.code,
        equipmentName: `${e.brand} ${e.model}`,
        familia: e.type?.family?.name ?? '—',
        estado: EQUIPMENT_STATUS_ES[e.status] ?? e.status,
        ubicacionFisica: e.physicalLocation ?? '—',
        bodega: e.warehouse?.name ?? '—',
        usuarioAsignado: assignment?.receiver?.name ?? '—',
        departamento: (assignment?.receiver as any)?.departments?.name ?? '—',
        fechaAsignacion: assignment ? formatDate(assignment.startDate) : '—',
      }
    })

    // Agrupar por ubicación para el resumen
    const byLocation = rows.reduce<Record<string, number>>((acc, r) => {
      const loc = r.ubicacionFisica === '—' ? 'Sin ubicación registrada' : r.ubicacionFisica
      acc[loc] = (acc[loc] ?? 0) + 1
      return acc
    }, {})

    const topLocations = Object.entries(byLocation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([loc, count]) => `${loc} (${count})`)
      .join(', ')

    const conUbicacion = rows.filter(r => r.ubicacionFisica !== '—').length
    const sinUbicacion = rows.length - conUbicacion

    const summary = [
      {
        title: 'Total de equipos activos',
        value: rows.length,
        description: 'Equipos no retirados del inventario',
      },
      {
        title: 'Con ubicación registrada',
        value: conUbicacion,
        description: `${Math.round((conUbicacion / rows.length) * 100) || 0}% tienen ubicación física registrada`,
      },
      {
        title: 'Sin ubicación registrada',
        value: sinUbicacion,
        description: 'Equipos sin ubicación física definida',
      },
      {
        title: 'Ubicaciones más frecuentes',
        value: topLocations || '—',
        description: 'Top 5 ubicaciones con más equipos',
      },
    ]

    const response: ReportResponse<LocationRow> = {
      summary,
      data: rows,
      filters: { familyId: familyId ?? null, onlyWithLocation },
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    if (format === 'csv') {
      const csv = toCSV(rows.map(r => ({
        Código: r.equipmentCode,
        Equipo: r.equipmentName,
        Familia: r.familia,
        Estado: r.estado,
        'Ubicación Física': r.ubicacionFisica,
        Bodega: r.bodega,
        'Usuario Asignado': r.usuarioAsignado,
        Departamento: r.departamento,
        'Fecha Asignación': r.fechaAsignacion,
      })))
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-ubicaciones.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Código', 'Equipo', 'Familia', 'Estado', 'Ubicación Física', 'Usuario', 'Departamento']
      const pdfRows = rows.map(r => [
        r.equipmentCode, r.equipmentName, r.familia, r.estado,
        r.ubicacionFisica, r.usuarioAsignado, r.departamento,
      ])
      const pdfBuffer = await generateReportPDF('¿Dónde están los equipos?', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-ubicaciones.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/locations:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
