import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FolioService } from './folio.service'
import { DigitalSignatureService } from './digital-signature.service'
import { buildActReceiverInfo } from '@/lib/inventory/general-delivery-act'
import { buildLicenseSnapshot } from '@/lib/inventory/license-snapshot'
import {
  addActExpirationDays,
  getInventoryActExpirationDays,
} from '@/lib/settings/runtime-settings'

/**
 * Genera el acta de entrega de una licencia asignada individualmente a un usuario.
 * Solo aplica cuando hay una persona concreta que firme el recibido (scope INDIVIDUAL
 * con receiverUserId) — asignaciones a departamento/equipo/empresa quedan solo en el
 * historial (license_assignments), sin acta, igual que no tendría sentido pedirle
 * firma de recibido a un departamento entero.
 */
export class LicenseDeliveryActService {
  static async generateDeliveryAct(licenseAssignmentId: string) {
    const assignment = await prisma.license_assignments.findUnique({
      where: { id: licenseAssignmentId },
      include: {
        license: true,
        receiver: { include: { departments: { select: { name: true } } } },
        deliverer: { include: { departments: { select: { name: true } } } },
      },
    })

    if (!assignment) throw new Error('Asignación de licencia no encontrada')
    if (!assignment.isActive) throw new Error('La asignación no está activa')
    if (!assignment.receiverUserId || !assignment.receiver) {
      throw new Error('El acta de entrega requiere un usuario receptor individual')
    }

    const existing = await prisma.delivery_acts.findUnique({
      where: { licenseAssignmentId },
    })
    if (existing) throw new Error('Esta asignación ya tiene un acta de entrega')

    const folio = await FolioService.generateDeliveryActFolio()
    const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()
    const actExpirationDays = await getInventoryActExpirationDays()
    const expirationDate = addActExpirationDays(new Date(), actExpirationDays)

    const receiverInfo = await buildActReceiverInfo(assignment.receiverUserId)
    const delivererInfo = {
      id: assignment.deliverer.id,
      name: assignment.deliverer.name,
      email: assignment.deliverer.email,
      role: assignment.deliverer.role,
      department: assignment.deliverer.departments?.name,
    }

    const equipmentSnapshot = await buildLicenseSnapshot(assignment.licenseId, {
      assignmentId: assignment.id,
      assignmentStartDate: assignment.startDate,
      changeReason: assignment.changeReason,
    })

    const act = await prisma.delivery_acts.create({
      data: {
        id: randomUUID(),
        folio,
        licenseAssignmentId,
        equipmentSnapshot: equipmentSnapshot as unknown as Prisma.InputJsonValue,
        delivererInfo: delivererInfo as unknown as Prisma.InputJsonValue,
        receiverInfo: receiverInfo as unknown as Prisma.InputJsonValue,
        accessories: [],
        observations: assignment.observations,
        actType: 'LICENSE_ASSIGNMENT',
        referenceId: assignment.licenseId,
        referenceType: 'license',
        status: 'PENDING',
        acceptanceToken,
        expirationDate,
      },
    })

    return act
  }
}
