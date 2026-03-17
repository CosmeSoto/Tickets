import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseService } from '@/lib/services/license.service'
import { updateLicenseSchema, assignLicenseSchema } from '@/lib/validations/inventory/license'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * GET /api/inventory/licenses/[id]
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
    const license = await LicenseService.getLicenseById(id, session.user.role)
    if (!license) {
      return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 })
    }

    return NextResponse.json(license)
  } catch (error) {
    console.error('Error en GET /api/inventory/licenses/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener licencia' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/licenses/[id]
 */
export async function PUT(
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
    const validatedData = updateLicenseSchema.parse(body)
    const license = await LicenseService.updateLicense(id, validatedData, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { updatedFields: Object.keys(validatedData) },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de licencia:', err))

    return NextResponse.json(license)
  } catch (error) {
    console.error('Error en PUT /api/inventory/licenses/[id]:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al actualizar licencia' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory/licenses/[id]
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
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo ADMIN puede eliminar licencias' }, { status: 403 })
    }

    const { id } = await params
    const existing = await LicenseService.getLicenseById(id, 'ADMIN')
    await LicenseService.deleteLicense(id, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing?.name, typeId: existing?.typeId },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando eliminación de licencia:', err))

    return NextResponse.json({ message: 'Licencia eliminada exitosamente' })
  } catch (error) {
    console.error('Error en DELETE /api/inventory/licenses/[id]:', error)
    return NextResponse.json({ error: 'Error al eliminar licencia' }, { status: 500 })
  }
}

/**
 * PATCH /api/inventory/licenses/[id]
 * Asignar/desasignar licencia
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

    if (body.action === 'unassign') {
      const license = await LicenseService.unassignLicense(id, session.user.id)

      await AuditServiceComplete.log({
        action: AuditActionsComplete.LICENSE_UNASSIGNED,
        entityType: 'inventory',
        entityId: id,
        userId: session.user.id,
        details: { name: license.name },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(err => console.error('[AUDIT] Error registrando desasignación:', err))

      return NextResponse.json(license)
    }

    const validatedData = assignLicenseSchema.parse(body)
    const license = await LicenseService.assignLicense(id, {
      assignedToEquipment: validatedData.assignedToEquipment || undefined,
      assignedToUser: validatedData.assignedToUser || undefined,
      assignedToDepartment: validatedData.assignedToDepartment || undefined,
    }, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_ASSIGNED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: {
        name: license.name,
        assignedToEquipment: validatedData.assignedToEquipment,
        assignedToUser: validatedData.assignedToUser,
        assignedToDepartment: validatedData.assignedToDepartment,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando asignación:', err))

    return NextResponse.json(license)
  } catch (error) {
    console.error('Error en PATCH /api/inventory/licenses/[id]:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al asignar licencia' }, { status: 500 })
  }
}
