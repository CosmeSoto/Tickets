/**
 * Servicio Profesional de Email
 * Maneja envío de emails con cola, reintentos y templates
 */

import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '../audit-service-complete'
import { getUnifiedSmtpConfig, isSystemEmailEnabled } from './smtp-config'
import {
  canSendTicketEmail,
  type TicketEmailEvent,
} from '@/lib/notifications/ticket-email-prefs'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  template?: string
  templateData?: Record<string, any>
  priority?: 'high' | 'normal' | 'low'
  scheduledAt?: Date
  /** Destinatario (usuario) para respetar preferencias de tickets */
  recipientUserId?: string
  /** Evento de ticket; si se omite no se aplican prefs finas de tickets */
  ticketEmailEvent?: TicketEmailEvent
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

  /**
   * Inicializa el transporter de email
   */
  private static async getTransporter(): Promise<nodemailer.Transporter> {
    const smtpConfig = await this.getSMTPConfig()

    if (!smtpConfig) {
      this.transporter = null
      this.isConfigured = false
      throw new Error(
        'Configuración SMTP no encontrada o correo desactivado. Configure en Admin > Configuración'
      )
    }

    if (this.transporter && this.isConfigured) {
      return this.transporter
    }

    const transportOpts: any = {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    }

    if (smtpConfig.password) {
      transportOpts.auth = {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      }
    }

    this.transporter = nodemailer.createTransport(transportOpts)
    this.isConfigured = true
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
          priority: options.priority || 'normal'
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
            template: options.template
          }
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
            success: false
          }
        }).catch(console.error)
      }

      return false
    }
  }

  /**
   * Agrega un email a la cola para envío posterior
   */
  static async queueEmail(options: EmailOptions, userId?: string): Promise<string> {
    try {
      if (!(await isSystemEmailEnabled())) {
        console.log('[EMAIL-SERVICE] Cola omitida: SMTP desactivado o sin configurar')
        return ''
      }

      if (options.ticketEmailEvent && options.recipientUserId) {
        const allowed = await canSendTicketEmail(
          options.recipientUserId,
          options.ticketEmailEvent
        )
        if (!allowed) {
          console.log(
            `[EMAIL-SERVICE] Cola omitida por preferencias (${options.ticketEmailEvent}) user=${options.recipientUserId}`
          )
          return ''
        }
      }

      // Preparar contenido
      let html = options.html || ''
      let text = options.text || ''

      if (options.template && options.templateData) {
        const rendered = await this.renderTemplate(options.template, options.templateData)
        html = rendered.html
        text = rendered.text
      }

      const recipients = Array.isArray(options.to) ? options.to : [options.to]
      const queueIds: string[] = []

      // Crear entrada en cola para cada destinatario
      for (const recipient of recipients) {
        const queueItem = await prisma.email_queue.create({
          data: {
            id: randomUUID(),
            toEmail: recipient,
            subject: options.subject,
            body: html || text,
            templateName: options.template,
            templateData: options.templateData ? JSON.stringify(options.templateData) : null,
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            scheduledAt: options.scheduledAt || new Date()
          }
        })

        queueIds.push(queueItem.id)
      }

      // Registrar en auditoría
      if (userId && queueIds[0]) {
        await AuditServiceComplete.logAction({
          userId,
          action: AuditActionsComplete.EMAIL_QUEUED,
          entityType: 'system',
          entityId: queueIds[0],
          details: {
            to: recipients,
            subject: options.subject,
            template: options.template,
            queueIds,
            ticketEmailEvent: options.ticketEmailEvent,
          }
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
      
      // Obtener emails pendientes que deben enviarse
      const pendingEmails = await prisma.email_queue.findMany({
        where: {
          status: 'pending',
          scheduledAt: { lte: now },
          attempts: { lt: prisma.email_queue.fields.maxAttempts }
        },
        take: 50, // Procesar máximo 50 por lote
        orderBy: { scheduledAt: 'asc' }
      })

      let sent = 0
      let failed = 0

      for (const email of pendingEmails) {
        try {
          // Marcar como enviando
          await prisma.email_queue.update({
            where: { id: email.id },
            data: { 
              status: 'sending',
              attempts: { increment: 1 }
            }
          })

          // Intentar enviar
          const success = await this.sendEmail({
            to: email.toEmail,
            subject: email.subject,
            html: email.body
          })

          if (success) {
            // Marcar como enviado
            await prisma.email_queue.update({
              where: { id: email.id },
              data: {
                status: 'sent',
                sentAt: new Date()
              }
            })
            sent++
          } else {
            throw new Error('Failed to send email')
          }
        } catch (error) {
          // Marcar como fallido o pendiente para reintentar
          const attempts = email.attempts + 1
          const status = attempts >= email.maxAttempts ? 'failed' : 'pending'
          
          await prisma.email_queue.update({
            where: { id: email.id },
            data: {
              status,
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          })

          if (status === 'failed') {
            failed++
          }
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
        text: data.message || 'Notificación del sistema'
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
        error: error instanceof Error ? error.message : 'Unknown error'
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
            { status: 'failed', createdAt: { lt: cutoffDate } }
          ]
        }
      })

      return result.count
    } catch (error) {
      console.error('[EMAIL-SERVICE] Error cleaning up emails:', error)
      return 0
    }
  }
}
