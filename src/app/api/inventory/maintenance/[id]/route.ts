import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'

/**
 * GET /api/inventory/maintenance/[id]
 * Obtiene detalle de un registro de mantenimiento
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const maintenance = await MaintenanceService.getById(id)

    if (!maintenance) {
      return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 })
    }

    return NextResponse.json(maintenance)
  } catch (error) {
    console.error('Error en GET /api/inventory/maintenance/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener mantenimiento' }, { status: 500 })
  }
}

/**
 * PATCH /api/inventory/maintenance/[id]
 * Reagenda o completa un mantenimiento
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, scheduledDate, description, cost, partsReplaced } = body

    if (action === 'reschedule') {
      if (!scheduledDate) {
        return NextResponse.json({ error: 'Fecha requerida para reagendar' }, { status: 400 })
      }
      const result = await MaintenanceService.reschedule(
        id,
        { scheduledDate: new Date(scheduledDate), description },
        session.user.id
      )
      return NextResponse.json(result)
    }

    if (action === 'complete') {
      const result = await MaintenanceService.completeMaintenance(
        id,
        { completedDate: new Date(), cost, partsReplaced },
        session.user.id
      )
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Acción no válida. Use: reschedule, complete' }, { status: 400 })
  } catch (error) {
    console.error('Error en PATCH /api/inventory/maintenance/[id]:', error)
    const message = error instanceof Error ? error.message : 'Error al actualizar mantenimiento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/**
 * DELETE /api/inventory/maintenance/[id]
 * Cancela y elimina un mantenimiento
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const { id } = await params
    await MaintenanceService.cancel(id, session.user.id)

    return NextResponse.json({ message: 'Mantenimiento cancelado y eliminado' })
  } catch (error) {
    console.error('Error en DELETE /api/inventory/maintenance/[id]:', error)
    const message = error instanceof Error ? error.message : 'Error al cancelar mantenimiento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
