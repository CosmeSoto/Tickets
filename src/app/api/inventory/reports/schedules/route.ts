import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { InventoryScheduledReportService } from '@/lib/services/inventory-scheduled-report.service'
import { createInventoryScheduledReportSchema } from '@/lib/validations/inventory-scheduled-report'

/**
 * GET /api/inventory/reports/schedules
 * POST /api/inventory/reports/schedules
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    await resolveReportScope(session.user)
    const schedules = await InventoryScheduledReportService.listByUser(session.user.id)
    return NextResponse.json({ schedules })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('GET /api/inventory/reports/schedules:', error)
    return NextResponse.json({ error: 'Error al listar programaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    await resolveReportScope(session.user)
    const body = createInventoryScheduledReportSchema.parse(await request.json())
    const schedule = await InventoryScheduledReportService.create(session.user.id, body)
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.flatten() }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('POST /api/inventory/reports/schedules:', error)
    return NextResponse.json({ error: 'Error al crear programación' }, { status: 500 })
  }
}
