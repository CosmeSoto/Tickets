import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { AssignContractInput } from '@/lib/validations/contract-assignment'

const ASSIGNMENT_INCLUDE = {
  contract: {
    select: {
      id: true,
      name: true,
      contractNumber: true,
      category: true,
      familyId: true,
      status: true,
    },
  },
  client: { select: { id: true, name: true, email: true, role: true } },
  deliverer: { select: { id: true, name: true, email: true, role: true } },
  family: { select: { id: true, name: true, color: true, code: true } },
  deliveryAct: { select: { id: true, folio: true, status: true, acceptanceToken: true } },
  returnAct: { select: { id: true, folio: true, status: true, acceptanceToken: true } },
} as const

export class ContractAssignmentService {
  static async listByContract(contractId: string) {
    return prisma.contract_assignments.findMany({
      where: { contractId },
      orderBy: { startDate: 'desc' },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  static async getActive(contractId: string) {
    return prisma.contract_assignments.findFirst({
      where: { contractId, isActive: true },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  static async getById(id: string) {
    return prisma.contract_assignments.findUnique({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  /**
   * Revierte asignación recién creada si falla el acta de entrega.
   */
  static async rollbackAssignment(assignmentId: string): Promise<void> {
    await prisma.$transaction(async tx => {
      await tx.delivery_acts.deleteMany({ where: { contractAssignmentId: assignmentId } })
      await tx.contract_assignments.delete({ where: { id: assignmentId } })
    })
  }

  /**
   * Revierte un cambio de cliente si falla la generación de actas posteriores.
   */
  static async rollbackFailedAssign(params: {
    newAssignmentId: string
    previousAssignmentId?: string | null
    returnActId?: string | null
  }): Promise<void> {
    const { newAssignmentId, previousAssignmentId, returnActId } = params
    await prisma.$transaction(async tx => {
      if (returnActId) {
        await tx.contract_return_acts.deleteMany({ where: { id: returnActId } })
      }
      await tx.delivery_acts.deleteMany({ where: { contractAssignmentId: newAssignmentId } })
      await tx.contract_assignments.delete({ where: { id: newAssignmentId } })
      if (previousAssignmentId) {
        await tx.contract_assignments.update({
          where: { id: previousAssignmentId },
          data: { isActive: true, actualEndDate: null },
        })
      }
    })
  }

  static async createAssignment(
    contractId: string,
    data: AssignContractInput,
    delivererId: string
  ) {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: { id: true, familyId: true, name: true, status: true },
    })
    if (!contract) throw new Error('Contrato no encontrado')
    if (!contract.familyId) {
      throw new Error('El contrato debe tener un área asignada antes de vincular un cliente')
    }

    const client = await prisma.users.findUnique({
      where: { id: data.clientId },
      select: { id: true, name: true, role: true, isActive: true },
    })
    if (!client || !client.isActive) throw new Error('Cliente no encontrado o inactivo')
    if (client.role !== 'CLIENT') {
      throw new Error('Solo se pueden asignar usuarios con rol Cliente')
    }

    const familyAccess = await prisma.client_family_assignments.findFirst({
      where: {
        clientId: data.clientId,
        familyId: contract.familyId,
        isActive: true,
      },
    })
    if (!familyAccess) {
      throw new Error('El cliente no tiene acceso al área de este contrato')
    }

    const active = await prisma.contract_assignments.findFirst({
      where: { contractId, isActive: true },
      include: { deliveryAct: true, client: { select: { id: true, name: true } } },
    })

    if (active?.clientId === data.clientId) {
      throw new Error('Este cliente ya tiene la asignación activa del contrato')
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date()
    const plannedEndDate = data.plannedEndDate ? new Date(data.plannedEndDate) : null

    return prisma.$transaction(async tx => {
      let previousAssignmentId: string | null = null

      if (active) {
        if (!active.deliveryAct || active.deliveryAct.status !== 'ACCEPTED') {
          throw new Error(
            'No se puede cambiar de cliente hasta que el acta de entrega vigente esté aceptada'
          )
        }
        previousAssignmentId = active.id
        await tx.contract_assignments.update({
          where: { id: active.id },
          data: {
            isActive: false,
            actualEndDate: startDate,
            changeReason: data.changeReason || 'Cambio de cliente',
          },
        })
      }

      const assignment = await tx.contract_assignments.create({
        data: {
          id: randomUUID(),
          contractId,
          clientId: data.clientId,
          delivererId,
          familyId: contract.familyId!,
          startDate,
          plannedEndDate,
          isActive: true,
          changeReason: data.changeReason || null,
          notes: data.notes || null,
        },
        include: ASSIGNMENT_INCLUDE,
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'CONTRACT_ASSIGNMENT_CREATED',
          entityType: 'contract',
          entityId: contractId,
          userId: delivererId,
          details: {
            assignmentId: assignment.id,
            clientId: data.clientId,
            clientName: client.name,
            previousAssignmentId,
            changeReason: data.changeReason ?? null,
          },
        },
      })

      return { assignment, previousAssignmentId }
    })
  }

  static async closeAssignment(assignmentId: string, actualEndDate?: Date) {
    return prisma.contract_assignments.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        actualEndDate: actualEndDate ?? new Date(),
      },
      include: ASSIGNMENT_INCLUDE,
    })
  }
}
