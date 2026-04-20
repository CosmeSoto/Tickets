import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { FolioService } from './folio.service'
import { DigitalSignatureService } from './digital-signature.service'
import { PDFGeneratorService } from './pdf-generator.service'
import { InventoryNotificationService } from './inventory-notification.service'
import type { DeliveryAct, UserInfo } from '@/types/inventory/delivery-act'

const prisma = new PrismaClient()

/**
 * Servicio para gestión de actas de entrega digitales
 */
export class DeliveryActService {
  /**
   * Genera el PDF de un acta con lógica de reintentos
   * @private
   */
  private static async generatePDFWithRetry(actId: string, maxRetries: number = 3): Promise<string | null> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Generando PDF para acta ${actId}, intento ${attempt}/${maxRetries}`)
        const pdfPath = await PDFGeneratorService.generateDeliveryActPDF(actId)
        console.log(`PDF generado exitosamente: ${pdfPath}`)
        return pdfPath
      } catch (error) {
        lastError = error as Error
        console.error(`Error en intento ${attempt}/${maxRetries} generando PDF:`, error)
        
        // Si no es el último intento, esperar antes de reintentar
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    console.error(`Falló la generación de PDF después de ${maxRetries} intentos:`, lastError)
    return null
  }

  /**
   * Genera un acta de entrega para una asignación
   * Se llama automáticamente al crear una asignación
   */
  static async generateDeliveryAct(assignmentId: string): Promise<DeliveryAct> {
    try {
      // Obtener asignación con relaciones
      const assignment = await (prisma.equipment_assignments.findUnique as any)({
        where: { id: assignmentId },
        include: {
          equipment: {
            include: {
              type: true,
              supplier: { select: { name: true, taxId: true } },
              attachments: {
                where: { mimeType: { startsWith: 'image/' } },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
              department: { include: { family: true } },
            }
          },
          receiver: { include: { departments: true } },
          deliverer: { include: { departments: true } },
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

      // Crear snapshot del equipo (incluye campos financieros si existen)
      const eq = assignment.equipment as any
      const firstAttachment = eq.attachments?.[0]
      const equipmentImagePath = firstAttachment
        ? `/api/uploads/equipment/${eq.id}/${firstAttachment.filename}`
        : (eq.photoUrl || null)

      const equipmentSnapshot = {
        id: eq.id,
        code: eq.code,
        serialNumber: eq.serialNumber,
        brand: eq.brand,
        model: eq.model,
        type: eq.typeId,
        typeName: eq.type?.name || '',
        condition: eq.condition,
        specifications: eq.specifications,
        // Campos financieros (opcionales)
        supplierName: eq.supplier?.name ?? null,
        supplierTaxId: eq.supplier?.taxId ?? null,
        purchasePrice: eq.purchasePrice ?? null,
        purchaseDate: eq.purchaseDate ?? null,
        invoiceNumber: eq.invoiceNumber ?? null,
        purchaseOrderNumber: eq.purchaseOrderNumber ?? null,
        equipmentImagePath,
        // Jerarquía departamento-familia
        departmentId: eq.department?.id ?? null,
        departmentName: eq.department?.name ?? null,
        familyId: eq.department?.family?.id ?? null,
        familyName: eq.department?.family?.name ?? null,
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
      const act = await (prisma.delivery_acts.create as any)({
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
          actType: 'EQUIPMENT_ASSIGNMENT',
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
          id: randomUUID(),
          action: 'ACTA_ENTREGA_CREADA',
          entityType: 'delivery_act',
          entityId: act.id,
          userId: assignment.delivererId,
          details: {
            folio,
            equipo: `${assignment.equipment.code} — ${assignment.equipment.brand} ${assignment.equipment.model}`,
            numeroSerie: assignment.equipment.serialNumber,
            entregadoPor: `${assignment.deliverer.name} (${assignment.deliverer.email})`,
            recibidoPor: `${assignment.receiver.name} (${assignment.receiver.email})`,
            tipoAsignacion: assignment.assignmentType,
            expira: expirationDate.toLocaleDateString('es-ES'),
          }
        }
      })

      // Enviar notificación de acta creada (asíncrono)
      InventoryNotificationService.sendActCreatedNotification(act.id).catch(error => {
        console.error('Error enviando notificación de acta creada:', error)
        // El error se registra pero no se propaga para no afectar la creación del acta
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

      const equipoLabel = `${(act as any).assignment?.equipment?.code} — ${(act as any).assignment?.equipment?.brand} ${(act as any).assignment?.equipment?.model}`

      // Registrar en auditoría con información completa y legible
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'ACTA_ACEPTADA',
          entityType: 'delivery_act',
          entityId: actId,
          userId: act.receiverInfo.id,
          details: {
            folio: act.folio,
            equipo: equipoLabel,
            aceptadoPor: `${act.receiverInfo.name} (${act.receiverInfo.email})`,
            entregadoPor: `${act.delivererInfo.name} (${act.delivererInfo.email})`,
            firmaDigital: signature.hash.substring(0, 20) + '...',
            ipOrigen: signature.ipAddress,
            fechaAceptacion: signature.timestamp.toLocaleString('es-ES'),
            descripcion: `${act.receiverInfo.name} aceptó y firmó el acta de entrega del equipo ${(act as any).assignment?.equipment?.code}. La entrega queda registrada oficialmente.`,
          }
        }
      })

      // ── Notificaciones INMEDIATAS al aceptar (no esperan el PDF) ──────────
      // Se envían de forma asíncrona pero sin bloquear la respuesta
      InventoryNotificationService.sendActAcceptedNotification(actId).catch(err => {
        console.error('Error enviando notificaciones de aceptación:', err)
      })

      // ── Generar PDF en background (no bloquea, no condiciona notificaciones) ──
      this.generatePDFWithRetry(actId, 3).catch(err => {
        console.error('Error generando PDF post-aceptación:', err)
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
            id: randomUUID(),
            action: 'ACTA_RECHAZADA',
            entityType: 'delivery_act',
            entityId: actId,
            userId: userId,
            details: {
              folio: act.folio,
              equipo: `${act.assignment?.equipment?.code} — ${act.assignment?.equipment?.brand} ${act.assignment?.equipment?.model}`,
              rechazadoPor: `${act.receiverInfo.name} (${act.receiverInfo.email})`,
              entregadoPor: `${act.delivererInfo.name} (${act.delivererInfo.email})`,
              motivoRechazo: reason,
              equipoRestauradoA: 'Disponible en bodega',
              descripcion: `${act.receiverInfo.name} rechazó el acta de entrega del equipo ${act.assignment?.equipment?.code}. El equipo fue devuelto a bodega y la asignación fue cancelada.`,
            }
          }
        })

        return updatedAct
      })

      // Enviar notificación de rechazo (asíncrono)
      InventoryNotificationService.sendActRejectedNotification(actId).catch(error => {
        console.error('Error enviando notificación de rechazo:', error)
        // El error se registra pero no se propaga para no afectar el rechazo
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
