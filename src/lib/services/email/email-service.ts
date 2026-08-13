/**
 * Servicio Profesional de Email
 * Maneja envío de emails con cola, reintentos y templates
 */

import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '../audit-service-complete'
import { getUnifiedSmtpConfig, resolveSmtpSecure } from './smtp-config'
import type { TicketEmailEvent } from '@/lib/notifications/email-prefs'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import type {
  EmailModule,
  EmailPriority,
  NotificationEmailEvent,
} from '@/lib/notifications/email-policy'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  template?: string
  templateData?: Record<string, any>
  /** Prioridad SMTP/nodemailer (legacy); no confundir con notificationPriority */
  priority?: 'high' | 'normal' | 'low'
  scheduledAt?: Date
  /** Destinatario (usuario) para respetar preferencias */
  recipientUserId?: string
  /** Evento de ticket (compat); implica module=tickets */
  ticketEmailEvent?: TicketEmailEvent
  /** Módulo de política global */
  module?: EmailModule
  /** Evento de política global */
  event?: NotificationEmailEvent
  /** Prioridad de política (critical | important | optional) */
  notificationPriority?: EmailPriority
}

export interface EmailQueueItem {
  id: string
  toEmail: string
  subject: string
  body: string
  templateName?: string
  templateData?: any
  status: 'pending' | 'sending' | 'sent' | 'failed'
  attempts: number
  maxAttempts: number
  scheduledAt: Date
  sentAt?: Date
  errorMessage?: string
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null
  private static isConfigured = false
  // Hash de la última config usada para detectar cambios y forzar reconexión
  private static configHash: string = ''

  private static async getSMTPConfig() {
    const cfg = await getUnifiedSmtpConfig()
    if (!cfg) return null
    return {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      user: cfg.user,
      password: cfg.password,
      from: cfg.from,
    }
  }

  /** Hash simple de la config para detectar si cambió desde la última conexión */
  private static hashConfig(
    cfg: NonNullable<Awaited<ReturnType<typeof EmailService.getSMTPConfig>>>
  ): string {
    return `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.password}`
  }

  /**
   * Inicializa el transporter de email.
   * Siempre refresca si la config de BD cambió respecto a la última conexión.
   */
  private static async getTransporter(): Promise<nodemailer.Transporter> {
    const smtpConfig = await this.getSMTPConfig()

    if (!smtpConfig) {
      this.transporter = null
      this.isConfigured = false
      this.configHash = ''
      throw new Error(
        'Configuración SMTP no encontrada o correo desactivado. Configure en Admin > Configuración'
      )
    }

    const currentHash = this.hashConfig(smtpConfig)

    // Reutilizar solo si el transporter existe Y la config no cambió
    if (this.transporter && this.isConfigured && this.configHash === currentHash) {
      return this.transporter
    }

    // Cerrar conexión anterior si existe
    if (this.transporter) {
      try {
        this.transporter.close()
      } catch {
        /* ignorar */
      }
    }

    const transportOpts: nodemailer.TransportOptions = {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: resolveSmtpSecure(smtpConfig.port, smtpConfig.secure),
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // STARTTLS: puerto 587 siempre requiere upgrade aunque secure=false
      ...(smtpConfig.port === 587 && { requireTLS: true }),
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    } as nodemailer.TransportOptions

    if (smtpConfig.password) {
      ;(transportOpts as any).auth = {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      }
    }

    this.transporter = nodemailer.createTransport(transportOpts)
    this.isConfigured = true
    this.configHash = currentHash
    return this.transporter
  }

  /**
   * Envía un email inmediatamente
   */
  static async sendEmail(options: EmailOptions, userId?: string): Promise<boolean> {
    try {
      const transporter = await this.getTransporter()
      const smtpConfig = await this.getSMTPConfig()

      if (!smtpConfig) {
        throw new Error('SMTP no configurado')
      }

      // Preparar contenido
      let html = options.html
      let text = options.text

      // Si se especifica template, renderizarlo
      if (options.template && options.templateData) {
        const rendered = await this.renderTemplate(options.template, options.templateData)
        html = rendered.html
        text = rendered.text
      }

      // Enviar email
      const recipients = Array.isArray(options.to) ? options.to : [options.to]

      for (const recipient of recipients) {
        await transporter.sendMail({
          from: smtpConfig.from,
          to: recipient,
          subject: options.subject,
          html,
          text,
          priority: options.priority || 'normal',
        })
      }

      // Registrar en auditoría
      if (userId) {
        await AuditServiceComplete.logAction({
          userId,
          action: AuditActionsComplete.EMAIL_SENT,
          entityType: 'system',
          entityId: randomUUID(),
          details: {
            to: recipients,
            subject: options.subject,
            template: options.template,
          },
        })
      }

      return true
    } catch (error) {
      console.error('[EMAIL-SERVICE] Error sending email:', error)

      // Registrar error en auditoría
      if (userId) {
        await AuditServiceComplete.logAction({
          userId,
          action: AuditActionsComplete.EMAIL_SENT,
          entityType: 'system',
          entityId: randomUUID(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false,
          },
        }).catch(console.error)
      }

      return false
    }
  }

  /**
   * Agrega un email a la cola (vía puerta global: SMTP + prefs + prioridad).
   */
  static async queueEmail(options: EmailOptions, userId?: string): Promise<string> {
    try {
      let html = options.html || ''
      let text = options.text || ''

      if (options.template && options.templateData) {
        const rendered = await this.renderTemplate(options.template, options.templateData)
        html = rendered.html
        text = rendered.text
      }

      const emailModule: EmailModule =
        options.module || (options.ticketEmailEvent ? 'tickets' : 'system')
      const event: NotificationEmailEvent =
        options.event ||
        options.ticketEmailEvent ||
        (emailModule === 'auth' ? 'security' : 'generic')

      const queueIds = await queueNotificationEmail({
        to: options.to,
        subject: options.subject,
        html: html || text,
        text,
        recipientUserId: options.recipientUserId,
        module: emailModule,
        event,
        priority: options.notificationPriority,
        templateName: options.template,
        templateData: options.templateData,
        scheduledAt: options.scheduledAt,
        actorUserId: userId,
      })

      if (userId && queueIds[0]) {
        await AuditServiceComplete.logAction({
          userId,
          action: AuditActionsComplete.EMAIL_QUEUED,
          entityType: 'system',
          entityId: queueIds[0],
          details: {
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: options.subject,
            template: options.template,
            queueIds,
            module,
            event,
            ticketEmailEvent: options.ticketEmailEvent,
          },
        })
      }

      return queueIds[0] || ''
    } catch (error) {
      console.error('[EMAIL-SERVICE] Error queueing email:', error)
      throw error
    }
  }

  /**
   * Procesa la cola de emails pendientes
   */
  static async processQueue(): Promise<{ sent: number; failed: number }> {
    try {
      const now = new Date()

      // Obtener emails pendientes que deben enviarse.
      // NOTA: no comparamos attempts < maxAttempts en el where de Prisma porque
      // prisma.email_queue.fields.maxAttempts es el descriptor del campo, no un valor.
      // Filtramos con una condición raw equivalente a: attempts < maxAttempts
      const pendingEmails = await prisma.email_queue.findMany({
        where: {
          status: 'pending',
          scheduledAt: { lte: now },
        },
        take: 50,
        orderBy: { scheduledAt: 'asc' },
      })

      // Filtrar en memoria los que aún tienen reintentos disponibles
      const actionable = pendingEmails.filter(e => e.attempts < e.maxAttempts)

      let sent = 0
      let failed = 0

      for (const email of actionable) {
        try {
          // Marcar como enviando e incrementar intentos
          await prisma.email_queue.update({
            where: { id: email.id },
            data: {
              status: 'sending',
              attempts: { increment: 1 },
            },
          })

          // Renderizar template si corresponde
          let html = email.body
          let text: string | undefined
          if (email.templateName && email.templateData) {
            try {
              const data =
                typeof email.templateData === 'string'
                  ? JSON.parse(email.templateData)
                  : (email.templateData as Record<string, unknown>)
              const rendered = await this.renderTemplate(email.templateName, data)
              html = rendered.html
              text = rendered.text
            } catch {
              // Usar body crudo si el template falla
            }
          }

          const success = await this.sendEmail({
            to: email.toEmail,
            subject: email.subject,
            html,
            text,
          })

          if (success) {
            await prisma.email_queue.update({
              where: { id: email.id },
              data: { status: 'sent', sentAt: new Date() },
            })
            sent++
          } else {
            throw new Error('sendEmail devolvió false')
          }
        } catch (error) {
          // attempts ya fue incrementado en BD; releer para decidir si fallar definitivamente
          const current = await prisma.email_queue.findUnique({
            where: { id: email.id },
            select: { attempts: true, maxAttempts: true },
          })
          const exhausted = current ? current.attempts >= current.maxAttempts : true
          await prisma.email_queue.update({
            where: { id: email.id },
            data: {
              status: exhausted ? 'failed' : 'pending',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          })
          if (exhausted) failed++
        }
      }

      return { sent, failed }
    } catch (error) {
      console.error('[EMAIL-SERVICE] Error processing queue:', error)
      return { sent: 0, failed: 0 }
    }
  }

  /**
   * Renderiza un template de email
   */
  private static async renderTemplate(
    templateName: string,
    data: Record<string, any>
  ): Promise<{ html: string; text: string }> {
    // Importar template dinámicamente e inyectar branding del sistema
    try {
      const { getSystemBranding } = await import('@/lib/branding')
      const branding = await getSystemBranding()
      const enrichedData = {
        ...data,
        systemName: data.systemName || branding.systemName,
        heroTitle: data.heroTitle || branding.heroTitle,
        companyName: data.companyName || branding.companyName,
      }

      const template = await import(`./templates/${templateName}`)
      return template.default(enrichedData)
    } catch (error) {
      console.error(`[EMAIL-SERVICE] Template not found: ${templateName}`)
      // Fallback a template básico
      return {
        html: `<p>${data.message || 'Notificación del sistema'}</p>`,
        text: data.message || 'Notificación del sistema',
      }
    }
  }

  /**
   * Verifica la configuración SMTP
   */
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter()
      await transporter.verify()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Limpia emails antiguos de la cola
   */
  static async cleanupOldEmails(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const result = await prisma.email_queue.deleteMany({
        where: {
          OR: [
            { status: 'sent', sentAt: { lt: cutoffDate } },
            { status: 'failed', createdAt: { lt: cutoffDate } },
          ],
        },
      })

      return result.count
    } catch (error) {
      console.error('[EMAIL-SERVICE] Error cleaning up emails:', error)
      return 0
    }
  }

  /** Cierra el pool SMTP para forzar reconexión tras cambiar configuración en Admin. */
  static resetTransporter(): void {
    if (this.transporter) {
      try {
        this.transporter.close()
      } catch {
        /* ignorar */
      }
    }
    this.transporter = null
    this.isConfigured = false
    this.configHash = ''
  }
}
