import { randomUUID } from 'crypto'
import { PrismaClient, EquipmentCondition, EquipmentStatus } from '@prisma/client'
import { FolioService } from './folio.service'
import { DigitalSignatureService } from './digital-signature.service'
import { PDFGeneratorService } from './pdf-generator.service'
import type { ReturnAct, UserInfo, CreateReturnActData } from '@/types/inventory/return-act'

const prisma = new PrismaClient()

/**
 * Servicio para gestión de actas de devolución
 */
export class ReturnActService {
  /**
   * Genera el PDF de un acta de devolución con lógica de reintentos
   * @private
   */
  private static async generatePDFWithRetry(actId: string, maxRetries: number = 3): Promise<string | null> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Generando PDF para acta de devolución ${actId}, intento ${attempt}/${maxRetries}`)
        const pdfPath = await PDFGeneratorService.generateReturnActPDF(actId)
        console.log(`PDF generado exitosamente: ${pdfPath}`)
        return pdfPath
      } catch (error) {
        lastError = error as Error
        console.error(`Error en intento ${attempt}/${maxRetries} generando PDF:`, error)
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }
    
    console.error(`Falló la generación de PDF después de ${maxRetries} intentos:`, lastError)
    return null
  }

  /**
   * Genera un acta de devolución para una asignación
   */
  static async generateReturnAct(data: CreateReturnActData): Promise<ReturnAct> {
    try {
      // Obtener asignación con relaciones
      const assignment = await (prisma.equipment_assignments.findUnique as any)({
        where: { id: data.assignmentId },
        include: {
          equipment: true,
          receiver: true,
          deliverer: true,
          deliveryAct: true,
        }
      })

      if (!assignment) {
        throw new Error('Asignación no encontrada')
      }

      if (!assignment.isActive) {
        throw new Error('La asignación no está activa')
      }

      if (!assignment.deliveryAct || (assignment.deliveryAct as any).status !== 'ACCEPTED') {
        throw new Error('La asignación no tiene un acta de entrega aceptada')
      }

      // Generar folio único
      const folio = await FolioService.generateReturnActFolio()

      // Generar token de aceptación
      const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()

      // Fecha de expiración: 7 días desde ahora
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 7)

      // Fecha de devolución (por defecto hoy)
      const returnDate = data.returnDate || new Date()

      // Crear snapshot del equipo
      const equipmentSnapshot = {
        id: assignment.equipment.id,
        code: assignment.equipment.code,
        serialNumber: assignment.equipment.serialNumber,
        brand: assignment.equipment.brand,
        model: assignment.equipment.model,
        type: (assignment.equipment as any).type,
        condition: data.returnCondition,
        specifications: assignment.equipment.specifications,
      }

      // Crear info del receiver (quien devuelve - era el receiver en la entrega)
      const receiverInfo: UserInfo = {
        id: assignment.receiver.id,
        name: assignment.receiver.name,
        email: assignment.receiver.email,
        role: assignment.receiver.role,
        department: (assignment.receiver as any).departments?.name,
      }

      // Crear info del deliverer (quien recibe la devolución - era el deliverer en la entrega)
      const delivererInfo: UserInfo = {
        id: assignment.deliverer.id,
        name: assignment.deliverer.name,
        email: assignment.deliverer.email,
        role: assignment.deliverer.role,
        department: (assignment.deliverer as any).departments?.name,
      }

      // Crear acta de devolución
      const act = await (prisma.return_acts.create as any)({
        data: {
          folio,
          assignmentId: data.assignmentId,
          deliveryActId: (assignment.deliveryAct as any).id,
          equipmentSnapshot,
          receiverInfo,
          delivererInfo,
          returnDate,
          returnCondition: data.returnCondition,
          inspectionNotes: data.inspectionNotes,
          missingAccessories: data.missingAccessories || [],
          damageDescription: data.damageDescription,
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
          },
          deliveryAct: true,
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'CREATE',
          entityType: 'return_act',
          entityId: act.id,
          userId: assignment.receiverId,
          details: {
            folio,
            assignmentId: data.assignmentId,
            returnCondition: data.returnCondition,
          }
        }
      })

      console.log(`Acta de devolución ${folio} creada exitosamente`)
      return act as ReturnAct
    } catch (error) {
      console.error('Error generando acta de devolución:', error)
      throw error
    }
  }

  /**
   * Obtiene un acta de devolución por ID
   */
  static async getActById(id: string): Promise<ReturnAct | null> {
    try {
      const act = await (prisma.return_acts.findUnique as any)({
        where: { id },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          },
          deliveryAct: true,
        }
      })

      return act as ReturnAct | null
    } catch (error) {
      console.error('Error obteniendo acta de devolución:', error)
      throw error
    }
  }

  /**
   * Obtiene un acta de devolución por token
   */
  static async getActByToken(token: string): Promise<ReturnAct | null> {
    try {
      const act = await (prisma.return_acts.findUnique as any)({
        where: { acceptanceToken: token },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          },
          deliveryAct: true,
        }
      })

      return act as ReturnAct | null
    } catch (error) {
      console.error('Error obteniendo acta de devolución por token:', error)
      throw error
    }
  }

  /**
   * Acepta un acta de devolución
   * Completa la asignación y actualiza el estado del equipo
   */
  static async acceptAct(
    actId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<ReturnAct> {
    try {
      const act = await this.getActById(actId)

      if (!act) {
        throw new Error('Acta de devolución no encontrada')
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
        (act as any).receiverInfo?.id ?? '',
        (act as any).delivererInfo?.id ?? '',
        ipAddress,
        userAgent
      )

      // Determinar nuevo estado del equipo basado en la condición
      let newEquipmentStatus: EquipmentStatus
      let newEquipmentCondition: EquipmentCondition

      switch ((act as any).returnCondition) {
        case 'DAMAGED':
          newEquipmentStatus = 'DAMAGED'
          newEquipmentCondition = 'POOR'
          break
        case 'POOR':
          newEquipmentStatus = 'MAINTENANCE'
          newEquipmentCondition = 'POOR'
          break
        case 'FAIR':
          newEquipmentStatus = 'AVAILABLE'
          newEquipmentCondition = 'FAIR'
          break
        case 'GOOD':
          newEquipmentStatus = 'AVAILABLE'
          newEquipmentCondition = 'GOOD'
          break
        case 'EXCELLENT':
          newEquipmentStatus = 'AVAILABLE'
          newEquipmentCondition = 'GOOD' as EquipmentCondition
          break
        default:
          newEquipmentStatus = 'AVAILABLE'
          newEquipmentCondition = 'GOOD'
      }

      // Actualizar acta, asignación y equipo en transacción
      const updated = await prisma.$transaction(async (tx) => {
        // Actualizar acta
        const updatedAct = await (tx.return_acts.update as any)({
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
            },
            deliveryAct: true,
          }
        })

        // Completar asignación
        await tx.equipment_assignments.update({
          where: { id: act.assignmentId },
          data: {
            isActive: false,
            actualEndDate: act.returnDate,
          }
        })

        // Actualizar estado y condición del equipo
        await tx.equipment.update({
          where: { id: (act as any).assignment.equipmentId },
          data: {
            status: newEquipmentStatus,
            condition: newEquipmentCondition,
          }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'ACCEPTED',
            entityType: 'return_act',
            entityId: actId,
            userId: (act as any).delivererInfo?.id ?? (act as any).delivererId ?? '',
            details: {
              folio: act.folio,
              signatureHash: signature.hash,
              ipAddress: signature.ipAddress,
              newEquipmentStatus,
              newEquipmentCondition,
            }
          }
        })

        return updatedAct
      })

      // Generar PDF automáticamente (con reintentos)
      this.generatePDFWithRetry(actId, 3).catch(error => {
        console.error('Error generando PDF después de aceptación:', error)
      })

      console.log(`Acta de devolución ${act.folio} aceptada exitosamente`)
      return updated as ReturnAct
    } catch (error) {
      console.error('Error aceptando acta de devolución:', error)
      throw error
    }
  }

  /**
   * Rechaza un acta de devolución
   */
  static async rejectAct(
    actId: string,
    reason: string,
    userId: string
  ): Promise<ReturnAct> {
    try {
      const act = await this.getActById(actId)

      if (!act) {
        throw new Error('Acta de devolución no encontrada')
      }

      if (act.status !== 'PENDING') {
        throw new Error('El acta no está pendiente de aceptación')
      }

      // Actualizar acta
      const updated = await (prisma.return_acts.update as any)({
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
          },
          deliveryAct: true,
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'REJECTED',
          entityType: 'return_act',
          entityId: actId,
          userId: userId,
          details: {
            folio: act.folio,
            reason,
          }
        }
      })

      console.log(`Acta de devolución ${act.folio} rechazada`)
      return updated as ReturnAct
    } catch (error) {
      console.error('Error rechazando acta de devolución:', error)
      throw error
    }
  }

  /**
   * Verifica si un acta está expirada
   */
  static isActExpired(act: ReturnAct): boolean {
    if (act.status !== 'PENDING') {
      return false
    }
    return new Date() > new Date(act.expirationDate)
  }

  /**
   * Verifica la autenticidad de un acta usando el hash
   */
  static verifyActAuthenticity(act: ReturnAct): boolean {
    if (!act.verificationHash || !act.signatureTimestamp || !act.signatureIp || !act.signatureUserAgent) {
      return false
    }

    return DigitalSignatureService.verifyHash(act.verificationHash, {
      actId: act.id,
      folio: act.folio,
      receiverId: (act.receiverInfo as any)?.id ?? '',
      delivererId: (act.delivererInfo as any)?.id ?? '',
      timestamp: new Date(act.signatureTimestamp),
      ipAddress: act.signatureIp,
      userAgent: act.signatureUserAgent,
    })
  }
}
