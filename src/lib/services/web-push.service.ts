/**
 * Servicio de Web Push Notifications.
 *
 * Responsabilidades:
 * - Registrar/eliminar suscripciones push de dispositivos
 * - Enviar notificaciones push a usuarios (incluso con navegador cerrado)
 * - Limpiar suscripciones expiradas o inválidas
 * - Respetar preferencias de usuario (pushNotifications, quietHours)
 *
 * Requiere variables de entorno:
 * - VAPID_PUBLIC_KEY: clave pública VAPID (se comparte con el frontend)
 * - VAPID_PRIVATE_KEY: clave privada VAPID (solo backend)
 * - VAPID_SUBJECT: email o URL de contacto (ej: "mailto:admin@tudominio.com")
 */

import webPush from 'web-push'
import prisma from '@/lib/prisma'

// Acceso al modelo push_subscriptions (se agrega al schema pero el client
// no lo conoce hasta correr prisma generate en producción)
const db = prisma as any

// ── Configuración VAPID ──────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@sistema-tickets.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface PushPayload {
  /** Título de la notificación */
  title: string
  /** Cuerpo/mensaje */
  body: string
  /** URL a abrir al hacer click */
  url?: string
  /** ID de la notificación en BD */
  id?: string
  /** ID del ticket relacionado */
  ticketId?: string
  /** Metadata adicional */
  metadata?: Record<string, any>
}

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// ── Servicio ─────────────────────────────────────────────────────────────────

export class WebPushService {
  /**
   * Verifica si Web Push está configurado correctamente.
   */
  static isConfigured(): boolean {
    return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
  }

  /**
   * Retorna la clave pública VAPID para que el frontend la use al suscribirse.
   */
  static getPublicKey(): string {
    return VAPID_PUBLIC_KEY
  }

  /**
   * Registra o actualiza una suscripción push para un usuario.
   * Si el endpoint ya existe, actualiza las claves y el userAgent.
   */
  static async subscribe(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent?: string
  ): Promise<void> {
    await db.push_subscriptions.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.substring(0, 500),
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.substring(0, 500),
      },
    })
  }

  /**
   * Elimina una suscripción push (cuando el usuario desactiva notificaciones
   * o se desuscribe manualmente).
   */
  static async unsubscribe(endpoint: string): Promise<void> {
    await db.push_subscriptions.deleteMany({
      where: { endpoint },
    })
  }

  /**
   * Elimina todas las suscripciones de un usuario (logout global, cuenta desactivada).
   */
  static async unsubscribeAll(userId: string): Promise<void> {
    await db.push_subscriptions.deleteMany({
      where: { userId },
    })
  }

  /**
   * Envía una notificación push a todos los dispositivos de un usuario.
   * Si alguna suscripción es inválida (410 Gone), la elimina automáticamente.
   *
   * @returns Número de dispositivos a los que se envió exitosamente
   */
  static async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    if (!this.isConfigured()) {
      console.warn('[WebPush] VAPID keys no configuradas — notificación push omitida')
      return 0
    }

    // Obtener todas las suscripciones activas del usuario
    const subscriptions = await db.push_subscriptions.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) return 0

    const jsonPayload = JSON.stringify(payload)
    let successCount = 0
    const expiredEndpoints: string[] = []

    // Enviar a cada dispositivo en paralelo
    await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            jsonPayload,
            { TTL: 60 * 60 * 4 } // 4 horas de vida máxima en la cola del push service
          )
          successCount++
        } catch (error: any) {
          // 404 o 410 = suscripción expirada/inválida → eliminar
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            expiredEndpoints.push(sub.endpoint)
          } else {
            console.error(
              `[WebPush] Error enviando a ${sub.endpoint.substring(0, 60)}...:`,
              error?.statusCode || error?.message
            )
          }
        }
      })
    )

    // Limpiar suscripciones expiradas
    if (expiredEndpoints.length > 0) {
      await db.push_subscriptions.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      })
    }

    return successCount
  }

  /**
   * Envía una notificación push a múltiples usuarios.
   *
   * @returns Total de dispositivos a los que se envió exitosamente
   */
  static async sendToMany(userIds: string[], payload: PushPayload): Promise<number> {
    if (!this.isConfigured() || userIds.length === 0) return 0

    const results = await Promise.allSettled(
      userIds.map(userId => this.sendToUser(userId, payload))
    )

    return results.reduce((total, r) => {
      return total + (r.status === 'fulfilled' ? r.value : 0)
    }, 0)
  }

  /**
   * Cuenta las suscripciones activas de un usuario (para mostrar en UI).
   */
  static async getSubscriptionCount(userId: string): Promise<number> {
    return db.push_subscriptions.count({ where: { userId } })
  }
}
