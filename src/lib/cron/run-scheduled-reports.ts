/**
 * Reportes programados de inventario.
 * Adjuntos requieren SMTP directo (email_queue no soporta attachments).
 * Igual respeta SMTP unificado + prefs inventario.
 */

import nodemailer from 'nodemailer'
import type { ReportExportFormat } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { InventoryScheduledReportService } from '@/lib/services/inventory-scheduled-report.service'
import { runSavedReportById } from '@/lib/inventory/reports/run-saved-report'
import {
  computeNextRunAt,
  exportFormatLabel,
  frequencyLabel,
} from '@/lib/inventory/reports/schedule-utils'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { getUnifiedSmtpConfig, isSystemEmailEnabled } from '@/lib/services/email/smtp-config'
import { canSendNotificationEmail } from '@/lib/notifications/email-prefs'

async function filterReportRecipients(emails: string[]): Promise<string[]> {
  const unique = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))]
  if (!unique.length) return []

  const users = await prisma.users.findMany({
    where: {
      isActive: true,
      OR: unique.map(email => ({ email: { equals: email, mode: 'insensitive' as const } })),
    },
    select: { id: true, email: true },
  })
  const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u.id]))

  const allowed: string[] = []
  for (const email of unique) {
    const userId = byEmail.get(email)
    if (userId) {
      const ok = await canSendNotificationEmail(userId, {
        module: 'inventory',
        event: 'inventoryReport',
        priority: 'important',
      })
      if (ok) allowed.push(email)
    } else {
      // Destinatario externo configurado en el schedule
      allowed.push(email)
    }
  }
  return allowed
}

async function sendReportEmail(options: {
  to: string[]
  subject: string
  html: string
  csv?: string
  pdf?: Buffer
  baseFilename: string
  exportFormat: ReportExportFormat
}) {
  if (!(await isSystemEmailEnabled())) {
    throw new Error('SMTP desactivado o sin configurar')
  }
  const smtp = await getUnifiedSmtpConfig()
  if (!smtp?.host) {
    throw new Error('SMTP no configurado')
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.password ? { user: smtp.user, pass: smtp.password } : undefined,
  })

  const safeName =
    options.baseFilename.replace(/[^a-zA-Z0-9-_áéíóúñ ]/gi, '').trim() || 'reporte'

  const attachments: nodemailer.SendMailOptions['attachments'] = []
  if (
    (options.exportFormat === 'CSV' || options.exportFormat === 'BOTH') &&
    options.csv
  ) {
    attachments.push({
      filename: `${safeName}.csv`,
      content: options.csv,
      contentType: 'text/csv; charset=utf-8',
    })
  }
  if (
    (options.exportFormat === 'PDF' || options.exportFormat === 'BOTH') &&
    options.pdf
  ) {
    attachments.push({
      filename: `${safeName}.pdf`,
      content: options.pdf,
      contentType: 'application/pdf',
    })
  }

  if (!attachments.length) {
    throw new Error('No hay archivos para adjuntar según el formato configurado')
  }

  const recipients = await filterReportRecipients(options.to)
  if (!recipients.length) {
    throw new Error('Sin destinatarios tras preferencias de correo / inventario')
  }

  for (const recipient of recipients) {
    await transporter.sendMail({
      from: smtp.from,
      to: recipient,
      subject: options.subject,
      html: options.html,
      attachments,
    })
  }
}

export async function runScheduledInventoryReports(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const due = await InventoryScheduledReportService.listDue()
  let sent = 0
  let failed = 0

  for (const schedule of due) {
    const nextRunAt = computeNextRunAt({
      frequency: schedule.frequency,
      scheduleTime: schedule.scheduleTime,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
    })

    try {
      const result = await runSavedReportById(schedule.savedReportId)
      if (!result) {
        throw new Error('No se pudo ejecutar el reporte guardado')
      }

      const recipients =
        (schedule.recipients as string[])?.length > 0
          ? (schedule.recipients as string[])
          : schedule.owner.email
            ? [schedule.owner.email]
            : []

      if (!recipients.length) {
        throw new Error('Sin destinatarios configurados')
      }

      const exportFormat = schedule.exportFormat ?? 'BOTH'
      const formatLabel = exportFormatLabel(exportFormat)

      const summaryHtml = result.summary
        .slice(0, 3)
        .map(s => `<li><strong>${s.title}:</strong> ${s.value}</li>`)
        .join('')

      await sendReportEmail({
        to: recipients,
        subject: `[Inventario] Reporte programado: ${result.reportName}`,
        html: `
          <p>Hola ${schedule.owner.name},</p>
          <p>Adjunto encontrarás el reporte <strong>${result.reportName}</strong> (${formatLabel}, ${result.rowCount} registros).</p>
          <ul>${summaryHtml}</ul>
          <p>Frecuencia: ${frequencyLabel(schedule.frequency)} a las ${schedule.scheduleTime}</p>
          <p style="color:#666;font-size:12px">Generado automáticamente por el Centro de Reportes.</p>
        `,
        csv: result.csv,
        pdf: result.pdf,
        baseFilename: result.reportName,
        exportFormat,
      })

      await InventoryScheduledReportService.markRunResult(schedule.id, {
        success: true,
        nextRunAt,
      })

      await AuditServiceComplete.logAction({
        userId: schedule.userId,
        action: AuditActionsComplete.REPORT_SCHEDULED,
        entityType: 'report',
        entityId: schedule.id,
        details: {
          savedReportId: schedule.savedReportId,
          recipients,
          rowCount: result.rowCount,
          exportFormat,
        },
      })

      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      await InventoryScheduledReportService.markRunResult(schedule.id, {
        success: false,
        error: message,
        nextRunAt,
      })
      failed += 1
      console.error(`[SCHEDULED-REPORTS] Error schedule ${schedule.id}:`, message)
    }
  }

  return { processed: due.length, sent, failed }
}
