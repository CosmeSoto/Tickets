import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import {
  ReportResponse,
  formatDate,
  daysUntil,
  getAccessibleFamilyIds,
  toCSV,
  generateReportPDF,
} from '@/lib/inventory/report-utils'

interface ExpiringRow {
  tipo: string
  nombre: string
  codigo: string
  familia: string
  fechaVencimiento: string
  diasRestantes: number
  urgencia: string
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
    const days = parseInt(searchParams.get('days') || '90', 10)
    const familyId = searchParams.get('familyId') || undefined
    const format = searchParams.get('format') || undefined

    const accessibleFamilyIds = await getAccessibleFamilyIds(user.id, user.role)

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

    const now = new Date()
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const rows: ExpiringRow[] = []

    // ── Licencias/Contratos ───────────────────────────────────────────────────
    const licenseWhere: Record<string, unknown> = {
      expirationDate: { gte: now, lte: cutoff },
    }
    if (familyFilter) {
      licenseWhere.licenseType = { familyId: { in: familyFilter } }
    }

    const licenses = await prisma.software_licenses.findMany({
      where: licenseWhere,
      select: {
        id: true,
        name: true,
        expirationDate: true,
        licenseType: {
          select: { family: { select: { name: true } } },
        },
      },
    })

    for (const lic of licenses) {
      const dias = daysUntil(lic.expirationDate) ?? 0
      rows.push({
        tipo: 'Licencia/Contrato',
        nombre: lic.name,
        codigo: lic.id.slice(0, 8).toUpperCase(),
        familia: lic.licenseType?.family?.name ?? '—',
        fechaVencimiento: formatDate(lic.expirationDate),
        diasRestantes: dias,
        urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
      })
    }

    // ── Materiales MRO ────────────────────────────────────────────────────────
    const consumableWhere: Record<string, unknown> = {
      expirationDate: { gte: now, lte: cutoff },
      status: { notIn: ['EXPIRED', 'RETIRED'] },
    }
    if (familyFilter) {
      consumableWhere.consumableType = { familyId: { in: familyFilter } }
    }

    const consumables = await prisma.consumables.findMany({
      where: consumableWhere,
      include: {
        consumableType: {
          select: { family: { select: { name: true } } },
        },
      },
    })

    for (const c of consumables) {
      const dias = daysUntil(c.expirationDate) ?? 0
      rows.push({
        tipo: 'Material MRO',
        nombre: c.name,
        codigo: c.id.slice(0, 8).toUpperCase(),
        familia: c.consumableType?.family?.name ?? '—',
        fechaVencimiento: formatDate(c.expirationDate),
        diasRestantes: dias,
        urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
      })
    }

    // ── Garantías de equipos ──────────────────────────────────────────────────
    const warrantyWhere: Record<string, unknown> = {
      warrantyExpiration: { gte: now, lte: cutoff },
      status: { not: 'RETIRED' },
    }
    if (familyFilter) {
      warrantyWhere.type = { familyId: { in: familyFilter } }
    }

    const equipmentWarranty = await prisma.equipment.findMany({
      where: warrantyWhere,
      select: {
        id: true,
        code: true,
        brand: true,
        model: true,
        warrantyExpiration: true,
        type: {
          select: { family: { select: { name: true } } },
        },
      },
    })

    for (const eq of equipmentWarranty) {
      const dias = daysUntil(eq.warrantyExpiration) ?? 0
      rows.push({
        tipo: 'Garantía de Equipo',
        nombre: `${eq.brand} ${eq.model}`,
        codigo: eq.code,
        familia: eq.type?.family?.name ?? '—',
        fechaVencimiento: formatDate(eq.warrantyExpiration),
        diasRestantes: dias,
        urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
      })
    }

    // ── Contratos de renta ────────────────────────────────────────────────────
    const rentalWhere: Record<string, unknown> = {
      rentalEndDate: { gte: now, lte: cutoff },
      ownershipType: 'RENTAL',
      status: { not: 'RETIRED' },
    }
    if (familyFilter) {
      rentalWhere.type = { familyId: { in: familyFilter } }
    }

    const rentalEquipment = await prisma.equipment.findMany({
      where: rentalWhere,
      select: {
        id: true,
        code: true,
        brand: true,
        model: true,
        rentalEndDate: true,
        type: {
          select: { family: { select: { name: true } } },
        },
      },
    })

    for (const eq of rentalEquipment) {
      const dias = daysUntil(eq.rentalEndDate) ?? 0
      rows.push({
        tipo: 'Contrato de Renta',
        nombre: `${eq.brand} ${eq.model}`,
        codigo: eq.code,
        familia: eq.type?.family?.name ?? '—',
        fechaVencimiento: formatDate(eq.rentalEndDate),
        diasRestantes: dias,
        urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
      })
    }

    // Ordenar por días restantes ASC (más urgente primero)
    rows.sort((a, b) => a.diasRestantes - b.diasRestantes)

    // ── Indicadores ejecutivos ────────────────────────────────────────────────
    const criticos = rows.filter((r) => r.urgencia === 'Crítico').length
    const altos = rows.filter((r) => r.urgencia === 'Alto').length
    const vencenEsteMes = rows.filter((r) => r.diasRestantes <= 30).length

    const summary = [
      {
        title: 'Activos próximos a vencer',
        value: rows.length,
        description: `En los próximos ${days} días`,
      },
      {
        title: 'Vencimientos críticos',
        value: criticos,
        description: 'Vencen en 7 días o menos — requieren atención inmediata',
      },
      {
        title: 'Vencen este mes',
        value: vencenEsteMes,
        description: `${altos} con prioridad alta (8-30 días)`,
      },
    ]

    const filters: Record<string, unknown> = {
      days,
      familyId: familyId ?? null,
    }

    const response: ReportResponse<ExpiringRow> = {
      summary,
      data: rows,
      filters,
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    if (format === 'csv') {
      const csvRows = rows.map((r) => ({
        Tipo: r.tipo,
        Nombre: r.nombre,
        Código: r.codigo,
        Familia: r.familia,
        'Fecha Vencimiento': r.fechaVencimiento,
        'Días Restantes': r.diasRestantes,
        Urgencia: r.urgencia,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-vencimientos.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Tipo', 'Nombre', 'Código', 'Familia', 'Fecha Vencimiento', 'Días', 'Urgencia']
      const pdfRows = rows.map((r) => [
        r.tipo,
        r.nombre,
        r.codigo,
        r.familia,
        r.fechaVencimiento,
        String(r.diasRestantes),
        r.urgencia,
      ])
      const pdfBuffer = await generateReportPDF('¿Qué está por vencer?', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-vencimientos.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/expiring:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
