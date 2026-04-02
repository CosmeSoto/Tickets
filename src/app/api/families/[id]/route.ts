import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FamilyService } from '@/lib/services/family.service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

// GET /api/families/[id] — Detalle de familia con ambas configs
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
    const family = await FamilyService.findById(id)

    if (!family) {
      return NextResponse.json(
        { success: false, message: 'Familia no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: family })
  } catch (error) {
    console.error('[GET /api/families/[id]]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener familia' },
      { status: 500 }
    )
  }
}

// PUT /api/families/[id] — Actualiza datos base de la familia
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const existing = await FamilyService.findById(id)

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Familia no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, color, icon, order } = body

    const updated = await FamilyService.update(id, { name, description, color, icon, order })

    await AuditServiceComplete.log({
      action: 'FAMILY_UPDATED',
      entityType: 'settings',
      entityId: id,
      userId: session.user.id,
      details: { familyCode: existing.code, familyName: existing.name },
      oldValues: { name: existing.name, description: existing.description, color: existing.color },
      newValues: { name: updated.name, description: updated.description, color: updated.color },
      request,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Familia "${updated.name}" actualizada exitosamente`,
    })
  } catch (error) {
    console.error('[PUT /api/families/[id]]', error)
    return NextResponse.json(
      { success: false, message: 'Error al actualizar familia' },
      { status: 500 }
    )
  }
}

// DELETE /api/families/[id] — Elimina familia; 409 si hay registros asociados
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const existing = await FamilyService.findById(id)

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Familia no encontrada' },
        { status: 404 }
      )
    }

    try {
      await FamilyService.delete(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar'
      return NextResponse.json({ success: false, message }, { status: 409 })
    }

    await AuditServiceComplete.log({
      action: 'FAMILY_DELETED',
      entityType: 'settings',
      entityId: id,
      userId: session.user.id,
      details: { familyCode: existing.code, familyName: existing.name },
      request,
    })

    return NextResponse.json({
      success: true,
      message: `Familia "${existing.name}" eliminada exitosamente`,
    })
  } catch (error) {
    console.error('[DELETE /api/families/[id]]', error)
    return NextResponse.json(
      { success: false, message: 'Error al eliminar familia' },
      { status: 500 }
    )
  }
}
