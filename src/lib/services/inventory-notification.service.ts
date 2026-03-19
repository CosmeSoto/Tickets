import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { generateDeliveryActCreatedEmail } from '../email-templates/inventory/delivery-act-created'
import { generateDeliveryActReminderEmail } from '../email-templates/inventory/delivery-act-reminder'
import { generateDeliveryActAcceptedEmail } from '../email-templates/inventory/delivery-act-accepted'
import { generateDeliveryActRejectedEmail } from '../email-templates/inventory/delivery-act-rejected'
import { generateDeliveryActExpiredEmail } from '../email-templates/inventory/delivery-act-expired'
import type { DeliveryAct } from '@/types/inventory/delivery-act'

const prisma = new PrismaClient()

// Helper para parsear JSON de forma segura
function parseJsonField<T>(field: any): T {
  if (typeof field === 'string') {
    return JSON.parse(field) as T
  }
  return field as T
}

/**
 * Servicio para envío de notificaciones de inventario
 * Usa el sistema de email_queue existente para envío asíncrono
 */
export class InventoryNotificationService {
  /**
   * Envía notificación cuando se crea un acta de entrega
   */
  static async sendActCreatedNotification(actId: string): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
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

      if (!act) {
        throw new Error('Acta no encontrada')
      }

      // Parsear campos JSON
      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)
      const delivererInfo = parseJsonField<any>(act.delivererInfo)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const acceptanceUrl = `${baseUrl}/acts/${act.id}/accept?token=${act.acceptanceToken}`

      const equipmentCode = equipmentSnapshot.code
      const equipmentDescription = `${equipmentSnapshot.brand} ${equipmentSnapshot.model}`

      // Generar email
      const emailData = generateDeliveryActCreatedEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        acceptanceUrl,
        receiverName: receiverInfo.name,
        delivererName: delivererInfo.name,
        equipmentCode,
        equipmentDescription,
        expirationDate: act.expirationDate,
      })

      // Agregar a cola de emails
      await prisma.email_queue.create({
        data: {
          id: randomUUID(),
          toEmail: receiverInfo.email,
          subject: emailData.subject,
          body: emailData.html,
          status: 'pending',
          templateName: 'delivery_act_created',
          templateData: JSON.stringify({
            type: 'delivery_act_created',
            actId: act.id,
            folio: act.folio,
          })
        }
      })

      // Crear notificación in-app para el receptor — lleva a la página autenticada del acta
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: receiverInfo.id,
          type: 'INVENTORY',
          title: `Acta de entrega pendiente — ${equipmentCode}`,
          message: `Tienes un acta de entrega pendiente para el equipo ${equipmentCode} (${equipmentDescription}). Debes firmarla antes del ${new Date(act.expirationDate).toLocaleDateString('es-ES')}.`,
          metadata: {
            type: 'delivery_act_created',
            actId: act.id,
            folio: act.folio,
            equipmentId: act.assignment?.equipmentId,
            link: `/inventory/acts/${act.id}`,
          },
          isRead: false,
        }
      })

      // Notificación al entregador también
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: delivererInfo.id,
          type: 'INVENTORY',
          title: `Acta generada — ${equipmentCode}`,
          message: `Se generó el acta ${act.folio} para la entrega de ${equipmentCode} a ${receiverInfo.name}. Pendiente de firma del receptor.`,
          metadata: {
            type: 'delivery_act_created',
            actId: act.id,
            folio: act.folio,
            equipmentId: act.assignment?.equipmentId,
            link: `/inventory/acts/${act.id}`,
          },
          isRead: false,
        }
      })

      console.log(`Notificación de acta creada enviada para ${act.folio}`)
    } catch (error) {
      console.error('Error enviando notificación de acta creada:', error)
      throw error
    }
  }

  /**
   * Envía recordatorio de acta próxima a expirar
   */
  static async sendActReminderNotification(actId: string, daysRemaining: number): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
            }
          }
        }
      })

      if (!act || act.status !== 'PENDING') {
        return
      }

      // Parsear campos JSON
      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const acceptanceUrl = `${baseUrl}/acts/${act.id}/accept?token=${act.acceptanceToken}`

      const equipmentCode = equipmentSnapshot.code
      const equipmentDescription = `${equipmentSnapshot.brand} ${equipmentSnapshot.model}`

      // Generar email
      const emailData = generateDeliveryActReminderEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo: parseJsonField<any>(act.delivererInfo) } as DeliveryAct,
        acceptanceUrl,
        receiverName: receiverInfo.name,
        equipmentCode,
        equipmentDescription,
        expirationDate: act.expirationDate,
        daysRemaining,
      })

      // Agregar a cola de emails
      await prisma.email_queue.create({
        data: {
          id: randomUUID(),
          toEmail: receiverInfo.email,
          subject: emailData.subject,
          body: emailData.html,
          status: 'pending',
          templateName: 'delivery_act_reminder',
          templateData: JSON.stringify({
            type: 'delivery_act_reminder',
            actId: act.id,
            folio: act.folio,
            daysRemaining,
          })
        }
      })

      // Crear notificación in-app
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: receiverInfo.id,
          type: 'INVENTORY',
          title: daysRemaining === 1 ? '¡URGENTE! Acta por Expirar' : 'Recordatorio: Acta Pendiente',
          message: `Tu acta de entrega para ${equipmentCode} expira en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}.`,
          metadata: {
            type: 'delivery_act_reminder',
            actId: act.id,
            folio: act.folio,
            daysRemaining,
            link: acceptanceUrl
          },
          isRead: false,
        }
      })

      console.log(`Recordatorio enviado para ${act.folio} (${daysRemaining} días restantes)`)
    } catch (error) {
      console.error('Error enviando recordatorio:', error)
      throw error
    }
  }

  /**
   * Envía notificación cuando se acepta un acta
   * Envía a ambas partes (deliverer y receiver) con PDF adjunto
   */
  static async sendActAcceptedNotification(actId: string, pdfPath?: string): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
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

      if (!act) {
        throw new Error('Acta no encontrada')
      }

      // Parsear campos JSON
      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)
      const delivererInfo = parseJsonField<any>(act.delivererInfo)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const pdfUrl = pdfPath ? `${baseUrl}${pdfPath}` : undefined
      const equipmentCode = equipmentSnapshot.code
      const equipmentDescription = `${equipmentSnapshot.brand} ${equipmentSnapshot.model}`

      // Email para el receptor
      const receiverEmailData = generateDeliveryActAcceptedEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: receiverInfo.name,
        recipientRole: 'receiver',
        equipmentCode,
        equipmentDescription,
        acceptedAt: act.acceptedAt!,
        pdfUrl,
      })

      // Email al receptor
      await prisma.email_queue.create({
        data: {
          id: randomUUID(),
          toEmail: receiverInfo.email,
          subject: receiverEmailData.subject,
          body: receiverEmailData.html,
          status: 'pending',
          templateName: 'delivery_act_accepted',
          templateData: JSON.stringify({
            type: 'delivery_act_accepted',
            actId: act.id,
            folio: act.folio,
            recipient: 'receiver',
            pdfPath,
          })
        }
      })

      // Email para el entregador
      const delivererEmailData = generateDeliveryActAcceptedEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: delivererInfo.name,
        recipientRole: 'deliverer',
        equipmentCode,
        equipmentDescription,
        acceptedAt: act.acceptedAt!,
        pdfUrl,
      })

      // Email al entregador
      await prisma.email_queue.create({
        data: {
          id: randomUUID(),
          toEmail: delivererInfo.email,
          subject: delivererEmailData.subject,
          body: delivererEmailData.html,
          status: 'pending',
          templateName: 'delivery_act_accepted',
          templateData: JSON.stringify({
            type: 'delivery_act_accepted',
            actId: act.id,
            folio: act.folio,
            recipient: 'deliverer',
            pdfPath,
          })
        }
      })

      // Notificaciones in-app
      await prisma.notifications.createMany({
        data: [
          {
            id: randomUUID(),
            userId: receiverInfo.id,
            type: 'INVENTORY',
            title: 'Acta Aceptada',
            message: `Has aceptado el acta de entrega para ${equipmentCode}.`,
            metadata: {
              type: 'delivery_act_accepted',
              actId: act.id,
              folio: act.folio,
              link: `${baseUrl}/inventory/acts/${act.id}`
            },
            isRead: false,
          },
          {
            id: randomUUID(),
            userId: delivererInfo.id,
            type: 'INVENTORY',
            title: 'Acta Aceptada',
            message: `${receiverInfo.name} ha aceptado el acta ${act.folio}.`,
            metadata: {
              type: 'delivery_act_accepted',
              actId: act.id,
              folio: act.folio,
              link: `${baseUrl}/inventory/acts/${act.id}`
            },
            isRead: false,
          }
        ]
      })

      console.log(`Notificaciones de aceptación enviadas para ${act.folio}`)
    } catch (error) {
      console.error('Error enviando notificación de aceptación:', error)
      throw error
    }
  }

  /**
   * Envía notificación cuando se rechaza un acta
   */
  static async sendActRejectedNotification(actId: string): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
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

      if (!act) {
        throw new Error('Acta no encontrada')
      }

      // Parsear campos JSON
      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)
      const delivererInfo = parseJsonField<any>(act.delivererInfo)

      const equipmentCode = equipmentSnapshot.code
      const equipmentDescription = `${equipmentSnapshot.brand} ${equipmentSnapshot.model}`

      // Email para el entregador
      const emailData = generateDeliveryActRejectedEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: delivererInfo.name,
        equipmentCode,
        equipmentDescription,
        rejectionReason: act.rejectionReason || 'No especificado',
        rejectedAt: act.rejectedAt!,
      })

      await prisma.email_queue.create({
        data: {
          id: randomUUID(),
          toEmail: delivererInfo.email,
          subject: emailData.subject,
          body: emailData.html,
          status: 'pending',
          templateName: 'delivery_act_rejected',
          templateData: JSON.stringify({
            type: 'delivery_act_rejected',
            actId: act.id,
            folio: act.folio,
          })
        }
      })

      // Notificación in-app para el entregador
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: delivererInfo.id,
          type: 'INVENTORY',
          title: 'Acta Rechazada',
          message: `${receiverInfo.name} ha rechazado el acta ${act.folio}.`,
          metadata: {
            type: 'delivery_act_rejected',
            actId: act.id,
            folio: act.folio,
            link: `${baseUrl}/inventory/acts/${act.id}`
          },
          isRead: false,
        }
      })

      console.log(`Notificación de rechazo enviada para ${act.folio}`)
    } catch (error) {
      console.error('Error enviando notificación de rechazo:', error)
      throw error
    }
  }

  /**
   * Envía notificación cuando un acta expira
   */
  static async sendActExpiredNotification(actId: string): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
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

      if (!act) {
        return
      }

      // Parsear campos JSON
      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)
      const delivererInfo = parseJsonField<any>(act.delivererInfo)

      const equipmentCode = equipmentSnapshot.code
      const equipmentDescription = `${equipmentSnapshot.brand} ${equipmentSnapshot.model}`

      // Email para ambas partes
      const emailData = generateDeliveryActExpiredEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: receiverInfo.name,
        equipmentCode,
        equipmentDescription,
        expirationDate: act.expirationDate,
      })

      // Email al receptor
      await prisma.email_queue.create({
        data: {
          id: randomUUID(),
          toEmail: receiverInfo.email,
          subject: emailData.subject,
          body: emailData.html,
          status: 'pending',
          templateName: 'delivery_act_expired',
          templateData: JSON.stringify({
            type: 'delivery_act_expired',
            actId: act.id,
            folio: act.folio,
          })
        }
      })

      // Email al entregador
      await prisma.email_queue.create({
        data: {
          id: randomUUID(),
          toEmail: delivererInfo.email,
          subject: `Acta Expirada - ${act.folio}`,
          body: emailData.html.replace(receiverInfo.name, delivererInfo.name),
          status: 'pending',
          templateName: 'delivery_act_expired',
          templateData: JSON.stringify({
            type: 'delivery_act_expired',
            actId: act.id,
            folio: act.folio,
          })
        }
      })

      // Notificaciones in-app
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      await prisma.notifications.createMany({
        data: [
          {
            id: randomUUID(),
            userId: receiverInfo.id,
            type: 'INVENTORY',
            title: 'Acta Expirada',
            message: `El acta ${act.folio} ha expirado sin ser aceptada.`,
            metadata: {
              type: 'delivery_act_expired',
              actId: act.id,
              folio: act.folio,
              link: `${baseUrl}/inventory/acts/${act.id}`
            },
            isRead: false,
          },
          {
            id: randomUUID(),
            userId: delivererInfo.id,
            type: 'INVENTORY',
            title: 'Acta Expirada',
            message: `El acta ${act.folio} ha expirado sin ser aceptada.`,
            metadata: {
              type: 'delivery_act_expired',
              actId: act.id,
              folio: act.folio,
              link: `${baseUrl}/inventory/acts/${act.id}`
            },
            isRead: false,
          }
        ]
      })

      console.log(`Notificaciones de expiración enviadas para ${act.folio}`)
    } catch (error) {
      console.error('Error enviando notificación de expiración:', error)
      throw error
    }
  }

  /**
   * Obtiene actas que necesitan recordatorios
   */
  static async getActsNeedingReminders(daysBeforeExpiration: number): Promise<string[]> {
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + daysBeforeExpiration)
      targetDate.setHours(0, 0, 0, 0)

      const nextDay = new Date(targetDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const acts = await prisma.delivery_acts.findMany({
        where: {
          status: 'PENDING',
          expirationDate: {
            gte: targetDate,
            lt: nextDay,
          }
        },
        select: { id: true }
      })

      return acts.map(act => act.id)
    } catch (error) {
      console.error('Error obteniendo actas para recordatorios:', error)
      throw error
    }
  }
}
