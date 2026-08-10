/**
 * Helpers de notificación para rutas API del servidor.
 *
 * Centraliza el patrón repetido en 40+ rutas:
 *   await NotificationService.push({ userId, type, title, message, metadata })
 *   await enqueueEmail({ to, subject, html, module, event, priority, recipientUserId })
 *
 * Uso:
 *   import { notifyUser, notifyAdmins, notifyMany, enqueueEmail } from '@/lib/api/notify'
 *
 *   // Notificación in-app a un usuario
 *   await notifyUser(userId, 'SUCCESS', 'Título', 'Mensaje', { link: '/ruta' })
 *
 *   // Notificación in-app a super admins + admin nativo de la familia
 *   await notifyFamilyScopedAdmins(familyId, 'WARNING', 'Título', 'Mensaje', { link: '/ruta' })
 *
 *   // Notificación in-app a todos los admins (eventos globales del sistema)
 *   await notifyAdmins('WARNING', 'Título', 'Mensaje', { link: '/ruta' })
 *
 *   // Notificación in-app + email en una sola llamada
 *   await notifyUser(userId, 'SUCCESS', 'Título', 'Mensaje', { link: '/ruta' }, {
 *     email: { to: user.email, subject: 'Asunto', html: '<p>...</p>' }
 *   })
 */

import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import {
  getFamilyScopedAdmins,
  getFamilyScopedAdminsForFamilies,
} from '@/lib/notifications/family-recipients'
import type { NotificationType } from '@prisma/client'

export interface EmailPayload {
  to: string
  subject: string
  html: string
  recipientUserId?: string
  module?: import('@/lib/notifications/email-policy').EmailModule
  event?: import('@/lib/notifications/email-policy').NotificationEmailEvent
  priority?: import('@/lib/notifications/email-policy').EmailPriority
}

export interface NotifyOptions {
  /** Si se provee, encola un email además de la notificación in-app */
  email?: EmailPayload
  /** Metadatos adicionales para la notificación (link, ids, etc.) */
  metadata?: Record<string, any>
}

// ─── Notificar a un usuario específico ───────────────────────────────────────

export async function notifyUser(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options: NotifyOptions = {}
): Promise<void> {
  const { email, metadata } = options

  await NotificationService.push({
    userId,
    type,
    title,
    message,
    metadata,
  }).catch(() => {})

  if (email) {
    await enqueueEmail({
      ...email,
      recipientUserId: userId,
      module: email.module || 'system',
      event: email.event || 'generic',
      priority: email.priority || 'optional',
    }).catch(() => {})
  }
}

// ─── Notificar a super admins + admin nativo de familia ───────────────────────

export async function notifyFamilyScopedAdmins(
  familyId: string | null | undefined,
  type: NotificationType,
  title: string,
  message: string,
  options: NotifyOptions = {}
): Promise<void> {
  const { metadata } = options
  const admins = await getFamilyScopedAdmins(familyId, { id: true })

  await Promise.allSettled(
    admins.map(admin =>
      NotificationService.push({ userId: admin.id, type, title, message, metadata })
    )
  )
}

/** Igual que notifyFamilyScopedAdmins pero excluye un usuario (p. ej. quien realizó la acción). */
export async function notifyFamilyScopedAdminsExcept(
  familyId: string | null | undefined,
  excludeUserId: string,
  type: NotificationType,
  title: string,
  message: string,
  options: NotifyOptions = {}
): Promise<void> {
  const { metadata } = options
  const admins = await getFamilyScopedAdmins(familyId, { id: true })

  await Promise.allSettled(
    admins
      .filter(admin => admin.id !== excludeUserId)
      .map(admin => NotificationService.push({ userId: admin.id, type, title, message, metadata }))
  )
}

/** Notifica admins de varias familias (p. ej. categoría movida entre áreas). */
export async function notifyFamilyScopedAdminsForFamiliesExcept(
  familyIds: (string | null | undefined)[],
  excludeUserId: string,
  type: NotificationType,
  title: string,
  message: string,
  options: NotifyOptions = {}
): Promise<void> {
  const { metadata } = options
  const admins = await getFamilyScopedAdminsForFamilies(familyIds, { id: true })

  await Promise.allSettled(
    admins
      .filter(admin => admin.id !== excludeUserId)
      .map(admin => NotificationService.push({ userId: admin.id, type, title, message, metadata }))
  )
}

// ─── Notificar a todos los admins ─────────────────────────────────────────────

export async function notifyAdmins(
  type: NotificationType,
  title: string,
  message: string,
  options: NotifyOptions = {}
): Promise<void> {
  const { metadata } = options

  const admins = await prisma.users.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })

  await Promise.allSettled(
    admins.map(admin =>
      NotificationService.push({ userId: admin.id, type, title, message, metadata })
    )
  )
}

// ─── Notificar a admins excluyendo uno (ej: el que realizó la acción) ─────────

export async function notifyAdminsExcept(
  excludeUserId: string,
  type: NotificationType,
  title: string,
  message: string,
  options: NotifyOptions = {}
): Promise<void> {
  const { metadata } = options

  const admins = await prisma.users.findMany({
    where: { role: 'ADMIN', isActive: true, id: { not: excludeUserId } },
    select: { id: true },
  })

  await Promise.allSettled(
    admins.map(admin =>
      NotificationService.push({ userId: admin.id, type, title, message, metadata })
    )
  )
}

// ─── Notificar a múltiples usuarios ──────────────────────────────────────────

export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  options: NotifyOptions = {}
): Promise<void> {
  const { metadata } = options

  await Promise.allSettled(
    userIds.map(userId => NotificationService.push({ userId, type, title, message, metadata }))
  )
}

// ─── Encolar email ────────────────────────────────────────────────────────────

export async function enqueueEmail(
  payload: EmailPayload & {
    recipientUserId?: string
    module?: import('@/lib/notifications/email-policy').EmailModule
    event?: import('@/lib/notifications/email-policy').NotificationEmailEvent
    priority?: import('@/lib/notifications/email-policy').EmailPriority
  }
): Promise<void> {
  const { queueNotificationEmail } = await import(
    '@/lib/notifications/queue-notification-email'
  )
  await queueNotificationEmail({
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    recipientUserId: payload.recipientUserId,
    module: payload.module || 'system',
    event: payload.event || 'generic',
    priority: payload.priority || 'optional',
  })
}
