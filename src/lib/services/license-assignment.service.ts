import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { LicenseScope } from '@prisma/client'

const ASSIGNMENT_INCLUDE = {
  license: { select: { id: true, name: true, typeId: true } },
  receiver: { select: { id: true, name: true, email: true, role: true } },
  deliverer: { select: { id: true, name: true, email: true, role: true } },
  department: { select: { id: true, name: true } },
  equipment: { select: { id: true, code: true, brand: true } },
  deliveryAct: { select: { id: true, folio: true, status: true, acceptanceToken: true } },
} as const

export interface CreateLicenseAssignmentInput {
  scope: LicenseScope
  userId?: string | null
  departmentId?: string | null
  equipmentId?: string | null
  changeReason?: string | null
  notes?: string | null
}

/**
 * Historial de asignaciones de licencia — mismo patrón transaccional que
 * ContractAssignmentService (cerrar la activa, crear la nueva, audit log, todo en una
 * transacción), adaptado a que el receptor puede ser un usuario, un equipo o un
 * departamento completo según LicenseScope.
 */
export class LicenseAssignmentService {
  static async listByLicense(licenseId: string) {
    return prisma.license_assignments.findMany({
      where: { licenseId },
      orderBy: { startDate: 'desc' },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  static async getActive(licenseId: string) {
    return prisma.license_assignments.findFirst({
      where: { licenseId, isActive: true },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  /** Revierte una asignación recién creada si falla la generación del acta. */
  static async rollbackAssignment(assignmentId: string): Promise<void> {
    await prisma.$transaction(async tx => {
      await tx.delivery_acts.deleteMany({ where: { licenseAssignmentId: assignmentId } })
      await tx.license_assignments.delete({ where: { id: assignmentId } })
    })
  }

  static async createAssignment(
    licenseId: string,
    data: CreateLicenseAssignmentInput,
    delivererId: string
  ) {
    const license = await prisma.software_licenses.findUnique({
      where: { id: licenseId },
      select: { id: true },
    })
    if (!license) throw new Error('Licencia no encontrada')

    const userId = data.scope === 'INDIVIDUAL' ? data.userId || null : null
    const equipmentId = data.scope === 'INDIVIDUAL' ? data.equipmentId || null : null
    const departmentId = data.scope === 'DEPARTMENT' ? data.departmentId || null : null

    if (data.scope === 'INDIVIDUAL' && !userId && !equipmentId) {
      throw new Error('Asigna un usuario o un equipo')
    }
    if (data.scope === 'INDIVIDUAL' && userId && equipmentId) {
      throw new Error('Una licencia individual no puede ir a usuario y equipo a la vez')
    }
    if (data.scope === 'DEPARTMENT' && !departmentId) {
      throw new Error('Selecciona un departamento')
    }

    let receiverName: string | null = null
    if (userId) {
      const receiver = await prisma.users.findUnique({
        where: { id: userId },
        select: { name: true },
      })
      if (!receiver) throw new Error('Usuario receptor no encontrado')
      receiverName = receiver.name
    }
    if (equipmentId) {
      const eq = await prisma.equipment.findUnique({
        where: { id: equipmentId },
        select: { id: true },
      })
      if (!eq) throw new Error('Equipo receptor no encontrado')
    }
    if (departmentId) {
      const dept = await prisma.departments.findUnique({
        where: { id: departmentId },
        select: { id: true },
      })
      if (!dept) throw new Error('Departamento no encontrado')
    }

    const active = await prisma.license_assignments.findFirst({
      where: { licenseId, isActive: true },
    })

    if (
      active &&
      active.scope === data.scope &&
      active.receiverUserId === userId &&
      active.departmentId === departmentId &&
      active.equipmentId === equipmentId
    ) {
      throw new Error('La licencia ya está asignada a este destino')
    }

    const startDate = new Date()

    const assignment = await prisma.$transaction(async tx => {
      if (active) {
        await tx.license_assignments.update({
          where: { id: active.id },
          data: {
            isActive: false,
            actualEndDate: startDate,
            changeReason: data.changeReason || active.changeReason,
          },
        })
      }

      const created = await tx.license_assignments.create({
        data: {
          id: randomUUID(),
          licenseId,
          delivererId,
          scope: data.scope,
          receiverUserId: userId,
          departmentId,
          equipmentId,
          startDate,
          isActive: true,
          changeReason: data.changeReason || null,
          observations: data.notes || null,
        },
        include: ASSIGNMENT_INCLUDE,
      })

      await tx.software_licenses.update({
        where: { id: licenseId },
        data: {
          licenseScope: data.scope,
          assignedToUser: userId,
          assignedToDepartment: departmentId,
          assignedToEquipment: equipmentId,
        },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'LICENSE_ASSIGNMENT_CREATED',
          entityType: 'license',
          entityId: licenseId,
          userId: delivererId,
          details: {
            assignmentId: created.id,
            scope: data.scope,
            receiverId: userId,
            receiverName,
            departmentId,
            equipmentId,
            previousAssignmentId: active?.id ?? null,
          },
        },
      })

      return created
    })

    return { assignment, previousAssignmentId: active?.id ?? null }
  }

  /** Desasigna la licencia (alcance EMPRESA) — cierra el historial activo sin crear acta. */
  static async closeAssignment(licenseId: string, userId: string): Promise<void> {
    const active = await prisma.license_assignments.findFirst({
      where: { licenseId, isActive: true },
    })

    await prisma.$transaction(async tx => {
      if (active) {
        await tx.license_assignments.update({
          where: { id: active.id },
          data: { isActive: false, actualEndDate: new Date() },
        })
      }

      await tx.software_licenses.update({
        where: { id: licenseId },
        data: { assignedToUser: null, assignedToEquipment: null, assignedToDepartment: null },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'LICENSE_UNASSIGNED',
          entityType: 'license',
          entityId: licenseId,
          userId,
          details: { previousAssignmentId: active?.id ?? null },
        },
      })
    })
  }
}
