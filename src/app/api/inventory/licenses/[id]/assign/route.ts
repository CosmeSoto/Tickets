import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { LicenseAssignmentService } from '@/lib/services/license-assignment.service'
import { LicenseDeliveryActService } from '@/lib/services/license-delivery-act.service'
import { InventoryNotificationService } from '@/lib/services/inventory-notification.service'
import { assignLicenseScopeSchema } from '@/lib/validations/inventory/license-assignment'
import {
  assertInventoryResourceManage,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { ZodError } from 'zod'

/**
 * POST /api/inventory/licenses/[id]/assign
 * Asigna la licencia (usuario/equipo/departamento/empresa) y, si el receptor es un
 * usuario concreto, genera acta de entrega — igual que equipos y contratos.
 * body: { action: 'unassign' } para quitar la asignación, o { scope, userId?, ... }.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id: licenseId } = await params

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'LICENSE', licenseId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()

    if (body.action === 'unassign') {
      await LicenseAssignmentService.closeAssignment(licenseId, session.user.id)
      await AuditServiceComplete.log({
        action: AuditActionsComplete.LICENSE_UNASSIGNED,
        entityType: 'inventory',
        entityId: licenseId,
        userId: session.user.id,
        details: {},
        ipAddress:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(() => {})
      return NextResponse.json({ ok: true })
    }

    const validated = assignLicenseScopeSchema.parse(body)

    let result
    try {
      result = await LicenseAssignmentService.createAssignment(
        licenseId,
        {
          scope: validated.scope,
          userId: validated.userId,
          departmentId: validated.departmentId,
          equipmentId: validated.equipmentId,
          changeReason: validated.changeReason,
          notes: validated.notes,
        },
        session.user.id
      )
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Error al asignar' },
        { status: 400 }
      )
    }

    const { assignment } = result
    let deliveryAct = null
    let acceptanceUrl: string | null = null

    // Solo hay a quién entregarle un acta cuando el receptor es un usuario concreto —
    // departamento/equipo/empresa quedan registrados en el historial sin acta.
    if (validated.scope === 'INDIVIDUAL' && validated.userId) {
      try {
        const license = await prisma.software_licenses.findUnique({
          where: { id: licenseId },
          select: { licenseType: { select: { familyId: true } } },
        })
        const familyConfig = license?.licenseType?.familyId
          ? await prisma.inventory_family_config.findUnique({
              where: { familyId: license.licenseType.familyId },
              select: { requireDeliveryAct: true },
            })
          : null

        if (familyConfig?.requireDeliveryAct !== false) {
          deliveryAct = await LicenseDeliveryActService.generateDeliveryAct(assignment.id)
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          acceptanceUrl = `${baseUrl}/acts/${deliveryAct.id}/accept?token=${deliveryAct.acceptanceToken}`
          InventoryNotificationService.sendActCreatedNotification(deliveryAct.id).catch(err =>
            console.error('Error enviando notificación de acta de licencia:', err)
          )
        }
      } catch (actError) {
        await LicenseAssignmentService.rollbackAssignment(assignment.id).catch(err =>
          console.error('[licenses/assign] Error en rollback:', err)
        )
        throw actError
      }
    }

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_ASSIGNED,
      entityType: 'inventory',
      entityId: licenseId,
      userId: session.user.id,
      details: {
        scope: validated.scope,
        userId: validated.userId,
        departmentId: validated.departmentId,
        equipmentId: validated.equipmentId,
      },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(() => {})

    return NextResponse.json({ assignment, deliveryAct, acceptanceUrl }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/inventory/licenses/[id]/assign]', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al asignar licencia' }, { status: 500 })
  }
}
