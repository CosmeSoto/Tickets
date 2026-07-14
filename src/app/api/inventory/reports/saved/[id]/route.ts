import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { assertSavedReportConfigAccess } from '@/lib/inventory/reports/saved-report-access'
import { InventorySavedReportService } from '@/lib/services/inventory-saved-report.service'
import { updateInventorySavedReportSchema } from '@/lib/validations/inventory-saved-report'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/inventory/reports/saved/[id]
 * PATCH /api/inventory/reports/saved/[id]
 * DELETE /api/inventory/reports/saved/[id]
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    await resolveReportScope(session.user)

    const savedReport = await InventorySavedReportService.getByIdForUser(id, session.user.id)
    if (!savedReport) {
      return NextResponse.json({ error: 'Reporte guardado no encontrado' }, { status: 404 })
    }

    return NextResponse.json(savedReport)
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Error en GET /api/inventory/reports/saved/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener reporte guardado' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    const existing = await InventorySavedReportService.getByIdForUser(id, session.user.id)
    if (!existing) {
      return NextResponse.json({ error: 'Reporte guardado no encontrado' }, { status: 404 })
    }

    const body = updateInventorySavedReportSchema.parse(await request.json())
    const nextKind = body.kind ?? existing.kind
    const nextTargetId = body.targetId ?? existing.targetId
    const nextFamilyId =
      body.familyId !== undefined ? body.familyId : existing.familyId

    await assertSavedReportConfigAccess(
      session.user,
      nextKind,
      nextTargetId,
      nextFamilyId
    )

    const savedReport = await InventorySavedReportService.update(id, session.user.id, body)
    return NextResponse.json(savedReport)
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('Error en PATCH /api/inventory/reports/saved/[id]:', error)
    return NextResponse.json({ error: 'Error al actualizar reporte guardado' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    await resolveReportScope(session.user)

    const deleted = await InventorySavedReportService.delete(id, session.user.id)
    if (!deleted) {
      return NextResponse.json({ error: 'Reporte guardado no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Error en DELETE /api/inventory/reports/saved/[id]:', error)
    return NextResponse.json({ error: 'Error al eliminar reporte guardado' }, { status: 500 })
  }
}
