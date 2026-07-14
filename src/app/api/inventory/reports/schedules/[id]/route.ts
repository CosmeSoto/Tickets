import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { runSavedReportById } from '@/lib/inventory/reports/run-saved-report'
import { InventoryScheduledReportService } from '@/lib/services/inventory-scheduled-report.service'
import { updateInventoryScheduledReportSchema } from '@/lib/validations/inventory-scheduled-report'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
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
    return NextResponse.json(schedule)
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Error al obtener programación' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    await resolveReportScope(session.user)

    const body = updateInventoryScheduledReportSchema.parse(await request.json())
    const schedule = await InventoryScheduledReportService.update(id, session.user.id, body)
    if (!schedule) {
      return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 })
    }
    return NextResponse.json(schedule)
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al actualizar programación' }, { status: 500 })
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

    const deleted = await InventoryScheduledReportService.delete(id, session.user.id)
    if (!deleted) {
      return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Error al eliminar programación' }, { status: 500 })
  }
}
