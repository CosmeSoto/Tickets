import nodemailer from 'nodemailer'
import prisma from './prisma'

// Configuración por defecto
const DEFAULT_EMAIL_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true para 465, false para otros puertos
  user: 'internet.freecom@gmail.com',
  from: 'Sistema de Tickets <internet.freecom@gmail.com>',
  enabled: true
}

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password?: string
  from: string
  enabled: boolean
}

// Obtener configuración de email desde BD o usar valores por defecto
async function getEmailConfig(): Promise<EmailConfig> {
  try {
    const settings = await prisma.system_settings.findMany({
      where: {
        key: {
          in: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpSecure', 'emailFrom', 'emailEnabled']
        }
      }
    })

    const config: any = { ...DEFAULT_EMAIL_CONFIG }

    settings.forEach(setting => {
      switch (setting.key) {
        case 'smtpHost':
          config.host = setting.value || DEFAULT_EMAIL_CONFIG.host
          break
        case 'smtpPort':
          config.port = parseInt(setting.value) || DEFAULT_EMAIL_CONFIG.port
          break
        case 'smtpUser':
          config.user = setting.value || DEFAULT_EMAIL_CONFIG.user
          break
        case 'smtpPassword':
          config.password = setting.value
          break
        case 'smtpSecure':
          config.secure = setting.value === 'true'
          break
        case 'emailFrom':
          config.from = setting.value || DEFAULT_EMAIL_CONFIG.from
          break
        case 'emailEnabled':
          config.enabled = setting.value === 'true'
          break
      }
    })

    return config
  } catch (error) {
    console.error('Error loading email config:', error)
    return DEFAULT_EMAIL_CONFIG
  }
}

// Crear transporter de nodemailer
async function createTransporter() {
  const config = await getEmailConfig()

  if (!config.enabled) {
    console.log('Email service is disabled')
    return null
  }

  const transportConfig: any = {
    host: config.host,
    port: config.port,
    secure: config.secure
  }

  // Solo agregar auth si hay contraseña configurada
  if (config.password) {
    transportConfig.auth = {
      user: config.user,
      pass: config.password
    }
  }

  return nodemailer.createTransport(transportConfig)
}

// Interfaz para opciones de email
interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

// Función principal para enviar emails
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const transporter = await createTransporter()

    if (!transporter) {
      console.log('Email not sent: service disabled')
      return false
    }

    const config = await getEmailConfig()

    await transporter.sendMail({
      from: config.from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '') // Fallback a texto plano
    })

    console.log(`Email sent successfully to: ${options.to}`)
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

// Plantillas de email para diferentes eventos

export async function sendTicketCreatedEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    if (!ticket) return false

    const recipients: string[] = []

    // Email al cliente
    if (ticket.users_tickets_clientIdTousers.email) {
      recipients.push(ticket.users_tickets_clientIdTousers.email)
    }

    // Email al técnico asignado (si existe)
    if (ticket.users_tickets_assigneeIdTousers?.email) {
      recipients.push(ticket.users_tickets_assigneeIdTousers.email)
    }

    if (recipients.length === 0) return false

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111827; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nuevo Ticket Creado</h1>
          </div>
          <div class="content">
            <p>Se ha creado un nuevo ticket en el sistema:</p>
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Ticket ID:</span>
                <span class="value">#${ticket.id.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="label">Título:</span>
                <span class="value">${ticket.title}</span>
              </div>
              <div class="info-row">
                <span class="label">Categoría:</span>
                <span class="value">${ticket.categories.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Prioridad:</span>
                <span class="value">${ticket.priority}</span>
              </div>
              <div class="info-row">
                <span class="label">Estado:</span>
                <span class="value">${ticket.status}</span>
              </div>
              <div class="info-row">
                <span class="label">Cliente:</span>
                <span class="value">${ticket.users_tickets_clientIdTousers.name}</span>
              </div>
              ${ticket.users_tickets_assigneeIdTousers ? `
              <div class="info-row">
                <span class="label">Asignado a:</span>
                <span class="value">${ticket.users_tickets_assigneeIdTousers.name}</span>
              </div>
              ` : ''}
            </div>
            <p><strong>Descripción:</strong></p>
            <p>${ticket.description}</p>
            <center>
              <a href="${process.env.NEXTAUTH_URL}/tickets/${ticket.id}" class="button">Ver Ticket</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
            <p>Por favor no responda a este email</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: recipients,
      subject: `Nuevo Ticket: ${ticket.title}`,
      html
    })
  } catch (error) {
    console.error('Error sending ticket created email:', error)
    return false
  }
}

export async function sendCommentAddedEmail(commentId: string) {
  try {
    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
      include: {
        users: {
          select: { name: true, email: true }
        },
        tickets: {
          include: {
            users_tickets_clientIdTousers: {
              select: { name: true, email: true }
            },
            users_tickets_assigneeIdTousers: {
              select: { name: true, email: true }
            }
          }
        }
      }
    })

    if (!comment) return false

    const recipients: string[] = []

    // Email al cliente (si el comentario no es del cliente)
    if (comment.authorId !== comment.tickets.clientId && comment.tickets.users_tickets_clientIdTousers.email) {
      recipients.push(comment.tickets.users_tickets_clientIdTousers.email)
    }

    // Email al técnico asignado (si el comentario no es del técnico)
    if (comment.authorId !== comment.tickets.assigneeId && comment.tickets.users_tickets_assigneeIdTousers?.email) {
      recipients.push(comment.tickets.users_tickets_assigneeIdTousers.email)
    }

    if (recipients.length === 0) return false

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .comment-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
          .author { font-weight: bold; color: #059669; margin-bottom: 10px; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nuevo Comentario en Ticket</h1>
          </div>
          <div class="content">
            <p>Se ha agregado un nuevo comentario al ticket <strong>${comment.tickets.title}</strong>:</p>
            <div class="comment-box">
              <div class="author">${comment.users.name}</div>
              <p>${comment.content}</p>
              <small style="color: #6b7280;">${new Date(comment.createdAt).toLocaleString('es-ES')}</small>
            </div>
            <center>
              <a href="${process.env.NEXTAUTH_URL}/tickets/${comment.ticketId}" class="button">Ver Ticket</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
            <p>Por favor no responda a este email</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: recipients,
      subject: `Nuevo comentario en: ${comment.tickets.title}`,
      html
    })
  } catch (error) {
    console.error('Error sending comment email:', error)
    return false
  }
}

export async function sendTicketStatusChangedEmail(ticketId: string, newStatus: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { name: true, email: true }
        }
      }
    })

    if (!ticket || !ticket.users_tickets_clientIdTousers.email) return false

    const statusLabels: Record<string, string> = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En Progreso',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado'
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Estado del Ticket Actualizado</h1>
          </div>
          <div class="content">
            <p>El estado de tu ticket <strong>${ticket.title}</strong> ha sido actualizado:</p>
            <center>
              <div class="status-badge" style="background: #ddd6fe; color: #6d28d9;">
                ${statusLabels[newStatus] || newStatus}
              </div>
            </center>
            ${newStatus === 'RESOLVED' || newStatus === 'CLOSED' ? `
              <p style="margin-top: 20px;">Tu ticket ha sido ${newStatus === 'RESOLVED' ? 'resuelto' : 'cerrado'}. Si tienes alguna pregunta adicional, no dudes en crear un nuevo ticket.</p>
              ${newStatus === 'CLOSED' ? '<p><strong>¿Te gustaría calificar el servicio recibido?</strong></p>' : ''}
            ` : ''}
            <center>
              <a href="${process.env.NEXTAUTH_URL}/tickets/${ticket.id}" class="button">Ver Ticket</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
            <p>Por favor no responda a este email</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: ticket.users_tickets_clientIdTousers.email,
      subject: `Ticket actualizado: ${ticket.title}`,
      html
    })
  } catch (error) {
    console.error('Error sending status change email:', error)
    return false
  }
}

export async function sendTicketAssignedEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    if (!ticket || !ticket.users_tickets_assigneeIdTousers?.email) return false

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Ticket Asignado</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${ticket.users_tickets_assigneeIdTousers.name}</strong>,</p>
            <p>Se te ha asignado un nuevo ticket:</p>
            <div class="ticket-info">
              <h3>${ticket.title}</h3>
              <p><strong>Categoría:</strong> ${ticket.categories.name}</p>
              <p><strong>Prioridad:</strong> ${ticket.priority}</p>
              <p><strong>Cliente:</strong> ${ticket.users_tickets_clientIdTousers.name}</p>
              <p><strong>Descripción:</strong></p>
              <p>${ticket.description}</p>
            </div>
            <center>
              <a href="${process.env.NEXTAUTH_URL}/tickets/${ticket.id}" class="button">Ver Ticket</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
            <p>Por favor no responda a este email</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: ticket.users_tickets_assigneeIdTousers.email,
      subject: `Nuevo ticket asignado: ${ticket.title}`,
      html
    })
  } catch (error) {
    console.error('Error sending assignment email:', error)
    return false
  }
}

// ⭐ NUEVO: Email al administrador cuando se crea un ticket
export async function sendTicketCreatedToAdminEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    if (!ticket) return false

    // Obtener todos los administradores
    const admins = await prisma.users.findMany({
      where: { 
        role: 'ADMIN',
        isActive: true
      },
      select: { email: true, name: true }
    })

    if (admins.length === 0) return false

    const adminEmails = admins.map(admin => admin.email).filter(Boolean)
    if (adminEmails.length === 0) return false

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111827; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .priority-HIGH { background: #fee2e2; color: #991b1b; }
          .priority-MEDIUM { background: #fef3c7; color: #92400e; }
          .priority-LOW { background: #dbeafe; color: #1e40af; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .action-required { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 Nuevo Ticket Requiere Asignación</h1>
          </div>
          <div class="content">
            <div class="action-required">
              <strong>⚠️ Acción Requerida:</strong> Un nuevo ticket ha sido creado y necesita ser asignado a un técnico.
            </div>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Ticket ID:</span>
                <span class="value">#${ticket.id.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="label">Título:</span>
                <span class="value">${ticket.title}</span>
              </div>
              <div class="info-row">
                <span class="label">Categoría:</span>
                <span class="value">${ticket.categories.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Prioridad:</span>
                <span class="value">
                  <span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span>
                </span>
              </div>
              <div class="info-row">
                <span class="label">Cliente:</span>
                <span class="value">${ticket.users_tickets_clientIdTousers.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Email Cliente:</span>
                <span class="value">${ticket.users_tickets_clientIdTousers.email}</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha Creación:</span>
                <span class="value">${new Date(ticket.createdAt).toLocaleString('es-ES')}</span>
              </div>
            </div>
            
            <p><strong>Descripción del Problema:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
              ${ticket.description}
            </div>
            
            <center>
              <a href="${process.env.NEXTAUTH_URL}/admin/tickets/${ticket.id}" class="button">Asignar Técnico</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
            <p>Por favor asigne este ticket lo antes posible</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: adminEmails,
      subject: `[ADMIN] Nuevo Ticket #${ticket.id.substring(0, 8)} - ${ticket.priority} - Requiere Asignación`,
      html
    })
  } catch (error) {
    console.error('Error sending ticket created to admin email:', error)
    return false
  }
}

// ⭐ NUEVO: Email al técnico cuando se le asigna un ticket
export async function sendTicketAssignedToTechnicianEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true, phone: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    if (!ticket || !ticket.users_tickets_assigneeIdTousers?.email) return false

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0891b2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111827; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .priority-HIGH { background: #fee2e2; color: #991b1b; }
          .priority-MEDIUM { background: #fef3c7; color: #92400e; }
          .priority-LOW { background: #dbeafe; color: #1e40af; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #0891b2; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .client-info { background: #ecfeff; border-left: 4px solid #0891b2; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Nuevo Ticket Asignado</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${ticket.users_tickets_assigneeIdTousers.name}</strong>,</p>
            <p>Se te ha asignado un nuevo ticket. Por favor revisa los detalles y comienza a trabajar en él:</p>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Ticket ID:</span>
                <span class="value">#${ticket.id.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="label">Título:</span>
                <span class="value"><strong>${ticket.title}</strong></span>
              </div>
              <div class="info-row">
                <span class="label">Categoría:</span>
                <span class="value">${ticket.categories.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Prioridad:</span>
                <span class="value">
                  <span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span>
                </span>
              </div>
              <div class="info-row">
                <span class="label">Fecha Creación:</span>
                <span class="value">${new Date(ticket.createdAt).toLocaleString('es-ES')}</span>
              </div>
            </div>
            
            <div class="client-info">
              <strong>📋 Información del Cliente:</strong><br>
              <strong>Nombre:</strong> ${ticket.users_tickets_clientIdTousers.name}<br>
              <strong>Email:</strong> ${ticket.users_tickets_clientIdTousers.email}<br>
              ${ticket.users_tickets_clientIdTousers.phone ? `<strong>Teléfono:</strong> ${ticket.users_tickets_clientIdTousers.phone}<br>` : ''}
            </div>
            
            <p><strong>Descripción del Problema:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
              ${ticket.description}
            </div>
            
            <center>
              <a href="${process.env.NEXTAUTH_URL}/tickets/${ticket.id}" class="button">Ver Ticket y Responder</a>
            </center>
            
            <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
              💡 <strong>Tip:</strong> Responde al cliente lo antes posible para mantener una buena comunicación.
            </p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
            <p>Por favor no responda a este email</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: ticket.users_tickets_assigneeIdTousers.email,
      subject: `[ASIGNADO] Ticket #${ticket.id.substring(0, 8)} - ${ticket.title}`,
      html
    })
  } catch (error) {
    console.error('Error sending ticket assigned to technician email:', error)
    return false
  }
}

// ⭐ NUEVO: Email al cliente cuando se le asigna un técnico a su ticket
export async function sendTicketAssignedToClientEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    if (!ticket || !ticket.users_tickets_clientIdTousers.email || !ticket.users_tickets_assigneeIdTousers) return false

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111827; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .tech-info { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Técnico Asignado a tu Ticket</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${ticket.users_tickets_clientIdTousers.name}</strong>,</p>
            <p>Buenas noticias! Tu ticket ha sido asignado a un técnico especializado que comenzará a trabajar en tu solicitud.</p>
            
            <div class="tech-info">
              <strong>👨‍💻 Técnico Asignado:</strong><br>
              <strong>${ticket.users_tickets_assigneeIdTousers.name}</strong><br>
              ${ticket.users_tickets_assigneeIdTousers.email}
            </div>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Ticket ID:</span>
                <span class="value">#${ticket.id.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="label">Título:</span>
                <span class="value">${ticket.title}</span>
              </div>
              <div class="info-row">
                <span class="label">Categoría:</span>
                <span class="value">${ticket.categories.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Estado:</span>
                <span class="value">En Progreso</span>
              </div>
            </div>
            
            <p>El técnico revisará tu solicitud y se pondrá en contacto contigo pronto. Recibirás notificaciones por email cuando haya actualizaciones.</p>
            
            <center>
              <a href="${process.env.NEXTAUTH_URL}/tickets/${ticket.id}" class="button">Ver Estado del Ticket</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
            <p>Por favor no responda a este email</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: ticket.users_tickets_clientIdTousers.email,
      subject: `Técnico asignado a tu ticket: ${ticket.title}`,
      html
    })
  } catch (error) {
    console.error('Error sending ticket assigned to client email:', error)
    return false
  }
}

// ⭐ NUEVO: Email al administrador cuando se resuelve un ticket
export async function sendTicketResolvedToAdminEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    if (!ticket) return false

    // Obtener todos los administradores
    const admins = await prisma.users.findMany({
      where: { 
        role: 'ADMIN',
        isActive: true
      },
      select: { email: true, name: true }
    })

    if (admins.length === 0) return false

    const adminEmails = admins.map(admin => admin.email).filter(Boolean)
    if (adminEmails.length === 0) return false

    // Calcular tiempo de resolución
    const resolutionTime = ticket.resolvedAt 
      ? Math.round((ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
      : 0

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111827; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .success-badge { background: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Ticket Resuelto</h1>
          </div>
          <div class="content">
            <div class="success-badge">
              <strong>✓ Ticket Completado:</strong> El ticket ha sido marcado como resuelto.
            </div>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Ticket ID:</span>
                <span class="value">#${ticket.id.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="label">Título:</span>
                <span class="value">${ticket.title}</span>
              </div>
              <div class="info-row">
                <span class="label">Categoría:</span>
                <span class="value">${ticket.categories.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Cliente:</span>
                <span class="value">${ticket.users_tickets_clientIdTousers.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Técnico:</span>
                <span class="value">${ticket.users_tickets_assigneeIdTousers?.name || 'No asignado'}</span>
              </div>
              <div class="info-row">
                <span class="label">Tiempo de Resolución:</span>
                <span class="value">${resolutionTime} horas</span>
              </div>
              <div class="info-row">
                <span class="label">Fecha Resolución:</span>
                <span class="value">${ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString('es-ES') : 'N/A'}</span>
              </div>
            </div>
            
            <center>
              <a href="${process.env.NEXTAUTH_URL}/admin/tickets/${ticket.id}" class="button">Ver Detalles</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: adminEmails,
      subject: `[ADMIN] Ticket Resuelto #${ticket.id.substring(0, 8)} - ${ticket.title}`,
      html
    })
  } catch (error) {
    console.error('Error sending ticket resolved to admin email:', error)
    return false
  }
}

// ⭐ NUEVO: Email al administrador cuando el cliente califica el servicio
export async function sendRatingToAdminEmail(ticketId: string, rating: number) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    if (!ticket) return false

    // Obtener la calificación
    const ratingData = await prisma.ticket_ratings.findUnique({
      where: { ticketId },
      select: {
        rating: true,
        feedback: true,
        responseTime: true,
        technicalSkill: true,
        communication: true,
        problemResolution: true
      }
    })

    if (!ratingData) return false

    // Obtener todos los administradores
    const admins = await prisma.users.findMany({
      where: { 
        role: 'ADMIN',
        isActive: true
      },
      select: { email: true, name: true }
    })

    if (admins.length === 0) return false

    const adminEmails = admins.map(admin => admin.email).filter(Boolean)
    if (adminEmails.length === 0) return false

    const stars = '⭐'.repeat(rating)
    const ratingColor = rating >= 4 ? '#059669' : rating >= 3 ? '#f59e0b' : '#dc2626'

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${ratingColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111827; }
          .rating-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center; }
          .rating-stars { font-size: 32px; margin: 10px 0; }
          .rating-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .rating-item { display: flex; justify-content: space-between; padding: 8px 0; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: ${ratingColor}; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⭐ Nueva Calificación Recibida</h1>
          </div>
          <div class="content">
            <p>Un cliente ha calificado el servicio recibido:</p>
            
            <div class="rating-box">
              <div class="rating-stars">${stars}</div>
              <h2 style="margin: 10px 0; color: ${ratingColor};">${rating}/5</h2>
            </div>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Ticket ID:</span>
                <span class="value">#${ticket.id.substring(0, 8)}</span>
              </div>
              <div class="info-row">
                <span class="label">Título:</span>
                <span class="value">${ticket.title}</span>
              </div>
              <div class="info-row">
                <span class="label">Cliente:</span>
                <span class="value">${ticket.users_tickets_clientIdTousers.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Técnico:</span>
                <span class="value">${ticket.users_tickets_assigneeIdTousers?.name || 'No asignado'}</span>
              </div>
            </div>
            
            <div class="rating-details">
              <h3 style="margin-top: 0;">Detalles de la Calificación:</h3>
              <div class="rating-item">
                <span>Tiempo de Respuesta:</span>
                <span><strong>${ratingData.responseTime}/5</strong></span>
              </div>
              <div class="rating-item">
                <span>Habilidad Técnica:</span>
                <span><strong>${ratingData.technicalSkill}/5</strong></span>
              </div>
              <div class="rating-item">
                <span>Comunicación:</span>
                <span><strong>${ratingData.communication}/5</strong></span>
              </div>
              <div class="rating-item">
                <span>Resolución del Problema:</span>
                <span><strong>${ratingData.problemResolution}/5</strong></span>
              </div>
            </div>
            
            ${ratingData.feedback ? `
              <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                <strong>Comentarios del Cliente:</strong>
                <p style="margin: 10px 0 0 0;">${ratingData.feedback}</p>
              </div>
            ` : ''}
            
            <center>
              <a href="${process.env.NEXTAUTH_URL}/admin/tickets/${ticket.id}" class="button">Ver Ticket Completo</a>
            </center>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del Sistema de Tickets</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: adminEmails,
      subject: `[ADMIN] Nueva Calificación ${stars} - Ticket #${ticket.id.substring(0, 8)}`,
      html
    })
  } catch (error) {
    console.error('Error sending rating to admin email:', error)
    return false
  }
}
