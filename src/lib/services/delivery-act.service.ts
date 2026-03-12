import { PrismaClient } from '@prisma/client'
import { FolioService } from './folio.service'
import { DigitalSignatureService } from './digital-signature.service'
import type { DeliveryAct, UserInfo } from '@/types/inventory/delivery-act'

const prisma = new PrismaClient()

/**
 * Servicio para gestión de actas de entrega digitales
 */
export class DeliveryActService {
  /**
   * Genera un acta de entrega para una asignación
   * Se llama automáticamente al crear una asignación
   */
  static async generateDeliveryAct(assignmentId: string): Promise<DeliveryAct> {
    try {
      // Obtener asignación con relaciones
      const assignment = await prisma.equipment_assignments.findUnique({
        where: { id: assignmentId },
        include: {
          equipment: true,
          receiver: {
            include: {
              departments: true
            }
          },
          deliverer: {
            include: {
              departments: true
            }
          }
        }
      })

      if (!assignment) {
        throw new Error('Asignación no encontrada')
      }

      // Generar folio único
      const folio = await FolioService.generateDeliveryActFolio()

      // Generar token de aceptación
      const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()

      // Fecha de expiración: 7 días desde ahora
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 7)

      // Crear snapshot del equipo
      const equipmentSnapshot = {
        id: assignment.equipment.id,
        code: assignment.equipment.code,
        serialNumber: assignment.equipment.serialNumber,
        brand: assignment.equipment.brand,
        model: assignment.equipment.model,
        type: assignment.equipment.type,
        condition: assignment.equipment.condition,
        specifications: assignment.equipment.specifications,
      }

      // Crear info del deliverer
      const delivererInfo: UserInfo = {
        id: assignment.deliverer.id,
        name: assignment.deliverer.name,
        email: assignment.deliverer.email,
        role: assignment.deliverer.role,
        department: assignment.deliverer.departments?.name,
      }

      // Crear info del receiver
      const receiverInfo: UserInfo = {
        id: assignment.receiver.id,
        name: assignment.receiver.name,
        email: assignment.receiver.email,
        role: assignment.receiver.role,
        department: assignment.receiver.departments?.name,
      }

      // Crear acta
      const act = await prisma.delivery_acts.create({
        data: {
          folio,
          assignmentId,
          equipmentSnapshot,
          delivererInfo,
          receiverInfo,
          accessories: assignment.accessories,
          observations: assignment.observations,
          termsVersion: '1.0',
          status: 'PENDING',
          acceptanceToken,
          expirationDate,
        },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          }
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'CREATE',
          entityType: 'delivery_act',
          entityId: act.id,
          userId: assignment.delivererId,
          details: {
            folio,
            assignmentId,
            receiverId: assignment.receiverId,
          }
        }
      })

      return act as DeliveryAct
    } catch (error) {
      console.error('Error generando acta de entrega:', error)
      throw error
    }
  }

  /**
   * Obtiene un acta por ID
   */
  static async getActById(id: string): Promise<DeliveryAct | null> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          }
        }
      })

      return act as DeliveryAct | null
    } catch (error) {
      console.error('Error obteniendo acta:', error)
      throw error
    }
  }

  /**
   * Obtiene un acta por token de aceptación
   */
  static async getActByToken(token: string): Promise<DeliveryAct | null> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { acceptanceToken: token },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          }
        }
      })

      return act as DeliveryAct | null
    } catch (error) {
      console.error('Error obteniendo acta por token:', error)
      throw error
    }
  }

  /**
   * Acepta un acta de entrega
   * Registra firma digital con timestamp, IP y user agent
   */
  static async acceptAct(
    actId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<DeliveryAct> {
    try {
      const act = await this.getActById(actId)

      if (!act) {
        throw new Error('Acta no encontrada')
      }

      if (act.status !== 'PENDING') {
        throw new Error('El acta no está pendiente de aceptación')
      }

      // Verificar que no esté expirada
      if (new Date() > new Date(act.expirationDate)) {
        throw new Error('El acta ha expirado')
      }

      // Crear firma digital
      const signature = DigitalSignatureService.createDigitalSignature(
        act.id,
        act.folio,
        act.receiverInfo.id,
        act.delivererInfo.id,
        ipAddress,
        userAgent
      )

      // Actualizar acta
      const updated = await prisma.delivery_acts.update({
        where: { id: actId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: signature.timestamp,
          signatureTimestamp: signature.timestamp,
          signatureIp: signature.ipAddress,
          signatureUserAgent: signature.userAgent,
          verificationHash: signature.hash,
        },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          }
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'ACCEPTED',
          entityType: 'delivery_act',
          entityId: actId,
          userId: act.receiverInfo.id,
          details: {
            folio: act.folio,
            signatureHash: signature.hash,
            ipAddress: signature.ipAddress,
          }
        }
      })

      return updated as DeliveryAct
    } catch (error) {
      console.error('Error aceptando acta:', error)
      throw error
    }
  }

  /**
   * Rechaza un acta de entrega
   * Cancela la asignación asociada
   */
  static async rejectAct(
    actId: string,
    reason: string,
    userId: string
  ): Promise<DeliveryAct> {
    try {
      const act = await this.getActById(actId)

      if (!act) {
        throw new Error('Acta no encontrada')
      }

      if (act.status !== 'PENDING') {
        throw new Error('El acta no está pendiente de aceptación')
      }

      // Actualizar acta y cancelar asignación en transacción
      const updated = await prisma.$transaction(async (tx) => {
        // Actualizar acta
        const updatedAct = await tx.delivery_acts.update({
          where: { id: actId },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason: reason,
          },
          include: {
            assignment: {
              include: {
                equipment: true,
                receiver: true,
                deliverer: true,
              }
            }
          }
        })

        // Marcar asignación como inactiva
        await tx.equipment_assignments.update({
          where: { id: act.assignmentId },
          data: {
            isActive: false,
            actualEndDate: new Date(),
          }
        })

        // Restaurar estado del equipo a AVAILABLE
        await tx.equipment.update({
          where: { id: act.assignment.equipmentId },
          data: { status: 'AVAILABLE' }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            action: 'REJECTED',
            entityType: 'delivery_act',
            entityId: actId,
            userId: userId,
            details: {
              folio: act.folio,
              reason,
            }
          }
        })

        return updatedAct
      })

      return updated as DeliveryAct
    } catch (error) {
      console.error('Error rechazando acta:', error)
      throw error
    }
  }

  /**
   * Verifica si un acta está expirada
   */
  static isActExpired(act: DeliveryAct): boolean {
    if (act.status !== 'PENDING') {
      return false
    }
    return new Date() > new Date(act.expirationDate)
  }

  /**
   * Marca actas expiradas como EXPIRED
   * Se ejecuta mediante cron job
   */
  static async markExpiredActs(): Promise<number> {
    try {
      const result = await prisma.delivery_acts.updateMany({
        where: {
          status: 'PENDING',
          expirationDate: {
            lt: new Date()
          }
        },
        data: {
          status: 'EXPIRED'
        }
      })

      return result.count
    } catch (error) {
      console.error('Error marcando actas expiradas:', error)
      throw error
    }
  }

  /**
   * Obtiene actas pendientes próximas a expirar
   * Para enviar recordatorios
   */
  static async getActsExpiringIn(days: number): Promise<DeliveryAct[]> {
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + days)

      const acts = await prisma.delivery_acts.findMany({
        where: {
          status: 'PENDING',
          expirationDate: {
            lte: targetDate,
            gte: new Date()
          }
        },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          }
        }
      })

      return acts as DeliveryAct[]
    } catch (error) {
      console.error('Error obteniendo actas próximas a expirar:', error)
      throw error
    }
  }

  /**
   * Verifica la autenticidad de un acta usando el hash
   */
  static verifyActAuthenticity(act: DeliveryAct): boolean {
    if (!act.verificationHash || !act.signatureTimestamp || !act.signatureIp || !act.signatureUserAgent) {
      return false
    }

    return DigitalSignatureService.verifyHash(act.verificationHash, {
      actId: act.id,
      folio: act.folio,
      receiverId: act.receiverInfo.id,
      delivererId: act.delivererInfo.id,
      timestamp: new Date(act.signatureTimestamp),
      ipAddress: act.signatureIp,
      userAgent: act.signatureUserAgent,
    })
  }
}
