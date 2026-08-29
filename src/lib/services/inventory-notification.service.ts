import { generateDeliveryActCreatedEmail } from '../email-templates/inventory/delivery-act-created'
import { generateDeliveryActReminderEmail } from '../email-templates/inventory/delivery-act-reminder'
import { generateDeliveryActAcceptedEmail } from '../email-templates/inventory/delivery-act-accepted'
import { generateDeliveryActRejectedEmail } from '../email-templates/inventory/delivery-act-rejected'
import { generateDeliveryActExpiredEmail } from '../email-templates/inventory/delivery-act-expired'
import type { DeliveryAct } from '@/types/inventory/delivery-act'
import { NotificationService } from './notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'
import { db as prisma } from '@/lib/server'
import { getSystemBranding } from '@/lib/branding'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'

/**
 * Compat: sustituye email_queue.create directo por la puerta global
 * (SMTP + prefs inventario + prioridad).
 */
async function legacyQueueCreate(args: {
  data: {
    id?: string
    toEmail: string
    subject: string
    body: string
    status?: string
    templateName?: string
    templateData?: string | null
  }
  recipientUserId?: string | null
}): Promise<void> {
  const d = args.data
  const name = d.templateName || ''
  const optional =
    name.includes('reminder') || name.includes('expired') || name.includes('accepted')
  let templateData: Record<string, unknown> | undefined
  if (d.templateData) {
    try {
      templateData = JSON.parse(d.templateData) as Record<string, unknown>
    } catch {
      templateData = undefined
    }
  }
  await queueNotificationEmail({
    to: d.toEmail,
    subject: d.subject,
    html: d.body,
    recipientUserId: args.recipientUserId,
    module: 'inventory',
    event: optional ? 'generic' : 'inventoryAct',
    priority: optional ? 'optional' : 'important',
    templateName: d.templateName,
    templateData,
  })
}

async function notifyDeliveryActFamilyAdmins(
  familyId: string | null | undefined,
  excludeUserIds: string[],
  notification: {
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'INVENTORY'
    title: string
    message: string
    metadata: Record<string, unknown>
  }
): Promise<void> {
  const admins = await getFamilyScopedAdmins(familyId, { id: true })
  const recipients = admins.filter(admin => !excludeUserIds.includes(admin.id))

  await Promise.all(
    recipients.map(admin =>
      NotificationService.push({
        userId: admin.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
      })
    )
  )

  const link =
    typeof notification.metadata.link === 'string' ? notification.metadata.link : undefined

  queueTelegramNotification({
    recipients: recipients.map(admin => ({ userId: admin.id })),
    title: notification.title,
    body: notification.message,
    module: 'inventory',
    event: 'inventoryAct',
    priority: 'important',
    link,
  }).catch(err => console.error('[TELEGRAM] Error acta inventario:', err))
}

async function getActFamilyId(act: {
  assignment?: { equipment?: { type?: { familyId?: string | null } | null } | null } | null
  licenseAssignment?: {
    license?: { licenseType?: { familyId?: string | null } | null } | null
  } | null
}): Promise<string | null> {
  return (
    act.assignment?.equipment?.type?.familyId ??
    act.licenseAssignment?.license?.licenseType?.familyId ??
    null
  )
}

/**
 * Código/descripción/rótulo legibles del ítem del acta — el snapshot en `equipmentSnapshot`
 * es polimórfico: para equipos viene de buildEquipmentSnapshot ({code, brand, model, ...}),
 * para licencias de buildLicenseSnapshot ({name, typeName, vendor, ...}, sin code/brand/model).
 * Antes esto siempre asumía la forma de equipo y salía "undefined" en las actas de licencia.
 */
function getActItemDisplay(
  act: { licenseAssignment?: unknown },
  equipmentSnapshot: any
): { itemCode: string; itemDescription: string; itemLabel: string } {
  if (act.licenseAssignment) {
    return {
      itemCode: equipmentSnapshot?.name ?? 'Licencia',
      itemDescription: equipmentSnapshot?.typeName ?? equipmentSnapshot?.vendor ?? '',
      itemLabel: 'Licencia',
    }
  }
  return {
    itemCode: equipmentSnapshot?.code ?? '',
    itemDescription: `${equipmentSnapshot?.brand ?? ''} ${equipmentSnapshot?.model ?? ''}`.trim(),
    itemLabel: 'Equipo',
  }
}

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
            },
          },
          licenseAssignment: {
            include: { license: { include: { licenseType: true } } },
          },
        },
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

      const {
        itemCode: equipmentCode,
        itemDescription: equipmentDescription,
        itemLabel,
      } = getActItemDisplay(act, equipmentSnapshot)

      // Generar email
      const { systemName } = await getSystemBranding()

      const emailData = generateDeliveryActCreatedEmail({
        systemName,
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        acceptanceUrl,
        receiverName: receiverInfo.name,
        delivererName: delivererInfo.name,
        equipmentCode,
        equipmentDescription,
        expirationDate: act.expirationDate,
        itemLabel,
      })

      // Agregar a cola de emails
      await legacyQueueCreate({
        recipientUserId: receiverInfo.id,
        data: {
          toEmail: receiverInfo.email,
          subject: emailData.subject,
          body: emailData.html,
          status: 'pending',
          templateName: 'delivery_act_created',
          templateData: JSON.stringify({
            type: 'delivery_act_created',
            actId: act.id,
            folio: act.folio,
          }),
        },
      })

      // Crear notificación in-app para el receptor
      await NotificationService.push({
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
      })

      // Notificación al entregador
      await NotificationService.push({
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
            },
          },
          licenseAssignment: {
            include: { license: { include: { licenseType: true } } },
          },
        },
      })

      if (!act || act.status !== 'PENDING') {
        return
      }

      // Parsear campos JSON
      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const acceptanceUrl = `${baseUrl}/acts/${act.id}/accept?token=${act.acceptanceToken}`

      const {
        itemCode: equipmentCode,
        itemDescription: equipmentDescription,
        itemLabel,
      } = getActItemDisplay(act, equipmentSnapshot)

      // Generar email
      const { systemName } = await getSystemBranding()

      const emailData = generateDeliveryActReminderEmail({
        systemName,
        act: {
          ...act,
          equipmentSnapshot,
          receiverInfo,
          delivererInfo: parseJsonField<any>(act.delivererInfo),
        } as DeliveryAct,
        acceptanceUrl,
        receiverName: receiverInfo.name,
        equipmentCode,
        equipmentDescription,
        expirationDate: act.expirationDate,
        daysRemaining,
        itemLabel,
      })

      // Agregar a cola de emails
      await legacyQueueCreate({
        recipientUserId: receiverInfo.id,
        data: {
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
          }),
        },
      })

      // Crear notificación in-app
      await NotificationService.push({
        userId: receiverInfo.id,
        type: 'INVENTORY',
        title: daysRemaining === 1 ? '¡URGENTE! Acta por Expirar' : 'Recordatorio: Acta Pendiente',
        message: `Tu acta de entrega para ${equipmentCode} expira en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}.`,
        metadata: {
          type: 'delivery_act_reminder',
          actId: act.id,
          folio: act.folio,
          daysRemaining,
          link: acceptanceUrl,
        },
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
          assignment: {
            include: {
              equipment: { include: { type: { select: { familyId: true } } } },
              receiver: true,
              deliverer: true,
            },
          },
          licenseAssignment: {
            include: { license: { include: { licenseType: true } } },
          },
        },
      })

      if (!act) throw new Error('Acta no encontrada')

      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)
      const delivererInfo = parseJsonField<any>(act.delivererInfo)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const {
        itemCode: equipmentCode,
        itemDescription: equipmentDescription,
        itemLabel,
      } = getActItemDisplay(act, equipmentSnapshot)
      const actLink = `/inventory/acts/${act.id}`
      const acceptedAtStr = act.acceptedAt
        ? new Date(act.acceptedAt).toLocaleString('es-ES')
        : new Date().toLocaleString('es-ES')

      // ── Emails ────────────────────────────────────────────────────────────
      const pdfUrl = pdfPath ? `${baseUrl}${pdfPath}` : undefined

      const { systemName } = await getSystemBranding()

      const receiverEmailData = generateDeliveryActAcceptedEmail({
        systemName,
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: receiverInfo.name,
        recipientRole: 'receiver',
        equipmentCode,
        equipmentDescription,
        acceptedAt: act.acceptedAt!,
        pdfUrl,
        itemLabel,
      })

      const delivererEmailData = generateDeliveryActAcceptedEmail({
        systemName,
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: delivererInfo.name,
        recipientRole: 'deliverer',
        equipmentCode,
        equipmentDescription,
        acceptedAt: act.acceptedAt!,
        pdfUrl,
        itemLabel,
      })

      await Promise.all([
        legacyQueueCreate({
          recipientUserId: receiverInfo.id,
          data: {
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
            }),
          },
        }),
        legacyQueueCreate({
          recipientUserId: delivererInfo.id,
          data: {
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
            }),
          },
        }),
      ])

      // ── Notificaciones in-app ─────────────────────────────────────────────
      await Promise.all([
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'SUCCESS',
          title: `✅ Acta firmada — ${equipmentCode}`,
          message: `Has aceptado y firmado el acta ${act.folio} para el equipo ${equipmentCode} (${equipmentDescription}). La entrega queda registrada el ${acceptedAtStr}.`,
          metadata: {
            type: 'delivery_act_accepted',
            actId: act.id,
            folio: act.folio,
            equipmentId: act.assignment?.equipmentId,
            link: actLink,
          },
        }),
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'SUCCESS',
          title: `✅ Acta aceptada por ${receiverInfo.name}`,
          message: `${receiverInfo.name} aceptó y firmó el acta ${act.folio} para el equipo ${equipmentCode} (${equipmentDescription}). Fecha de firma: ${acceptedAtStr}.`,
          metadata: {
            type: 'delivery_act_accepted',
            actId: act.id,
            folio: act.folio,
            equipmentId: act.assignment?.equipmentId,
            link: actLink,
          },
        }),
      ])

      // Super admins + admin nativo de la familia del equipo (excluir entregador)
      const familyId = await getActFamilyId(act)
      await notifyDeliveryActFamilyAdmins(familyId, [delivererInfo.id], {
        type: 'INFO',
        title: `Acta aceptada — ${equipmentCode}`,
        message: `${receiverInfo.name} aceptó el acta ${act.folio} entregada por ${delivererInfo.name}. Equipo: ${equipmentCode}.`,
        metadata: {
          type: 'delivery_act_accepted',
          actId: act.id,
          folio: act.folio,
          equipmentId: act.assignment?.equipmentId,
          link: actLink,
        },
      })

      console.log(
        `Notificaciones de aceptación enviadas para ${act.folio} → receptor: ${receiverInfo.name}, entregador: ${delivererInfo.name}`
      )
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
          assignment: {
            include: {
              equipment: { include: { type: { select: { familyId: true } } } },
              receiver: true,
              deliverer: true,
            },
          },
          licenseAssignment: {
            include: { license: { include: { licenseType: true } } },
          },
        },
      })

      if (!act) throw new Error('Acta no encontrada')

      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)
      const delivererInfo = parseJsonField<any>(act.delivererInfo)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const {
        itemCode: equipmentCode,
        itemDescription: equipmentDescription,
        itemLabel,
      } = getActItemDisplay(act, equipmentSnapshot)
      const actLink = `/inventory/acts/${act.id}`
      const rejectedAtStr = act.rejectedAt
        ? new Date(act.rejectedAt).toLocaleString('es-ES')
        : new Date().toLocaleString('es-ES')
      const motivo = act.rejectionReason || 'No especificado'

      // ── Email al entregador ───────────────────────────────────────────────
      const { systemName } = await getSystemBranding()

      const emailData = generateDeliveryActRejectedEmail({
        systemName,
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: delivererInfo.name,
        equipmentCode,
        equipmentDescription,
        rejectionReason: motivo,
        rejectedAt: act.rejectedAt!,
        itemLabel,
      })

      await legacyQueueCreate({
        recipientUserId: delivererInfo.id,
        data: {
          toEmail: delivererInfo.email,
          subject: emailData.subject,
          body: emailData.html,
          status: 'pending',
          templateName: 'delivery_act_rejected',
          templateData: JSON.stringify({
            type: 'delivery_act_rejected',
            actId: act.id,
            folio: act.folio,
          }),
        },
      })

      // ── Notificaciones in-app ─────────────────────────────────────────────
      await Promise.all([
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'WARNING',
          title: `⚠️ Acta rechazada — ${equipmentCode}`,
          message: `${receiverInfo.name} rechazó el acta ${act.folio} para ${equipmentCode} (${equipmentDescription}). Motivo: "${motivo}". Vuelve a estar disponible. Fecha: ${rejectedAtStr}.`,
          metadata: {
            type: 'delivery_act_rejected',
            actId: act.id,
            folio: act.folio,
            equipmentId: act.assignment?.equipmentId,
            link: actLink,
          },
        }),
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'INFO',
          title: `Rechazo registrado — ${equipmentCode}`,
          message: `Rechazaste el acta ${act.folio} para ${equipmentCode}. El entregador ha sido notificado. Vuelve a estar disponible.`,
          metadata: {
            type: 'delivery_act_rejected',
            actId: act.id,
            folio: act.folio,
            equipmentId: act.assignment?.equipmentId,
            link: actLink,
          },
        }),
      ])

      const familyId = await getActFamilyId(act)
      await notifyDeliveryActFamilyAdmins(familyId, [delivererInfo.id], {
        type: 'WARNING',
        title: `Acta rechazada — ${equipmentCode}`,
        message: `${receiverInfo.name} rechazó el acta ${act.folio}. Motivo: "${motivo}". Entregador: ${delivererInfo.name}.`,
        metadata: {
          type: 'delivery_act_rejected',
          actId: act.id,
          folio: act.folio,
          equipmentId: act.assignment?.equipmentId,
          link: actLink,
        },
      })

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
            },
          },
          licenseAssignment: {
            include: { license: { include: { licenseType: true } } },
          },
        },
      })

      if (!act) {
        return
      }

      // Parsear campos JSON
      const equipmentSnapshot = parseJsonField<any>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<any>(act.receiverInfo)
      const delivererInfo = parseJsonField<any>(act.delivererInfo)

      const {
        itemCode: equipmentCode,
        itemDescription: equipmentDescription,
        itemLabel,
      } = getActItemDisplay(act, equipmentSnapshot)

      // Email para ambas partes
      const { systemName } = await getSystemBranding()

      const emailData = generateDeliveryActExpiredEmail({
        systemName,
        act: { ...act, equipmentSnapshot, receiverInfo, delivererInfo } as DeliveryAct,
        recipientName: receiverInfo.name,
        equipmentCode,
        equipmentDescription,
        expirationDate: act.expirationDate,
        itemLabel,
      })

      // Email al receptor
      await legacyQueueCreate({
        recipientUserId: receiverInfo.id,
        data: {
          toEmail: receiverInfo.email,
          subject: emailData.subject,
          body: emailData.html,
          status: 'pending',
          templateName: 'delivery_act_expired',
          templateData: JSON.stringify({
            type: 'delivery_act_expired',
            actId: act.id,
            folio: act.folio,
          }),
        },
      })

      // Email al entregador
      await legacyQueueCreate({
        recipientUserId: delivererInfo.id,
        data: {
          toEmail: delivererInfo.email,
          subject: `Acta Expirada - ${act.folio}`,
          body: emailData.html.replace(receiverInfo.name, delivererInfo.name),
          status: 'pending',
          templateName: 'delivery_act_expired',
          templateData: JSON.stringify({
            type: 'delivery_act_expired',
            actId: act.id,
            folio: act.folio,
          }),
        },
      })

      // Notificaciones in-app
      await Promise.all([
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'INVENTORY',
          title: 'Acta Expirada',
          message: `El acta ${act.folio} ha expirado sin ser aceptada.`,
          metadata: {
            type: 'delivery_act_expired',
            actId: act.id,
            folio: act.folio,
            link: `/inventory/acts/${act.id}`,
          },
        }),
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'INVENTORY',
          title: 'Acta Expirada',
          message: `El acta ${act.folio} ha expirado sin ser aceptada.`,
          metadata: {
            type: 'delivery_act_expired',
            actId: act.id,
            folio: act.folio,
            link: `/inventory/acts/${act.id}`,
          },
        }),
      ])

      console.log(`Notificaciones de expiración enviadas para ${act.folio}`)
    } catch (error) {
      console.error('Error enviando notificación de expiración:', error)
      throw error
    }
  }

  /**
   * Notificación al crear acta de entrega de suscripción/contrato (no equipo).
   */
  static async sendSubscriptionDeliveryActNotification(actId: string): Promise<void> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
        include: {
          contractAssignment: {
            include: {
              contract: { select: { id: true, name: true, familyId: true } },
            },
          },
        },
      })

      if (!act || act.actType !== 'SUBSCRIPTION_ASSIGNMENT') {
        throw new Error('Acta de suscripción no encontrada')
      }

      const snapshot = parseJsonField<Record<string, unknown>>(act.equipmentSnapshot)
      const receiverInfo = parseJsonField<{ id: string; name: string; email: string }>(
        act.receiverInfo
      )
      const delivererInfo = parseJsonField<{ id: string; name: string; email: string }>(
        act.delivererInfo
      )

      const contractName = String(snapshot.name ?? 'Suscripción')
      const contractRef = snapshot.contractNumber
        ? `${snapshot.contractNumber} — ${contractName}`
        : contractName

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const acceptanceUrl = `${baseUrl}/acts/${act.id}/accept?token=${act.acceptanceToken}`
      const expirationStr = new Date(act.expirationDate).toLocaleDateString('es-ES')

      const { systemName } = await getSystemBranding()

      const emailData = generateDeliveryActCreatedEmail({
        systemName,
        act: {
          ...act,
          equipmentSnapshot: snapshot,
          receiverInfo: { ...receiverInfo, role: 'CLIENT' },
          delivererInfo: { ...delivererInfo, role: 'ADMIN' },
        } as DeliveryAct,
        acceptanceUrl,
        receiverName: receiverInfo.name,
        delivererName: delivererInfo.name,
        equipmentCode: contractName,
        equipmentDescription: contractRef,
        expirationDate: act.expirationDate,
      })

      await legacyQueueCreate({
        recipientUserId: receiverInfo.id,
        data: {
          toEmail: receiverInfo.email,
          subject: emailData.subject.replace('Entrega', 'Asignación de suscripción'),
          body: emailData.html.replace(/equipo/gi, 'suscripción').replace(/Equipo/g, 'Suscripción'),
          status: 'pending',
          templateName: 'subscription_delivery_act_created',
          templateData: JSON.stringify({
            type: 'subscription_delivery_act_created',
            actId: act.id,
            folio: act.folio,
            contractId: act.contractAssignment?.contract.id,
          }),
        },
      })

      const actLink = `/acts/${act.id}/accept?token=${act.acceptanceToken}`

      await Promise.all([
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'INVENTORY',
          title: `Acta de asignación pendiente — ${contractName}`,
          message: `Debes firmar el acta ${act.folio} para la suscripción ${contractRef} antes del ${expirationStr}.`,
          metadata: {
            type: 'subscription_delivery_act_created',
            actId: act.id,
            folio: act.folio,
            contractId: act.contractAssignment?.contract.id,
            link: actLink,
          },
        }),
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'INVENTORY',
          title: `Acta generada — ${contractName}`,
          message: `Se generó el acta ${act.folio} para asignar ${contractRef} a ${receiverInfo.name}. Pendiente de firma.`,
          metadata: {
            type: 'subscription_delivery_act_created',
            actId: act.id,
            folio: act.folio,
            contractId: act.contractAssignment?.contract.id,
            link: `/inventory/acts/${act.id}`,
          },
        }),
      ])

      const familyId = act.contractAssignment?.contract.familyId
      await notifyDeliveryActFamilyAdmins(familyId, [delivererInfo.id], {
        type: 'INFO',
        title: `Nueva asignación — ${contractName}`,
        message: `Acta ${act.folio} generada para ${receiverInfo.name}. Suscripción: ${contractRef}.`,
        metadata: {
          type: 'subscription_delivery_act_created',
          actId: act.id,
          folio: act.folio,
          contractId: act.contractAssignment?.contract.id,
          link: `/inventory/acts/${act.id}`,
        },
      })
    } catch (error) {
      console.error('Error enviando notificación de acta de suscripción:', error)
      throw error
    }
  }

  /**
   * Notificación al crear acta de retiro de suscripción/contrato.
   */
  static async sendSubscriptionReturnActNotification(actId: string): Promise<void> {
    try {
      const act = await prisma.contract_return_acts.findUnique({
        where: { id: actId },
        include: {
          contractAssignment: {
            include: {
              contract: { select: { id: true, name: true, familyId: true } },
            },
          },
        },
      })

      if (!act) throw new Error('Acta de retiro no encontrada')

      const snapshot = parseJsonField<Record<string, unknown>>(act.contractSnapshot)
      const receiverInfo = parseJsonField<{ id: string; name: string; email: string }>(
        act.receiverInfo
      )
      const delivererInfo = parseJsonField<{ id: string; name: string; email: string }>(
        act.delivererInfo
      )

      const contractName = String(snapshot.name ?? 'Suscripción')
      const contractRef = snapshot.contractNumber
        ? `${snapshot.contractNumber} — ${contractName}`
        : contractName

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const acceptanceUrl = `${baseUrl}/acts/contract-return/${act.id}/accept?token=${act.acceptanceToken}`
      const expirationStr = new Date(act.expirationDate).toLocaleDateString('es-ES')

      await legacyQueueCreate({
        recipientUserId: receiverInfo.id,
        data: {
          toEmail: receiverInfo.email,
          subject: `Acta de retiro de suscripción — ${act.folio}`,
          body: `<p>Hola ${receiverInfo.name},</p><p>Debes firmar el acta de retiro ${act.folio} para la suscripción <strong>${contractRef}</strong> antes del ${expirationStr}.</p><p><a href="${acceptanceUrl}">Revisar y firmar acta</a></p>`,
          status: 'pending',
          templateName: 'subscription_return_act_created',
          templateData: JSON.stringify({
            type: 'subscription_return_act_created',
            actId: act.id,
            folio: act.folio,
          }),
        },
      })

      await Promise.all([
        NotificationService.push({
          userId: receiverInfo.id,
          type: 'INVENTORY',
          title: `Acta de retiro pendiente — ${contractName}`,
          message: `Debes firmar el acta ${act.folio} para el retiro de ${contractRef} antes del ${expirationStr}.`,
          metadata: {
            type: 'subscription_return_act_created',
            actId: act.id,
            folio: act.folio,
            contractId: act.contractAssignment?.contract.id,
            link: acceptanceUrl,
          },
        }),
        NotificationService.push({
          userId: delivererInfo.id,
          type: 'INVENTORY',
          title: `Acta de retiro generada — ${contractName}`,
          message: `Se generó el acta ${act.folio} para el retiro de ${contractRef} de ${receiverInfo.name}.`,
          metadata: {
            type: 'subscription_return_act_created',
            actId: act.id,
            folio: act.folio,
            contractId: act.contractAssignment?.contract.id,
            link: `/acts/contract-return/${act.id}/accept`,
          },
        }),
      ])

      const familyId = act.contractAssignment?.contract.familyId
      await notifyDeliveryActFamilyAdmins(familyId, [delivererInfo.id], {
        type: 'INFO',
        title: `Retiro de suscripción — ${contractName}`,
        message: `Acta de retiro ${act.folio} para ${receiverInfo.name}. Suscripción: ${contractRef}.`,
        metadata: {
          type: 'subscription_return_act_created',
          actId: act.id,
          folio: act.folio,
          contractId: act.contractAssignment?.contract.id,
        },
      })
    } catch (error) {
      console.error('Error enviando notificación de retiro de suscripción:', error)
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
          },
        },
        select: { id: true },
      })

      return acts.map(act => act.id)
    } catch (error) {
      console.error('Error obteniendo actas para recordatorios:', error)
      throw error
    }
  }
}
