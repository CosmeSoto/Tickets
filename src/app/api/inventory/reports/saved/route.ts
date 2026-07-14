import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { assertSavedReportConfigAccess } from '@/lib/inventory/reports/saved-report-access'
import { InventorySavedReportService } from '@/lib/services/inventory-saved-report.service'
import { createInventorySavedReportSchema } from '@/lib/validations/inventory-saved-report'
import type { SavedReportKind } from '@prisma/client'

/**
 * GET /api/inventory/reports/saved?kind=DATASET
 * POST /api/inventory/reports/saved
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    await resolveReportScope(session.user)

    const kindParam = request.nextUrl.searchParams.get('kind')
    const pinnedParam = request.nextUrl.searchParams.get('pinned')
    const kind =
      kindParam === 'DATASET' || kindParam === 'TEMPLATE'
        ? (kindParam as SavedReportKind)
        : undefined
    const pinned =
      pinnedParam === 'true' ? true : pinnedParam === 'false' ? false : undefined

    const savedReports = await InventorySavedReportService.listByUser(session.user.id, {
      kind,
      pinned,
    })
    return NextResponse.json({ savedReports })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Error en GET /api/inventory/reports/saved:', error)
    return NextResponse.json({ error: 'Error al listar reportes guardados' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = createInventorySavedReportSchema.parse(await request.json())
    await assertSavedReportConfigAccess(
      session.user,
      body.kind,
      body.targetId,
      body.familyId
    )

    const savedReport = await InventorySavedReportService.create(session.user.id, body)
    return NextResponse.json(savedReport, { status: 201 })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('Error en POST /api/inventory/reports/saved:', error)
    return NextResponse.json({ error: 'Error al guardar reporte' }, { status: 500 })
  }
}
