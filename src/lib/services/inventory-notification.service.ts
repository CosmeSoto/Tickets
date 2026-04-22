import { randomUUID } from 'crypto'
import { generateDeliveryActCreatedEmail } from '../email-templates/inventory/delivery-act-created'
import { generateDeliveryActReminderEmail } from '../email-templates/inventory/delivery-act-reminder'
import { generateDeliveryActAcceptedEmail } from '../email-templates/inventory/delivery-act-accepted'
import { generateDeliveryActRejectedEmail } from '../email-templates/inventory/delivery-act-rejected'
import { generateDeliveryActExpiredEmail } from '../email-templates/inventory/delivery-act-expired'
import type { DeliveryAct } from '@/types/inventory/delivery-act'
import { NotificationService } from './notification-service'
import { db as prisma } from '@/lib/server'

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

      // Crear notificación in-app para el receptor
      await NotificationService.push({
        userId: receiverInfo.id,
        type: 'INVENTORY',
        title: `Acta de entrega pendiente — ${equipmentCode}`,
        message: `Tienes un acta de entrega pendiente para el equipo ${equipmentCode} (${equipmentDescription}). Debes firmarla antes del ${new Date(act.expirationDate).toLocaleDateString('es-ES')}.`,
        metadata: { type: 'delivery_act_created', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: `/inventory/acts/${act.id}` },
      })

      // Notificación al entregador
      await NotificationService.push({
        userId: delivererInfo.id,
        type: 'INVENTORY',
        title: `Acta generada — ${equipmentCode}`,
        message: `Se generó el acta ${act.folio} para la entrega de ${equipmentCode} a ${receiverInfo.name}. Pendiente de firma del receptor.`,
        metadata: { type: 'delivery_act_created', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: `/inventory/acts/${act.id}` },
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
      await NotificationService.push({
        userId: receiverInfo.id,
        type: 'INVENTORY',
        title: daysRemaining === 1 ? '¡URGENTE! Acta por Expirar' : 'Recordatorio: Acta Pendiente',
        message: `Tu acta de entrega para ${equipmentCode} expira en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}.`,
        metadata: { type: 'delivery_act_reminder', actId: act.id, folio: act.folio, daysRemaining, link: acceptanceUrl },
      })

      console.log(`Recordatorio enviado para ${act.folio} (${daysRemaining} días restantes)`)
    } catch (error) {
      console.error('Error enviando recordatorio:', error)
      throw error
    }
  }

  /**
   * Envía notificación cuando se acepta un acta.
   * Notifica a AMBAS partes: receptor (confirmación) y entregador (alerta de acción completada).
   */
  static async sendActAcceptedNotification(actId: string, pdfPath?: string): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
        include: {
          assignment: { include: { equipment: true, receiver: true, deliverer: true } }
        }
      })

      if (!act) throw new Error('Acta no encontrada')

      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo     = parseJsonField<any>(act.receiverInfo)
      const delivererInfo    = parseJsonField<any>(act.delivererInfo)

      const baseUrl              = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const equipmentCode        = equipmentSnapshot.code
      const equipmentDescription = `${equipmentSnapshot.brand} ${equipmentSnapshot.model}`
      const actLink              = `/inventory/acts/${act.id}`
      const acceptedAtStr        = act.acceptedAt
        ? new Date(act.acceptedAt).toLocaleString('es-ES')
        : new Date().toLocaleString('es-ES')

      // ── Emails ────────────────────────────────────────────────────────────
      const pdfUrl = pdfPath ? `${baseUrl}${pdfPath}` : undefined

      const receiverEmailData = generateDeliveryActAcceptedEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: receiverInfo.name,
        recipientRole: 'receiver',
        equipmentCode,
        equipmentDescription,
        acceptedAt: act.acceptedAt!,
        pdfUrl,
      })

      const delivererEmailData = generateDeliveryActAcceptedEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: delivererInfo.name,
        recipientRole: 'deliverer',
        equipmentCode,
        equipmentDescription,
        acceptedAt: act.acceptedAt!,
        pdfUrl,
      })

      await Promise.all([
        prisma.email_queue.create({
          data: {
            id: randomUUID(),
            toEmail: receiverInfo.email,
            subject: receiverEmailData.subject,
            body: receiverEmailData.html,
            status: 'pending',
            templateName: 'delivery_act_accepted',
            templateData: JSON.stringify({ type: 'delivery_act_accepted', actId: act.id, folio: act.folio, recipient: 'receiver', pdfPath }),
          }
        }),
        prisma.email_queue.create({
          data: {
            id: randomUUID(),
            toEmail: delivererInfo.email,
            subject: delivererEmailData.subject,
            body: delivererEmailData.html,
            status: 'pending',
            templateName: 'delivery_act_accepted',
            templateData: JSON.stringify({ type: 'delivery_act_accepted', actId: act.id, folio: act.folio, recipient: 'deliverer', pdfPath }),
          }
        }),
      ])

      // ── Notificaciones in-app ─────────────────────────────────────────────
      await Promise.all([
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'SUCCESS',
          title: `✅ Acta firmada — ${equipmentCode}`,
          message: `Has aceptado y firmado el acta ${act.folio} para el equipo ${equipmentCode} (${equipmentDescription}). La entrega queda registrada el ${acceptedAtStr}.`,
          metadata: { type: 'delivery_act_accepted', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: actLink },
        }),
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'SUCCESS',
          title: `✅ Acta aceptada por ${receiverInfo.name}`,
          message: `${receiverInfo.name} aceptó y firmó el acta ${act.folio} para el equipo ${equipmentCode} (${equipmentDescription}). Fecha de firma: ${acceptedAtStr}.`,
          metadata: { type: 'delivery_act_accepted', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: actLink },
        }),
      ])

      // Si hay admins distintos al entregador, notificarlos también
      const admins = await prisma.users.findMany({
        where: { role: 'ADMIN', id: { not: delivererInfo.id } },
        select: { id: true },
      })
      await Promise.all(admins.map(admin =>
        NotificationService.push({
          userId: admin.id,
          type: 'INFO',
          title: `Acta aceptada — ${equipmentCode}`,
          message: `${receiverInfo.name} aceptó el acta ${act.folio} entregada por ${delivererInfo.name}. Equipo: ${equipmentCode}.`,
          metadata: { type: 'delivery_act_accepted', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: actLink },
        })
      ))

      console.log(`Notificaciones de aceptación enviadas para ${act.folio} → receptor: ${receiverInfo.name}, entregador: ${delivererInfo.name}`)
    } catch (error) {
      console.error('Error enviando notificación de aceptación:', error)
      throw error
    }
  }

  /**
   * Envía notificación cuando se rechaza un acta.
   * Notifica al entregador (admin/técnico) con el motivo del rechazo.
   */
  static async sendActRejectedNotification(actId: string): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
        include: {
          assignment: { include: { equipment: true, receiver: true, deliverer: true } }
        }
      })

      if (!act) throw new Error('Acta no encontrada')

      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo     = parseJsonField<any>(act.receiverInfo)
      const delivererInfo    = parseJsonField<any>(act.delivererInfo)

      const baseUrl              = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const equipmentCode        = equipmentSnapshot.code
      const equipmentDescription = `${equipmentSnapshot.brand} ${equipmentSnapshot.model}`
      const actLink              = `/inventory/acts/${act.id}`
      const rejectedAtStr        = act.rejectedAt
        ? new Date(act.rejectedAt).toLocaleString('es-ES')
        : new Date().toLocaleString('es-ES')
      const motivo               = act.rejectionReason || 'No especificado'

      // ── Email al entregador ───────────────────────────────────────────────
      const emailData = generateDeliveryActRejectedEmail({
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: delivererInfo.name,
        equipmentCode,
        equipmentDescription,
        rejectionReason: motivo,
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
          templateData: JSON.stringify({ type: 'delivery_act_rejected', actId: act.id, folio: act.folio }),
        }
      })

      // ── Notificaciones in-app ─────────────────────────────────────────────
      await Promise.all([
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'WARNING',
          title: `⚠️ Acta rechazada — ${equipmentCode}`,
          message: `${receiverInfo.name} rechazó el acta ${act.folio} para el equipo ${equipmentCode} (${equipmentDescription}). Motivo: "${motivo}". El equipo volvió a estar disponible. Fecha: ${rejectedAtStr}.`,
          metadata: { type: 'delivery_act_rejected', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: actLink },
        }),
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'INFO',
          title: `Rechazo registrado — ${equipmentCode}`,
          message: `Rechazaste el acta ${act.folio} para el equipo ${equipmentCode}. El entregador ha sido notificado. El equipo volvió a bodega.`,
          metadata: { type: 'delivery_act_rejected', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: actLink },
        }),
      ])

      // Notificar a admins distintos al entregador
      const admins = await prisma.users.findMany({
        where: { role: 'ADMIN', id: { not: delivererInfo.id } },
        select: { id: true },
      })
      await Promise.all(admins.map(admin =>
        NotificationService.push({
          userId: admin.id,
          type: 'WARNING',
          title: `Acta rechazada — ${equipmentCode}`,
          message: `${receiverInfo.name} rechazó el acta ${act.folio}. Motivo: "${motivo}". Entregador: ${delivererInfo.name}.`,
          metadata: { type: 'delivery_act_rejected', actId: act.id, folio: act.folio, equipmentId: act.assignment?.equipmentId, link: actLink },
        })
      ))

      console.log(`Notificaciones de rechazo enviadas para ${act.folio}`)
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
      await Promise.all([
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'INVENTORY',
          title: 'Acta Expirada',
          message: `El acta ${act.folio} ha expirado sin ser aceptada.`,
          metadata: { type: 'delivery_act_expired', actId: act.id, folio: act.folio, link: `/inventory/acts/${act.id}` },
        }),
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'INVENTORY',
          title: 'Acta Expirada',
          message: `El acta ${act.folio} ha expirado sin ser aceptada.`,
          metadata: { type: 'delivery_act_expired', actId: act.id, folio: act.folio, link: `/inventory/acts/${act.id}` },
        }),
      ])

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
