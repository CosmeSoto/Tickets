import { randomUUID } from 'crypto'
import { EquipmentCondition, EquipmentStatus, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { FolioService } from './folio.service'
import { DigitalSignatureService } from './digital-signature.service'
import { PDFGeneratorService } from './pdf-generator.service'
import type { ReturnAct, UserInfo, CreateReturnActData } from '@/types/inventory/return-act'
import {
  addActExpirationDays,
  getInventoryActExpirationDays,
} from '@/lib/settings/runtime-settings'

/**
 * Servicio para gestión de actas de devolución
 */
export class ReturnActService {
  /**
   * Genera el PDF de un acta de devolución con lógica de reintentos
   * @private
   */
  private static async generatePDFWithRetry(
    actId: string,
    maxRetries: number = 3
  ): Promise<string | null> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `Generando PDF para acta de devolución ${actId}, intento ${attempt}/${maxRetries}`
        )
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
      const assignment = await prisma.equipment_assignments.findUnique({
        where: { id: data.assignmentId },
        include: {
          equipment: {
            include: {
              model: { select: { model: true } },
              type: { select: { id: true, name: true } },
              department: {
                select: {
                  id: true,
                  name: true,
                  family: { select: { id: true, name: true } },
                },
              },
            },
          },
          receiver: { include: { departments: { select: { name: true } } } },
          deliverer: { include: { departments: { select: { name: true } } } },
          deliveryAct: true,
        },
      })

      if (!assignment) {
        throw new Error('Asignación no encontrada')
      }

      if (!assignment.isActive) {
        throw new Error('La asignación no está activa')
      }

      if (!assignment.deliveryAct || assignment.deliveryAct.status !== 'ACCEPTED') {
        throw new Error('La asignación no tiene un acta de entrega aceptada')
      }

      // Generar folio único
      const folio = await FolioService.generateReturnActFolio()

      // Generar token de aceptación
      const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()

      // Fecha de expiración según configuración global de inventario
      const actExpirationDays = await getInventoryActExpirationDays()
      const expirationDate = addActExpirationDays(new Date(), actExpirationDays)

      // Fecha de devolución (por defecto hoy)
      const returnDate = data.returnDate || new Date()

      const eq = assignment.equipment
      // Crear snapshot del equipo (sin undefined — Prisma Json no los acepta bien)
      const equipmentSnapshot = {
        id: eq.id,
        code: eq.code,
        serialNumber: eq.serialNumber,
        brand: eq.brand,
        model: eq.model?.model || eq.modelDeprecated,
        type: eq.typeId,
        typeName: eq.type?.name || '',
        condition: data.returnCondition,
        departmentId: eq.department?.id ?? null,
        departmentName: eq.department?.name ?? null,
        familyId: eq.department?.family?.id ?? null,
        familyName: eq.department?.family?.name ?? null,
      }

      // Crear info del receiver (quien devuelve - era el receiver en la entrega)
      const receiverInfo: UserInfo = {
        id: assignment.receiver.id,
        name: assignment.receiver.name,
        email: assignment.receiver.email,
        role: assignment.receiver.role,
        department: assignment.receiver.departments?.name,
      }

      // Crear info del deliverer (quien recibe la devolución - era el deliverer en la entrega)
      const delivererInfo: UserInfo = {
        id: assignment.deliverer.id,
        name: assignment.deliverer.name,
        email: assignment.deliverer.email,
        role: assignment.deliverer.role,
        department: assignment.deliverer.departments?.name,
      }

      // Crear acta de devolución
      const act = await prisma.return_acts.create({
        data: {
          folio,
          assignmentId: data.assignmentId,
          deliveryActId: assignment.deliveryAct.id,
          equipmentSnapshot: equipmentSnapshot as unknown as Prisma.InputJsonValue,
          receiverInfo: receiverInfo as unknown as Prisma.InputJsonValue,
          delivererInfo: delivererInfo as unknown as Prisma.InputJsonValue,
          returnDate,
          equipmentCondition: data.returnCondition,
          inspectionNotes: data.inspectionNotes ?? null,
          missingAccessories: data.missingAccessories || [],
          damageDescription: data.damageDescription ?? null,
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
            },
          },
          deliveryAct: true,
        },
      })

      // Registrar en auditoría (acta + equipo para historial del activo)
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
            equipmentId: assignment.equipmentId,
          },
        },
      })

      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'RETURN_PENDING',
          entityType: 'equipment',
          entityId: assignment.equipmentId,
          userId: assignment.delivererId,
          details: {
            folio,
            assignmentId: data.assignmentId,
            returnCondition: data.returnCondition,
            receiverName: assignment.receiver.name,
            delivererName: assignment.deliverer.name,
            description: `Acta de devolución ${folio} generada. Pendiente de firma para liberar a bodega.`,
          },
        },
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
      const act = await prisma.return_acts.findUnique({
        where: { id },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            },
          },
          deliveryAct: true,
        },
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
      const act = await prisma.return_acts.findUnique({
        where: { acceptanceToken: token },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            },
          },
          deliveryAct: true,
        },
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
  static async acceptAct(actId: string, ipAddress: string, userAgent: string): Promise<ReturnAct> {
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

      switch ((act as any).equipmentCondition) {
        case 'DAMAGED':
          newEquipmentStatus = 'DAMAGED'
          newEquipmentCondition = 'DAMAGED'
          break
        case 'NEW':
          newEquipmentStatus = 'AVAILABLE'
          newEquipmentCondition = 'NEW'
          break
        case 'USED':
        default:
          newEquipmentStatus = 'AVAILABLE'
          newEquipmentCondition = 'USED'
      }

      // Actualizar acta, asignación y equipo en transacción
      const updated = await prisma.$transaction(async tx => {
        // Actualizar acta
        const updatedAct = await tx.return_acts.update({
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
              },
            },
            deliveryAct: true,
          },
        })

        // Completar asignación
        await tx.equipment_assignments.update({
          where: { id: act.assignmentId },
          data: {
            isActive: false,
            actualEndDate: act.returnDate,
          },
        })

        // Actualizar estado y condición del equipo; liberar custodia de área (vuelve a bodega Compras)
        await tx.equipment.update({
          where: { id: (act as any).assignment.equipmentId },
          data: {
            status: newEquipmentStatus,
            condition: newEquipmentCondition,
            departmentId: null,
          },
        })

        // Registrar en auditoría (acta + equipo)
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
              equipmentId: (act as any).assignment.equipmentId,
            },
          },
        })

        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'RETURNED',
            entityType: 'equipment',
            entityId: (act as any).assignment.equipmentId,
            userId: (act as any).delivererInfo?.id ?? (act as any).delivererId ?? '',
            details: {
              folio: act.folio,
              assignmentId: act.assignmentId,
              actualEndDate: act.returnDate.toISOString(),
              newStatus: newEquipmentStatus,
              newCondition: newEquipmentCondition,
              receiverName: (act as any).receiverInfo?.name,
              departmentCleared: true,
              description: `Equipo devuelto a bodega (acta ${act.folio}). Estado: ${newEquipmentStatus}.`,
            },
          },
        })

        return updatedAct
      })

      // Notificar a las partes (no bloquea la respuesta)
      this.notifyReturnAccepted(updated as ReturnAct).catch(err => {
        console.error('Error notificando aceptación de devolución:', err)
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

  private static async notifyReturnAccepted(act: ReturnAct): Promise<void> {
    const { notifyUser } = await import('@/lib/api/notify')
    const receiver = act.receiverInfo as any
    const deliverer = act.delivererInfo as any
    const equipment = (act as any).assignment?.equipment
    const code = equipment?.code || 'equipo'
    const label = equipment
      ? `${equipment.code} — ${equipment.brand} ${equipment.model?.model || equipment.modelDeprecated || ''}`
      : code
    const link = `/inventory/acts/return/${act.id}`
    const statusLabel =
      (act as any).equipmentCondition === 'DAMAGED' ? 'Dañado' : 'Disponible en bodega'

    if (receiver?.id) {
      await notifyUser(
        receiver.id,
        'SUCCESS',
        `Devolución completada — ${code}`,
        `El acta ${act.folio} fue firmada. El equipo ${label} quedó como ${statusLabel}.`,
        { metadata: { link } }
      )
    }
    if (deliverer?.id && deliverer.id !== receiver?.id) {
      await notifyUser(
        deliverer.id,
        'SUCCESS',
        `Devolución firmada — ${code}`,
        `Confirmaste la recepción de ${label} (acta ${act.folio}). Estado: ${statusLabel}.`,
        { metadata: { link } }
      )
    }
  }

  /**
   * Rechaza un acta de devolución
   */
  static async rejectAct(actId: string, reason: string, userId: string): Promise<ReturnAct> {
    try {
      const act = await this.getActById(actId)

      if (!act) {
        throw new Error('Acta de devolución no encontrada')
      }

      if (act.status !== 'PENDING') {
        throw new Error('El acta no está pendiente de aceptación')
      }

      // Actualizar acta
      const updated = await prisma.return_acts.update({
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
            },
          },
          deliveryAct: true,
        },
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
            equipmentId: (act as any).assignment?.equipmentId,
          },
        },
      })

      this.notifyReturnRejected(updated as ReturnAct, reason).catch(err => {
        console.error('Error notificando rechazo de devolución:', err)
      })

      console.log(`Acta de devolución ${act.folio} rechazada`)
      return updated as ReturnAct
    } catch (error) {
      console.error('Error rechazando acta de devolución:', error)
      throw error
    }
  }

  private static async notifyReturnRejected(act: ReturnAct, reason: string): Promise<void> {
    const { notifyUser } = await import('@/lib/api/notify')
    const receiver = act.receiverInfo as any
    const deliverer = act.delivererInfo as any
    const equipment = (act as any).assignment?.equipment
    const code = equipment?.code || 'equipo'
    const link = `/inventory/acts/return/${act.id}`

    if (receiver?.id) {
      await notifyUser(
        receiver.id,
        'WARNING',
        `Devolución rechazada — ${code}`,
        `El acta ${act.folio} fue rechazada. El equipo sigue asignado. Motivo: ${reason}`,
        { metadata: { link } }
      )
    }
    if (deliverer?.id && deliverer.id !== receiver?.id) {
      await notifyUser(
        deliverer.id,
        'INFO',
        `Acta de devolución rechazada — ${code}`,
        `Se rechazó el acta ${act.folio}. El equipo permanece asignado hasta una nueva devolución firmada.`,
        { metadata: { link: '/inventory/acts?tab=return' } }
      )
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
    if (
      !act.verificationHash ||
      !act.signatureTimestamp ||
      !act.signatureIp ||
      !act.signatureUserAgent
    ) {
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
