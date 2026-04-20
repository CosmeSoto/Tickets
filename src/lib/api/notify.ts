/**
 * Helpers de notificación para rutas API del servidor.
 *
 * Centraliza el patrón repetido en 40+ rutas:
 *   await NotificationService.push({ userId, type, title, message, metadata })
 *   await prisma.email_queue.create({ data: { id: randomUUID(), toEmail, subject, body, ... } })
 *
 * Uso:
 *   import { notifyUser, notifyAdmins, notifyMany, enqueueEmail } from '@/lib/api/notify'
 *
 *   // Notificación in-app a un usuario
 *   await notifyUser(userId, 'SUCCESS', 'Título', 'Mensaje', { link: '/ruta' })
 *
 *   // Notificación in-app a todos los admins
 *   await notifyAdmins('WARNING', 'Título', 'Mensaje', { link: '/ruta' })
 *
 *   // Notificación in-app + email en una sola llamada
 *   await notifyUser(userId, 'SUCCESS', 'Título', 'Mensaje', { link: '/ruta' }, {
 *     email: { to: user.email, subject: 'Asunto', html: '<p>...</p>' }
 *   })
 */

import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { randomUUID } from 'crypto'
import type { NotificationType } from '@prisma/client'

export interface EmailPayload {
  to: string
  subject: string
  html: string
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
    await enqueueEmail(email).catch(() => {})
  }
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
    admins.map((admin) =>
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
    admins.map((admin) =>
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
    userIds.map((userId) =>
      NotificationService.push({ userId, type, title, message, metadata })
    )
  )
}

// ─── Encolar email ────────────────────────────────────────────────────────────

export async function enqueueEmail(payload: EmailPayload): Promise<void> {
  await prisma.email_queue.create({
    data: {
      id: randomUUID(),
      toEmail: payload.to,
      subject: payload.subject,
      body: payload.html,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: new Date(),
    },
  })
}

// ─── Notificar usuario + encolar email en una sola llamada ───────────────────

export async function notifyUserWithEmail(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  email: EmailPayload,
  metadata?: Record<string, any>
): Promise<void> {
  await Promise.allSettled([
    NotificationService.push({ userId, type, title, message, metadata }),
    enqueueEmail(email),
  ])
}

// ─── Notificar admins + encolar email a uno específico ───────────────────────

export async function notifyAdminsWithEmail(
  type: NotificationType,
  title: string,
  message: string,
  email: EmailPayload,
  metadata?: Record<string, any>
): Promise<void> {
  const admins = await prisma.users.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })

  await Promise.allSettled([
    ...admins.map((admin) =>
      NotificationService.push({ userId: admin.id, type, title, message, metadata })
    ),
    enqueueEmail(email),
  ])
}
