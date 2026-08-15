/**
 * Política de alertas Telegram por módulo y prioridad.
 *
 * Misma filosofía que email-policy:
 *   critical   → seguridad / operaciones de backups irreversibles
 *   important  → operativo (tickets, inventario, backups fallidos, rondas)
 *   optional   → ruido / opt-in — NUNCA se envía por Telegram
 *
 * Por defecto solo se envían critical + important.
 * El usuario puede desactivar Telegram desde sus preferencias (telegramNotifications).
 */

import type { TelegramPriority } from '@/lib/services/telegram.service'
import type { EmailModule, NotificationEmailEvent } from './email-policy'

// ─── Módulos ──────────────────────────────────────────────────────────────────

// Re-exportamos los tipos compatibles para que queueTelegramNotification
// use la misma firma que queueNotificationEmail.
export type TelegramModule = EmailModule

/**
 * Eventos Telegram — superset de NotificationEmailEvent.
 * Se añaden los eventos de patrullas que no existen en el canal email
 * (rondas solo notifican por Telegram e in-app, no por correo).
 */
export type TelegramEvent =
  | NotificationEmailEvent
  // Rondas
  | 'patrolAssigned' // Schedule creado o agente modificado
  | 'patrolReminder' // Recordatorio pre-ronda (X min antes del scheduledStart)
  | 'patrolMissed' // Ronda marcada como MISSED o auto-cerrada como INCOMPLETE
  | 'patrolCancelled' // Schedule desactivado → rondas pendientes canceladas

// ─── Tabla de prioridades ─────────────────────────────────────────────────────

export const TELEGRAM_EVENT_PRIORITY: Record<TelegramEvent, TelegramPriority> = {
  // Tickets
  security: 'critical',
  ticketCreated: 'important',
  ticketAssigned: 'important',
  statusChanged: 'important',
  newComments: 'optional',
  ticketUpdated: 'optional',
  digest: 'optional',
  generic: 'optional',
  // Inventario
  inventoryAct: 'important',
  inventoryAlert: 'important',
  inventoryReport: 'optional',
  // Backups
  backupFailure: 'critical', // más urgente en Telegram que en email
  backupSuccess: 'optional',
  // Procesos y procedimientos
  processReview: 'important',
  processReviewDue: 'important',
  processPublished: 'optional',
  // Rondas — todas important (canal operativo del staff de seguridad)
  patrolAssigned: 'important',
  patrolReminder: 'important',
  patrolMissed: 'important',
  patrolCancelled: 'important',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function resolveTelegramPriority(
  event: TelegramEvent | undefined,
  explicit?: TelegramPriority
): TelegramPriority {
  if (explicit) return explicit
  if (event) return TELEGRAM_EVENT_PRIORITY[event]
  return 'optional'
}

/**
 * Decide si un evento debe enviarse por Telegram.
 * optional siempre se omite — Telegram es canal operativo, no de ruido.
 */
export function shouldSendViaTelegram(priority: TelegramPriority): boolean {
  return priority === 'critical' || priority === 'important'
}
