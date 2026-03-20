/**
 * Servicio de Webhooks
 * Maneja el envío de eventos a URLs externas con reintentos y seguridad
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createHmac } from 'crypto'

export interface WebhookPayload {
  event: string
  timestamp: string
  data: any
}

export interface WebhookConfig {
  id: string
  name: string
  url: string
  events: string[]
  secret: string
  isActive: boolean
  headers?: Record<string, string>
  timeoutMs: number
  retryCount: number
}

export class WebhookService {
  /**
   * Eventos soportados por el sistema
   */
  static readonly EVENTS = {
    // Tickets
    TICKET_CREATED: 'ticket.created',
    TICKET_UPDATED: 'ticket.updated',
    TICKET_ASSIGNED: 'ticket.assigned',
    TICKET_RESOLVED: 'ticket.resolved',
    TICKET_CLOSED: 'ticket.closed',
    TICKET_REOPENED: 'ticket.reopened',
    
    // Comentarios
    COMMENT_ADDED: 'comment.added',
    
    // Usuarios
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    
    // Categorías
    CATEGORY_CREATED: 'category.created',
    CATEGORY_UPDATED: 'category.updated',
    
    // SLA
    SLA_VIOLATED: 'sla.violated',
    SLA_WARNING: 'sla.warning'
  }

  /**
   * Dispara un evento a todos los webhooks suscritos
   */
  static async trigger(event: string, data: any): Promise<void> {
    try {
      // Obtener webhooks activos suscritos a este evento
      const webhooks = await prisma.webhooks.findMany({
        where: {
          isActive: true,
          events: {
            has: event
          }
        }
      })

      if (webhooks.length === 0) {
        return
      }

      // Disparar webhooks en paralelo
      const promises = webhooks.map(webhook =>
        this.sendWebhook(webhook, event, data)
      )

      await Promise.allSettled(promises)
    } catch (error) {
      console.error('[WEBHOOK] Error disparando evento:', error)
    }
  }

  /**
   * Envía un webhook a una URL específica
   */
  private static async sendWebhook(
    webhook: any,
    event: string,
    data: any,
    attempt: number = 1
  ): Promise<void> {
    const startTime = Date.now()
    const logId = randomUUID()

    try {
      // Preparar payload
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data
      }

      // Generar firma HMAC
      const signature = this.generateSignature(payload, webhook.secret)

      // Preparar headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-ID': webhook.id,
        'X-Webhook-Attempt': attempt.toString(),
        'User-Agent': 'Sistema-Tickets-Webhook/1.0'
      }

      // Agregar headers personalizados
      if (webhook.headers) {
        Object.assign(headers, webhook.headers)
      }

      // Enviar webhook con timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs || 30000)

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const duration = Date.now() - startTime
      const responseBody = await response.text().catch(() => '')

      // Registrar log exitoso
      await prisma.webhook_logs.create({
        data: {
          id: logId,
          webhookId: webhook.id,
          event,
          payload: payload as any,
          responseStatus: response.status,
          responseBody: responseBody.substring(0, 1000), // Limitar a 1000 caracteres
          durationMs: duration,
          attempt
        }
      })

      // Actualizar última ejecución
      await prisma.webhooks.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date() }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseBody}`)
      }

      console.log(`[WEBHOOK] ✅ Enviado a ${webhook.name} (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error(`[WEBHOOK] ❌ Error enviando a ${webhook.name}:`, errorMessage)

      // Registrar log de error
      await prisma.webhook_logs.create({
        data: {
          id: logId,
          webhookId: webhook.id,
          event,
          payload: { event, data } as any,
          errorMessage,
          durationMs: duration,
          attempt
        }
      })

      // Reintentar si no se alcanzó el máximo
      if (attempt < (webhook.retryCount || 3)) {
        console.log(`[WEBHOOK] Reintentando ${webhook.name} (intento ${attempt + 1})`)
        
        // Esperar con backoff exponencial
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        await this.sendWebhook(webhook, event, data, attempt + 1)
      }
    }
  }

  /**
   * Genera firma HMAC para el payload
   */
  private static generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = createHmac('sha256', secret)
    hmac.update(JSON.stringify(payload))
    return hmac.digest('hex')
  }

  /**
   * Verifica la firma de un webhook (para endpoints que reciben webhooks)
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    return signature === expectedSignature
  }

  /**
   * Crea un nuevo webhook
   */
  static async create(data: {
    name: string
    url: string
    events: string[]
    secret?: string
    headers?: Record<string, string>
    timeoutMs?: number
    retryCount?: number
    createdBy: string
  }): Promise<any> {
    const secret = data.secret || this.generateSecret()

    return await prisma.webhooks.create({
      data: {
        id: randomUUID(),
        name: data.name,
        url: data.url,
        events: data.events,
        secret,
        headers: data.headers as any,
        timeoutMs: data.timeoutMs || 30000,
        retryCount: data.retryCount || 3,
        createdBy: data.createdBy,
        isActive: true
      }
    })
  }

  /**
   * Actualiza un webhook
   */
  static async update(id: string, data: Partial<{
    name: string
    url: string
    events: string[]
    headers: Record<string, string>
    timeoutMs: number
    retryCount: number
    isActive: boolean
  }>): Promise<any> {
    return await prisma.webhooks.update({
      where: { id },
      data: {
        ...data,
        headers: data.headers as any
      }
    })
  }

  /**
   * Elimina un webhook
   */
  static async delete(id: string): Promise<void> {
    await prisma.webhooks.delete({
      where: { id }
    })
  }

  /**
   * Obtiene logs de un webhook
   */
  static async getLogs(webhookId: string, limit: number = 50): Promise<any[]> {
    return await prisma.webhook_logs.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }

  /**
   * Prueba un webhook enviando un evento de test
   */
  static async test(webhookId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const webhook = await prisma.webhooks.findUnique({
        where: { id: webhookId }
      })

      if (!webhook) {
        return { success: false, error: 'Webhook no encontrado' }
      }

      await this.sendWebhook(webhook, 'test.ping', {
        message: 'Este es un evento de prueba',
        timestamp: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  /**
   * Genera un secret aleatorio para webhooks
   */
  private static generateSecret(): string {
    return randomUUID() + randomUUID()
  }

  /**
   * Obtiene estadísticas de webhooks
   */
  static async getStats(webhookId?: string): Promise<{
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    avgDuration: number
    successRate: number
  }> {
    const where = webhookId ? { webhookId } : {}

    const [total, successful, failed, avgDuration] = await Promise.all([
      prisma.webhook_logs.count({ where }),
      prisma.webhook_logs.count({
        where: { ...where, responseStatus: { gte: 200, lt: 300 } }
      }),
      prisma.webhook_logs.count({
        where: { ...where, errorMessage: { not: null } }
      }),
      prisma.webhook_logs.aggregate({
        where,
        _avg: { durationMs: true }
      })
    ])

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      avgDuration: Math.round(avgDuration._avg.durationMs || 0),
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0
    }
  }
}
