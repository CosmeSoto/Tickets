/**
 * Servicio Profesional de Email
 * Maneja envío de emails con cola, reintentos y templates
 */

import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '../audit-service-complete'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  template?: string
  templateData?: Record<string, any>
  priority?: 'high' | 'normal' | 'low'
  scheduledAt?: Date
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

  /**
   * Inicializa el transporter de email
   */
  private static async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter && this.isConfigured) {
      return this.transporter
    }

    // Obtener configuración SMTP desde la base de datos
    const smtpConfig = await this.getSMTPConfig()

    if (!smtpConfig) {
      throw new Error('Configuración SMTP no encontrada. Configure el email en Admin > Configuración')
    }

    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password
      },
      pool: true, // Usar pool de conexiones
      maxConnections: 5,
      maxMessages: 100
    })

    this.isConfigured = true
    return this.transporter
  }

  /**
   * Obtiene configuración SMTP desde la base de datos
   */
  private static async getSMTPConfig() {
    try {
      const settings = await prisma.system_settings.findMany({
        where: {
          key: {
            in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_secure', 'email_from']
          }
        }
      })

      if (settings.length === 0) {
        return null
      }

      const config: Record<string, any> = {}
      settings.forEach(setting => {
        config[setting.key] = setting.value
      })

      return {
        host: config.smtp_host,
        port: parseInt(config.smtp_port || '587'),
        secure: config.smtp_secure === 'true',
        user: config.smtp_user,
        password: config.smtp_password,
        from: config.email_from || config.smtp_user
      }
    } catch (error) {
      console.error('[EMAIL-SERVICE] Error getting SMTP config:', error)
      return null
    }
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
      if (userId) {
        await AuditServiceComplete.logAction({
          userId,
          action: AuditActionsComplete.EMAIL_QUEUED,
          entityType: 'system',
          entityId: queueIds[0],
          details: {
            to: recipients,
            subject: options.subject,
            template: options.template,
            queueIds
          }
        })
      }

      return queueIds[0]
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
    // Importar template dinámicamente
    try {
      const template = await import(`./templates/${templateName}`)
      return template.default(data)
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
