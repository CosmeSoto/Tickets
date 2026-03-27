import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseService } from '@/lib/services/license.service'
import { updateLicenseSchema, assignLicenseSchema } from '@/lib/validations/inventory/license'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { getRenewalAlertStatus } from '@/lib/inventory/renewal-alert'

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

    // Fetch supplier, licenseScope, contractType and family separately
    const licenseWithExtra = await prisma.software_licenses.findUnique({
      where: { id },
      select: {
        supplier: { select: { id: true, name: true, taxId: true } },
        licenseScope: true,
        contractType: true,
        licenseType: { include: { family: true } },
      },
    })

    const renewalAlertStatus = getRenewalAlertStatus(
      (license as any).renewalDate ? new Date((license as any).renewalDate) : null
    )

    return NextResponse.json({
      ...license,
      supplier: licenseWithExtra?.supplier ?? null,
      licenseScope: licenseWithExtra?.licenseScope ?? null,
      contractType: licenseWithExtra?.contractType ?? null,
      licenseType: licenseWithExtra?.licenseType ?? null,
      renewalAlertStatus,
    })
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
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const { id } = await params
    const body = await request.json()
    const { supplierId, renewalCost, renewalDate, invoiceNumber, purchaseOrderNumber, licenseScope, contractType, ...rest } = body

    // Validar renewalCost
    if (renewalCost !== undefined && renewalCost !== null && renewalCost < 0) {
      return NextResponse.json({ error: 'El costo de renovación no puede ser negativo' }, { status: 400 })
    }

    // Validar supplierId
    if (supplierId !== undefined && supplierId !== null) {
      const supplierExists = await prisma.suppliers.findUnique({ where: { id: supplierId }, select: { id: true } })
      if (!supplierExists) {
        return NextResponse.json({ error: 'El proveedor especificado no existe' }, { status: 400 })
      }
    }

    // Validar XOR para licenseScope INDIVIDUAL
    if (licenseScope === 'INDIVIDUAL') {
      const assignedToEquipment = rest.assignedToEquipment ?? body.assignedToEquipment ?? null
      const assignedToUser = rest.assignedToUser ?? body.assignedToUser ?? null
      const hasEquipment = assignedToEquipment != null
      const hasUser = assignedToUser != null

      if (!hasEquipment && !hasUser) {
        return NextResponse.json(
          { error: 'Una licencia individual debe estar asignada a un equipo o usuario' },
          { status: 422 }
        )
      }
      if (hasEquipment && hasUser) {
        return NextResponse.json(
          { error: 'Una licencia individual no puede estar asignada a equipo y usuario simultáneamente' },
          { status: 422 }
        )
      }
    }

    const validatedData = updateLicenseSchema.parse(rest)
    const updatePayload: any = { ...validatedData }
    if (supplierId !== undefined) updatePayload.supplierId = supplierId
    if (renewalCost !== undefined) updatePayload.renewalCost = renewalCost
    if (renewalDate !== undefined) updatePayload.renewalDate = renewalDate
    if (invoiceNumber !== undefined) updatePayload.invoiceNumber = invoiceNumber
    if (purchaseOrderNumber !== undefined) updatePayload.purchaseOrderNumber = purchaseOrderNumber
    if (licenseScope !== undefined) updatePayload.licenseScope = licenseScope
    if (contractType !== undefined) updatePayload.contractType = contractType

    const license = await LicenseService.updateLicense(id, updatePayload, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { updatedFields: Object.keys(updatePayload) },
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
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
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
