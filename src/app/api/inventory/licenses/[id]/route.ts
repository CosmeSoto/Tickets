import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseService } from '@/lib/services/license.service'
import { updateLicenseSchema } from '@/lib/validations/inventory/license'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import {
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  assertResourceTypeChangeAllowed,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import prisma from '@/lib/prisma'
import { getRenewalAlertStatus } from '@/lib/inventory/renewal-alert'
import { getSetting } from '@/lib/api-cache'
import {
  getLinkedBusinessContractIdForLicense,
  syncLicenseContractLink,
  mapLicenseScope,
} from '@/lib/inventory/license-contract'
import { withAttributeLabels } from '@/lib/inventory/attribute-labels'
import { isValidInvoiceNumber, INVOICE_NUMBER_ERROR } from '@/lib/inventory/invoice-number'

/**
 * GET /api/inventory/licenses/[id]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'LICENSE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

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
        licenseType: { include: { family: true, attributes: true } },
      },
    })

    // Etiqueta legible de cada atributo personalizado, resuelta contra el catálogo del
    // tipo de licencia (misma fuente que equipo/suministro — ver attribute-labels.ts).
    const customValuesWithLabels = withAttributeLabels(
      (license as any).customValues,
      licenseWithExtra?.licenseType?.attributes
    )

    const warningDaysRaw = await getSetting('inventory.license_alert_days_first', 600, '30')
    const warningDays = Math.max(1, parseInt(warningDaysRaw ?? '30', 10) || 30)
    const renewalAlertStatus = getRenewalAlertStatus(
      (license as any).renewalDate ? new Date((license as any).renewalDate) : null,
      warningDays
    )

    const linkedContractId = await getLinkedBusinessContractIdForLicense(id)

    return NextResponse.json({
      ...license,
      customValues: customValuesWithLabels,
      supplier: licenseWithExtra?.supplier ?? null,
      licenseScope: licenseWithExtra?.licenseScope ?? null,
      contractType: licenseWithExtra?.contractType ?? null,
      licenseType: licenseWithExtra?.licenseType ?? null,
      renewalAlertStatus,
      linkedContractId,
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/licenses/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener licencia' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/licenses/[id]
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id } = await params

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'LICENSE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()
    const {
      supplierId,
      renewalCost,
      renewalDate,
      invoiceNumber,
      purchaseOrderNumber,
      licenseScope,
      contractType,
      contractId,
      scope,
      licenseTypeId,
      customValues,
      ...rest
    } = body

    // invoiceNumber/purchaseOrderNumber quedan fuera de `rest` (van directo al
    // updatePayload más abajo), así que updateLicenseSchema.parse nunca los ve.
    if (!isValidInvoiceNumber(invoiceNumber) || !isValidInvoiceNumber(purchaseOrderNumber)) {
      return NextResponse.json({ error: INVOICE_NUMBER_ERROR }, { status: 400 })
    }

    // Validar renewalCost
    if (renewalCost !== undefined && renewalCost !== null && renewalCost < 0) {
      return NextResponse.json(
        { error: 'El costo de renovación no puede ser negativo' },
        { status: 400 }
      )
    }

    // Validar supplierId
    if (supplierId !== undefined && supplierId !== null) {
      const supplierExists = await prisma.suppliers.findUnique({
        where: { id: supplierId },
        select: { id: true },
      })
      if (!supplierExists) {
        return NextResponse.json({ error: 'El proveedor especificado no existe' }, { status: 400 })
      }
    }

    const existingAssign = await prisma.software_licenses.findUnique({
      where: { id },
      select: {
        assignedToUser: true,
        assignedToEquipment: true,
        assignedToDepartment: true,
        licenseScope: true,
      },
    })

    const nextScope =
      (scope !== undefined ? mapLicenseScope(scope) : undefined) ??
      (licenseScope !== undefined ? String(licenseScope) : undefined) ??
      existingAssign?.licenseScope ??
      null

    // Solo validar conflicto XOR si el body toca asignación (no bloquear editar datos)
    const touchesAssign =
      body.assignedToUser !== undefined ||
      body.assignedToEquipment !== undefined ||
      body.assignedToDepartment !== undefined

    if (touchesAssign && nextScope === 'INDIVIDUAL') {
      const nextEquipment =
        body.assignedToEquipment !== undefined
          ? body.assignedToEquipment
          : existingAssign?.assignedToEquipment
      const nextUser =
        body.assignedToUser !== undefined ? body.assignedToUser : existingAssign?.assignedToUser
      const hasEquipment = nextEquipment != null && nextEquipment !== ''
      const hasUser = nextUser != null && nextUser !== ''
      if (hasEquipment && hasUser) {
        return NextResponse.json(
          {
            error:
              'Una licencia individual no puede estar asignada a equipo y usuario simultáneamente',
          },
          { status: 422 }
        )
      }
    }

    // Si se reasigna el tipo (y por tanto la familia), validar permiso en la
    // familia DESTINO — assertInventoryResourceManage de arriba solo cubrió
    // la familia actual de la licencia.
    if (licenseTypeId) {
      try {
        await assertResourceTypeChangeAllowed(
          toInventoryAccessUser(session.user),
          'LICENSE',
          licenseTypeId
        )
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    const validatedData = updateLicenseSchema.parse(rest)
    const updatePayload: any = { ...validatedData }
    if (licenseTypeId !== undefined) updatePayload.typeId = licenseTypeId
    if (scope !== undefined) updatePayload.licenseScope = mapLicenseScope(scope)
    if (supplierId !== undefined) updatePayload.supplierId = supplierId
    if (renewalCost !== undefined) updatePayload.renewalCost = renewalCost
    if (renewalDate !== undefined) updatePayload.renewalDate = renewalDate
    if (invoiceNumber !== undefined) updatePayload.invoiceNumber = invoiceNumber
    if (purchaseOrderNumber !== undefined) updatePayload.purchaseOrderNumber = purchaseOrderNumber
    if (licenseScope !== undefined) updatePayload.licenseScope = licenseScope
    if (contractType !== undefined) updatePayload.contractType = contractType
    if (customValues !== undefined) {
      updatePayload.customValues = customValues.length > 0 ? customValues : null
    }

    // No vaciar asignación al editar campos generales sin enviar asignatarios
    if (!touchesAssign) {
      delete updatePayload.assignedToUser
      delete updatePayload.assignedToEquipment
      delete updatePayload.assignedToDepartment
    }

    const license = await LicenseService.updateLicense(id, updatePayload, session.user.id)

    if (contractId !== undefined) {
      await syncLicenseContractLink(id, contractId || null, license.name)
    }

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { updatedFields: Object.keys(updatePayload) },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de licencia:', err))

    return NextResponse.json(license)
  } catch (error) {
    console.error('Error en PUT /api/inventory/licenses/[id]:', error)
    if (error instanceof ZodError) {
      const first = error.errors[0]
      const field = first?.path?.join('.') || undefined
      const message = first?.message
        ? field
          ? `${first.message} (${field})`
          : first.message
        : 'Datos inválidos'
      return NextResponse.json({ error: message, field, details: error.errors }, { status: 400 })
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
    const { id } = await params

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'LICENSE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const existing = await LicenseService.getLicenseById(id, 'ADMIN')
    await LicenseService.deleteLicense(id, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing?.name, typeId: existing?.typeId },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
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
 * Cerrar contrato (isActive: false). Asignar/desasignar responsable vive en
 * /api/inventory/licenses/[id]/assign — deja historial (license_assignments) y
 * genera acta de entrega cuando corresponde, algo que este endpoint no hacía.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id } = await params

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'LICENSE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }
    const body = await request.json()

    // Cerrar contrato: marcar como vencido
    if (body.isActive === false) {
      const existing = await prisma.software_licenses.findUnique({
        where: { id },
        select: { id: true, name: true },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
      }
      const closed = await prisma.software_licenses.update({
        where: { id },
        data: { expirationDate: new Date() },
      })
      await AuditServiceComplete.log({
        action: AuditActionsComplete.LICENSE_UPDATED,
        entityType: 'inventory',
        entityId: id,
        userId: session.user.id,
        details: { action: 'CONTRACT_CLOSED', name: existing.name },
        ipAddress:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(() => {})
      return NextResponse.json(closed)
    }

    return NextResponse.json(
      { error: 'Usa POST /api/inventory/licenses/[id]/assign para asignar o desasignar' },
      { status: 400 }
    )
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
